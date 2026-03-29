/**
 * gamePanelTypes.ts
 * Shared prop types for GamePanel and its sub-components.
 */
import type React from 'react';
import type { Player, GameEvent, Hint, PlayerHint } from '../../../context/GameContext';
import type { RoleDefinition } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';

export interface GamePanelProps {
  alivePlayers: Player[];
  phase: string;
  dayStep: string;
  currentPlayerId: number | null;
  votes: Record<number, number>;
  onVote: (voterId: number, targetId: number) => void;
  onCancelVote: (voterId: number) => void;
  currentPlayerAlive: boolean;
  canFlip?: boolean;
  onFlip?: () => void;
  currentRole?: RoleDefinition;
  hypotheses?: Record<number, string>;
  isPracticeMode?: boolean;
  isSimulationMode?: boolean;
  isDemoMode?: boolean;
  tutorialStep?: number;
  isVillageois?: boolean;
  t: GameThemeTokens;
  deadPlayers?: Player[];
  events?: GameEvent[];
  turn?: number;
  hints?: Hint[];
  playerHints?: PlayerHint[];
  onRevealHint?: (hintId: number) => void;
  phaseTimerEndAt?: string | null;
  loverPairs?: [number, number][];
  allPlayers?: Player[];
  maireId?: number | null;
  maireElectionDone?: boolean;
  maireCandidates?: number[];
  maireCampaignMessages?: Record<number, string>;
  onDeclareCandidacy?: (playerId: number, message?: string) => void;
  onWithdrawCandidacy?: (playerId: number) => void;
  nominations?: Record<number, number>;
  lastWillUsed?: Record<number, boolean>;
  dayEliminationsCount?: number;
  isFlipped?: boolean;
  onFlipBack?: () => void;
  roleBackContent?: React.ReactNode;
  onSetHypothesis?: (targetPlayerId: number, roleId: string) => void;
  gameId?: string;
  earlyVotes?: Record<number, number>;
}