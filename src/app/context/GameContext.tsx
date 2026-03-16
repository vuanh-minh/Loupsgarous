/**
 * GameContext.tsx — Thin orchestrator (~90 lines).
 *
 * All constants / initial state  → gameContextConstants.ts
 * All game-action callbacks      → useGameActions.ts
 * Server sync / local mode       → useGameSync.ts
 */
import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

// ── Re-export types for backward compatibility ──
export type {
  Player, Hint, PlayerHint, DynamicHint, GamePhase, NightStep, DayStep,
  GameEvent, PhaseDeathRecord, GameState,
  Quest, QuestTask, QuestTaskInputType, QuestStatus,
} from './gameTypes';

// ── Re-export localStorage helpers used by other pages ──
export { localLoadGamesList, localSaveGamesList, localDeleteState } from './gameContextConstants';

import type { GameState } from './gameTypes';
import {
  initialState,
  defaultContextValue,
  type GameContextType,
} from './gameContextConstants';

import { useGameActions } from './useGameActions';
import { useGameSync } from './useGameSync';

const GameContext = createContext<GameContextType>(defaultContextValue);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>({ ...initialState });

  const [isGM, setIsGMRaw] = useState(() => {
    try { return sessionStorage.getItem('loup-garou-isGM') === 'true'; } catch { return false; }
  });
  const setIsGM = useCallback((v: boolean) => {
    setIsGMRaw(v);
    try { if (v) sessionStorage.setItem('loup-garou-isGM', 'true'); else sessionStorage.removeItem('loup-garou-isGM'); } catch {}
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Sync (local mode, server load/save, merge) ──
  const {
    localMode, localModeRef,
    syncToServer, loadFromServer, mergePlayerActions, setFullState, applyStateDelta,
    isDeltaRecoveryNeeded, clearDeltaRecovery,
  } = useGameSync({ setState, state, stateRef });

  // ── All game-action callbacks ──
  const actions = useGameActions({ setState, stateRef, localModeRef });

  return (
    <GameContext.Provider
      value={{
        state,
        ...actions,
        syncToServer,
        loadFromServer,
        setFullState,
        applyStateDelta,
        mergePlayerActions,
        isDeltaRecoveryNeeded,
        clearDeltaRecovery,
        isGM,
        setIsGM,
        localMode,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}