import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Moon, Sun,
  Users, ArrowLeft, Crown,
  Shield, Eye,
  Target, Trash2,
  Check, X,
  Swords,
  Plus, LayoutGrid,
  Lightbulb,
  Map,
  Menu,
  ScrollText,
  Settings,
  Activity,
} from 'lucide-react';
import { useGame, type Player, type NightStep, type DayStep, type GamePhase, localLoadGamesList, localSaveGamesList, localDeleteState } from '../../context/GameContext';
import { useIsMobile } from '../ui/use-mobile';
import { useRealtimeSync, type HeartbeatMap, getBroadcastMetrics } from '../../context/useRealtimeSync';
import { computeDelta, nextBroadcastVersion, estimatePayloadSize, fitBroadcastPayload } from '../../context/deltaSync';
import { gameTheme } from '../../context/gameTheme';
import { API_BASE, publicAnonKey, jsonAuthHeaders } from '../../context/apiConfig';
import { SetupPanel, PLAYER_AVATARS, type PlayerEntry } from './SetupPanel';
import { SpectatorGameView } from './spectator/SpectatorGameView';
import { GMQuestsPanel } from './gm/GMQuestsPanel';
import type { Quest, TaskTemplate } from '../../context/gameTypes';
import { GMDynamicHintsPanel, countAvailableDynamicHints } from './gm/GMDynamicHintsPanel';
import { computeEndAt, computeRemaining } from '../PhaseTimer';
import { sendPushNotifications } from '../../context/useNotifications';
import { type GameListEntry } from './gm/GMShared';
import { AVATAR_DEFAULT_TAGS, DEFAULT_AVAILABLE_TAGS } from '../../data/avatarDefaultTags';
import { getGalleryId } from '../../data/avatarResolver';
import { GMHunterShotModal as HunterShotModal, EndGameOverlay } from './gm/GMModals';
import { GamePanel } from './gm/GMGamePanel';
import { GMLobbyView } from './gm/GMLobbyView';
import { GameLobbyPanel } from './gm/GameLobbyPanel';
import { useGMPhaseTransitions } from './gm/useGMGameLogic';
import { GMPerformanceMonitor } from './gm/GMPerformanceMonitor';
import { GMPlayerGalleryPanel } from './gm/GMPlayerGalleryPanel';
import { GMEventLog } from './gm/GMEventLog';

type GMTab = 'setup' | 'game' | 'players' | 'journal' | 'hints' | 'quests' | 'gallery' | 'spectator';

