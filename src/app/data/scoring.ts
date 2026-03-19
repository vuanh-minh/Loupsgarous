import type { GameState, Player } from '../context/gameTypes';
import { getRoleById } from './roles';

/* ================================================================
   Scoring — computes end-of-game scores for each player.

   Base rules:
     - Winner team    : +10 pts
     - Alive at end   : + 5 pts
     - Days passed    : +0.5 pt per day (ceil)

   Bonus rules:
     - Quête réussie        : +3 pts per completed individual quest
     - Sorcière Poison fatal: +2 pts if witch kill target is a werewolf
     - Chasseur Tir juste   : +3 pts if hunter kills an enemy
     - Cupidon Amour tragique: +3 pts if lovers win (for cupid)
     - Renard Flair          : +2 pts per fox sniff that found a wolf
     - Bon vote             : +1 pts per vote that led to eliminating an enemy
                               (wolves excluded)
     - Maire élu             : +2 pts for the elected maire
     - Hypothèse correcte    : +2 pts per correct role hypothesis
                               (wolves: +3 pts per special role to compensate)
     - Première victime      : +3 pts consolation for first eliminated
     - Participation parfaite: +1 pt if 0 missed day votes
   ================================================================ */

export interface BonusDetail {
  label: string;
  emoji: string;
  points: number;
}

export interface PlayerScore {
  playerId: number;
  name: string;
  avatar: string;
  role: string;
  alive: boolean;
  isWinner: boolean;
  /* Base points */
  winnerPoints: number;
  alivePoints: number;
  dayPoints: number;
  /* Bonus points */
  bonusPoints: number;
  bonuses: BonusDetail[];
  /* Total */
  total: number;
}

/* ── helpers ── */

const WOLF_ROLE_IDS = new Set(['loup-garou']);
const TRIVIAL_ROLE_IDS = new Set(['villageois', 'loup-garou']);

function isPlayerWinner(player: Player, state: GameState): boolean {
  const { winner, loverPairs } = state;
  if (!winner) return false;

  if (winner === 'lovers') {
    for (const [id1, id2] of loverPairs) {
      if (player.id === id1 || player.id === id2) return true;
    }
    return false;
  }

  const roleDef = getRoleById(player.role);
  if (!roleDef) return false;

  if (winner === 'village') return roleDef.team === 'village';
  if (winner === 'werewolf') return roleDef.team === 'werewolf';
  return false;
}

function getPlayerTeam(player: Player): 'village' | 'werewolf' | 'solo' | null {
  return getRoleById(player.role)?.team ?? null;
}

function isEnemy(voterTeam: string | null, targetTeam: string | null): boolean {
  if (!voterTeam || !targetTeam) return false;
  if (voterTeam === 'village' && targetTeam === 'werewolf') return true;
  if (voterTeam === 'werewolf' && targetTeam === 'village') return true;
  return false;
}

/** Find the very first player who died in the game (from phaseDeathHistory). */
function findFirstVictimId(state: GameState): number | null {
  const history = state.phaseDeathHistory;
  if (history && history.length > 0) {
    const first = history[0];
    if (first.deadPlayerIds.length > 0) return first.deadPlayerIds[0];
  }
  // Fallback: first eliminated from voteHistory
  for (const vh of state.voteHistory) {
    if (vh.eliminated != null) return vh.eliminated;
  }
  return null;
}

/* ── bonus computation per player ── */

