import {
  type Player, type GameState,
  type GameEvent, type Quest, type Hint, type PlayerHint,
} from '../../../context/gameTypes';
import { getRoleById, type RoleDefinition } from '../../../data/roles';
import { nextHintId } from '../../HintComponents';

/* ================================================================
   gmPureHelpers — pure functions & types for GM game logic.
   No hooks, no side-effects.  Extracted from useGMGameLogic.ts.
   ================================================================ */

// ── Types ────────────────────────────────────────────────────────

/** Describes one night-role action card in the GM dashboard. */
export interface NightAction {
  id: string;
  emoji: string;
  label: string;
  color: string;
  done: boolean;
  /** Verbose detail string (desktop). */
  detail: string;
  /** Compact detail string (mobile). */
  compactDetail: string;
  players: Player[];
}

/** Per-player status for a night action picker. */
export interface PlayerActionStatus {
  done: boolean;
  detail: string;
}

/** Computed vote tracking data for the GM dashboard. */
export interface VoteData {
  totalAlive: number;
  totalVotes: number;
  voteCounts: Record<number, number>;
  ranking: Array<{ player: Player; count: number }>;
  voterDetails: Array<{
    voter: Player | undefined;
    target: Player | undefined;
    isRandom: boolean;
    isMaire: boolean;
    isLastWill: boolean;
  }>;
  maireVoteTargetId: number | null;
  maxCount: number;
  isVoteResult: boolean;
  eliminatedPlayer: Player | undefined;
  eliminatedRole: RoleDefinition | null;
  /** All eliminated players (multi-elimination support) */
  eliminatedPlayers: Player[];
  eliminatedRoles: (RoleDefinition | null)[];
}

// ── Pure helpers ─────────────────────────────────────────────────

/**
 * Compute per-player done/detail status for a given night action.
 * Used by the night-action picker modal.
 */
export function getPlayerStatuses(
  state: GameState,
  actionId: string,
  actionPlayers: Player[],
): Record<number, PlayerActionStatus> {
  const statuses: Record<number, PlayerActionStatus> = {};
  for (const p of actionPlayers) {
    switch (actionId) {
      case 'werewolves': {
        const targetId = state.werewolfVotes?.[p.id];
        statuses[p.id] = targetId !== undefined
          ? { done: true, detail: 'A vote' }
          : { done: false, detail: 'En attente de vote' };
        break;
      }
      case 'seer': {
        const tid = state.seerTargets?.[p.id];
        const target = tid !== undefined ? state.players.find((pl) => pl.id === tid) : null;
        const targetEmoji = target ? (getRoleById(target.role)?.emoji || '') : '';
        statuses[p.id] = tid !== undefined
          ? { done: true, detail: `A sonde \u2192 ${target?.name || '?'} (${targetEmoji})` }
          : { done: false, detail: 'En attente' };
        break;
      }
      case 'witch': {
        const healed = !!(state.witchHealedThisNight || {})[p.id];
        const killed = state.witchKillTargets?.[p.id] !== undefined;
        if (healed || killed) {
          const parts: string[] = [];
          if (healed) parts.push('Guerison');
          if (killed) {
            const kt = state.players.find((pl) => pl.id === state.witchKillTargets?.[p.id]);
            const ktEmoji = kt ? (getRoleById(kt.role)?.emoji || '') : '';
            parts.push(`Poison \u2192 ${kt?.name || '?'} (${ktEmoji})`);
          }
          statuses[p.id] = { done: true, detail: parts.join(' \u00b7 ') };
        } else {
          statuses[p.id] = { done: false, detail: 'Aucune potion utilisee' };
        }
        break;
      }
      case 'guard': {
        const gid = state.guardTargets?.[p.id];
        const target = gid !== undefined ? state.players.find((pl) => pl.id === gid) : null;
        const targetEmoji = target ? (getRoleById(target.role)?.emoji || '') : '';
        statuses[p.id] = gid !== undefined
          ? { done: true, detail: `Protege \u2192 ${target?.name || '?'} (${targetEmoji})` }
          : { done: false, detail: 'En attente' };
        break;
      }
      case 'cupidon': {
        const linked = (state.cupidLinkedBy || []).length > 0;
        statuses[p.id] = linked
          ? { done: true, detail: 'Amoureux lies' }
          : { done: false, detail: 'En attente du lien' };
        break;
      }
      case 'corbeau': {
        const ctid = state.corbeauTargets?.[p.id];
        const target = ctid !== undefined ? state.players.find((pl) => pl.id === ctid) : null;
        const corbeauTgtEmoji = target ? (getRoleById(target.role)?.emoji || '') : '';
        const msg = (state.corbeauMessages ?? {})[p.id] || '';
        const corbeauDetailStr = `\u2192 ${target ? target.name : '?'} (${corbeauTgtEmoji})${msg ? ': ' + msg : ''}`;
        statuses[p.id] = ctid !== undefined
          ? { done: true, detail: corbeauDetailStr }
          : { done: false, detail: 'En attente' };
        break;
      }
      case 'petite-fille':
        statuses[p.id] = { done: true, detail: 'Role passif' };
        break;
      default:
        statuses[p.id] = { done: false, detail: '' };
    }
  }
  return statuses;
}

