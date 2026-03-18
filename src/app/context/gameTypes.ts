/**
 * gameTypes.ts — Shared type definitions for the Loup-Garou game state.
 * Extracted from GameContext.tsx to reduce file size and improve reusability.
 * (cache-bust: v2)
 */
import type { RoleDefinition } from '../data/roles';

export interface Player {
  id: number;
  shortCode: string;
  name: string;
  role: string;
  alive: boolean;
  avatar: string;
  avatarUrl?: string;
  votesReceived: number;
  justRevived?: boolean;
  /** True if the player was added after the role-reveal phase ended */
  joinedMidGame?: boolean;
}

export interface Hint {
  id: number;
  text: string;
  imageUrl?: string;                          // optional image uploaded by the GM
  fromDynamic?: boolean;                      // true if created by revealing a dynamic hint
  createdAt: string;
}

export interface PlayerHint {
  hintId: number;
  playerId: number;
  sentAt: string;
  revealed: boolean;
  revealedAt?: string;
}

/* ── Dynamic Hint System ── */
export interface DynamicHint {
  id: number;
  targetPlayerId: number;   // The player this hint is about
  text: string;             // May contain {role} placeholder
  imageUrl?: string;        // optional image uploaded by the GM
  priority: 1 | 2 | 3;     // Priority level: 1 = first revealed, 2 = after P1, 3 = after P2
  revealed: boolean;        // true if granted to at least one player (kept for backwards compat)
  revealedAt?: string;
  createdAt: string;
  /** IDs of players who have been granted this hint (supports multi-player grants) */
  grantedToPlayerIds?: number[];
}

/* ── Quest System ── */
export type QuestTaskInputType = 'text' | 'code' | 'player-select' | 'multiple-choice';
export type QuestStatus = 'active' | 'pending-resolution' | 'success' | 'fail';
export type QuestType = 'individual' | 'collaborative';

export interface QuestTask {
  id: number;
  question: string;
  inputType: QuestTaskInputType;
  choices?: string[];                       // for multiple-choice
  correctAnswer: string;                    // GM-configured correct answer
  imageUrl?: string;                        // optional image displayed after the question
  referencedPlayerId?: number;              // optional: player this task is about (avatar shown next to question)
  playerAnswers: Record<number, string>;    // playerId -> submitted answer
  playerResults: Record<number, boolean>;   // playerId -> true/false (set on resolution)
  templateId?: number;                      // reference to TaskTemplate.id in the task library
}

/** Reusable task template stored in the task library */
export interface TaskTemplate {
  id: number;
  question: string;
  inputType: QuestTaskInputType;
  choices?: string[];
  correctAnswer: string;
  imageUrl?: string;
  referencedPlayerId?: number;
  createdAt: string;
  /** Source gallery ID (number for per-player, 'pretask' for general pre-tasks) */
  gallerySourceId?: number | string;
  /** Original pre-task ID from gallery (for deduplication) */
  originalPreTaskId?: number;
}

export interface Quest {
  id: number;
  title: string;
  description: string;
  questType?: QuestType;                        // default 'individual'
  playerStatuses: Record<number, QuestStatus>;  // playerId -> individual status
  tasks: QuestTask[];
  collaborativeVotes?: Record<number, boolean>; // playerId -> true (success) / false (fail)
  collaborativeGroups?: number[][];             // groups of player IDs for collaborative quests
  collaborativeGroupSize?: number;              // desired group size (2-5, default 3)
  createdAt: string;
  resolvedAt?: string;
  hidden: boolean;                              // hidden from players until revealed by GM
  rewardHintIds?: Record<number, number>;       // playerId -> hintId rewarded on success
  targetTags?: string[];                        // if set, only players with at least one of these tags are eligible (OR logic)
  distributionOrder?: number | 'random' | 'available';        // numeric = priority (lower first), 'random' = random pick (default), 'available' = auto-assigned to all eligible players
  /** Tracks in which phase each player's quest was resolved: playerId -> "turn-phase" key */
  playerResolvedInPhase?: Record<number, string>;
  /** Original gallery pre-quest ID (for deduplication during auto-import) */
  galleryPreQuestId?: number;
}

