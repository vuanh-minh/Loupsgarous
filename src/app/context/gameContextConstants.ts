/**
 * gameContextConstants.ts
 * Pure constants, types, helpers and initial state for GameContext.
 * No React dependencies — safe to import anywhere.
 */
import { ROLES } from '../data/roles';
import type {
  Player, GamePhase, NightStep, DayStep,
  GameEvent, GameState, PhaseDeathRecord,
  Quest, QuestTask, QuestTaskInputType, QuestStatus,
} from './gameTypes';
import type { RoleDefinition } from '../data/roles';
import type { StateDelta } from './deltaSync';

// ── Re-export types so GameContext.tsx can still re-export them ──
export type { Player, GamePhase, NightStep, DayStep, GameEvent, PhaseDeathRecord, GameState, Quest, QuestTask, QuestTaskInputType, QuestStatus };

// ── Avatars ──
export const AVATARS = [
  '🧔','👩','👨','👵','🧑','👴','👱‍♀️','👱','🧑‍🦰','👩‍🦱',
  '👨‍🦳','👩‍🦳','🧑‍🦲','👩‍🦲','🧓','👲','🧕','👳‍♀️','👳','🤵',
  '🧑‍🎤','👩‍🎤','👨‍🎤','🧑‍🏫','👩‍🏫','👨‍🏫','🧑‍🍳','👩‍🍳','👨‍🍳','🧑‍🔧',
  '👩‍🔧','👨‍🔧','🧑‍💼','👩‍💼','👨‍💼','🧑‍🔬','👩‍🔬','👨‍🔬','🧑‍💻','👩‍💻',
  '👨‍💻','🧑‍🎨','👩‍🎨','👨‍🎨','🧑‍🚒','👩‍🚒','👨‍🚒','🧑‍✈️','👩‍✈️','👨‍✈️',
  '🧑‍🚀','👩🚀','👨🚀','🧑‍⚖️','👩‍⚖️','👨‍⚖️','🫅','🥷','🦸','🦹',
];

