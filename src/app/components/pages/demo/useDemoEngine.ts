/**
 * useDemoEngine.ts — AI engine for the demo mode.
 * Manages a local GameState with 42 AI players + 1 human player.
 * Auto-progresses phases (night actions, day votes, resolution).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Player, GameEvent } from '../../../context/gameTypes';
import type { PhaseDeathRecord } from '../../../context/gameTypes';
import type { Quest } from '../../../context/gameTypes';
import { initialState, AVATARS, generateShortCode, nextEventId } from '../../../context/gameContextConstants';
import { ROLES, getRoleById } from '../../../data/roles';
import { computeEndAt } from '../../PhaseTimer';
import { AVATAR_GALLERY } from '../../../data/avatarGallery';
import { galleryRef } from '../../../data/avatarResolver';

const DEMO_PHASE_DURATION = 30; // seconds for day phase timer in demo
const DEMO_NIGHT_DURATION = 45; // seconds for night phase timer in demo
const DEMO_ANNOUNCEMENT_DURATION = 6; // seconds to show announcement screens

// ── Player names ──
// Use gallery names as AI player names (pick 42 from the 57 gallery entries)
const GALLERY_PLAYER_COUNT = 42;
const TOTAL_PLAYERS = GALLERY_PLAYER_COUNT + 1; // Gallery AI + 1 human

// ── Role composition for ~43 players (Metropole-like) ──
function buildRoleList(userRole: string): string[] {
  const roles: string[] = [userRole];
  // Ensure wolf count: 8 wolves total
  const wolvesNeeded = userRole === 'loup-garou' ? 7 : 8;
  for (let i = 0; i < wolvesNeeded; i++) roles.push('loup-garou');
  // Corbeaux (wolf team)
  if (userRole !== 'corbeau') {
    roles.push('corbeau');
    roles.push('corbeau');
  } else {
    roles.push('corbeau');
  }
  // Special roles
  const specials = ['voyante', 'sorciere', 'chasseur', 'cupidon', 'garde', 'renard', 'concierge', 'petite-fille'];
  for (const s of specials) {
    if (!roles.includes(s)) roles.push(s);
  }
  // Fill remaining with villageois
  while (roles.length < TOTAL_PLAYERS) roles.push('villageois');
  return roles;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = shuffleArray(arr);
  return shuffled.slice(0, n);
}

/** Create a GameEvent for the demo */
function makeEvent(turn: number, phase: 'night' | 'day', message: string): GameEvent {
  return {
    id: nextEventId(),
    turn,
    phase,
    message,
    timestamp: new Date().toISOString(),
  };
}

export interface DemoEngineResult {
  state: GameState;
  userPlayerId: number;
  userShortCode: string;
  updateState: (updater: (s: GameState) => GameState) => void;
  started: boolean;
  gameOver: boolean;
}

// ── Demo Quests ──
const DEMO_QUEST_IDS = { individual: 1001, collab: 1002 };
const DEMO_REWARD_HINT_IDS = { individual: 101, collab: 102 };