export function GameMasterPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    state, setPhase, setNightStep, setDayStep, addEvent,
    eliminatePlayer, revivePlayer,
    setWerewolfTarget, setSeerTarget, confirmWerewolfKill,
    confirmSeerReveal, useWitchHeal, useWitchKill,
    checkWinCondition, endGame, setupPlayers, assignRoles,
    updateRoleConfig, getTotalRoles, nextTurn,
    setCupidLink, confirmHunterShot, castWerewolfVote,
    setScreen, resolveVote, addPlayerMidGame,
    syncToServer, isGM, mergePlayerActions,
    loadFromServer, setFullState, setPlayerAvatar,
    setRoleRevealDone, setGuardTarget,
    updateState, localMode,
    relaunchGame,
  } = useGame();

  const t = gameTheme(state.phase);

  // ── Multi-game lobby state ──
  const [selectedGameId, setSelectedGameIdRaw] = useState<string | null>(() => {
    try { return sessionStorage.getItem('loup-garou-selectedGameId'); } catch { return null; }
  });
  const setSelectedGameId = useCallback((id: string | null) => {
    setSelectedGameIdRaw(id);
    try {
      if (id) sessionStorage.setItem('loup-garou-selectedGameId', id);
      else sessionStorage.removeItem('loup-garou-selectedGameId');
    } catch {}
  }, []);
  const [gamesList, setGamesList] = useState<GameListEntry[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [showNewGameInput, setShowNewGameInput] = useState(false);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  const [selectedGameName, setSelectedGameName] = useState<string>('');

  // Flag to skip sync after a merge (prevents feedback loop: merge->setState->sync->merge)
  const skipSyncRef = useRef(false);

  // Track whether initial server load is complete (prevents sync/auto-config from overwriting)
  const gmLoadedRef = useRef(false);
  const [gmLoading, setGmLoading] = useState(true);
  const hasAutoDistributedRef = useRef(false);

  // Redirect if not authenticated as GM (wait for initial load to complete to avoid race condition)
  useEffect(() => {
    if (gmLoading) return; // Don't redirect while initial load is in progress
    // Also check sessionStorage as a synchronous fallback in case React state hasn't committed yet
    let isGMFromStorage = false;
    try { isGMFromStorage = sessionStorage.getItem('loup-garou-isGM') === 'true'; } catch {}
    if (!isGM && !isGMFromStorage) {
      navigate('/');
    }
  }, [isGM, navigate, gmLoading]);

  const [activeTab, setActiveTab] = useState<GMTab>(
    state.players.length > 0 ? 'game' : 'setup'
  );
  const [playerEntries, setPlayerEntries] = useState<PlayerEntry[]>([]);
  const playerCount = playerEntries.length;
  const [showEventLog, setShowEventLog] = useState(true);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [hintTargetPlayerId, setHintTargetPlayerId] = useState<number | null>(null);
  const [questTargetPlayerId, setQuestTargetPlayerId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [perfMonitorOpen, setPerfMonitorOpen] = useState(false);

  // ── Lobby: fetch games list ──
  const localIdCounter = useRef(0);

  const fetchGamesList = useCallback(async () => {
    if (localMode) {
      setGamesList(localLoadGamesList() as GameListEntry[]);
      setLobbyLoading(false);
      return;
    }
    try {
      setLobbyLoading(true);
      const res = await fetch(`${API_BASE}/games`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGamesList(data.games || []);
      }
    } catch (err) {
      console.log('Fetch games list error:', err);
    } finally {
      setLobbyLoading(false);
    }
  }, [localMode]);

  const createGame = useCallback(async (name: string) => {
    if (localMode) {
      localIdCounter.current += 1;
      const localGame: GameListEntry = {
        id: `local-${Date.now()}-${localIdCounter.current}`,
        name,
        createdAt: new Date().toISOString(),
        turn: 0,
        screen: 'home',
      };
      setGamesList((prev) => {
        const updated = [...prev, localGame];
        localSaveGamesList(updated);
        return updated;
      });
      return localGame;
    }
    try {
      const res = await fetch(`${API_BASE}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ password: 'loupgarou', name }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          setGamesList((prev) => [...prev, data.game]);
          return data.game as GameListEntry;
        }
      }
      return null;
    } catch (err) {
      console.log('Create game error:', err);
      return null;
    }
  }, [localMode]);

  const deleteGame = useCallback(async (gameId: string) => {
    if (localMode) {
      setGamesList((prev) => {
        const updated = prev.filter((g) => g.id !== gameId);
        localSaveGamesList(updated);
        return updated;
      });
      localDeleteState(gameId);
      if (selectedGameId === gameId) setSelectedGameId(null);
      return;
    }
    try {
      setDeletingGameId(gameId);
      const res = await fetch(`${API_BASE}/games/${gameId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ password: 'loupgarou' }),
      });
      if (res.ok) {
        setGamesList((prev) => prev.filter((g) => g.id !== gameId));
        if (selectedGameId === gameId) {
          setSelectedGameId(null);
        }
      }
    } catch (err) {
      console.log('Delete game error:', err);
    } finally {
      setDeletingGameId(null);
    }
  }, [selectedGameId, setSelectedGameId, localMode]);

  const selectGame = useCallback(async (gameId: string) => {
    setSelectedGameId(gameId);
    // Try to find the game name from the games list
    setSelectedGameName((prev) => {
      const found = gamesList.find(g => g.id === gameId);
      return found?.name || prev || '';
    });
    setGmLoading(true);
    gmLoadedRef.current = false;
    try {
      const serverState = await loadFromServer({ gameId });
      if (serverState) {
        skipSyncRef.current = true;
        // Ensure gameId is set on the state
        serverState.gameId = gameId;
        setFullState(serverState);
        setPlayerEntries(serverState.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          avatarUrl: p.avatarUrl,
        })));
        // Navigate to the right tab based on game state
        if (serverState.screen === 'game' || serverState.screen === 'vote' || serverState.screen === 'end') {
          setActiveTab('game');
        } else {
          setActiveTab('setup');
        }
      } else {
        // No state yet for this game — start fresh with this gameId
        const freshState = {
          gameId,
          screen: 'home' as const,
          players: [],
          roleConfig: { ...state.roleConfig },
          phase: 'night' as const,
          nightStep: 'idle' as const,
          dayStep: 'discussion' as const,
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
          wolfInactivityThreshold: 0,
          villagerInactivityThreshold: 0,
          randomVoteIfInactive: false,
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
          hints: [],
          playerHints: [],
          maireSuccessionPending: false,
          maireSuccessionFromId: null,
          maireSuccessionPhase: null,
          phaseTimerDuration: 900,
          phaseTimerEndAt: null,
          phaseTimerDayDuration: 900,
          phaseTimerNightDuration: 900,
          phaseTimerMaireDuration: 900,
        };
        setFullState(freshState as any);
        // Start with empty player list — players join via QR/link
        setPlayerEntries([]);
        setActiveTab('setup');
      }
    } catch (err) {
      console.log('Select game load error:', err);
    } finally {
      gmLoadedRef.current = true;
      setGmLoading(false);
    }
  }, [loadFromServer, setFullState, setSelectedGameId, gamesList]);

  const backToLobby = useCallback(() => {
    setSelectedGameId(null);
    fetchGamesList();
  }, [setSelectedGameId, fetchGamesList]);

  // Load existing game state from server on mount (persist across reloads)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Check for pending game creation from HomePage
        let pendingGameId: string | null = null;
        let pendingGameName: string | null = null;
        try {
          pendingGameId = sessionStorage.getItem('loup-garou-pendingGameId');
          pendingGameName = sessionStorage.getItem('loup-garou-pendingGameName');
          if (pendingGameId) {
            sessionStorage.removeItem('loup-garou-pendingGameId');
            sessionStorage.removeItem('loup-garou-pendingGameName');
          }
        } catch { /* ignore */ }

        if (pendingGameId) {
          // A game was selected from the homepage (GM code or creation) — always override current selection
          if (cancelled) return;
          setSelectedGameId(pendingGameId);
          if (pendingGameName) setSelectedGameName(pendingGameName);
          // Ensure the game is in the local games list (might have been created from HomePage)
          // Always register to avoid race condition with localMode detection
          {
            const currentLocalGames = localLoadGamesList() as GameListEntry[];
            if (!currentLocalGames.some((g) => g.id === pendingGameId)) {
              const updated = [...currentLocalGames, { id: pendingGameId, name: pendingGameName || '', createdAt: new Date().toISOString(), turn: 0, screen: 'home' }];
              localSaveGamesList(updated);
            }
            setGamesList((prev) => {
              if (prev.some((g) => g.id === pendingGameId)) return prev;
              return [...prev, { id: pendingGameId!, name: pendingGameName || '', createdAt: new Date().toISOString(), turn: 0, screen: 'home' }];
            });
          }
          // Load or create the game state
          const serverState = await loadFromServer({ gameId: pendingGameId });
          if (cancelled) return;
          if (serverState) {
            skipSyncRef.current = true;
            serverState.gameId = pendingGameId;
            setFullState(serverState);
            if (serverState.players?.length > 0) {
              setPlayerEntries(serverState.players.map((p: any) => ({
                id: p.id, name: p.name, avatar: p.avatar, avatarUrl: p.avatarUrl,
              })));
            }
            // Navigate to the right tab based on game state
            if (serverState.screen === 'game' || serverState.screen === 'vote' || serverState.screen === 'end') {
              setActiveTab('game');
            } else {
              setActiveTab('setup');
            }
          } else {
            // Fresh game — set gameId on state
            const freshState = {
              gameId: pendingGameId,
              screen: 'home' as const,
              players: [],
              roleConfig: { ...state.roleConfig },
              phase: 'night' as const,
              nightStep: 'idle' as const,
              dayStep: 'discussion' as const,
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
              hints: [],
              playerHints: [],
              maireSuccessionPending: false,
              maireSuccessionFromId: null,
              maireSuccessionPhase: null,
              phaseTimerDuration: 900,
              phaseTimerEndAt: null,
              phaseTimerDayDuration: 900,
              phaseTimerNightDuration: 900,
              phaseTimerMaireDuration: 900,
            };
            setFullState(freshState as any);
            setPlayerEntries([]);
            setActiveTab('setup');
          }
        } else if (selectedGameId) {
          // Restore the previously selected game
          const serverState = await loadFromServer({ gameId: selectedGameId });
          if (cancelled) return;
          if (serverState && serverState.players && serverState.players.length > 0) {
            skipSyncRef.current = true;
            serverState.gameId = selectedGameId;
            setFullState(serverState);
            setPlayerEntries(serverState.players.map((p: any) => ({
              id: p.id,
              name: p.name,
              avatar: p.avatar,
              avatarUrl: p.avatarUrl,
            })));
            if (serverState.screen === 'game' || serverState.screen === 'vote' || serverState.screen === 'end') {
              setActiveTab('game');
            } else {
              setActiveTab('setup');
            }
          } else if (serverState) {
            skipSyncRef.current = true;
            serverState.gameId = selectedGameId;
            setFullState(serverState);
          } else if (localMode) {
            // Server unreachable and no cached state — clear stale selection, show lobby
            setSelectedGameId(null);
          }
        } else {
          // No game selected — load the lobby
          await fetchGamesList();
        }
      } catch (err) {
        console.log('GM initial load error:', err);
      } finally {
        if (!cancelled) {
          gmLoadedRef.current = true;
          setGmLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []); // Run once on mount

  // When localMode transitions to true after mount, retry loading the selected game from localStorage
  // (handles race condition where mount effect ran before health check completed)
  const localModeRetried = useRef(false);
  useEffect(() => {
    if (!localMode || localModeRetried.current) return;
    localModeRetried.current = true;
    if (selectedGameId && state.players.length === 0) {
      // Mount effect probably failed because localModeRef wasn't set yet — retry from localStorage
      (async () => {
        const cached = await loadFromServer({ gameId: selectedGameId });
        if (cached && cached.players && cached.players.length > 0) {
          skipSyncRef.current = true;
          cached.gameId = selectedGameId;
          setFullState(cached);
          setPlayerEntries(cached.players.map((p: any) => ({
            id: p.id, name: p.name, avatar: p.avatar, avatarUrl: p.avatarUrl,
          })));
          if (cached.screen === 'game' || cached.screen === 'vote' || cached.screen === 'end') {
            setActiveTab('game');
          } else {
            setActiveTab('setup');
          }
          gmLoadedRef.current = true;
          setGmLoading(false);
        }
      })();
    } else if (!selectedGameId) {
      fetchGamesList();
    }
  }, [localMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player heartbeat tracking
  const [playerHeartbeats, setPlayerHeartbeats] = useState<HeartbeatMap>({});
  const [, setHeartbeatTick] = useState(0); // force re-render for relative times

  const handleHeartbeat = useCallback((shortCode: string, ts: number) => {
    setPlayerHeartbeats((prev) => {
      if (prev[shortCode] === ts) return prev;
      return { ...prev, [shortCode]: ts };
    });
  }, []);

  // Tick every 5s to update relative time display
  useEffect(() => {
    const interval = setInterval(() => setHeartbeatTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Load heartbeats from server on mount / game switch (persistence across GM reloads)
  useEffect(() => {
    if (localMode) return;
    if (state.players.length === 0) return;
    const hbParams = state.gameId ? `?gameId=${state.gameId}` : '';
    // Reset heartbeats when switching games to avoid stale data
    setPlayerHeartbeats({});
    fetch(`${API_BASE}/game/heartbeats${hbParams}`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.heartbeats) {
          setPlayerHeartbeats(data.heartbeats);
        }
      })
      .catch((err) => console.log('Load heartbeats error:', err));
  }, [state.players.length, state.gameId]);

  // Realtime channel: GM listens for player action notifications
  // Debounce action notifications to avoid flooding when many players act at once
  const actionMergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleActionNotify = useCallback(() => {
    if (actionMergeTimerRef.current) clearTimeout(actionMergeTimerRef.current);
    actionMergeTimerRef.current = setTimeout(async () => {
      const changed = await mergePlayerActions();
      if (changed) {
        skipSyncRef.current = true;
      }
    }, 300); // 300ms debounce: batches rapid-fire notifications from many players
  }, [mergePlayerActions]);

  // Handle lobby join events from players — auto-add to playerEntries
  const handleLobbyJoin = useCallback((player: { id: string; name: string; shortCode: string }) => {
    // Add to lobbyPlayers for connection tracking
    updateState((s) => {
      const existing = s.lobbyPlayers || [];
      if (existing.some((p) => p.id === player.id)) return s;
      return {
        ...s,
        lobbyPlayers: [...existing, { id: player.id, name: player.name, shortCode: player.shortCode, joinedAt: new Date().toISOString() }],
      };
    });
    // Auto-add to playerEntries (the actual game player list)
    setPlayerEntries((prev) => {
      // Avoid duplicates by name (lobby player might re-broadcast)
      if (prev.some((p) => p.name === player.name)) return prev;
      const newId = prev.length > 0 ? Math.max(...prev.map((p) => p.id)) + 1 : 0;
      return [
        ...prev,
        {
          id: newId,
          name: player.name,
          avatar: PLAYER_AVATARS[prev.length % PLAYER_AVATARS.length],
          shortCode: player.shortCode,
        },
      ];
    });
  }, [updateState]);

  // Refs for deferred access (declared early so handleResyncRequest can reference them)
  const lastResyncBroadcastRef = useRef(0);
  const resyncCoalescedRef = useRef(0);
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const broadcastStateRef = useRef<((gs: any) => void) | null>(null);
  const handleResyncRequest = useCallback(() => {
    const now = Date.now();
    if (now - lastResyncBroadcastRef.current < 5000) {
      resyncCoalescedRef.current++;
      console.log(`[GM] Resync request coalesced (${resyncCoalescedRef.current} pending, < 5s since last broadcast)`);
      return;
    }
    // Debounce: wait 500ms to coalesce multiple simultaneous requests
    if (resyncTimerRef.current) return;
    resyncTimerRef.current = setTimeout(() => {
      resyncTimerRef.current = null;
      lastResyncBroadcastRef.current = Date.now();
      const coalesced = resyncCoalescedRef.current;
      resyncCoalescedRef.current = 0;
      console.log(`[GM] Resync request fulfilled (coalesced ${coalesced} others) — broadcasting full state`);
      if (broadcastStateRef.current) {
        broadcastStateRef.current(fitBroadcastPayload(stateRef.current));
      }
    }, 500);
  }, []);

  const { status: realtimeStatus, isConnected: realtimeConnected, broadcastState, broadcastDelta, broadcastTestNotification, broadcastLobbyResponse } = useRealtimeSync({
    isGM: true,
    onActionNotify: handleActionNotify,
    onHeartbeat: handleHeartbeat,
    onLobbyJoin: handleLobbyJoin,
    onResyncRequest: handleResyncRequest,
    gameId: selectedGameId || state.gameId || null,
    disabled: localMode,
  });

  // Auto-respond to lobby joins: broadcast acceptance so the player knows they're registered
  const prevLobbyCountRef = useRef(0);
  useEffect(() => {
    const lobbyPlayers = state.lobbyPlayers || [];
    if (lobbyPlayers.length > prevLobbyCountRef.current) {
      // New player(s) joined — send acceptance responses
      const newPlayers = lobbyPlayers.slice(prevLobbyCountRef.current);
      for (const p of newPlayers) {
        broadcastLobbyResponse({ playerId: p.id, accepted: true, gameName: selectedGameName || '' });
      }
    }
    prevLobbyCountRef.current = lobbyPlayers.length;
  }, [state.lobbyPlayers, broadcastLobbyResponse, selectedGameName]);

  // ── Delta tracking for optimized broadcasts ──
  const prevBroadcastStateRef = useRef<typeof state | null>(null);
  const deltaCounterRef = useRef(0);
  const FULL_RESYNC_EVERY = 10; // full state every N broadcasts for recovery

  // Sync state to server whenever game state changes (debounced) + broadcast via channel
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Don't sync until initial server load is complete
    if (!gmLoadedRef.current) return;
    // Only sync when there are players or lobby players (game is configured/active)
    if (state.players.length === 0 && state.screen === 'home' && !(state.lobbyPlayers?.length)) return;
    // Skip server persist if this state update came from a server merge,
    // but still broadcast to spectators/players via Realtime channel
    const shouldSkipServerSync = skipSyncRef.current;
    if (shouldSkipServerSync) {
      skipSyncRef.current = false;
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      if (!shouldSkipServerSync) {
        // Persist to server via REST
        syncToServer();
      }
      // ── Delta broadcast optimization ──
      const prev = prevBroadcastStateRef.current;
      deltaCounterRef.current++;
      const shouldSendFull = !prev || deltaCounterRef.current >= FULL_RESYNC_EVERY;

      if (shouldSendFull) {
        // Full state broadcast (initial sync / periodic recovery)
        // Apply size guard to prevent exceeding Supabase Realtime's ~256KB limit
        broadcastState(fitBroadcastPayload(state));
        deltaCounterRef.current = 0;
      } else {
        // Compute delta and send only changed fields
        const version = nextBroadcastVersion();
        const delta = computeDelta(prev, state, version);
        if (delta) {
          const fullSize = estimatePayloadSize(state);
          broadcastDelta(delta, fullSize);
        }
        // else: No changes detected — skip broadcast entirely
      }
      prevBroadcastStateRef.current = state;
    }, 500);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [state, syncToServer, broadcastState, broadcastDelta]);

  // Fallback polling for player actions — slower when Realtime is connected
  useEffect(() => {
    if (localMode) return;
    if (state.players.length === 0) return;
    // When realtime is connected, poll infrequently as fallback (10s)
    // When disconnected, poll more aggressively (2s)
    const pollInterval = realtimeConnected ? 15000 : 2000;
    const interval = setInterval(async () => {
      const changed = await mergePlayerActions();
      if (changed) {
        skipSyncRef.current = true;
      }
    }, pollInterval);
    return () => clearInterval(interval);
  }, [state.players.length, mergePlayerActions, realtimeConnected]);

  // In local mode, keep the games list metadata in sync with the active game state
  useEffect(() => {
    if (!localMode || !selectedGameId) return;
    setGamesList((prev) => {
      const idx = prev.findIndex((g) => g.id === selectedGameId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], turn: state.turn, screen: state.screen };
      localSaveGamesList(updated);
      return updated;
    });
  }, [localMode, selectedGameId, state.turn, state.screen]);

  // Auto-distribute roles only on initial load (not when player count changes)
  useEffect(() => {
    // Don't auto-distribute while loading or during an active game
    if (!gmLoadedRef.current) return;
    if (hasAutoDistributedRef.current) return;
    if (state.screen === 'game' || state.screen === 'vote' || state.screen === 'end') return;
    if (state.players.length > 0) return;
    // Don't auto-distribute with 0 players — wait for at least 1 player to join
    if (playerCount === 0) return;
    hasAutoDistributedRef.current = true;
    const wolves = Math.max(1, Math.round(playerCount * 0.2));
    const voyante = 1;
    const sorciere = 1;
    const villageois = Math.max(0, playerCount - wolves - voyante - sorciere);
    updateRoleConfig('loup-garou', wolves);
    updateRoleConfig('voyante', voyante);
    updateRoleConfig('sorciere', sorciere);
    updateRoleConfig('villageois', villageois);
    updateRoleConfig('chasseur', 0);
    updateRoleConfig('cupidon', 0);
    updateRoleConfig('petite-fille', 0);
  }, [playerCount, updateRoleConfig, state.screen, state.players.length]);

  // Reset playerEntries when game is reset (e.g. "Nouvelle Partie")
  useEffect(() => {
    if (state.screen === 'home' && state.players.length === 0 && gmLoadedRef.current) {
      setPlayerEntries([]);
      setActiveTab('setup');
      // Allow auto-distribute to fire again for the fresh setup
      hasAutoDistributedRef.current = false;
    }
  }, [state.screen, state.players.length]);

  // Switch to setup tab when game is relaunched (screen goes back to 'setup')
  useEffect(() => {
    if (state.screen === 'setup' && gmLoadedRef.current) {
      setActiveTab('setup');
      // Reset end-game overlay state so it can show again in the next game
      setResultDismissed(false);
      // Sync playerEntries from state.players (catches mid-game additions)
      if (state.players.length > 0) {
        setPlayerEntries(state.players.map((p, i) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || PLAYER_AVATARS[i % PLAYER_AVATARS.length],
          avatarUrl: p.avatarUrl,
          shortCode: p.shortCode,
        })));
      }
    }
  }, [state.screen]);

  // ── Auto-import gallery hints & tasks when playerEntries change (pre-game) ──
  const importedGalleryIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    // Only run pre-game (before players are set up in state)
    if (state.players.length > 0) return;
    if (playerEntries.length === 0) return;

    // Find gallery players that haven't been imported yet
    const galleryPlayers: { playerId: number; galleryId: number }[] = [];
    playerEntries.forEach((e) => {
      const gid = getGalleryId(e.avatarUrl);
      if (gid !== null && !importedGalleryIdsRef.current.has(gid)) {
        galleryPlayers.push({ playerId: e.id, galleryId: gid });
      }
    });

    // Clean up hints/tasks for removed gallery players
    const currentGalleryIds = new Set<number>();
    playerEntries.forEach((e) => {
      const gid = getGalleryId(e.avatarUrl);
      if (gid !== null) currentGalleryIds.add(gid);
    });
    const removedGalleryIds: number[] = [];
    importedGalleryIdsRef.current.forEach((gid) => {
      if (!currentGalleryIds.has(gid)) removedGalleryIds.push(gid);
    });
    if (removedGalleryIds.length > 0) {
      removedGalleryIds.forEach((gid) => {
        importedGalleryIdsRef.current.delete(gid);
      });
      const validPlayerIds = new Set(playerEntries.map((e) => e.id));
      updateState((s) => ({
        ...s,
        dynamicHints: (s.dynamicHints ?? []).filter((h: any) => validPlayerIds.has(h.targetPlayerId) || !h.gallerySourceId),
        taskLibrary: (s.taskLibrary ?? []).filter((t: any) => t.referencedPlayerId == null || validPlayerIds.has(t.referencedPlayerId) || !t.gallerySourceId),
      }));
    }

    if (galleryPlayers.length === 0) return;

    // Fetch gallery data (per-player hints/tasks + general pre-tasks + pre-quests)
    (async () => {
      try {
        const [hintsRes, tasksRes, preTasksRes, preQuestsRes] = await Promise.all([
          fetch(`${API_BASE}/gallery/hints`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/tasks`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/pretasks`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/quests`, { headers: jsonAuthHeaders() }),
        ]);
        const hintsJson = await hintsRes.json();
        const tasksJson = await tasksRes.json();
        const preTasksJson = await preTasksRes.json();
        const preQuestsJson = await preQuestsRes.json();
        const galleryHintsData: Record<number, { id: number; text: string; priority: 1 | 2 | 3; imageUrl?: string }[]> = hintsJson.hints || {};
        const galleryTasksData: Record<number, { id: number; question: string; inputType: string; correctAnswer: string; choices?: string[]; imageUrl?: string }[]> = tasksJson.tasks || {};
        const galleryPreTasks: { id: number; question: string; inputType: string; correctAnswer: string; choices?: string[]; imageUrl?: string }[] =
          Array.isArray(preTasksJson.pretasks) ? preTasksJson.pretasks : (preTasksJson.pretasks?.list ?? []);
        const galleryPreQuests: { id: number; title: string; description: string; questType: string; collaborativeGroupSize?: number; tasks: { id: number; question: string; inputType: string; correctAnswer: string; choices?: string[]; imageUrl?: string }[]; targetTags?: string[]; distributionOrder?: number | 'random' | 'available'; createdAt: string }[] =
          Array.isArray(preQuestsJson.quests) ? preQuestsJson.quests : (preQuestsJson.quests?.list ?? []);

        const importedHints: any[] = [];
        const importedTasks: TaskTemplate[] = [];

        updateState((s) => {
          let nextHintId = (s.dynamicHints ?? []).length > 0 ? Math.max(...(s.dynamicHints ?? []).map((h) => h.id)) + 1 : 1;
          let nextTaskId = (s.taskLibrary ?? []).length > 0 ? Math.max(...(s.taskLibrary ?? []).map((t) => t.id)) + 1 : 1;

          // Import general pre-tasks (only once — skip if already present)
          const existingPreTaskSourceIds = new Set(
            (s.taskLibrary ?? []).filter((t) => t.gallerySourceId === 'pretask').map((t) => (t as any).originalPreTaskId)
          );
          for (const pt of galleryPreTasks) {
            if (!existingPreTaskSourceIds.has(pt.id)) {
              importedTasks.push({
                id: nextTaskId++,
                question: pt.question,
                inputType: pt.inputType as any,
                correctAnswer: pt.correctAnswer,
                choices: pt.choices,
                imageUrl: pt.imageUrl,
                createdAt: new Date().toISOString(),
                gallerySourceId: 'pretask',
                originalPreTaskId: pt.id,
              });
            }
          }

          // Import per-player gallery tasks & hints
          for (const { playerId, galleryId } of galleryPlayers) {
            const hintTpls = galleryHintsData[galleryId] ?? [];
            for (const tpl of hintTpls) {
              importedHints.push({
                id: nextHintId++,
                targetPlayerId: playerId,
                text: tpl.text,
                imageUrl: tpl.imageUrl,
                priority: tpl.priority,
                revealed: false,
                createdAt: new Date().toISOString(),
                gallerySourceId: galleryId,
              });
            }
            const taskTpls = galleryTasksData[galleryId] ?? [];
            for (const tpl of taskTpls) {
              importedTasks.push({
                id: nextTaskId++,
                question: tpl.question,
                inputType: tpl.inputType as any,
                correctAnswer: tpl.correctAnswer,
                choices: tpl.choices,
                imageUrl: tpl.imageUrl,
                referencedPlayerId: playerId,
                createdAt: new Date().toISOString(),
                gallerySourceId: galleryId,
              });
            }
            importedGalleryIdsRef.current.add(galleryId);
          }

          // Import gallery pre-quests as actual quests (only once — skip duplicates by title)
          const existingQuestTitles = new Set((s.quests || []).map((q) => q.title));
          const existingPreQuestSourceIds = new Set(
            (s.quests || []).filter((q: any) => q.galleryPreQuestId != null).map((q: any) => q.galleryPreQuestId)
          );
          const newQuests: Quest[] = [];
          for (const pq of galleryPreQuests) {
            if (existingPreQuestSourceIds.has(pq.id)) continue;
            const now = Date.now();
            const questId = now + Math.floor(Math.random() * 100000);
            // Deduplicate title
            let title = pq.title;
            if (existingQuestTitles.has(title)) {
              let counter = 1;
              while (existingQuestTitles.has(`${pq.title} ${counter}`)) counter++;
              title = `${pq.title} ${counter}`;
            }
            existingQuestTitles.add(title);

            const isCollab = pq.questType === 'collaborative';
            let questTasks: Quest['tasks'] = [];

            if (!isCollab && pq.tasks.length > 0) {
              const newTaskLibEntries: TaskTemplate[] = pq.tasks.map((t) => ({
                id: nextTaskId++,
                question: t.question,
                inputType: t.inputType as any,
                correctAnswer: t.correctAnswer,
                choices: t.choices ? [...t.choices] : undefined,
                imageUrl: t.imageUrl,
                createdAt: new Date().toISOString(),
                gallerySourceId: 'prequest' as any,
              }));
              importedTasks.push(...newTaskLibEntries);

              questTasks = newTaskLibEntries.map((tpl, idx) => ({
                id: questId * 100 + idx,
                question: tpl.question,
                inputType: tpl.inputType,
                correctAnswer: tpl.correctAnswer,
                choices: tpl.choices ? [...tpl.choices] : undefined,
                imageUrl: tpl.imageUrl,
                referencedPlayerId: tpl.referencedPlayerId,
                playerAnswers: {} as Record<number, string>,
                playerResults: {} as Record<number, boolean>,
                templateId: tpl.id,
              }));
            }

            newQuests.push({
              id: questId,
              title,
              description: pq.description,
              questType: isCollab ? 'collaborative' : undefined,
              collaborativeGroupSize: isCollab ? (pq.collaborativeGroupSize || 3) : undefined,
              playerStatuses: {},
              tasks: questTasks,
              createdAt: new Date().toISOString(),
              hidden: true,
              targetTags: pq.targetTags,
              distributionOrder: pq.distributionOrder,
              galleryPreQuestId: pq.id,
            });
          }

          return {
            ...s,
            dynamicHints: [...(s.dynamicHints ?? []), ...importedHints],
            taskLibrary: [...(s.taskLibrary ?? []), ...importedTasks],
            quests: [...(s.quests || []), ...newQuests],
          };
        });
      } catch (err) {
        console.error('Failed to fetch gallery hints/tasks/quests for pre-game preview:', err);
      }
    })();
  }, [playerEntries, state.players.length, updateState]);

  // Reset gallery import tracking when game is reset
  useEffect(() => {
    if (state.screen === 'home' && state.players.length === 0) {
      importedGalleryIdsRef.current = new Set();
    }
  }, [state.screen, state.players.length]);

  const totalRoles = getTotalRoles();
  const isValid = totalRoles === playerCount;
  const werewolfCount = state.roleConfig['loup-garou'] || 0;
  const hasEnoughWerewolves = werewolfCount >= 1;
  const alivePlayers = useMemo(() => state.players.filter((p) => p.alive), [state.players]);
  const deadPlayers = useMemo(() => state.players.filter((p) => !p.alive), [state.players]);
  const isNight = state.phase === 'night';

  // Badge count for Indices tab: available dynamic hints
  const hintBadgeCount = useMemo(() => countAvailableDynamicHints(state), [state.dynamicHints, state.players]);

  const hasRole = useCallback((roleId: string) =>
    state.players.some((p) => p.role === roleId && p.alive), [state.players]);

  // Avatar upload
  const [uploadingPlayerId, setUploadingPlayerId] = useState<number | null>(null);
  const handleUploadAvatar = useCallback(async (file: File, playerId: number, isPreGame: boolean) => {
    setUploadingPlayerId(playerId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gameId', state.gameId || '');
      formData.append('playerId', String(playerId));
      formData.append('password', 'loupgarou');

      const res = await fetch(`${API_BASE}/game/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.avatarUrl) {
        if (isPreGame) {
          setPlayerEntries((prev) =>
            prev.map((e) => (e.id === playerId ? { ...e, avatarUrl: data.avatarUrl } : e))
          );
        } else {
          setPlayerAvatar(playerId, data.avatarUrl);
        }
      } else {
        console.log('Avatar upload failed:', data.error);
      }
    } catch (err) {
      console.log('Avatar upload error:', err);
    } finally {
      setUploadingPlayerId(null);
    }
  }, [state.gameId, setPlayerAvatar]);

  // Win check (skip if result was dismissed to avoid re-opening)
  useEffect(() => {
    if (resultDismissed) return;
    const winner = checkWinCondition();
    if (winner) {
      setTimeout(() => endGame(winner), 1500);
    }
  }, [state.players, checkWinCondition, endGame, resultDismissed]);

  const handleStartGame = async () => {
    if (!isValid || !hasEnoughWerewolves) return;
    setResultDismissed(false);
    setupPlayers(
      playerCount,
      playerEntries.map((e) => e.name),
      playerEntries.map((e) => e.avatarUrl),
      playerEntries.map((e) => e.shortCode),
    );
    // Build pre-assignments from playerEntries with an assignedRole
    const preAssignments: Record<number, string> = {};
    playerEntries.forEach((e, idx) => {
      if (e.assignedRole) preAssignments[idx] = e.assignedRole;
    });
    assignRoles(Object.keys(preAssignments).length > 0 ? preAssignments : undefined);
    addEvent('Les roles ont ete attribues. Decouvrez vos roles !');
    // Auto-assign tags based on player names from gallery defaults
    const playerNames = playerEntries.map((e) => e.name);
    const autoPlayerTags: Record<number, string[]> = {};
    const usedTags = new Set<string>();
    playerNames.forEach((name, idx) => {
      const tags = AVATAR_DEFAULT_TAGS[name];
      if (tags && tags.length > 0) {
        autoPlayerTags[idx] = [...tags];
        tags.forEach((t) => usedTags.add(t));
      }
    });
    // Merge default available tags with any tags actually used
    const autoAvailableTags = [...DEFAULT_AVAILABLE_TAGS];
    usedTags.forEach((t) => { if (!autoAvailableTags.includes(t)) autoAvailableTags.push(t); });

    // Gallery hints, tasks & pre-quests are already pre-imported into state.dynamicHints / state.taskLibrary / state.quests
    // during the setup phase (auto-import useEffect). Just clear lobby players and set tags.
    updateState((s) => ({
      ...s,
      lobbyPlayers: [],
      playerTags: Object.keys(autoPlayerTags).length > 0 ? autoPlayerTags : (s.playerTags || {}),
      availableTags: autoAvailableTags.length > 0 ? autoAvailableTags : (s.availableTags || []),
    }));
    setScreen('game');
    setActiveTab('game');
    // Start in role reveal phase (not night yet)
    setRoleRevealDone(false);
    setNightStep('idle');
  };

  // ── Phase transition logic (extracted to useGMGameLogic) ──
  const clearServerMidGameJoins = useCallback(() => {
    if (!state.gameId) return;
    fetch(`${API_BASE}/game/action/clear-mid-game-joins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ gameId: state.gameId }),
    }).catch(() => {});
  }, [state.gameId]);

  const {
    leverLeSoleil,
    handleAdvanceTurn,
    handleStartNight1,
    handleResolveMaireElection,
  } = useGMPhaseTransitions({
    state, setPhase, setNightStep, setDayStep,
    addEvent, eliminatePlayer, setWerewolfTarget,
    confirmWerewolfKill, nextTurn, updateState, setRoleRevealDone,
    clearServerMidGameJoins,
  });

  // ── Vote result notification ──
  const prevVoteResultRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    // Skip initial render and when no game is active
    if (prevVoteResultRef.current === undefined) {
      prevVoteResultRef.current = state.voteResult;
      return;
    }
    if (prevVoteResultRef.current === state.voteResult) return;
    prevVoteResultRef.current = state.voteResult;

    // Only notify when a player is actually eliminated (voteResult becomes non-null)
    // Tie case: voteResult stays null, no change detected. Reset case: voteResult goes
    // from number back to null (turn transition) — skip that too.
    if (state.voteResult === null) return;
    if (!state.gameId || state.screen !== 'game') return;

    const allEliminated = (state.voteResults || []).map((id: number) => state.players.find((p: Player) => p.id === id)).filter(Boolean);
    const targets = state.players.filter((p: Player) => p.alive || (state.voteResults || []).includes(p.id)).map((p: Player) => p.shortCode);
    const msg = allEliminated.length > 1
      ? `\u2694\uFE0F ${allEliminated.map((p: any) => p.name).join(', ')} ont \u00e9t\u00e9 \u00e9limin\u00e9s par le village.`
      : `\u2696\uFE0F ${allEliminated[0]?.name || 'Un joueur'} a \u00e9t\u00e9 \u00e9limin\u00e9 par le village.`;
    sendPushNotifications(state.gameId, targets, 'Loup-Garou', msg, 'vote-result');
  }, [state.voteResult, state.gameId, state.screen, state.players]);

  // ── Night action reminder (5 minutes after night starts) ──
  const nightReminderSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase !== 'night' || state.nightStep !== 'active' || !state.gameId || state.screen !== 'game') {
      nightReminderSentRef.current = null;
      return;
    }

    const nightKey = `${state.turn}-night`;
    if (nightReminderSentRef.current === nightKey) return;

    const REMINDER_DELAY = 5 * 60 * 1000; // 5 minutes
    const timer = setTimeout(() => {
      if (nightReminderSentRef.current === nightKey) return;
      nightReminderSentRef.current = nightKey;

      // Find alive players who have a night action role but haven't acted
      const inactivePlayers: Player[] = [];
      for (const p of state.players) {
        if (!p.alive) continue;
        const role = p.role;
        let hasActed = false;

        if (role === 'loup-garou') {
          hasActed = state.werewolfVotes?.[p.id] !== undefined;
        } else if (role === 'voyante') {
          hasActed = state.seerTargets?.[p.id] !== undefined;
        } else if (role === 'sorciere') {
          // Witch has acted if she used heal or kill, or if both potions are used up
          const healUsed = (state.witchHealUsedBy || []).includes(p.id);
          const killUsed = (state.witchKillUsedBy || []).includes(p.id);
          hasActed = (healUsed && killUsed)
            || state.witchHealedThisNight?.[p.id] !== undefined
            || state.witchKillTargets?.[p.id] !== undefined;
        } else if (role === 'salvateur') {
          hasActed = state.guardTargets?.[p.id] !== undefined;
        } else if (role === 'cupidon') {
          hasActed = (state.cupidLinkedBy || []).includes(p.id);
        } else if (role === 'corbeau') {
          hasActed = state.corbeauTargets?.[p.id] !== undefined;
        } else {
          // Roles without night actions (villageois, chasseur, petite-fille, etc.)
          continue;
        }

        if (!hasActed) {
          inactivePlayers.push(p);
        }
      }

      if (inactivePlayers.length > 0) {
        const shortCodes = inactivePlayers.map((p) => p.shortCode);
        sendPushNotifications(
          state.gameId!, shortCodes, 'Loup-Garou',
          '\u23F0 Vous n\'avez pas encore agi cette nuit !',
          'action-reminder',
        );
      }
    }, REMINDER_DELAY);

    return () => clearTimeout(timer);
  }, [state.phase, state.nightStep, state.turn, state.gameId, state.screen,
      state.players, state.werewolfVotes, state.seerTargets,
      state.witchHealedThisNight, state.witchKillTargets, state.witchHealUsedBy,
      state.witchKillUsedBy, state.guardTargets, state.cupidLinkedBy, state.corbeauTargets]);

  // ── Phase timer auto-transition ──
  const leverLeSoleilRef = useRef(leverLeSoleil);
  leverLeSoleilRef.current = leverLeSoleil;
  const handleAdvanceTurnRef = useRef(handleAdvanceTurn);
  handleAdvanceTurnRef.current = handleAdvanceTurn;
  const gmSetFullStateRef = useRef(setFullState);
  gmSetFullStateRef.current = setFullState;
  broadcastStateRef.current = broadcastState;

  // Push notification: 1 minute warning from GM side
  const timerOneMinPushRef = useRef(false);
  useEffect(() => {
    timerOneMinPushRef.current = false;
  }, [state.phaseTimerEndAt]);

  useEffect(() => {
    if (!state.phaseTimerEndAt || !state.gameId || state.screen !== 'game' || state.winner) return;
    if (state.phaseTimerDuration <= 0) return;
    const endAt = state.phaseTimerEndAt;
    const check = () => {
      if (timerOneMinPushRef.current) return;
      const remaining = computeRemaining(endAt);
      if (remaining > 0 && remaining <= 60) {
        timerOneMinPushRef.current = true;
        const targets = state.players.filter((p: Player) => p.alive).map((p: Player) => p.shortCode);
        sendPushNotifications(state.gameId!, targets, 'Loup-Garou', '\u23F3 Plus qu\'une minute\u00A0!', 'timer-1min');
      }
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [state.phaseTimerEndAt, state.phaseTimerDuration, state.gameId, state.screen, state.winner]);

  useEffect(() => {
    if (!state.phaseTimerEndAt || state.screen !== 'game' || state.winner || !state.gameId) return;

    let transitionInFlight = false;
    const gameId = state.gameId;
    const endAt = state.phaseTimerEndAt;
    // Capture current phase info for local fallback
    const currentPhase = state.phase;
    const currentDayStep = state.dayStep;
    const currentMaireElectionDone = state.maireElectionDone;
    const currentTurn = state.turn;
    const currentRoleRevealDone = state.roleRevealDone;

    const doTransition = async () => {
      if (transitionInFlight) return;
      transitionInFlight = true;

      // In local mode, skip server and transition locally
      if (localMode) {
        console.log('[GM] Local mode — applying timer transition locally');
        if (currentPhase === 'night') {
          leverLeSoleilRef.current();
        } else if (currentPhase === 'day') {
          if (currentDayStep === 'vote' && !currentMaireElectionDone && currentTurn === 1 && currentRoleRevealDone) {
            handleResolveMaireElection();
          } else {
            if (currentDayStep === 'vote') {
              resolveVote();
              addEvent('Le vote est clos (temps ecoule). Decompte des voix...');
            }
            handleAdvanceTurnRef.current();
          }
        }
        setTimeout(() => { transitionInFlight = false; }, 5000);
        return;
      }

      console.log('[GM] Timer expired, requesting server auto-transition...');
      try {
        const res = await fetch(`${API_BASE}/game/action/timer-transition`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ gameId }),
        });
        const data = await res.json();
        if (data.success && data.gameState) {
          console.log('[GM] Server auto-transition applied.');
          gmSetFullStateRef.current(data.gameState);
          broadcastStateRef.current(data.gameState);
        } else if (data.skipped) {
          console.log('[GM] Server auto-transition skipped:', data.reason);
          // If server returned the latest state with the skip (lock case), apply it
          if (data.gameState) {
            gmSetFullStateRef.current(data.gameState);
            broadcastStateRef.current(data.gameState);
          } else {
            // Otherwise fetch the latest state to catch up
            try {
              const stateRes = await fetch(`${API_BASE}/game/state?gameId=${encodeURIComponent(gameId)}`, {
                headers: { 'Authorization': `Bearer ${publicAnonKey}` },
              });
              const stateData = await stateRes.json();
              if (stateData.gameState) {
                gmSetFullStateRef.current(stateData.gameState);
                broadcastStateRef.current(stateData.gameState);
              }
            } catch { /* ignore */ }
          }
        } else if (data.error) {
          console.log('[GM] Server auto-transition error:', data.error);
        }
      } catch (err) {
        console.log('[GM] Server auto-transition fetch error, falling back to local:', err);
        // Fallback to local transition if server is unreachable
        if (currentPhase === 'night') {
          leverLeSoleilRef.current();
        } else if (currentPhase === 'day') {
          if (currentDayStep === 'vote' && !currentMaireElectionDone && currentTurn === 1 && currentRoleRevealDone) {
            handleResolveMaireElection();
          } else {
            if (currentDayStep === 'vote') {
              resolveVote();
              addEvent('Le vote est clos (temps ecoule). Decompte des voix...');
            }
            handleAdvanceTurnRef.current();
          }
        }
      }
      setTimeout(() => { transitionInFlight = false; }, 5000);
    };

    const interval = setInterval(() => {
      const remaining = computeRemaining(endAt);
      if (remaining <= 0) {
        doTransition();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [state.phaseTimerEndAt, state.phase, state.dayStep, state.screen, state.winner, state.maireElectionDone, state.turn, state.roleRevealDone, state.gameId]);

  // Show loading screen while restoring game state from server
  if (gmLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: t.pageBg }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: t.goldBg, border: `2px solid ${t.goldBorder}` }}
          >
            <Crown size={28} style={{ color: t.gold }} />
          </div>
          <p style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
            Chargement de la partie...
          </p>
          <div className="mt-3 w-32 h-1 rounded-full mx-auto overflow-hidden" style={{ background: `rgba(${t.overlayChannel}, 0.05)` }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #b8860b, #d4a843)' }}
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  // ── LOBBY VIEW: Show when no game is selected ──
  if (!selectedGameId) {
    return (
      <GMLobbyView
        t={t}
        navigate={navigate}
        gamesList={gamesList}
        lobbyLoading={lobbyLoading}
        deletingGameId={deletingGameId}
        deleteGame={deleteGame}
        selectGame={selectGame}
        showNewGameInput={showNewGameInput}
        setShowNewGameInput={setShowNewGameInput}
        newGameName={newGameName}
        setNewGameName={setNewGameName}
        createGame={createGame}
      />
    );
  }

  return (
    <div
      className="h-dvh flex flex-col"
      style={{
        background: t.pageBg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top Navigation Bar */}
      {activeTab !== 'spectator' && (
      <header
        className="flex-shrink-0 px-3 sm:px-6 py-2 sm:py-3"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          background: t.headerBg,
          borderBottom: `1px solid ${t.headerBorder}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Top row: Back + Title + Game info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={backToLobby}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              title="Retour aux parties"
            >
              <ArrowLeft size={isMobile ? 16 : 18} style={{ color: t.textMuted }} />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Crown size={isMobile ? 14 : 18} style={{ color: t.gold }} />
              <h1
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: t.gold,
                  fontSize: isMobile ? '0.8rem' : '1rem',
                }}
              >
                {isMobile ? 'MJ' : 'Maitre du Jeu'}
              </h1>
              {/* Realtime connection indicator */}
              <div
                title={realtimeConnected ? 'Temps reel actif' : realtimeStatus === 'connecting' ? 'Connexion...' : 'Mode polling'}
                className="flex items-center gap-1"
                style={{ marginLeft: '0.4rem' }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: realtimeConnected ? '#4ade80' : realtimeStatus === 'connecting' ? '#f0c55b' : '#ef4444',
                    boxShadow: realtimeConnected ? '0 0 4px rgba(74,222,128,0.5)' : 'none',
                  }}
                />
                {!isMobile && (
                  <span style={{ fontSize: '0.55rem', color: realtimeConnected ? '#4ade80' : t.textMuted }}>
                    {realtimeConnected ? 'Live' : realtimeStatus === 'connecting' ? '...' : 'Poll'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {state.players.length > 0 && (
              <>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {isNight ? (
                    <Moon size={isMobile ? 12 : 14} style={{ color: '#7c8db5' }} />
                  ) : (
                    <Sun size={isMobile ? 12 : 14} style={{ color: '#f0c55b' }} />
                  )}
                  <span
                    style={{
                      fontFamily: '"Cinzel", serif',
                      color: isNight ? '#7c8db5' : '#f0c55b',
                      fontSize: isMobile ? '0.65rem' : '0.8rem',
                    }}
                  >
                    {isMobile
                      ? (isNight ? `N${state.turn}` : `J${state.turn}`)
                      : (isNight ? `Nuit ${state.turn}` : `Jour ${state.turn}`)}
                  </span>
                </div>
                {!isMobile && (
                  <>
                    <div className="h-4 w-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#6b8e5a', fontSize: '0.75rem' }}>
                        {alivePlayers.length} vivants
                      </span>
                      <span style={{ color: '#c41e3a', fontSize: '0.75rem' }}>
                        {deadPlayers.length} morts
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            {/* Mobile burger menu button (header) */}
          {isMobile && (() => {
            const burgerTabs = [
              { id: 'journal' as GMTab, label: 'Journal', icon: <ScrollText size={16} /> },
              { id: 'setup' as GMTab, label: 'Configuration', icon: <Settings size={16} /> },
              { id: 'gallery' as GMTab, label: 'Galerie', icon: <LayoutGrid size={16} /> },
              { id: 'spectator' as GMTab, label: 'Spectateur', icon: <Eye size={16} /> },
              { id: '__perf__' as GMTab, label: 'Performance', icon: <Activity size={16} /> },
            ];
            const isOnBurgerTab = burgerTabs.some(bt => bt.id === activeTab) || perfMonitorOpen;
            return (
              <>
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: mobileMenuOpen || isOnBurgerTab ? t.goldBg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${mobileMenuOpen || isOnBurgerTab ? t.goldBorder : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {mobileMenuOpen ? (
                    <X size={14} style={{ color: t.gold }} />
                  ) : (
                    <Menu size={14} style={{ color: isOnBurgerTab ? t.gold : t.textMuted }} />
                  )}
                </button>
                {/* Burger dropdown (portaled to body) */}
                {createPortal(
                  <AnimatePresence>
                    {mobileMenuOpen && (
                      <>
                        <motion.div
                          key="gm-menu-backdrop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="fixed inset-0"
                          style={{ zIndex: 9998, background: 'rgba(0,0,0,0.4)' }}
                          onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                          key="gm-menu-panel"
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="fixed right-3 flex flex-col rounded-xl overflow-hidden"
                          style={{
                            zIndex: 9999,
                            top: 'calc(env(safe-area-inset-top, 0px) + 52px)',
                            minWidth: '180px',
                            background: t.modalBg,
                            backdropFilter: 'blur(24px)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            border: `1px solid ${t.headerBorder}`,
                          }}
                        >
                          {burgerTabs.map((tab, idx) => (
                            <button
                              key={tab.id}
                              onClick={() => {
                                if (tab.id === '__perf__') {
                                  setPerfMonitorOpen((v) => !v);
                                } else {
                                  setActiveTab(tab.id);
                                  setPerfMonitorOpen(false);
                                }
                                setMobileMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 transition-colors"
                              style={{
                                background: (tab.id === '__perf__' ? perfMonitorOpen : activeTab === tab.id) ? t.goldBg : 'transparent',
                                color: (tab.id === '__perf__' ? perfMonitorOpen : activeTab === tab.id) ? t.gold : t.textMuted,
                                fontFamily: '"Cinzel", serif',
                                fontSize: '0.75rem',
                                borderBottom: idx < burgerTabs.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none',
                              }}
                            >
                              {tab.icon}
                              {tab.label}
                              {(tab.id === '__perf__' ? perfMonitorOpen : activeTab === tab.id) && (
                                <span className="ml-auto" style={{ color: t.gold }}>
                                  <Check size={14} />
                                </span>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>,
                  document.body
                )}
              </>
            );
          })()}
          </div>
        </div>

        {/* Tab row (desktop only — mobile uses bottom nav) */}
        {!isMobile && (
        <div className="flex items-center mt-1 justify-end gap-1">
          {(
            [
              { id: 'game' as GMTab, label: 'Partie', icon: <Target size={14} /> },
              { id: 'hints' as GMTab, label: 'Indices', icon: <Lightbulb size={14} /> },
              { id: 'quests' as GMTab, label: 'Quêtes', icon: <Map size={14} /> },
              { id: 'setup' as GMTab, label: 'Paramétrages', icon: <Shield size={14} /> },
              { id: 'gallery' as GMTab, label: 'Galerie', icon: <LayoutGrid size={14} /> },
              { id: 'spectator' as GMTab, label: 'Spectateur', icon: <Eye size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors relative"
                style={{
                  background: activeTab === tab.id ? t.goldBg : 'transparent',
                  border: activeTab === tab.id ? `1px solid ${t.goldBorder}` : '1px solid transparent',
                  color: activeTab === tab.id ? t.gold : t.textMuted,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.75rem',
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'hints' && hintBadgeCount > 0 && (
                  <span
                    className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-white"
                    style={{ background: '#8b5cf6', fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif', padding: '0 4px' }}
                  >
                    {hintBadgeCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        )}
      </header>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col"
            >
              {state.players.length > 0 ? (
                <SetupPanel
                  state={state}
                  playerEntries={playerEntries}
                  setPlayerEntries={setPlayerEntries}
                  playerCount={playerCount}
                  totalRoles={totalRoles}
                  isValid={isValid}
                  hasEnoughWerewolves={hasEnoughWerewolves}
                  updateRoleConfig={updateRoleConfig}
                  handleStartGame={handleStartGame}
                  isMobile={isMobile}
                  gameStarted={state.screen === 'game' || state.screen === 'vote' || state.screen === 'end'}
                  addPlayerMidGame={addPlayerMidGame}
                  gamePlayers={state.players}
                  playerHeartbeats={playerHeartbeats}
                  onUploadAvatar={handleUploadAvatar}
                  uploadingPlayerId={uploadingPlayerId}
                  t={t}
                  updateState={updateState}
                  onResetGame={relaunchGame}
                />
              ) : (
                <GameLobbyPanel
                  state={state}
                  gameId={selectedGameId || state.gameId || ''}
                  gameName={selectedGameName || gamesList.find(g => g.id === selectedGameId)?.name || ''}
                  playerEntries={playerEntries}
                  setPlayerEntries={setPlayerEntries}
                  playerCount={playerCount}
                  totalRoles={totalRoles}
                  isValid={isValid}
                  hasEnoughWerewolves={hasEnoughWerewolves}
                  updateRoleConfig={updateRoleConfig}
                  handleStartGame={handleStartGame}
                  isMobile={isMobile}
                  onUploadAvatar={handleUploadAvatar}
                  uploadingPlayerId={uploadingPlayerId}
                  t={t}
                  updateState={updateState}
                />
              )}
            </motion.div>
          )}
          {activeTab === 'game' && (
            <motion.div
              key="game"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <GamePanel
                state={state}
                alivePlayers={alivePlayers}
                deadPlayers={deadPlayers}
                isNight={isNight}
                hasRole={hasRole}
                leverLeSoleil={leverLeSoleil}
                handleAdvanceTurn={handleAdvanceTurn}
                handleStartNight1={handleStartNight1}
                eliminatePlayer={eliminatePlayer}
                revivePlayer={revivePlayer}
                addEvent={addEvent}
                showEventLog={showEventLog}
                setShowEventLog={setShowEventLog}
                navigate={navigate}
                setNightStep={setNightStep}
                confirmHunterShot={confirmHunterShot}
                setDayStep={setDayStep}
                resolveVote={resolveVote}
                setGuardTarget={setGuardTarget}
                isMobile={isMobile}
                playerHeartbeats={playerHeartbeats}
                t={t}
                resultDismissed={resultDismissed}
                onShowResult={() => setResultDismissed(false)}
                updateState={updateState}
                onSendHintToPlayer={(playerId: number) => {
                  setHintTargetPlayerId(playerId);
                  setActiveTab('hints');
                }}
                broadcastTestNotification={broadcastTestNotification}
                handleResolveMaireElection={handleResolveMaireElection}
                externalSelectedPlayer={questTargetPlayerId}
                onClearExternalSelectedPlayer={() => setQuestTargetPlayerId(null)}
                forceMobileView={isMobile ? 'controls' : undefined}
                onNavigateToPlayersTab={isMobile ? (playerId: number) => {
                  setQuestTargetPlayerId(playerId);
                  setActiveTab('players');
                } : undefined}
              />
            </motion.div>
          )}
          {activeTab === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <GamePanel
                state={state}
                alivePlayers={alivePlayers}
                deadPlayers={deadPlayers}
                isNight={isNight}
                hasRole={hasRole}
                leverLeSoleil={leverLeSoleil}
                handleAdvanceTurn={handleAdvanceTurn}
                handleStartNight1={handleStartNight1}
                eliminatePlayer={eliminatePlayer}
                revivePlayer={revivePlayer}
                addEvent={addEvent}
                showEventLog={showEventLog}
                setShowEventLog={setShowEventLog}
                navigate={navigate}
                setNightStep={setNightStep}
                confirmHunterShot={confirmHunterShot}
                setDayStep={setDayStep}
                resolveVote={resolveVote}
                setGuardTarget={setGuardTarget}
                isMobile={isMobile}
                playerHeartbeats={playerHeartbeats}
                t={t}
                resultDismissed={resultDismissed}
                onShowResult={() => setResultDismissed(false)}
                updateState={updateState}
                onSendHintToPlayer={(playerId: number) => {
                  setHintTargetPlayerId(playerId);
                  setActiveTab('hints');
                }}
                broadcastTestNotification={broadcastTestNotification}
                handleResolveMaireElection={handleResolveMaireElection}
                externalSelectedPlayer={questTargetPlayerId}
                onClearExternalSelectedPlayer={() => setQuestTargetPlayerId(null)}
                forceMobileView="players"
              />
            </motion.div>
          )}
          {activeTab === 'journal' && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <GMEventLog state={state} isMobile={isMobile} t={t} />
            </motion.div>
          )}
          {activeTab === 'hints' && (
            <motion.div
              key="hints"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <div className={`${isMobile ? 'px-3 py-3' : 'px-6 py-5 max-w-4xl mx-auto'}`}>
                <GMDynamicHintsPanel
                  state={state}
                  onUpdateState={updateState}
                  t={t}
                  isMobile={isMobile}
                  playerEntries={playerEntries}
                  externalPerPlayerTarget={hintTargetPlayerId}
                  onClearExternalTarget={() => setHintTargetPlayerId(null)}
                />
              </div>
            </motion.div>
          )}
          {activeTab === 'quests' && (
            <motion.div
              key="quests"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <div className={`${isMobile ? 'px-3 py-3' : 'px-6 py-5 max-w-4xl mx-auto'}`}>
                <GMQuestsPanel
                  state={state}
                  updateState={updateState}
                  t={t}
                  isMobile={isMobile}
                  onNavigateToPlayer={(playerId: number) => {
                    setQuestTargetPlayerId(playerId);
                    setActiveTab(isMobile ? 'players' : 'game');
                  }}
                  playerEntries={playerEntries}
                />
              </div>
            </motion.div>
          )}
          {activeTab === 'gallery' && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-y-auto"
            >
              <div className={`${isMobile ? 'px-3 py-3' : 'px-6 py-5 w-full'}`}>
                <GMPlayerGalleryPanel
                  state={state}
                  onUpdateState={updateState}
                  t={t}
                  isMobile={isMobile}
                  playerEntries={playerEntries}
                  setPlayerEntries={setPlayerEntries}
                />
              </div>
            </motion.div>
          )}
          {activeTab === 'spectator' && (
            <motion.div
              key="spectator"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full overflow-hidden"
            >
              <SpectatorGameView
                state={state}
                embedded
                onBack={() => setActiveTab('game')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* End game overlay */}
      <AnimatePresence>
        {state.winner && !resultDismissed && (
          <EndGameOverlay state={state} navigate={navigate} t={t} onDismiss={() => setResultDismissed(true)} onRelaunch={relaunchGame} />
        )}
      </AnimatePresence>

      {/* Hunter Shot Modal — GM can confirm the shot when a Chasseur dies */}
      <AnimatePresence>
        {state.hunterPending && state.hunterShooterId !== null && (
          <HunterShotModal
            players={state.players}
            hunterId={state.hunterShooterId}
            preTarget={(state.hunterPreTargets || {})[state.hunterShooterId] ?? null}
            villagePresentIds={state.villagePresentIds}
            onShoot={(targetId) => {
              confirmHunterShot(targetId);
              syncToServer();
            }}
          />
        )}
      </AnimatePresence>

      {/* Maire Succession — handled in the dying Maire's player view only.
         Auto-fallback via autoAssignMaireSuccessor at next phase transition. */}

      {/* Mobile bottom nav bar (4 tabs, no burger — burger is in header) */}
      {isMobile && activeTab !== 'spectator' && (
        <nav
          className="flex-shrink-0 flex items-stretch"
          style={{
            background: t.headerBg,
            borderTop: `1px solid ${t.headerBorder}`,
            backdropFilter: 'blur(10px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {([
            { id: 'game' as GMTab, label: 'Contrôles', icon: <Swords size={18} /> },
            { id: 'players' as GMTab, label: 'Joueurs', icon: <Users size={18} /> },
            { id: 'quests' as GMTab, label: 'Quêtes', icon: <Map size={18} /> },
            { id: 'hints' as GMTab, label: 'Indices', icon: <Lightbulb size={18} /> },
          ]).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileMenuOpen(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative"
                style={{
                  color: isActive ? t.gold : t.textMuted,
                  background: isActive ? t.goldBg : 'transparent',
                }}
              >
                {tab.icon}
                <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.55rem', fontWeight: isActive ? 700 : 400 }}>
                  {tab.label}
                </span>
                {tab.id === 'hints' && hintBadgeCount > 0 && (
                  <span
                    className="absolute top-1 right-1/4 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-white"
                    style={{ background: '#8b5cf6', fontSize: '0.45rem', fontWeight: 700, padding: '0 2px' }}
                  >
                    {hintBadgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Performance monitor */}
      <GMPerformanceMonitor
        realtimeStatus={realtimeStatus}
        playerCount={state.players.length}
        aliveCount={state.players.filter(p => p.alive).length}
        playerHeartbeats={playerHeartbeats}
        playerNames={Object.fromEntries(state.players.map(p => [p.shortCode, p.name]))}
        isOpen={perfMonitorOpen}
        onClose={() => setPerfMonitorOpen(false)}
      />
    </div>
  );
}