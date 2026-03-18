import React, { createContext, useContext } from 'react';
import { type Player, type GameState, type NightStep, type DayStep } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type HeartbeatMap } from '../../../context/useRealtimeSync';
import { type MobileGameView } from './GMShared';

/* ================================================================
   GamePanelContext — eliminates prop drilling across GM sub-components.
   Provides game state, actions, UI state, and derived helpers.
   ================================================================ */

export interface GamePanelContextValue {
  /* ---- Game State (read-only data) ---- */
  state: GameState;
  alivePlayers: Player[];
  deadPlayers: Player[];
  isNight: boolean;
  isMobile: boolean;
  playerHeartbeats: HeartbeatMap;
  t: GameThemeTokens;

  /* ---- Game Actions (callbacks from parent) ---- */
  hasRole: (id: string) => boolean;
  leverLeSoleil: () => void;
  handleAdvanceTurn: () => void;
  handleStartNight1: () => void;
  eliminatePlayer: (id: number) => void;
  revivePlayer: (id: number, newRole?: string) => void;
  addEvent: (msg: string) => void;
  navigate: (to: string) => void;
  setNightStep: (s: NightStep) => void;
  confirmHunterShot: (id: number) => void;
  setDayStep: (s: DayStep) => void;
  resolveVote: () => void;
  setGuardTarget: (guardId: number, targetId: number | null) => void;
  updateState: (updater: (s: GameState) => GameState) => void;
  onSendHintToPlayer?: (playerId: number) => void;
  broadcastTestNotification?: (shortCode: string) => void;
  handleResolveMaireElection?: () => void;

  /* ---- Top-level UI state (passed through) ---- */
  showEventLog: boolean;
  setShowEventLog: (v: boolean) => void;
  resultDismissed?: boolean;
  onShowResult?: () => void;

  /* ---- Panel-local UI state ---- */
  selectedPlayer: number | null;
  setSelectedPlayer: (id: number | null) => void;
  mobileView: MobileGameView;
  setMobileView: (v: MobileGameView) => void;
  revivePendingId: number | null;
  setRevivePendingId: (id: number | null) => void;
  nightActionsTab: 'pending' | 'done';
  setNightActionsTab: (tab: 'pending' | 'done') => void;
  nightActionPickerPlayers: {
    players: Player[];
    actionLabel: string;
    actionEmoji: string;
    actionColor: string;
    playerStatuses: Record<number, { done: boolean; detail: string }>;
  } | null;
  setNightActionPickerPlayers: (v: GamePanelContextValue['nightActionPickerPlayers']) => void;

  /* ---- Derived helpers ---- */
  navigateToPlayerPreview: (player: Player) => void;
  getPlayerStatuses: (actionId: string, actionPlayers: Player[]) => Record<number, { done: boolean; detail: string }>;
  handleNightActionClick: (players: Player[], label: string, emoji: string, color: string, actionId: string) => void;

  /* ---- External navigation (mobile) ---- */
  onNavigateToPlayersTab?: (playerId: number) => void;
}

const GamePanelContext = createContext<GamePanelContextValue | null>(null);

export function GamePanelProvider({ value, children }: { value: GamePanelContextValue; children: React.ReactNode }) {
  return <GamePanelContext.Provider value={value}>{children}</GamePanelContext.Provider>;
}

export function useGamePanelContext(): GamePanelContextValue {
  const ctx = useContext(GamePanelContext);
  if (!ctx) throw new Error('useGamePanelContext must be used within a GamePanelProvider');
  return ctx;
}