function computeBonuses(player: Player, state: GameState, firstVictimId: number | null): BonusDetail[] {
  const bonuses: BonusDetail[] = [];
  const playerMap = new Map(state.players.map(p => [p.id, p]));
  const playerTeam = getPlayerTeam(player);

  // 1. Quête réussie (+3 per completed quest)
  const assignedQuestIds = state.questAssignments?.[player.id] ?? [];
  let completedQuests = 0;
  for (const qid of assignedQuestIds) {
    const quest = state.quests?.find(q => q.id === qid);
    if (quest && quest.playerStatuses?.[player.id] === 'success') {
      completedQuests++;
    }
  }
  if (completedQuests > 0) {
    bonuses.push({
      label: `Quête${completedQuests > 1 ? 's' : ''} réussie${completedQuests > 1 ? 's' : ''} (×${completedQuests})`,
      emoji: '🎯',
      points: completedQuests * 3,
    });
  }

  // 2. Sorcière — Poison fatal (+2 if witch kill target is a werewolf)
  if (player.role === 'sorciere') {
    const killTargetId = state.witchKillTargets?.[player.id];
    if (killTargetId != null) {
      const target = playerMap.get(killTargetId);
      if (target) {
        const targetRole = getRoleById(target.role);
        if (targetRole && targetRole.team === 'werewolf') {
          bonuses.push({ label: 'Poison fatal', emoji: '🧪', points: 2 });
        }
      }
    }
  }

  // 3. Chasseur — Tir juste (+3 if hunter kills an enemy)
  if (player.role === 'chasseur' && state.hunterShooterId === player.id) {
    const targetId = state.hunterPreTargets?.[player.id];
    if (targetId != null) {
      const target = playerMap.get(targetId);
      if (target) {
        const targetTeam = getPlayerTeam(target);
        if (isEnemy(playerTeam, targetTeam)) {
          bonuses.push({ label: 'Tir juste', emoji: '🎯', points: 3 });
        }
      }
    }
  }

  // 4. Cupidon — Amour tragique (+3 if lovers win)
  if (player.role === 'cupidon' && state.winner === 'lovers') {
    bonuses.push({ label: 'Amour tragique', emoji: '💘', points: 3 });
  }

  // 5. Renard — Flair du renard (+2 per positive sniff)
  if (player.role === 'renard') {
    const foxResult = state.foxResults?.[player.id];
    // foxResults is boolean per fox — but we might have multiple sniffs tracked in events
    // foxResults[foxId] = true if at least 1 wolf found in last sniff
    // For simplicity, count all positive fox results across the game
    // Actually foxResults is per-fox single boolean. Let's count from events instead.
    // Since foxResults only stores the latest result, let's check events for fox sniff results.
    let foxPositiveCount = 0;
    for (const evt of state.events) {
      if (
        evt.message.includes(`Renard`) &&
        evt.message.includes(`détecté`) &&
        evt.message.includes(`loup`)
      ) {
        // Count events that indicate this fox found a wolf
        foxPositiveCount++;
      }
    }
    // Fallback: if no events matched but foxResults is true, count at least 1
    if (foxPositiveCount === 0 && foxResult === true) {
      foxPositiveCount = 1;
    }
    if (foxPositiveCount > 0) {
      bonuses.push({
        label: `Flair du renard (×${foxPositiveCount})`,
        emoji: '🦊',
        points: foxPositiveCount * 2,
      });
    }
  }

  // 6. Bon vote (+1 per vote that led to eliminating an enemy)
  //    Wolves are excluded — they already know who the enemies are.
  let goodVotes = 0;
  if (playerTeam !== 'werewolf') {
    for (const vh of state.voteHistory) {
      const eliminatedId = vh.eliminated;
      if (eliminatedId == null) continue;
      const votedForId = vh.votes?.[player.id];
      if (votedForId !== eliminatedId) continue;
      const target = playerMap.get(eliminatedId);
      if (target) {
        const targetTeam = getPlayerTeam(target);
        if (isEnemy(playerTeam, targetTeam)) {
          goodVotes++;
        }
      }
    }
  }
  if (goodVotes > 0) {
    bonuses.push({
      label: `Bon vote${goodVotes > 1 ? 's' : ''} (×${goodVotes})`,
      emoji: '🗳️',
      points: goodVotes * 1,
    });
  }

  // 7. Maire élu (+2)
  if (state.maireId === player.id) {
    bonuses.push({ label: 'Maire élu', emoji: '🎖️', points: 2 });
  }

  // 8. Hypothèse correcte (+2 per correct guess)
  //    For werewolf players: only count special roles (not villageois, not loup-garou)
  const playerHypotheses = state.hypotheses?.[player.id];
  if (playerHypotheses) {
    let correctGuesses = 0;
    for (const [targetIdStr, guessedRole] of Object.entries(playerHypotheses)) {
      const targetId = Number(targetIdStr);
      if (targetId === player.id) continue; // skip self-hypothesis
      const target = playerMap.get(targetId);
      if (!target) continue;
      if (target.role === guessedRole) {
        // For wolf players, only count non-trivial roles
        if (playerTeam === 'werewolf' && TRIVIAL_ROLE_IDS.has(guessedRole)) continue;
        correctGuesses++;
      }
    }
    if (correctGuesses > 0) {
      bonuses.push({
        label: `Hypothèse${correctGuesses > 1 ? 's' : ''} correcte${correctGuesses > 1 ? 's' : ''} (×${correctGuesses})`,
        emoji: '🧠',
        points: correctGuesses * (playerTeam === 'werewolf' ? 3 : 2),
      });
    }
  }

  // 9. Première victime (+3 consolation)
  if (firstVictimId === player.id) {
    bonuses.push({ label: 'Première victime', emoji: '💀', points: 3 });
  }

  // 11. Participation parfaite (+1 if 0 missed day votes)
  const missedVotes = state.villagerMissedVotes?.[player.id] ?? 0;
  if (missedVotes === 0 && state.turn >= 1) {
    bonuses.push({ label: 'Participation parfaite', emoji: '✅', points: 1 });
  }

  return bonuses;
}

/* ── main export ── */

/**
 * Compute scores for every player in the game.
 * Returns an array sorted by total descending, then by name.
 */
export function computeScores(state: GameState): PlayerScore[] {
  const days = Math.max(0, state.turn);
  const firstVictimId = findFirstVictimId(state);

  return state.players
    .map((player) => {
      const isWinner = isPlayerWinner(player, state);
      const winnerPoints = isWinner ? 10 : 0;
      const alivePoints = player.alive ? 5 : 0;
      const dayPoints = Math.ceil(days * 0.5);

      const bonuses = computeBonuses(player, state, firstVictimId);
      const bonusPoints = bonuses.reduce((sum, b) => sum + b.points, 0);

      const total = winnerPoints + alivePoints + dayPoints + bonusPoints;

      return {
        playerId: player.id,
        name: player.name,
        avatar: player.avatar,
        role: player.role,
        alive: player.alive,
        isWinner,
        winnerPoints,
        alivePoints,
        dayPoints,
        bonusPoints,
        bonuses,
        total,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}