function buildDemoQuests(players: Player[]): Quest[] {
  const now = new Date().toISOString();
  const aiPlayers = players.filter(p => p.id !== 1);
  const collabMates = aiPlayers.slice(0, 2);
  const collabGroup = [1, ...collabMates.map(p => p.id)];

  return [
    // 1) Individual quest with 3 tasks (text, code, multiple-choice)
    {
      id: DEMO_QUEST_IDS.individual,
      title: 'Les épreuves du guetteur',
      description: 'Le guetteur du village vous met à l\'épreuve. Répondez à ses trois questions pour prouver votre loyauté.',
      questType: 'individual' as const,
      playerStatuses: { 1: 'active' as const },
      tasks: [
        {
          id: 1,
          question: 'Quel animal nocturne est le symbole du guetteur ? (Indice : il hulule)',
          inputType: 'text' as const,
          correctAnswer: 'hibou',
          playerAnswers: {},
          playerResults: {},
        },
        {
          id: 2,
          question: 'Entrez le code secret gravé sur la porte de la tour de guet (Indice : L-O-U-P)',
          inputType: 'code' as const,
          correctAnswer: 'LOUP',
          playerAnswers: {},
          playerResults: {},
        },
        {
          id: 3,
          question: 'Combien de loups-garous se cachent habituellement dans un village de 43 joueurs ?',
          inputType: 'multiple-choice' as const,
          choices: ['4', '6', '8', '10'],
          correctAnswer: '8',
          playerAnswers: {},
          playerResults: {},
        },
      ],
      createdAt: now,
      hidden: false,
      distributionOrder: 1,
      rewardHintIds: { 1: DEMO_REWARD_HINT_IDS.individual },
    },
    // 2) Collaborative quest
    {
      id: DEMO_QUEST_IDS.collab,
      title: 'L\'alliance secrète',
      description: 'Formez une alliance avec vos coéquipiers pour démasquer les loups. Votez ensemble !',
      questType: 'collaborative' as const,
      playerStatuses: Object.fromEntries(collabGroup.map(id => [id, 'active' as const])),
      tasks: [{
        id: 4,
        question: 'Pensez-vous que votre groupe contient un loup-garou ?',
        inputType: 'multiple-choice' as const,
        choices: ['Oui, j\'en suis sûr', 'Non, nous sommes tous innocents', 'Je ne sais pas'],
        correctAnswer: 'Non, nous sommes tous innocents',
        playerAnswers: {},
        playerResults: {},
      }],
      collaborativeGroups: [collabGroup],
      collaborativeGroupSize: 3,
      collaborativeVotes: {},
      createdAt: now,
      hidden: false,
      distributionOrder: 2,
      rewardHintIds: { 1: DEMO_REWARD_HINT_IDS.collab },
    },
  ];
}

function buildDemoQuestAssignments(players: Player[]): Record<number, number[]> {
  const assignments: Record<number, number[]> = {};
  // Assign both quests to the human player
  assignments[1] = [DEMO_QUEST_IDS.individual, DEMO_QUEST_IDS.collab];
  // Assign the collab quest to the 2 AI teammates as well
  const aiPlayers = players.filter(p => p.id !== 1);
  const collabMates = aiPlayers.slice(0, 2);
  for (const mate of collabMates) {
    assignments[mate.id] = [DEMO_QUEST_IDS.collab];
  }
  return assignments;
}