/**
 * Build the array of night-action cards for the GM dashboard.
 * Returns both verbose (desktop) and compact (mobile) detail strings.
 */
export function buildNightActions(
  state: GameState,
  hasRole: (id: string) => boolean,
  alivePlayers: Player[],
): NightAction[] {
  const actions: NightAction[] = [];
  const aliveWolves = alivePlayers.filter((p) => p.role === 'loup-garou');
  const wolfVoteCount = Object.keys(state.werewolfVotes).length;

  // ── Cupidon (turn 1 only) ──
  if (hasRole('cupidon')) {
    const cupidLinked = (state.cupidLinkedBy || []).length > 0;
    const cupidPlayers = state.players.filter((p) => p.alive && p.role === 'cupidon');
    if (!cupidLinked) {
      actions.push({
        id: 'cupidon', emoji: '\uD83D\uDC98', label: 'Cupidon', color: '#ec4899',
        done: false, players: cupidPlayers,
        detail: 'En attente du lien amoureux',
        compactDetail: 'En attente',
      });
    } else {
      const pairsStr = (state.loverPairs || []).map((pair: [number, number]) => {
        const l1 = state.players.find((p) => p.id === pair[0]);
        const l2 = state.players.find((p) => p.id === pair[1]);
        return `${l1?.name || '?'} \u2764\uFE0F ${l2?.name || '?'}`;
      }).join(' | ');
      actions.push({
        id: 'cupidon', emoji: '\uD83D\uDC98', label: 'Cupidon', color: '#ec4899',
        done: true, players: cupidPlayers,
        detail: pairsStr || 'Amoureux lies',
        compactDetail: 'Lie',
      });
    }
  }

  // ── Loups-Garous ──
  const wolfVerbose = wolfVoteCount > 0
    ? (() => {
        const maxKills = Math.max(1, state.wolfKillsPerNight || 1);
        const counts: Record<number, number> = {};
        Object.values(state.werewolfVotes).forEach((tid: number) => { counts[tid] = (counts[tid] || 0) + 1; });
        const topEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, maxKills);
        const namesStr = topEntries.map(([id, vc]) => {
          const tp = state.players.find((p) => p.id === parseInt(id));
          const tpEmoji = tp ? (getRoleById(tp.role)?.emoji || '') : '';
          return `${tp?.name || '?'} (${tpEmoji}) (${vc})`;
        }).join(', ');
        return `${wolfVoteCount}/${aliveWolves.length} vote(s) \u2014 ${namesStr}${(state.wolfKillsPerNight || 1) > 1 ? ` [max ${state.wolfKillsPerNight} victimes]` : ''}`;
      })()
    : `0/${aliveWolves.length} vote(s)${(state.wolfKillsPerNight || 1) > 1 ? ` [max ${state.wolfKillsPerNight} victimes]` : ''}`;
  actions.push({
    id: 'werewolves', emoji: '\uD83D\uDC3A', label: 'Loups-Garous', color: '#c41e3a',
    done: wolfVoteCount >= aliveWolves.length, players: aliveWolves,
    detail: wolfVerbose,
    compactDetail: `${wolfVoteCount}/${aliveWolves.length} vote(s)${(state.wolfKillsPerNight || 1) > 1 ? ` [max ${state.wolfKillsPerNight}]` : ''}`,
  });

  // ── Voyante ──
  if (hasRole('voyante')) {
    const seerCount = Object.keys(state.seerTargets || {}).length;
    const totalSeers = state.players.filter((p) => p.alive && p.role === 'voyante').length;
    const seerNames = Object.entries(state.seerTargets || {}).map(([, tid]) => {
      const tp = state.players.find((p) => p.id === tid);
      const tpEmoji = tp ? (getRoleById(tp.role)?.emoji || '') : '';
      return `${tp?.name || '?'} (${tpEmoji})`;
    }).join(', ');
    actions.push({
      id: 'seer', emoji: '\uD83D\uDD2E', label: 'Voyante', color: '#8b5cf6',
      done: seerCount >= totalSeers,
      players: state.players.filter((p) => p.alive && p.role === 'voyante'),
      detail: seerCount > 0 ? `${seerCount}/${totalSeers} \u2014 Sonde: ${seerNames}` : `0/${totalSeers} \u2014 En attente`,
      compactDetail: seerCount > 0 ? `${seerCount}/${totalSeers}` : 'Attente',
    });
  }

  // ── Sorciere ──
  if (hasRole('sorciere')) {
    const witchHealCount = Object.keys(state.witchHealedThisNight || {}).length;
    const witchKillCount = Object.keys(state.witchKillTargets || {}).length;
    const totalWitches = state.players.filter((p) => p.alive && p.role === 'sorciere').length;
    const witchActedIds = new Set([
      ...Object.keys(state.witchHealedThisNight || {}),
      ...Object.keys(state.witchKillTargets || {}),
    ]);
    const healIcon = witchHealCount > 0 ? '\uD83D\uDD34' : '\uD83D\uDFE2';
    const killIcon = witchKillCount > 0 ? '\uD83D\uDD34' : '\uD83D\uDFE2';
    actions.push({
      id: 'witch', emoji: '\uD83E\uDDD9\u200D\u2640\uFE0F', label: 'Sorciere', color: '#10b981',
      done: witchActedIds.size >= totalWitches,
      players: state.players.filter((p) => p.alive && p.role === 'sorciere'),
      detail: `${healIcon} Guerison (${witchHealCount}) \u00b7 ${killIcon} Poison (${witchKillCount})`,
      compactDetail: `${healIcon} (${witchHealCount}) \u00b7 ${killIcon} (${witchKillCount})`,
    });
  }

  // ── Garde ──
  if (hasRole('garde')) {
    const guardCount = Object.keys(state.guardTargets || {}).length;
    const totalGuards = state.players.filter((p) => p.alive && p.role === 'garde').length;
    const guardNames = Object.values(state.guardTargets || {}).map((tid: number) => {
      const gp = state.players.find((p) => p.id === tid);
      const gpEmoji = gp ? (getRoleById(gp.role)?.emoji || '') : '';
      return `${gp?.name || '?'} (${gpEmoji})`;
    }).join(', ');
    actions.push({
      id: 'guard', emoji: '\uD83D\uDEE1\uFE0F', label: 'Garde', color: '#3b82f6',
      done: guardCount >= totalGuards,
      players: state.players.filter((p) => p.alive && p.role === 'garde'),
      detail: guardCount > 0 ? `${guardCount}/${totalGuards} \u2014 Protege: ${guardNames}` : `0/${totalGuards} \u2014 En attente`,
      compactDetail: guardCount > 0 ? `${guardCount}/${totalGuards}` : 'Attente',
    });
  }

  // ── Petite Fille ──
  if (hasRole('petite-fille')) {
    actions.push({
      id: 'petite-fille', emoji: '\uD83D\uDC67', label: 'Petite Fille', color: '#f59e0b',
      done: true,
      players: state.players.filter((p) => p.alive && p.role === 'petite-fille'),
      detail: 'Espionne les loups \u2014 role passif',
      compactDetail: 'Passif',
    });
  }

  // ── Corbeau ──
  if (hasRole('corbeau')) {
    const corbeauCount = Object.keys(state.corbeauTargets || {}).length;
    const totalCorbeaux = state.players.filter((p) => p.alive && p.role === 'corbeau').length;
    const corbeauVerbose = corbeauCount > 0
      ? Object.entries(state.corbeauTargets || {}).map(([actorId, tid]: [string, number]) => {
          const cTarget = state.players.find((p) => p.id === tid);
          const cTargetEmoji = cTarget ? (getRoleById(cTarget.role)?.emoji || '') : '';
          const targetName = (cTarget?.name || '?') + ' (' + cTargetEmoji + ')';
          const msg = (state.corbeauMessages ?? {})[Number(actorId)] || '';
          return msg ? `\u2192 ${targetName}: "${msg}"` : `\u2192 ${targetName}`;
        }).join(' | ')
      : `0/${totalCorbeaux} \u2014 En attente`;
    actions.push({
      id: 'corbeau', emoji: '\uD83D\uDC26\u200D\u2B1B', label: 'Corbeau', color: '#4a3660',
      done: corbeauCount >= totalCorbeaux,
      players: state.players.filter((p) => p.alive && p.role === 'corbeau'),
      detail: corbeauCount > 0 ? `${corbeauCount}/${totalCorbeaux} \u2014 ${corbeauVerbose}` : corbeauVerbose,
      compactDetail: corbeauCount > 0 ? `${corbeauCount}/${totalCorbeaux}` : 'Attente',
    });
  }

  // ── Renard ──
  if (hasRole('renard')) {
    const foxCount = Object.keys(state.foxTargets || {}).length;
    const totalFoxes = state.players.filter((p) => p.alive && p.role === 'renard').length;
    const foxVerbose = foxCount > 0
      ? Object.entries(state.foxTargets || {}).map(([actorId, targetIds]: [string, number[]]) => {
          const foxResult = (state.foxResults || {})[Number(actorId)];
          const names = targetIds.map((tid: number) => {
            const fp = state.players.find((p) => p.id === tid);
            return fp?.name || '?';
          }).join(', ');
          return `${names} \u2192 ${foxResult ? '\uD83D\uDC3A Loup!' : '\u2705 Aucun'}`;
        }).join(' | ')
      : `0/${totalFoxes} \u2014 En attente`;
    const foxCompact = foxCount > 0
      ? `${foxCount}/${totalFoxes} ` + Object.entries(state.foxTargets || {}).map(([actorId]: [string, number[]]) => {
          const foxResult = (state.foxResults || {})[Number(actorId)];
          return foxResult ? '\uD83D\uDC3A' : '\u2705';
        }).join(' ')
      : 'Attente';
    actions.push({
      id: 'renard', emoji: '\uD83E\uDD8A', label: 'Renard', color: '#f97316',
      done: foxCount >= totalFoxes,
      players: state.players.filter((p) => p.alive && p.role === 'renard'),
      detail: foxCount > 0 ? `${foxCount}/${totalFoxes} \u2014 ${foxVerbose}` : foxVerbose,
      compactDetail: foxCompact,
    });
  }

  // ── Concierge ──
  if (hasRole('concierge')) {
    const conciergeCount = Object.keys(state.conciergeTargets || {}).length;
    const totalConcierges = state.players.filter((p) => p.alive && p.role === 'concierge').length;
    const conciergeVerbose = conciergeCount > 0
      ? Object.entries(state.conciergeTargets || {}).map(([, targetId]: [string, number]) => {
          const tp = state.players.find((p) => p.id === targetId);
          return `Observe: ${tp?.name || '?'}`;
        }).join(' | ')
      : `0/${totalConcierges} \u2014 En attente`;
    actions.push({
      id: 'concierge', emoji: '\uD83D\uDD11', label: 'Concierge', color: '#0ea5e9',
      done: conciergeCount >= totalConcierges,
      players: state.players.filter((p) => p.alive && p.role === 'concierge'),
      detail: conciergeCount > 0 ? `${conciergeCount}/${totalConcierges} \u2014 ${conciergeVerbose}` : conciergeVerbose,
      compactDetail: conciergeCount > 0 ? `${conciergeCount}/${totalConcierges}` : 'Attente',
    });
  }

  return actions;
}