export type GamePhase = 'night' | 'day';
export type NightStep = 'werewolves' | 'seer' | 'witch' | 'cupidon' | 'idle' | 'done' | 'active';
export type DayStep = 'discussion' | 'vote' | 'result' | 'announcement';

export interface GameEvent {
  id: number;
  turn: number;
  phase: GamePhase;
  message: string;
  timestamp: string; // ISO string for serialization
}

/** Snapshot of the most recent phase transition's death announcement */
export interface PhaseDeathRecord {
  /** Unique key: e.g. "dawn-2" or "dusk-3" */
  phaseKey: string;
  transition: 'dawn' | 'dusk';
  turn: number;
  deadPlayerIds: number[];
  /** Player IDs who joined mid-game since the previous phase transition */
  newPlayerJoinIds?: number[];
}

export interface GameState {
  gameId: string;
  screen: 'home' | 'setup' | 'game' | 'vote' | 'end';
  players: Player[];
  roleConfig: Record<string, number>;
  phase: GamePhase;
  nightStep: NightStep;
  dayStep: DayStep;
  turn: number;
  events: GameEvent[];
  timer: number;
  timerRunning: boolean;
  winner: 'village' | 'werewolf' | 'lovers' | null;
  werewolfTarget: number | null;
  werewolfVotes: Record<number, number>;
  werewolfVoteMessages: Record<number, string>; // wolfId -> optional message when voting
  werewolfTargets: number[];          // all resolved wolf kill targets (top N by vote)
  wolfKillsPerNight: number;          // max wolf kills per night (GM setting, default 1)
  seerTargets: Record<number, number>;          // seerPlayerId -> targetPlayerId
  seerResults: Record<number, RoleDefinition | null>; // seerPlayerId -> result
  witchHealUsedBy: number[];     // witch player IDs who permanently used heal
  witchKillUsedBy: number[];     // witch player IDs who permanently used kill
  witchHealTarget: number | null;   // wolf victim shown to witches
  witchKillTargets: Record<number, number>;  // witchPlayerId -> targetPlayerId
  witchHealedThisNight: Record<number, boolean>;  // witchPlayerId -> true if healed this night
  votes: Record<number, number>;
  voteResult: number | null;
  /** All player IDs eliminated by the village vote (supports multi-elimination). */
  voteResults: number[];
  /** Number of players eliminated during the day vote. Default 1, max 3. */
  dayEliminationsCount: number;
  loverPairs: [number, number][];   // array of lover pairs
  cupidLinkedBy: number[];          // cupid player IDs who have linked
  hunterPending: boolean;
  hunterShooterId: number | null;
  hunterPreTargets: Record<number, number>;  // hunterId -> preselected target
  hypotheses: Record<number, Record<number, string>>;
  voteHistory: Array<{ turn: number; votes: Record<number, number>; eliminated: number | null; nominations?: Record<number, number> }>;
  roleRevealDone: boolean;
  roleRevealedBy: number[];
  guardTargets: Record<number, number>;       // guardPlayerId -> protectedPlayerId
  guardLastTargets: Record<number, number>;   // guardPlayerId -> lastProtectedPlayerId
  corbeauTargets: Record<number, number>;     // corbeauPlayerId -> targetPlayerId
  corbeauMessages: Record<number, string>;    // corbeauPlayerId -> custom message
  corbeauLastTargets: Record<number, number>; // corbeauPlayerId -> lastTargetPlayerId
  earlyVotes: Record<number, number>;         // voterId -> targetId (anticipated vote during night)
  foxTargets: Record<number, number[]>;       // foxPlayerId -> array of 3 sniffed player IDs
  foxResults: Record<number, boolean>;        // foxPlayerId -> true if at least 1 wolf found
  hints: Hint[];
  playerHints: PlayerHint[];
  phaseTimerDuration: number; // seconds, 0 = disabled
  phaseTimerEndAt: string | null; // ISO timestamp when timer expires
  phaseTimerDayDuration: number; // seconds for day phases (fallback to phaseTimerDuration)
  phaseTimerNightDuration: number; // seconds for night phases (fallback to phaseTimerDuration)
  phaseTimerMaireDuration: number; // seconds for Maire election phase (fallback to phaseTimerDayDuration)
  maireId: number | null;           // player ID of the elected Maire (overlay role)
  maireElectionDone: boolean;       // whether the Maire election has been resolved
  maireVotes: Record<number, number>; // voterId -> candidateId during Maire election
  maireCandidates: number[];         // player IDs who declared candidacy for Maire
  maireCampaignMessages: Record<number, string>; // playerId -> campaign message for Maire election
  /** Mayor succession: pending flag when the current Maire dies */
  maireSuccessionPending: boolean;
  /** Player ID of the dying Maire who must choose a successor */
  maireSuccessionFromId: number | null;
  /** Phase during which the Maire died (determines when successor's role activates) */
  maireSuccessionPhase: GamePhase | null;
  /** Alive snapshot at the start of the current phase (used to compute deaths at transition) */
  aliveAtPhaseStart?: Record<number, boolean>;
  /** Most recent phase transition's death data -- consumed by player-side announcements */
  lastPhaseDeaths?: PhaseDeathRecord;
  /** Full history of phase death records -- used to show all missed deaths to late joiners */
  phaseDeathHistory?: PhaseDeathRecord[];
  /** Concierge: maps concierge player ID -> observed player ID (this night) */
  conciergeTargets: Record<number, number>;
  /** Dernière volonté: tracks which dead players have used their one-time last-will vote */
  lastWillUsed: Record<number, boolean>;
  /** Wolf inactivity: tracks consecutive nights each wolf has NOT voted. Killed at 2. */
  wolfMissedVotes: Record<number, number>;
  /** Wolf inactivity threshold: number of consecutive missed votes before death. 0 = disabled. */
  wolfInactivityThreshold: number;
  /** Villager inactivity: tracks consecutive day phases each player has NOT voted. */
  villagerMissedVotes: Record<number, number>;
  /** Villager inactivity threshold: number of consecutive missed day votes before elimination. 0 = disabled. */
  villagerInactivityThreshold: number;
  /** Whether inactive players get a random vote assigned automatically. true = enabled (default). */
  randomVoteIfInactive: boolean;
  /** Tracks who first nominated each target: targetId -> first nominatorId */
  nominations: Record<number, number>;
  /** Whether the Maire election success screen is currently showing */
  maireSuccessScreen?: boolean;
  /** Quest system: missions created by GM */
  quests: Quest[];
  /** Quest assignments: playerId -> array of assigned quest IDs */
  questAssignments: Record<number, number[]>;
  /** Max quests a player can complete per phase (day or night). 0 = unlimited. Default 1. */
  questsPerPhase: number;
  /** Tracks quest completions this phase: playerId -> count of quests completed */
  questCompletionsThisPhase: Record<number, number>;
  /** Player tags: playerId -> array of tag names */
  playerTags: Record<number, string[]>;
  /** Available tags created by GM */
  availableTags: string[];
  /** Lobby players: pre-game registrations from QR/link join flow */
  lobbyPlayers?: Array<{ id: string; name: string; shortCode: string; joinedAt: string }>;
  /** Game mode — always classic */
  gameMode: 'classic';
  /** @deprecated Kept for backwards compat — unused */
  suspectLists: Record<number, number[]>;
  /** Player IDs added mid-game, pending inclusion in the next phase death record */
  midGameJoinIds?: number[];
  /** GM-triggered alerts: shortCode -> timestamp (ms). Player detects new timestamp and shows in-app toast. */
  gmAlerts?: Record<string, number>;
  /** IDs of players who have "joined the village" (present & active).
   *  Set when roleRevealDone transitions to true. Players NOT in this list are "away".
   *  Undefined = backwards-compat: all players are present. */
  villagePresentIds?: number[];
  /** Dynamic hints: GM-created hints targeting specific players, distributed by team */
  dynamicHints?: DynamicHint[];
  /** Task library: reusable task templates for quest creation */
  taskLibrary?: TaskTemplate[];
}