export function useDemoEngine(selectedRole: string | null): DemoEngineResult {
  const [state, setState] = useState<GameState>({ ...initialState });
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const userPlayerIdRef = useRef<number>(1);
  const userShortCodeRef = useRef<string>('DEM1');
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const updateState = useCallback((updater: (s: GameState) => GameState) => {
    setState(prev => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  // ── Initialize game when role is selected / Reset when role is cleared ──
  useEffect(() => {
    // Reset engine when selectedRole becomes null (user navigated back)
    if (selectedRole === null) {
      // Clear any running timers
      if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
      if (aiTimerRef.current) { clearTimeout(aiTimerRef.current); aiTimerRef.current = null; }
      // Reset all state so the next role pick triggers a fresh game
      if (started || gameOver) {
        setState({ ...initialState });
        stateRef.current = { ...initialState };
        setStarted(false);
        setGameOver(false);
      }
      return;
    }

    // Initialize game when role is selected
    if (started) return;

    const roles = buildRoleList(selectedRole);
    // User gets slot 0 (their chosen role), shuffle the rest
    const aiRoles = shuffleArray(roles.slice(1));
    const existingCodes = new Set<string>();

    const players: Player[] = [];
    // User player
    const userCode = generateShortCode('Demo', existingCodes);
    existingCodes.add(userCode);
    userShortCodeRef.current = userCode;
    players.push({
      id: 1,
      shortCode: userCode,
      name: 'Vous',
      role: selectedRole,
      alive: true,
      avatar: '🎭',
      votesReceived: 0,
    });
    userPlayerIdRef.current = 1;

    // AI players — use gallery avatars
    const shuffledGallery = shuffleArray(AVATAR_GALLERY).slice(0, GALLERY_PLAYER_COUNT);
    for (let i = 0; i < shuffledGallery.length; i++) {
      const galleryEntry = shuffledGallery[i];
      const code = generateShortCode(galleryEntry.name, existingCodes);
      existingCodes.add(code);
      players.push({
        id: i + 2,
        shortCode: code,
        name: galleryEntry.name,
        role: aiRoles[i],
        alive: true,
        avatar: AVATARS[i % AVATARS.length],
        avatarUrl: galleryRef(galleryEntry.id),
        votesReceived: 0,
      });
    }

    const roleConfig: Record<string, number> = {};
    for (const r of ROLES) {
      roleConfig[r.id] = players.filter(p => p.role === r.id).length;
    }

    setState({
      ...initialState,
      gameId: 'demo-' + Date.now(),
      screen: 'game',
      players,
      roleConfig,
      phase: 'night',
      nightStep: 'active',
      dayStep: 'discussion',
      turn: 1,
      roleRevealDone: true,
      roleRevealedBy: players.map(p => p.id),
      wolfKillsPerNight: 1,
      gameMode: 'classic',
      // Skip mayor election in demo
      maireElectionDone: true,
      // Events matching normal game flow
      events: [
        makeEvent(1, 'night', '--- Nuit 1 ---'),
        makeEvent(1, 'night', "Le village s'endort... Tous les roles agissent simultanément."),
      ],
      // Demo hint for the player
      hints: [
        { id: 1, text: 'Méfiez-vous de ceux qui parlent trop… ou pas assez. Le loup se cache parmi les bavards.', createdAt: new Date().toISOString() },
        { id: DEMO_REWARD_HINT_IDS.individual, text: 'Le guetteur vous murmure : "Surveillez les joueurs qui s\'opposent systématiquement à la majorité… ils protègent peut-être l\'un des leurs."', createdAt: new Date().toISOString() },
        { id: DEMO_REWARD_HINT_IDS.collab, text: 'L\'alliance a découvert un secret : "Lors du dernier vote, ceux qui ont voté contre la victime innocente sont suspects. Recoupez les votes !"', createdAt: new Date().toISOString() },
      ],
      playerHints: [
        { hintId: 1, playerId: 1, sentAt: new Date().toISOString(), revealed: false },
        // Reward hints are NOT pre-added — they are injected only when the quest succeeds (see DemoPage.tsx)
      ],
      // ── Demo quests (one per input type + 1 collaborative) ──
      quests: buildDemoQuests(players),
      questAssignments: buildDemoQuestAssignments(players),
      // Phase timer: night starts at 45 seconds
      phaseTimerDuration: DEMO_NIGHT_DURATION,
      phaseTimerDayDuration: DEMO_PHASE_DURATION,
      phaseTimerNightDuration: DEMO_NIGHT_DURATION,
      phaseTimerEndAt: computeEndAt(DEMO_NIGHT_DURATION),
    });
    setStarted(true);
  }, [selectedRole, started]);

  // ── Win condition check ──
  const checkWin = useCallback((s: GameState): 'village' | 'werewolf' | 'lovers' | null => {
    const alive = s.players.filter(p => p.alive);
    const wolves = alive.filter(p => {
      const r = getRoleById(p.role);
      return r?.team === 'werewolf';
    });
    const villagers = alive.filter(p => {
      const r = getRoleById(p.role);
      return r?.team !== 'werewolf';
    });
    if (wolves.length === 0) return 'village';
    if (wolves.length >= villagers.length) return 'werewolf';
    return null;
  }, []);

  // ── AI Night Actions ──
  const runAINightActions = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const alive = next.players.filter(p => p.alive);
    const userId = userPlayerIdRef.current;

    // Wolves vote (AI wolves)
    const wolves = alive.filter(p => getRoleById(p.role)?.team === 'werewolf' && p.id !== userId);
    const nonWolves = alive.filter(p => getRoleById(p.role)?.team !== 'werewolf' && p.id !== userId);
    const wolfVotes: Record<number, number> = { ...(next.werewolfVotes || {}) };
    if (nonWolves.length > 0) {
      const wolfTarget = pickRandom(nonWolves);
      for (const w of wolves) {
        wolfVotes[w.id] = wolfTarget.id;
      }
    }
    next.werewolfVotes = wolfVotes;

    // Seer (AI seers)
    const seers = alive.filter(p => p.role === 'voyante' && p.id !== userId);
    const seerTargets = { ...(next.seerTargets || {}) };
    const seerResults = { ...(next.seerResults || {}) };
    for (const seer of seers) {
      const targets = alive.filter(p => p.id !== seer.id && !seerTargets[seer.id]);
      if (targets.length > 0) {
        const t = pickRandom(targets);
        seerTargets[seer.id] = t.id;
        seerResults[seer.id] = getRoleById(t.role) ?? null;
      }
    }
    next.seerTargets = seerTargets;
    next.seerResults = seerResults;

    // Guard (AI guards)
    const guards = alive.filter(p => p.role === 'garde' && p.id !== userId);
    const guardTargets = { ...(next.guardTargets || {}) };
    for (const guard of guards) {
      const lastTarget = next.guardLastTargets?.[guard.id];
      const possibleTargets = alive.filter(p => p.id !== guard.id && p.id !== lastTarget);
      if (possibleTargets.length > 0) {
        guardTargets[guard.id] = pickRandom(possibleTargets).id;
      }
    }
    next.guardTargets = guardTargets;

    // Fox (AI foxes)
    const foxes = alive.filter(p => p.role === 'renard' && p.id !== userId);
    const foxTargets = { ...(next.foxTargets || {}) };
    const foxResults = { ...(next.foxResults || {}) };
    for (const fox of foxes) {
      const others = alive.filter(p => p.id !== fox.id);
      if (others.length >= 3) {
        const group = pickRandomN(others, 3).map(p => p.id);
        foxTargets[fox.id] = group;
        foxResults[fox.id] = group.some(id => {
          const pl = next.players.find(p => p.id === id);
          return pl && getRoleById(pl.role)?.team === 'werewolf';
        });
      }
    }
    next.foxTargets = foxTargets;
    next.foxResults = foxResults;

    // Cupidon (AI, first night only)
    if (next.turn === 1) {
      const cupids = alive.filter(p => p.role === 'cupidon' && p.id !== userId);
      const cupidLinkedBy = [...(next.cupidLinkedBy || [])];
      const loverPairs = [...(next.loverPairs || [])];
      for (const cupid of cupids) {
        if (cupidLinkedBy.includes(cupid.id)) continue;
        const targets = alive.filter(p => p.id !== cupid.id);
        if (targets.length >= 2) {
          const [a, b] = pickRandomN(targets, 2);
          loverPairs.push([a.id, b.id]);
          cupidLinkedBy.push(cupid.id);
        }
      }
      next.cupidLinkedBy = cupidLinkedBy;
      next.loverPairs = loverPairs;
    }

    return next;
  }, []);

  // ── Resolve Night → Day transition ──
  const resolveNight = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const userId = userPlayerIdRef.current;

    // ── Snapshot alive players BEFORE deaths (for phaseDeathHistory) ──
    const aliveBeforeIds = new Set(next.players.filter(p => p.alive).map(p => p.id));

    // Determine wolf target by vote tally
    const voteCount: Record<number, number> = {};
    for (const targetId of Object.values(next.werewolfVotes)) {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }
    let maxVotes = 0;
    let wolfTarget: number | null = null;
    for (const [id, count] of Object.entries(voteCount)) {
      if (count > maxVotes) {
        maxVotes = count;
        wolfTarget = Number(id);
      }
    }

    // ── User immunity: redirect wolf target away from user ──
    if (wolfTarget === userId) wolfTarget = null;

    // Check if guard protected the target
    const guardedIds = new Set(Object.values(next.guardTargets || {}));
    if (wolfTarget !== null && guardedIds.has(wolfTarget)) {
      next.events = [...next.events, makeEvent(next.turn, 'night', '🛡️ Quelque chose a interfere pendant la nuit.')];
      wolfTarget = null;
    }

    // Check witch heal
    for (const [, healed] of Object.entries(next.witchHealedThisNight || {})) {
      if (healed && wolfTarget !== null) {
        wolfTarget = null;
      }
    }

    // Kill wolf target + generate event
    if (wolfTarget !== null) {
      next.players = next.players.map(p =>
        p.id === wolfTarget ? { ...p, alive: false } : p
      );
      const target = next.players.find(p => p.id === wolfTarget);
      next.events = [...next.events, makeEvent(next.turn, 'night', `${target?.name || 'Un joueur'} a ete devore par les loups cette nuit.`)];
    }

    // Witch kill targets + generate events (skip user)
    for (const [, targetId] of Object.entries(next.witchKillTargets || {})) {
      if (typeof targetId === 'number' && targetId !== userId) {
        next.players = next.players.map(p =>
          p.id === targetId ? { ...p, alive: false } : p
        );
        const target = next.players.find(p => p.id === targetId);
        next.events = [...next.events, makeEvent(next.turn, 'night', `${target?.name || 'Un joueur'} a ete empoisonne cette nuit.`)];
      }
    }

    // Lover death cascade (skip user)
    for (const pair of next.loverPairs || []) {
      const [a, b] = pair;
      const pa = next.players.find(p => p.id === a);
      const pb = next.players.find(p => p.id === b);
      if (pa && pb) {
        if (!pa.alive && pb.alive && pb.id !== userId) {
          next.players = next.players.map(p => p.id === b ? { ...p, alive: false } : p);
          next.events = [...next.events, makeEvent(next.turn, 'night', `💔 ${pb.name} meurt de chagrin — son amoureux a ete elimine.`)];
        }
        if (!pb.alive && pa.alive && pa.id !== userId) {
          next.players = next.players.map(p => p.id === a ? { ...p, alive: false } : p);
          next.events = [...next.events, makeEvent(next.turn, 'night', `💔 ${pa.name} meurt de chagrin — son amoureux a ete elimine.`)];
        }
      }
    }

    // If no one died, add "peaceful night" event
    const deathEvents = next.events.filter(e =>
      e.turn === next.turn && e.phase === 'night' &&
      (e.message.includes('devore') || e.message.includes('empoisonne') || e.message.includes('meurt de chagrin'))
    );
    if (deathEvents.length === 0) {
      next.events = [...next.events, makeEvent(next.turn, 'night', 'La nuit a ete calme... personne n\'a ete elimine.')];
    }

    // ── Build PhaseDeathRecord for dawn announcement ──
    const deadPlayerIds = next.players
      .filter(p => aliveBeforeIds.has(p.id) && !p.alive)
      .map(p => p.id);
    const dawnRecord: PhaseDeathRecord = {
      phaseKey: `dawn-${next.turn}`,
      transition: 'dawn' as const,
      turn: next.turn,
      deadPlayerIds,
    };
    next.phaseDeathHistory = [...(next.phaseDeathHistory || []), dawnRecord];
    next.lastPhaseDeaths = dawnRecord;

    // ── Transition to day — show announcement first ──
    next.phase = 'day';
    next.dayStep = 'announcement';
    next.nightStep = 'idle';
    next.werewolfVotes = {};
    next.werewolfTarget = null;
    next.werewolfTargets = wolfTarget !== null ? [wolfTarget] : [];
    next.witchHealTarget = null;
    next.witchKillTargets = {};
    next.witchHealedThisNight = {};
    next.seerTargets = {};
    next.seerResults = {};
    next.guardLastTargets = { ...next.guardTargets };
    next.guardTargets = {};
    next.foxTargets = {};
    next.foxResults = {};
    next.conciergeTargets = {};
    next.corbeauTargets = {};
    next.corbeauMessages = {};
    next.votes = {};
    next.voteResult = null;
    next.voteResults = [];
    next.nominations = {};
    next.earlyVotes = {};

    // Add day header events
    next.events = [
      ...next.events,
      makeEvent(next.turn, 'day', `--- Jour ${next.turn} ---`),
      makeEvent(next.turn, 'day', 'Le village se reveille...'),
    ];
    next.phaseTimerEndAt = null; // No timer during announcement

    return next;
  }, []);

  // ── Transition from announcement → vote ──
  const startVotePhase = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const userId = userPlayerIdRef.current;

    next.dayStep = 'vote';

    // Pre-nominate 3 random alive players (not the user) as vote candidates
    const aliveAfter = next.players.filter(p => p.alive);
    const nominatable = aliveAfter.filter(p => p.id !== userId);
    const nominees = shuffleArray(nominatable).slice(0, 3);
    const nominationsMap: Record<number, number> = {};
    for (const nominee of nominees) {
      const possibleNominators = aliveAfter.filter(p => p.id !== nominee.id);
      const nominator = possibleNominators.length > 0 ? pickRandom(possibleNominators) : aliveAfter[0];
      nominationsMap[nominee.id] = nominator.id;
    }
    next.nominations = nominationsMap;

    next.events = [
      ...next.events,
      makeEvent(next.turn, 'day', 'Le vote commence !'),
    ];
    next.phaseTimerEndAt = computeEndAt(DEMO_PHASE_DURATION);

    return next;
  }, []);

  // ── AI Day Votes ──
  const runAIDayVotes = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const alive = next.players.filter(p => p.alive);
    const userId = userPlayerIdRef.current;
    const aiVoters = alive.filter(p => p.id !== userId);
    const votes: Record<number, number> = { ...(next.votes || {}) };

    // Only the 3 nominated players are vote candidates
    const nomineeIds = Object.keys(next.nominations || {}).map(Number);
    const nomineePlayers = alive.filter(p => nomineeIds.includes(p.id));
    // Fallback: if somehow no nominees, use all alive
    const votePool = nomineePlayers.length > 0 ? nomineePlayers : alive;

    for (const voter of aiVoters) {
      const role = getRoleById(voter.role);
      // Filter out self from vote pool
      const candidates = votePool.filter(p => p.id !== voter.id);
      if (candidates.length === 0) continue;

      if (role?.team === 'werewolf') {
        // Wolves target a non-wolf nominee
        const nonWolves = candidates.filter(p => getRoleById(p.role)?.team !== 'werewolf');
        if (nonWolves.length > 0) {
          votes[voter.id] = pickRandom(nonWolves).id;
        } else {
          votes[voter.id] = pickRandom(candidates).id;
        }
      } else {
        // Villagers vote randomly among nominees
        votes[voter.id] = pickRandom(candidates).id;
      }
    }
    next.votes = votes;
    return next;
  }, []);

  // ── Resolve Day Vote ──
  const resolveVote = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const userId = userPlayerIdRef.current;

    // ── Snapshot alive players BEFORE vote elimination (for phaseDeathHistory) ──
    const aliveBeforeIds = new Set(next.players.filter(p => p.alive).map(p => p.id));

    const voteCount: Record<number, number> = {};
    for (const targetId of Object.values(next.votes)) {
      voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let eliminated: number | null = null;
    for (const [id, count] of Object.entries(voteCount)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminated = Number(id);
      }
    }

    // Check for tie — no elimination on tie
    const maxCount = Object.values(voteCount).filter(c => c === maxVotes);
    if (maxCount.length > 1) eliminated = null;

    // ── User immunity: user cannot be voted out ──
    if (eliminated === userId) eliminated = null;

    next.events = [...next.events, makeEvent(next.turn, 'day', 'Le vote est clos. Decompte des voix...')];

    if (eliminated !== null) {
      next.players = next.players.map(p =>
        p.id === eliminated ? { ...p, alive: false, votesReceived: maxVotes } : p
      );
      next.voteResult = eliminated;
      next.voteResults = eliminated !== null ? [eliminated] : [];
      const target = next.players.find(p => p.id === eliminated);
      next.events = [...next.events, makeEvent(next.turn, 'day', `${target?.name || 'Un joueur'} a ete elimine par le village avec ${maxVotes} vote(s).`)];

      // Lover death cascade (skip user)
      for (const pair of next.loverPairs || []) {
        const [a, b] = pair;
        if (a === eliminated && b !== userId) {
          next.players = next.players.map(p => p.id === b ? { ...p, alive: false } : p);
          const lover = next.players.find(p => p.id === b);
          if (lover) next.events = [...next.events, makeEvent(next.turn, 'day', `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`)];
        }
        if (b === eliminated && a !== userId) {
          next.players = next.players.map(p => p.id === a ? { ...p, alive: false } : p);
          const lover = next.players.find(p => p.id === a);
          if (lover) next.events = [...next.events, makeEvent(next.turn, 'day', `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`)];
        }
      }
    } else {
      next.events = [...next.events, makeEvent(next.turn, 'day', 'Aucune elimination — egalite des votes.')];
    }

    next.voteHistory = [...(next.voteHistory || []), {
      turn: next.turn,
      votes: { ...next.votes },
      eliminated,
    }];

    // ── Build PhaseDeathRecord for dusk announcement ──
    const deadPlayerIds = next.players
      .filter(p => aliveBeforeIds.has(p.id) && !p.alive)
      .map(p => p.id);
    const duskRecord: PhaseDeathRecord = {
      phaseKey: `dusk-${next.turn}`,
      transition: 'dusk' as const,
      turn: next.turn,
      deadPlayerIds,
    };
    next.phaseDeathHistory = [...(next.phaseDeathHistory || []), duskRecord];
    next.lastPhaseDeaths = duskRecord;

    return next;
  }, []);

  // ── Transition Day → Night ──
  const transitionToNight = useCallback((s: GameState): GameState => {
    let next = { ...s };
    const newTurn = next.turn + 1;
    next.phase = 'night';
    next.nightStep = 'active';
    next.dayStep = 'discussion';
    next.turn = newTurn;
    next.votes = {};
    next.voteResult = null;
    next.voteResults = [];
    next.werewolfVotes = {};
    next.nominations = {};
    next.earlyVotes = {};

    // Add night events + reset timer
    next.events = [
      ...next.events,
      makeEvent(newTurn, 'night', `--- Nuit ${newTurn} ---`),
      makeEvent(newTurn, 'night', "Le village s'endort... Tous les roles agissent simultanément."),
    ];
    next.phaseTimerEndAt = computeEndAt(DEMO_NIGHT_DURATION);

    return next;
  }, []);

  // ── Main game loop ──
  useEffect(() => {
    if (!started || gameOver) return;

    const s = stateRef.current;

    // Check win
    const winner = checkWin(s);
    if (winner) {
      const timer = setTimeout(() => {
        updateState(prev => ({ ...prev, winner, screen: 'end' }));
        setGameOver(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Compute remaining ms until phase timer expires (used for auto-transition)
    const timerRemainingMs = s.phaseTimerEndAt
      ? Math.max(0, new Date(s.phaseTimerEndAt).getTime() - Date.now())
      : DEMO_PHASE_DURATION * 1000;

    if (s.phase === 'night') {
      // Night: AI acts after 2s, resolve when timer expires
      const aiTimer = setTimeout(() => {
        updateState(prev => runAINightActions(prev));
      }, Math.min(2000, timerRemainingMs));

      const resolveTimer = setTimeout(() => {
        updateState(prev => resolveNight(prev));
      }, timerRemainingMs);

      return () => {
        clearTimeout(aiTimer);
        clearTimeout(resolveTimer);
      };
    }

    if (s.phase === 'day') {
      if (s.dayStep === 'vote') {
        // AI votes after 3s, resolve when timer expires
        const aiTimer = setTimeout(() => {
          updateState(prev => runAIDayVotes(prev));
        }, Math.min(3000, timerRemainingMs));

        const resolveTimer = setTimeout(() => {
          updateState(prev => {
            const resolved = resolveVote(prev);
            return { ...resolved, dayStep: 'result' };
          });
        }, timerRemainingMs);

        return () => {
          clearTimeout(aiTimer);
          clearTimeout(resolveTimer);
        };
      }

      if (s.dayStep === 'result') {
        // Show result for 4s, then night
        const timer = setTimeout(() => {
          updateState(prev => {
            const winner = checkWin(prev);
            if (winner) {
              setGameOver(true);
              return { ...prev, winner, screen: 'end' };
            }
            return transitionToNight(prev);
          });
        }, 4000);
        return () => clearTimeout(timer);
      }

      if (s.dayStep === 'announcement') {
        // Show announcement for 6s, then start vote phase
        const timer = setTimeout(() => {
          updateState(prev => startVotePhase(prev));
        }, DEMO_ANNOUNCEMENT_DURATION * 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [started, gameOver, state.phase, state.dayStep, state.turn, state.players, checkWin, runAINightActions, resolveNight, startVotePhase, runAIDayVotes, resolveVote, transitionToNight, updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []);

  return {
    state,
    userPlayerId: userPlayerIdRef.current,
    userShortCode: userShortCodeRef.current,
    updateState,
    started,
    gameOver,
  };
}