/**
 * Compute all vote tracking data from current game state.
 * Shared between desktop GMGameControls and mobile MobileControlsView.
 */
export function computeVoteData(state: GameState, alivePlayers: Player[]): VoteData {
  const totalAlive = alivePlayers.length;
  const aliveIdSet = new Set(alivePlayers.map((p) => p.id));
  const lastWillUsed = state.lastWillUsed ?? {};
  // Count alive players' votes + dernière volonté votes
  const totalVotes = Object.keys(state.votes).filter((vid) => {
    const id = parseInt(vid);
    return aliveIdSet.has(id) || lastWillUsed[id];
  }).length;

  const voteCounts: Record<number, number> = {};
  Object.entries(state.votes).forEach(([voterId, targetId]: [string, number]) => {
    const vid = parseInt(voterId);
    if (!aliveIdSet.has(vid) && !lastWillUsed[vid]) return; // skip dead players without dernière volonté
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  const ranking = Object.entries(voteCounts)
    .map(([id, count]) => ({
      player: state.players.find((p: Player) => p.id === parseInt(id))!,
      count,
    }))
    .filter((r) => r.player)
    .sort((a, b) => b.count - a.count);

  // Detect abstainer IDs from event log
  const abstainerIds = new Set(
    state.events
      .filter((ev: GameEvent) =>
        ev.turn === state.turn && ev.phase === 'day' && ev.message.startsWith('[Abstention]'),
      )
      .map((ev: GameEvent) => {
        const match = ev.message.match(/\[Abstention\] (.+?) n'a pas vote/);
        if (!match) return null;
        const player = state.players.find((p: Player) => p.name === match[1]);
        return player?.id ?? null;
      })
      .filter((id): id is number => id !== null),
  );

  const voterDetails = Object.entries(state.votes).map(([voterId, targetId]) => {
    const vid = parseInt(voterId);
    const voter = state.players.find((p: Player) => p.id === vid);
    return {
      voter,
      target: state.players.find((p: Player) => p.id === (targetId as number)),
      isRandom: abstainerIds.has(vid),
      isMaire: state.maireId !== null && vid === state.maireId,
      isLastWill: !!(state.lastWillUsed ?? {})[vid],
    };
  });

  const maireVoteTargetId =
    state.maireId !== null && state.votes[state.maireId] !== undefined
      ? (state.votes[state.maireId] as number)
      : null;

  const maxCount = ranking.length > 0 ? ranking[0].count : 0;
  const isVoteResult = state.dayStep === 'result';
  const eliminatedPlayer =
    state.voteResult !== null
      ? state.players.find((p: Player) => p.id === state.voteResult)
      : undefined;
  const eliminatedRole = eliminatedPlayer ? getRoleById(eliminatedPlayer.role) : null;

  return {
    totalAlive, totalVotes, voteCounts, ranking, voterDetails,
    maireVoteTargetId, maxCount, isVoteResult,
    eliminatedPlayer, eliminatedRole,
    eliminatedPlayers: (state.voteResults || []).map((id) => state.players.find((p: Player) => p.id === id)).filter(Boolean) as Player[],
    eliminatedRoles: (state.voteResults || []).map((id) => { const p = state.players.find((pl: Player) => pl.id === id); return p ? getRoleById(p.role) : null; }),
  };
}

// ── Quest Distribution ───────────────────────────────────────────

/** Shuffle array (Fisher-Yates) */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pure quest distribution round.
 * Takes a GameState and returns an updated GameState with new quest assignments.
 * Returns { state, distributedCount } so callers can display feedback.
 *
 * This is the single source of truth for quest distribution logic —
 * used by both the GM "Distribuer" button and automatic phase transitions.
 */
export function distributeQuestRound(s: GameState): { state: GameState; distributedCount: number } {
  let distributedCount = 0;
  const allQuests = s.quests || [];
  if (allQuests.length === 0) return { state: s, distributedCount: 0 };

  const pSet = s.villagePresentIds ? new Set(s.villagePresentIds) : null;
  const alive = shuffleArray(s.players.filter(p => p.alive && (!pSet || pSet.has(p.id))).map(p => p.id));
  const dead = shuffleArray(s.players.filter(p => !p.alive).map(p => p.id));
  const aliveSet = new Set(alive);
  // All players: alive first, then dead (dead only get individual quests). Away players excluded.
  const allEligible = [...alive, ...dead];
  const newAssignments: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(s.questAssignments || {})) {
    newAssignments[Number(k)] = [...v];
  }

  const updatedQuests = allQuests.map(q => ({ ...q }));
  const processedThisRound = new Set<number>();

  // Split quests into available (auto), ordered (numeric) and random pools
  const availableQuests = updatedQuests
    .filter(q => q.distributionOrder === 'available');
  const orderedQuests = updatedQuests
    .filter(q => typeof q.distributionOrder === 'number')
    .sort((a, b) => (a.distributionOrder as number) - (b.distributionOrder as number));
  const randomQuests = updatedQuests
    .filter(q => q.distributionOrder === 'random' || q.distributionOrder === undefined);

  // Helper: attempt to assign a specific quest to a player
  const tryAssignQuest = (pid: number, picked: typeof updatedQuests[0]) => {
    const isCollab = (picked.questType || 'individual') === 'collaborative';

    if (isCollab) {
      const groupSize = picked.collaborativeGroupSize || 3;
      const eligible = alive.filter(id => {
        if (processedThisRound.has(id)) return false;
        if ((newAssignments[id] || []).includes(picked.id)) return false;
        if (picked.targetTags && picked.targetTags.length > 0) {
          const idTags = (s.playerTags || {})[id] || [];
          return picked.targetTags.some(tag => idTags.includes(tag));
        }
        return true;
      });

      if (eligible.length < 2) return false;

      const actualGroupSize = Math.min(groupSize, eligible.length);
      const group = eligible.slice(0, actualGroupSize);

      const qIdx = updatedQuests.findIndex(q => q.id === picked.id);
      if (qIdx >= 0) {
        const groups: number[][] = (updatedQuests[qIdx].collaborativeGroups || []).map(g => [...g]);
        groups.push(group);
        updatedQuests[qIdx] = { ...updatedQuests[qIdx], collaborativeGroups: groups };
      }

      for (const memberId of group) {
        if (!newAssignments[memberId]) newAssignments[memberId] = [];
        if (!newAssignments[memberId].includes(picked.id)) {
          newAssignments[memberId].push(picked.id);
        }
        processedThisRound.add(memberId);
        distributedCount++;
      }
      return true;
    } else {
      if (!newAssignments[pid]) newAssignments[pid] = [];
      newAssignments[pid].push(picked.id);
      processedThisRound.add(pid);
      distributedCount++;
      return true;
    }
  };

  // Helper: check if a player has a matching tag for a quest
  const playerHasQuestTag = (pid: number, quest: typeof updatedQuests[0]): boolean => {
    if (!quest.targetTags || quest.targetTags.length === 0) return false;
    const pidTags = (s.playerTags || {})[pid] || [];
    return quest.targetTags.some(tag => pidTags.includes(tag));
  };

  // Helper: check if ALL tagged players already had the quest BEFORE this round.
  const originalAssignments = s.questAssignments || {};
  const allTaggedPlayersHaveQuest = (quest: typeof updatedQuests[0]): boolean => {
    if (!quest.targetTags || quest.targetTags.length === 0) return true;
    return allEligible.every(pid => {
      if (!playerHasQuestTag(pid, quest)) return true;
      return (originalAssignments[pid] || []).includes(quest.id);
    });
  };

  // Phase 0: Auto-assign "available" quests to ALL eligible players (no round limit)
  for (const quest of availableQuests) {
    const isQuestCollab = (quest.questType || 'individual') === 'collaborative';
    for (const pid of allEligible) {
      if (isQuestCollab && !aliveSet.has(pid)) continue;
      const myQids = newAssignments[pid] || [];
      if (myQids.includes(quest.id)) continue;
      if (quest.targetTags && quest.targetTags.length > 0) {
        if (isQuestCollab) {
          const pidTags = (s.playerTags || {})[pid] || [];
          if (!quest.targetTags.some(tag => pidTags.includes(tag))) continue;
        }
      }
      if (!newAssignments[pid]) newAssignments[pid] = [];
      newAssignments[pid].push(quest.id);
      distributedCount++;
    }
  }

  // Phase 1: Distribute ordered quests (ascending priority) to ALL eligible players
  for (const quest of orderedQuests) {
    const isQuestCollab = (quest.questType || 'individual') === 'collaborative';
    const hasTags = quest.targetTags && quest.targetTags.length > 0;

    if (!isQuestCollab && hasTags) {
      for (const pid of allEligible) {
        if (processedThisRound.has(pid)) continue;
        const myQids = newAssignments[pid] || [];
        if (myQids.includes(quest.id)) continue;
        if (!playerHasQuestTag(pid, quest)) continue;
        tryAssignQuest(pid, quest);
      }
      if (allTaggedPlayersHaveQuest(quest)) {
        for (const pid of allEligible) {
          if (processedThisRound.has(pid)) continue;
          const myQids = newAssignments[pid] || [];
          if (myQids.includes(quest.id)) continue;
          tryAssignQuest(pid, quest);
        }
      }
    } else {
      for (const pid of allEligible) {
        if (processedThisRound.has(pid)) continue;
        if (isQuestCollab && !aliveSet.has(pid)) continue;
        const myQids = newAssignments[pid] || [];
        if (myQids.includes(quest.id)) continue;
        if (hasTags) {
          const pidTags = (s.playerTags || {})[pid] || [];
          if (!quest.targetTags!.some(tag => pidTags.includes(tag))) continue;
        }
        tryAssignQuest(pid, quest);
      }
    }
  }

  // Phase 2: For remaining unprocessed players, pick a random quest from the random pool
  for (const pid of allEligible) {
    if (processedThisRound.has(pid)) continue;
    const isDead = !aliveSet.has(pid);

    const myQids = newAssignments[pid] || [];
    const available = randomQuests.filter(q => {
      if (myQids.includes(q.id)) return false;
      if (isDead && (q.questType || 'individual') === 'collaborative') return false;
      const isIndiv = (q.questType || 'individual') === 'individual';
      if (q.targetTags && q.targetTags.length > 0) {
        if (isIndiv) {
          if (!playerHasQuestTag(pid, q) && !allTaggedPlayersHaveQuest(q)) return false;
        } else {
          if (!playerHasQuestTag(pid, q)) return false;
        }
      }
      return true;
    });

    const taggedAvailable = available.filter(q => playerHasQuestTag(pid, q));
    const pickPool = taggedAvailable.length > 0 ? taggedAvailable : available;

    if (pickPool.length === 0) {
      const orderedFallback = orderedQuests.filter(q => {
        if (myQids.includes(q.id)) return false;
        if (isDead && (q.questType || 'individual') === 'collaborative') return false;
        const isIndiv = (q.questType || 'individual') === 'individual';
        if (q.targetTags && q.targetTags.length > 0) {
          if (isIndiv) {
            if (!playerHasQuestTag(pid, q) && !allTaggedPlayersHaveQuest(q)) return false;
          } else {
            if (!playerHasQuestTag(pid, q)) return false;
          }
        }
        return true;
      });
      if (orderedFallback.length > 0) {
        tryAssignQuest(pid, orderedFallback[0]);
      }
      continue;
    }

    const picked = pickPool[Math.floor(Math.random() * pickPool.length)];
    const isCollab = (picked.questType || 'individual') === 'collaborative';

    if (isCollab) {
      const groupSize = picked.collaborativeGroupSize || 3;
      const eligible = alive.filter(id => {
        if (processedThisRound.has(id)) return false;
        if ((newAssignments[id] || []).includes(picked.id)) return false;
        if (picked.targetTags && picked.targetTags.length > 0) {
          const idTags = (s.playerTags || {})[id] || [];
          return picked.targetTags.some(tag => idTags.includes(tag));
        }
        return true;
      });

      if (eligible.length < 2) {
        const individualAvailable = available.filter(q => (q.questType || 'individual') === 'individual');
        if (individualAvailable.length > 0) {
          const iPicked = individualAvailable[Math.floor(Math.random() * individualAvailable.length)];
          if (!newAssignments[pid]) newAssignments[pid] = [];
          newAssignments[pid].push(iPicked.id);
          processedThisRound.add(pid);
          distributedCount++;
        }
        continue;
      }

      tryAssignQuest(pid, picked);
    } else {
      tryAssignQuest(pid, picked);
    }
  }

  // Unhide all quests that have been assigned to at least one player (no longer drafts)
  const allAssignedQuestIds = new Set<number>();
  for (const ids of Object.values(newAssignments)) {
    for (const qid of ids) allAssignedQuestIds.add(qid);
  }
  for (const q of updatedQuests) {
    if (q.hidden && allAssignedQuestIds.has(q.id)) {
      q.hidden = false;
    }
  }

  return {
    state: { ...s, quests: updatedQuests, questAssignments: newAssignments },
    distributedCount,
  };
}

// ── Villager P2 Clue Distribution ────────────────────────────────

/** Resolve {role} and {durole} placeholders in hint text — includes French articles with auto-capitalization */
export function resolveHintText(text: string, player: Player): string {
  const role = getRoleById(player.role);
  if (!role) return text.replace(/\{role\}/gi, player.role).replace(/\{durole\}/gi, player.role);

  // {role} → "le/la/un/l' <Name>" (or hintDisplay override)
  let result = text.replace(/\{role\}/gi, (_match, offset: number) => {
    if (role.hintDisplay) {
      return offset === 0
        ? role.hintDisplay.charAt(0).toUpperCase() + role.hintDisplay.slice(1)
        : role.hintDisplay;
    }
    const capitalize = offset === 0;
    if (role.article === "l'") {
      const prefix = capitalize ? "L'" : "l'";
      return `${prefix}${role.name}`;
    }
    const art = capitalize
      ? role.article.charAt(0).toUpperCase() + role.article.slice(1)
      : role.article;
    return `${art} ${role.name}`;
  });

  // {durole} → "du/de la/d'un/de l' <Name>" (or hintGenitiveDisplay override)
  result = result.replace(/\{durole\}/gi, (_match, offset: number) => {
    if (role.hintGenitiveDisplay) {
      return offset === 0
        ? role.hintGenitiveDisplay.charAt(0).toUpperCase() + role.hintGenitiveDisplay.slice(1)
        : role.hintGenitiveDisplay;
    }
    const capitalize = offset === 0;
    if (role.article === "l'") {
      return capitalize ? `De l'${role.name}` : `de l'${role.name}`;
    }
    if (role.article === 'un') {
      return capitalize ? `D'un ${role.name}` : `d'un ${role.name}`;
    }
    if (role.article === 'le') {
      return capitalize ? `Du ${role.name}` : `du ${role.name}`;
    }
    return capitalize ? `De la ${role.name}` : `de la ${role.name}`;
  });

  return result;
}

/**
 * Pure villager clue distribution.
 * For each alive present player, picks one random unrevealed dynamic hint
 * of the given priority targeting a simple villager (role 'villageois')
 * that they haven't received yet, and delivers it as a normal Hint + PlayerHint entry.
 *
 * Does NOT mark dynamic hints as revealed — each distribution is an independent
 * random draw. Uses grantedToPlayerIds to avoid duplicate grants per player.
 *
 * @param priority - Which priority pool to draw from (1 or 2). Defaults to 2.
 */
export function distributeVillagerP2Clues(s: GameState, priority: 1 | 2 = 2): { state: GameState; distributedCount: number } {
  const dynamicHints = s.dynamicHints ?? [];

  // Build villageois pool: unrevealed hints of the given priority targeting a simple villager
  const p2Pool = dynamicHints.filter((h) => {
    if (h.priority !== priority || h.revealed) return false;
    const targetPlayer = s.players.find((p) => p.id === h.targetPlayerId);
    if (!targetPlayer) return false;
    return getRoleById(targetPlayer.role)?.id === 'villageois';
  });

  if (p2Pool.length === 0) return { state: s, distributedCount: 0 };

  const vpSet = s.villagePresentIds ? new Set(s.villagePresentIds) : null;
  const alivePlayers = s.players.filter((p) => p.alive && (!vpSet || vpSet.has(p.id)));

  // Track updates to dynamic hints (for grantedToPlayerIds)
  const updatedDynamicHints = dynamicHints.map((h) => ({ ...h }));

  // Map: dynamicHintId → playerIds receiving it this round
  const assignments = new Map<number, number[]>();
  let distributedCount = 0;

  for (const player of alivePlayers) {
    const available = p2Pool.filter((h) => {
      // Exclude clue about this player themselves
      if (h.targetPlayerId === player.id) return false;
      // Exclude if already granted to this player
      const granted = h.grantedToPlayerIds ?? [];
      return !granted.includes(player.id);
    });
    if (available.length === 0) continue;

    const picked = available[Math.floor(Math.random() * available.length)];

    // Update grantedToPlayerIds on the mutable copy
    const dhIdx = updatedDynamicHints.findIndex((h) => h.id === picked.id);
    if (dhIdx >= 0) {
      const dh = updatedDynamicHints[dhIdx];
      updatedDynamicHints[dhIdx] = {
        ...dh,
        grantedToPlayerIds: [...(dh.grantedToPlayerIds ?? []), player.id],
      };
      // Keep pool reference in sync so subsequent players see updated grantedToPlayerIds
      const poolIdx = p2Pool.findIndex((h) => h.id === picked.id);
      if (poolIdx >= 0) p2Pool[poolIdx] = updatedDynamicHints[dhIdx];
    }

    if (!assignments.has(picked.id)) assignments.set(picked.id, []);
    assignments.get(picked.id)!.push(player.id);
    distributedCount++;
  }

  if (distributedCount === 0) return { state: s, distributedCount: 0 };

  // Build Hint + PlayerHint entries: one Hint per unique dynamic hint drawn
  const newHints: Hint[] = [...(s.hints ?? [])];
  const newPlayerHints: PlayerHint[] = [...(s.playerHints ?? [])];
  const now = new Date().toISOString();

  for (const [dhId, playerIds] of assignments) {
    const dh = updatedDynamicHints.find((h) => h.id === dhId)!;
    const targetPlayer = s.players.find((p) => p.id === dh.targetPlayerId)!;
    const resolvedText = resolveHintText(dh.text, targetPlayer);

    const hintId = nextHintId(newHints);
    newHints.push({
      id: hintId,
      text: resolvedText,
      ...(dh.imageUrl ? { imageUrl: dh.imageUrl } : {}),
      fromDynamic: true,
      createdAt: now,
    });

    for (const pid of playerIds) {
      newPlayerHints.push({ hintId, playerId: pid, sentAt: now, revealed: false });
    }
  }

  return {
    state: {
      ...s,
      dynamicHints: updatedDynamicHints,
      hints: newHints,
      playerHints: newPlayerHints,
    },
    distributedCount,
  };
}