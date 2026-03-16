import { useState, useEffect, useRef, useCallback } from 'react';
import { type GameState } from '../../../context/GameContext';
import { API_BASE, publicAnonKey } from '../../../context/apiConfig';

/** Duration (ms) to suppress polls after a player action to protect optimistic state */
const ACTION_DIRTY_WINDOW = 1500;

interface PlayerSyncOptions {
  shortCode: string | null;
  fallbackGameId: string | null;
  state: GameState;
  isGMPreview: boolean;
  currentPlayerId: number | null;
  loadFromServer: (opts?: { gameId?: string; shortCode?: string }) => Promise<GameState | null>;
  setFullState: (gs: GameState) => void;
  setHypothesis: (viewerId: number, targetId: number, roleId: string | null) => void;
  realtimeConnected: boolean;
  broadcastHeartbeat: (shortCode: string) => void;
  localMode: boolean;
  isDeltaRecoveryNeeded: () => boolean;
  clearDeltaRecovery: () => void;
  broadcastResyncRequest: () => void;
}

export function usePlayerSync({
  shortCode,
  fallbackGameId,
  state,
  isGMPreview,
  currentPlayerId,
  loadFromServer,
  setFullState,
  setHypothesis,
  realtimeConnected,
  broadcastHeartbeat,
  localMode,
  isDeltaRecoveryNeeded,
  clearDeltaRecovery,
  broadcastResyncRequest,
}: PlayerSyncOptions) {
  // ---- Initial loading ----
  const [initialLoading, setInitialLoading] = useState(true);

  // ---- Action dirty window: suppress poll overwrites briefly after an action ----
  const lastActionTsRef = useRef(0);
  const pendingRefreshRef = useRef(false);

  // ---- Adaptive polling state (declared early so markActionSent can reset backoff) ----
  const noChangePollCountRef = useRef(0);
  const lastPollHashRef = useRef('');

  /** Call this right before sending any server action to protect optimistic state */
  const markActionSent = useCallback(() => {
    lastActionTsRef.current = Date.now();
    pendingRefreshRef.current = true;
    // Reset backoff — action means state is changing, poll more aggressively after dirty window
    noChangePollCountRef.current = 0;
  }, []);

  /** Force an immediate re-fetch from server (called after server action confirms) */
  const triggerImmediateRefresh = useCallback(async () => {
    // Small delay to let the server write propagate
    await new Promise(r => setTimeout(r, 200));
    try {
      const serverState = await loadFromServer(shortCode ? { shortCode } : undefined);
      if (serverState) {
        pendingRefreshRef.current = false;
        setFullState(serverState);
      }
    } catch { /* ignore */ }
  }, [loadFromServer, setFullState, shortCode]);

  // ---- Resync ----
  const [isResyncing, setIsResyncing] = useState(false);
  const handleResync = useCallback(async () => {
    setIsResyncing(true);
    try {
      lastActionTsRef.current = 0; // Clear dirty window for manual resync
      pendingRefreshRef.current = false;
      const serverState = await loadFromServer(shortCode ? { shortCode } : undefined);
      if (serverState) setFullState(serverState);
    } catch { /* ignore */ }
    setTimeout(() => setIsResyncing(false), 600);
  }, [loadFromServer, setFullState, shortCode]);

  // ---- Adaptive fallback polling with exponential backoff ----
  useEffect(() => {
    let active = true;
    // Reset backoff counters on mount / dependency change
    noChangePollCountRef.current = 0;

    const poll = async () => {
      // Skip poll if within dirty window (action recently sent)
      const elapsed = Date.now() - lastActionTsRef.current;
      if (elapsed < ACTION_DIRTY_WINDOW && lastActionTsRef.current > 0) {
        if (active) setInitialLoading(false);
        return;
      }
      // Try loading by shortCode first
      let serverState = await loadFromServer(shortCode ? { shortCode } : undefined);
      // If shortCode lookup fails and we have a fallback gameId, try by gameId
      if (!serverState && fallbackGameId) {
        serverState = await loadFromServer({ gameId: fallbackGameId });
      }
      if (active && serverState) {
        // Check if state actually changed (cheap hash comparison)
        const hash = `${serverState.turn}-${serverState.phase}-${serverState.dayStep}-${serverState.nightStep}-${Object.keys(serverState.votes || {}).length}-${Object.keys(serverState.werewolfVotes || {}).length}`;
        if (hash === lastPollHashRef.current) {
          noChangePollCountRef.current++;
        } else {
          noChangePollCountRef.current = 0;
          lastPollHashRef.current = hash;
        }
        pendingRefreshRef.current = false;
        setFullState(serverState);
      }
      if (active) setInitialLoading(false);
    };
    poll();

    // Adaptive interval: start at base, increase up to max when no changes detected
    const BASE_POLL = realtimeConnected ? 10000 : 2000;
    const MAX_POLL = realtimeConnected ? 30000 : 5000;

    let currentInterval: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      // Exponential backoff: base * 1.5^(min(noChangeCount, 5))
      const backoffFactor = Math.min(Math.pow(1.5, Math.min(noChangePollCountRef.current, 5)), MAX_POLL / BASE_POLL);
      const nextDelay = Math.min(Math.round(BASE_POLL * backoffFactor), MAX_POLL);
      currentInterval = setTimeout(async () => {
        await poll();
        if (active) schedulePoll();
      }, nextDelay);
    };
    schedulePoll();

    return () => {
      active = false;
      clearTimeout(currentInterval);
    };
  }, [loadFromServer, setFullState, realtimeConnected, shortCode, fallbackGameId]);

  // ---- Delta version gap recovery ----
  // When a gap is detected in delta versions, immediately fetch full state
  useEffect(() => {
    if (!realtimeConnected) return; // Only relevant when using realtime deltas
    const checkInterval = setInterval(async () => {
      if (isDeltaRecoveryNeeded()) {
        console.log('[usePlayerSync] Delta version gap detected — requesting resync + fetching full state');
        clearDeltaRecovery();
        noChangePollCountRef.current = 0; // Reset backoff for aggressive polling
        // Ask GM to re-broadcast full state via Realtime (fast path)
        broadcastResyncRequest();
        // Also fetch from REST as fallback (in case GM missed the request)
        try {
          let serverState = await loadFromServer(shortCode ? { shortCode } : undefined);
          if (!serverState && fallbackGameId) {
            serverState = await loadFromServer({ gameId: fallbackGameId });
          }
          if (serverState) {
            setFullState(serverState);
          }
        } catch (err) {
          console.log('[usePlayerSync] Delta recovery fetch error:', err);
        }
      }
    }, 2000); // Check every 2s
    return () => clearInterval(checkInterval);
  }, [realtimeConnected, isDeltaRecoveryNeeded, clearDeltaRecovery, broadcastResyncRequest, loadFromServer, setFullState, shortCode, fallbackGameId]);

  // ---- Heartbeat ----
  const gameIdRef = useRef(state.gameId);
  gameIdRef.current = state.gameId;

  useEffect(() => {
    if (!shortCode) return;
    const sendHeartbeat = () => {
      broadcastHeartbeat(shortCode);
      fetch(`${API_BASE}/game/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ shortCode, gameId: gameIdRef.current || undefined }),
      }).catch(() => {});
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(interval);
  }, [shortCode, broadcastHeartbeat]);

  // ---- Hypothesis persistence: load ----
  const hypothesesLoadedRef = useRef(false);
  // Reset the flag when game goes back to setup/lobby so stale hypotheses aren't reloaded
  useEffect(() => {
    if (state.screen === 'setup' || state.screen === 'lobby') {
      hypothesesLoadedRef.current = false;
    }
  }, [state.screen]);
  useEffect(() => {
    if (!shortCode || !state.gameId || currentPlayerId === null || hypothesesLoadedRef.current) return;
    hypothesesLoadedRef.current = true;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/game/hypothesis?shortCode=${encodeURIComponent(shortCode)}&gameId=${encodeURIComponent(state.gameId!)}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.hypotheses && Object.keys(data.hypotheses).length > 0) {
            const loaded = data.hypotheses as Record<number, string>;
            for (const [targetId, roleId] of Object.entries(loaded)) {
              if (roleId) setHypothesis(currentPlayerId, Number(targetId), roleId as string);
            }
          }
        }
      } catch (err) {
        console.log('Failed to load hypotheses from server:', err);
      }
    })();
  }, [shortCode, state.gameId, currentPlayerId, setHypothesis]);

  // ---- Hypothesis persistence: save (debounced 1s) ----
  const myHypotheses = currentPlayerId !== null ? state.hypotheses[currentPlayerId] : undefined;
  const saveHypTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!shortCode || !state.gameId || currentPlayerId === null || !myHypotheses) return;
    if (saveHypTimerRef.current) clearTimeout(saveHypTimerRef.current);
    saveHypTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/game/hypothesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          shortCode,
          gameId: state.gameId,
          hypotheses: myHypotheses,
        }),
      }).catch((err) => console.log('Failed to save hypotheses:', err));
    }, 1000);
    return () => { if (saveHypTimerRef.current) clearTimeout(saveHypTimerRef.current); };
  }, [myHypotheses, shortCode, state.gameId, currentPlayerId]);

  return { isResyncing, handleResync, initialLoading, markActionSent, triggerImmediateRefresh };
}