// ── Short code generation ──
// Format: first 3 letters of name (uppercase, unaccented) + 1 random digit
// e.g. Adrien -> ADR1, Cindy -> CIN4, Etienne -> ETI4
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function generateShortCode(name: string, existingCodes: Set<string>): string {
  const clean = stripAccents(name.trim()).replace(/[^a-zA-Z]/g, '').toUpperCase();
  const prefix = (clean.length >= 3 ? clean.slice(0, 3) : clean.padEnd(3, 'X'));
  let attempts = 0;
  let code = '';
  do {
    const digit = Math.floor(Math.random() * 10);
    code = `${prefix}${digit}`;
    attempts++;
  } while (existingCodes.has(code) && attempts < 50);
  // Fallback: append a second digit if all single-digit variants are taken
  if (existingCodes.has(code)) {
    code = `${prefix}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  }
  return code;
}

// ── Event id counter ──
let eventIdCounter = 0;
export function nextEventId() {
  return ++eventIdCounter;
}
export function syncEventCounter(events: { id: number }[]) {
  if (events.length > 0) {
    const maxId = Math.max(...events.map((e) => e.id));
    if (maxId >= eventIdCounter) {
      eventIdCounter = maxId;
    }
  }
}

// ── localStorage helpers (local / offline mode) ──
const LS_PREFIX = 'loup-garou-local-state-';
const LS_GAMES_KEY = 'loup-garou-local-games';

export function localSaveState(gameId: string, gs: GameState) {
  try {
    localStorage.setItem(`${LS_PREFIX}${gameId}`, JSON.stringify(gs));
  } catch (err) {
    console.log('localStorage save error:', err);
  }
}

export function localLoadState(gameId: string): GameState | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${gameId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.log('localStorage load error:', err);
    return null;
  }
}

export function localDeleteState(gameId: string) {
  try {
    localStorage.removeItem(`${LS_PREFIX}${gameId}`);
  } catch {}
}

export function localLoadGamesList(): { id: string; [key: string]: unknown }[] {
  try {
    const raw = localStorage.getItem(LS_GAMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function localSaveGamesList(games: { id: string; [key: string]: unknown }[]) {
  try {
    localStorage.setItem(LS_GAMES_KEY, JSON.stringify(games));
  } catch {}
}

// ── Default role config ──
export const defaultRoleConfig: Record<string, number> = {};
ROLES.forEach((r) => {
  defaultRoleConfig[r.id] = r.defaultCount;
});

// ── Initial state ──
export const initialState: GameState = {
  gameId: '',
  screen: 'home',
  players: [],
  roleConfig: { ...defaultRoleConfig },
  phase: 'night',
  nightStep: 'idle',
  dayStep: 'discussion',
  turn: 1,
  events: [],
  timer: 120,
  timerRunning: false,
  winner: null,
  werewolfTarget: null,
  werewolfVotes: {},
  werewolfVoteMessages: {},
  werewolfTargets: [],
  wolfKillsPerNight: 1,
  seerTargets: {},
  seerResults: {},
  witchHealUsedBy: [],
  witchKillUsedBy: [],
  witchHealTarget: null,
  witchKillTargets: {},
  witchHealedThisNight: {},
  votes: {},
  voteResult: null,
  voteResults: [],
  dayEliminationsCount: 1,
  loverPairs: [],
  cupidLinkedBy: [],
  hunterPending: false,
  hunterShooterId: null,
  hunterPreTargets: {},
  hypotheses: {},
  voteHistory: [],
  roleRevealDone: false,
  roleRevealedBy: [],
  guardTargets: {},
  guardLastTargets: {},
  corbeauTargets: {},
  corbeauMessages: {},
  corbeauLastTargets: {},
  earlyVotes: {},
  foxTargets: {},
  foxResults: {},
  hints: [],
  playerHints: [],
  phaseTimerDuration: 900,
  phaseTimerEndAt: null,
  phaseTimerDayDuration: 900,
  phaseTimerNightDuration: 900,
  phaseTimerMaireDuration: 900,
  maireId: null,
  maireElectionDone: false,
  maireVotes: {},
  maireCandidates: [],
  maireCampaignMessages: {},
  maireSuccessionPending: false,
  maireSuccessionFromId: null,
  maireSuccessionPhase: null,
  conciergeTargets: {},
  oracleUsed: {},
  oracleResults: {},
  empoisonneurTargets: {},
  poisonedPlayers: {},
  lastWillUsed: {},
  wolfMissedVotes: {},
  wolfInactivityThreshold: 2,
  randomVoteIfInactive: true,
  villagerMissedVotes: {},
  villagerInactivityThreshold: 2,
  nominations: {},
  quests: [],
  questAssignments: {},
  questsPerPhase: 1,
  questCompletionsThisPhase: {},
  playerTags: {},
  availableTags: [],
  gameMode: 'classic',
  suspectLists: {},
  midGameJoinIds: [],
  gmAlerts: {},
};

// ── GameContextType interface ──
export interface GameContextType {
  state: GameState;
  setScreen: (screen: GameState['screen']) => void;
  updateRoleConfig: (roleId: string, count: number) => void;
  setupPlayers: (count: number, names?: string[], avatarUrls?: (string | undefined)[], shortCodes?: (string | undefined)[]) => void;
  assignRoles: (preAssignments?: Record<number, string>) => void;
  setPhase: (phase: GamePhase) => void;
  setNightStep: (step: NightStep) => void;
  setDayStep: (step: DayStep) => void;
  addEvent: (message: string) => void;
  setTimer: (seconds: number) => void;
  toggleTimer: () => void;
  tickTimer: () => void;
  eliminatePlayer: (playerId: number) => void;
  revivePlayer: (playerId: number, newRole?: string) => void;
  setWerewolfTarget: (playerId: number | null) => void;
  castWerewolfVote: (wolfId: number, targetId: number) => void;
  setSeerTarget: (seerPlayerId: number, targetPlayerId: number | null) => void;
  confirmWerewolfKill: () => void;
  confirmSeerReveal: () => void;
  useWitchHeal: (witchPlayerId: number) => void;
  useWitchKill: (witchPlayerId: number, targetPlayerId: number) => void;
  cancelWitchKill: (witchPlayerId: number) => void;
  castVote: (voterId: number, targetId: number) => void;
  cancelVote: (voterId: number) => void;
  resolveVote: () => void;
  checkWinCondition: () => 'village' | 'werewolf' | 'lovers' | null;
  endGame: (winner: 'village' | 'werewolf' | 'lovers') => void;
  resetGame: () => void;
  relaunchGame: () => void;
  getTotalRoles: () => number;
  nextTurn: () => void;
  setCupidLink: (cupidPlayerId: number, id1: number, id2: number) => void;
  confirmHunterShot: (targetId: number) => void;
  setHunterPreTarget: (hunterId: number, targetId: number | null) => void;
  setHypothesis: (viewerId: number, targetId: number, roleId: string | null) => void;
  addPlayerMidGame: (name: string, chosenRoleId?: string) => void;
  setPlayerAvatar: (playerId: number, avatarUrl: string) => void;
  setRoleRevealDone: (done: boolean) => void;
  clearJustRevived: (playerId: number) => void;
  setGuardTarget: (guardPlayerId: number, targetPlayerId: number | null) => void;
  updateState: (updater: (s: GameState) => GameState) => void;
  syncToServer: () => Promise<void>;
  loadFromServer: (opts?: { gameId?: string; shortCode?: string }) => Promise<GameState | null>;
  setFullState: (state: GameState) => void;
  applyStateDelta: (delta: StateDelta) => void;
  mergePlayerActions: () => Promise<boolean>;
  isDeltaRecoveryNeeded: () => boolean;
  clearDeltaRecovery: () => void;
  isGM: boolean;
  setIsGM: (v: boolean) => void;
  localMode: boolean;
}

// ── Default (noop) context value ──
const noop = (() => {}) as (...args: never[]) => void;
const noopReturn = (() => null) as () => null;
const noopAsync = (async () => {}) as () => Promise<void>;
const noopAsyncNull = (async () => null) as () => Promise<null>;

export const defaultContextValue: GameContextType = {
  state: { ...initialState },
  setScreen: noop,
  updateRoleConfig: noop,
  setupPlayers: noop,
  assignRoles: noop,
  setPhase: noop,
  setNightStep: noop,
  setDayStep: noop,
  addEvent: noop,
  setTimer: noop,
  toggleTimer: noop,
  tickTimer: noop,
  eliminatePlayer: noop,
  revivePlayer: noop,
  setWerewolfTarget: noop,
  castWerewolfVote: noop,
  setSeerTarget: (seerPlayerId: number, targetPlayerId: number | null) => {},
  confirmWerewolfKill: noop,
  confirmSeerReveal: noop,
  useWitchHeal: (witchPlayerId: number) => {},
  useWitchKill: (witchPlayerId: number, targetPlayerId: number) => {},
  cancelWitchKill: (witchPlayerId: number) => {},
  castVote: noop,
  cancelVote: noop,
  resolveVote: noop,
  checkWinCondition: noopReturn as () => 'village' | 'werewolf' | 'lovers' | null,
  endGame: noop,
  resetGame: noop,
  relaunchGame: noop,
  getTotalRoles: () => 0,
  nextTurn: noop,
  setCupidLink: (cupidPlayerId: number, id1: number, id2: number) => {},
  confirmHunterShot: noop,
  setHunterPreTarget: (hunterId: number, targetId: number | null) => {},
  setHypothesis: noop,
  addPlayerMidGame: noop,
  setPlayerAvatar: noop,
  setRoleRevealDone: noop,
  clearJustRevived: noop,
  setGuardTarget: (guardPlayerId: number, targetPlayerId: number | null) => {},
  updateState: noop,
  syncToServer: noopAsync,
  loadFromServer: noopAsyncNull as () => Promise<GameState | null>,
  setFullState: noop,
  applyStateDelta: noop,
  mergePlayerActions: noopAsync as () => Promise<boolean>,
  isDeltaRecoveryNeeded: () => false,
  clearDeltaRecovery: noop,
  isGM: false,
  setIsGM: noop,
  localMode: false,
};