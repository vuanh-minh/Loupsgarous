import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, RefreshCw, LayoutGrid, Moon, Sun, Users } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { useRealtimeSync } from '../../context/useRealtimeSync';
import { gameTheme } from '../../context/gameTheme';
import { computeRemaining } from '../PhaseTimer';
import { API_BASE, publicAnonKey } from '../../context/apiConfig';
import { SpectatorGameView } from './spectator/SpectatorGameView';

interface GameListEntry {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  aliveCount: number;
  phase: string;
  turn: number;
  screen: string;
}

export function SpectatorPage() {
  const navigate = useNavigate();
  const { gameId: gameIdParam } = useParams();
  const { state, loadFromServer, setFullState, applyStateDelta, localMode, isDeltaRecoveryNeeded, clearDeltaRecovery } = useGame();
  const t = gameTheme(state.phase);

  // ── Lobby state (when no gameId in URL) ──
  const [gamesList, setGamesList] = useState<GameListEntry[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);

  const activeGameId = gameIdParam || state.gameId || null;

  // Realtime channel: receive GM state broadcasts instantly (game-specific)
  const handleStateReceived = useCallback((gs: any) => {
    setFullState(gs);
  }, [setFullState]);

  // Handle GM delta broadcasts (optimized — only changed fields)
  const handleDeltaReceived = useCallback((delta: any) => {
    applyStateDelta(delta);
  }, [applyStateDelta]);

  const { isConnected: realtimeConnected, broadcastResyncRequest } = useRealtimeSync({
    isGM: false,
    onStateReceived: handleStateReceived,
    onDeltaReceived: handleDeltaReceived,
    gameId: activeGameId,
    disabled: localMode,
  });

  // ── Auto-transition: trigger next phase when timer expires ──
  const setFullStateRef = useRef(setFullState);
  setFullStateRef.current = setFullState;

  useEffect(() => {
    if (!state.phaseTimerEndAt || state.winner || !activeGameId) return;
    if (localMode) return;

    let transitionInFlight = false;
    const gameId = activeGameId;
    const endAt = state.phaseTimerEndAt;

    const doTransition = async () => {
      if (transitionInFlight) return;
      transitionInFlight = true;

      console.log('[SpectatorPage] Timer expired, requesting server auto-transition...');
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
          console.log('[SpectatorPage] Server auto-transition applied.');
          setFullStateRef.current(data.gameState);
        } else if (data.skipped) {
          console.log('[SpectatorPage] Server auto-transition skipped:', data.reason);
          if (data.gameState) {
            setFullStateRef.current(data.gameState);
          } else {
            try {
              const stateRes = await fetch(`${API_BASE}/game/state?gameId=${encodeURIComponent(gameId)}`, {
                headers: { 'Authorization': `Bearer ${publicAnonKey}` },
              });
              const stateData = await stateRes.json();
              if (stateData.gameState) {
                setFullStateRef.current(stateData.gameState);
              }
            } catch (pollErr) {
              console.log('[SpectatorPage] Fallback state poll error:', pollErr);
            }
          }
        } else if (data.error) {
          console.log('[SpectatorPage] Server auto-transition error:', data.error);
        }
      } catch (err) {
        console.log('[SpectatorPage] Server auto-transition fetch error:', err);
      }
      setTimeout(() => { transitionInFlight = false; }, 5000);
    };

    // Higher jitter (2–4s) for spectators — lower priority than players/GM
    const jitterMs = 2000 + Math.random() * 2000;

    const interval = setInterval(() => {
      const remaining = computeRemaining(endAt);
      if (remaining <= 0) {
        doTransition();
      }
    }, 1000);

    // Check immediately (with jitter) in case the timer is already expired
    if (computeRemaining(endAt) <= 0) {
      setTimeout(doTransition, jitterMs);
    }

    return () => clearInterval(interval);
  }, [state.phaseTimerEndAt, state.winner, activeGameId, localMode]);

  // Fetch games list for lobby
  const fetchGamesList = useCallback(async () => {
    if (localMode) { setLobbyLoading(false); return; }
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
      console.log('Spectator fetch games list error:', err);
    } finally {
      setLobbyLoading(false);
    }
  }, [localMode]);

  // Load lobby when no gameId
  useEffect(() => {
    if (!gameIdParam) {
      fetchGamesList();
    }
  }, [gameIdParam, fetchGamesList]);

  // Auto-refresh lobby every 10s
  useEffect(() => {
    if (gameIdParam) return;
    const interval = setInterval(fetchGamesList, 10000);
    return () => clearInterval(interval);
  }, [gameIdParam, fetchGamesList]);

  // Initial load + fallback polling for a specific game
  useEffect(() => {
    if (!gameIdParam) return;
    let active = true;
    const poll = async () => {
      const serverState = await loadFromServer({ gameId: gameIdParam });
      if (active && serverState) {
        setFullState(serverState);
      }
    };
    poll(); // always do initial load
    const pollInterval = realtimeConnected ? 5000 : 2000;
    const interval = setInterval(poll, pollInterval);
    return () => { active = false; clearInterval(interval); };
  }, [gameIdParam, loadFromServer, setFullState, realtimeConnected]);

  // ── Delta version gap recovery ──
  useEffect(() => {
    if (!realtimeConnected || !gameIdParam) return;
    const checkInterval = setInterval(async () => {
      if (isDeltaRecoveryNeeded()) {
        console.log('[SpectatorPage] Delta version gap detected — requesting resync + fetching full state');
        clearDeltaRecovery();
        // Ask GM to re-broadcast full state (fast path)
        broadcastResyncRequest();
        // Also fetch from REST as fallback
        try {
          const serverState = await loadFromServer({ gameId: gameIdParam });
          if (serverState) setFullState(serverState);
        } catch (err) {
          console.log('[SpectatorPage] Delta recovery fetch error:', err);
        }
      }
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [realtimeConnected, gameIdParam, isDeltaRecoveryNeeded, clearDeltaRecovery, broadcastResyncRequest, loadFromServer, setFullState]);

  // ── LOBBY VIEW: show game list when no gameId ──
  if (!gameIdParam) {
    const getStatusInfo = (g: GameListEntry) => {
      if (g.screen === 'end') return { label: 'Terminee', color: '#6b7b9b', bg: 'rgba(107,123,155,0.1)' };
      if (g.screen === 'game' || g.screen === 'vote') {
        if (g.phase === 'night') return { label: `Nuit ${g.turn}`, color: '#7c8db5', bg: 'rgba(124,141,181,0.1)' };
        return { label: `Jour ${g.turn}`, color: '#f0c55b', bg: 'rgba(240,197,91,0.1)' };
      }
      return { label: 'Configuration', color: '#d4a843', bg: 'rgba(212,168,67,0.08)' };
    };

    const activeGames = gamesList.filter((g) => g.playerCount > 0);
    const hasGames = activeGames.length > 0;

    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: t.pageBg,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <header
          className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4"
          style={{
            background: t.headerBg,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid' as const,
            borderBottomColor: t.headerBorder,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <ArrowLeft size={18} style={{ color: '#6b7b9b' }} />
              </button>
              <Eye size={20} style={{ color: '#a78bfa' }} />
              <h1 style={{ fontFamily: '"Cinzel", serif', color: '#a78bfa', fontSize: '1.1rem' }}>
                Spectateur
              </h1>
            </div>
            <button
              onClick={fetchGamesList}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
              title="Rafraichir"
            >
              <RefreshCw size={16} style={{ color: '#6b7b9b' }} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <div className="max-w-4xl mx-auto">
            {lobbyLoading && gamesList.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <LayoutGrid size={24} style={{ color: '#a78bfa', margin: '0 auto 0.75rem' }} />
                  <p style={{ fontFamily: '"Cinzel", serif', color: '#6b7b9b', fontSize: '0.85rem' }}>
                    Chargement des parties...
                  </p>
                </div>
              </div>
            ) : !hasGames ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(139,92,246,0.06)', border: '2px solid rgba(139,92,246,0.15)' }}
                >
                  <span className="text-4xl">👁️</span>
                </div>
                <p style={{ fontFamily: '"Cinzel", serif', color: '#a78bfa', fontSize: '1rem', marginBottom: '0.25rem' }}>
                  Aucune partie en cours
                </p>
                <p style={{ color: '#6b7b9b', fontSize: '0.8rem', textAlign: 'center' }}>
                  Le Maitre du Jeu doit d'abord lancer une partie.
                </p>
              </div>
            ) : (
              <>
                <p
                  className="mb-4"
                  style={{ fontFamily: '"Cinzel", serif', color: '#6b7b9b', fontSize: '0.8rem' }}
                >
                  Selectionnez une partie a observer
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeGames.map((game) => {
                    const status = getStatusInfo(game);
                    return (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(139,92,246,0.1)',
                        }}
                        onClick={() => navigate(`/spectator/${game.id}`)}
                      >
                        <h3
                          className="truncate mb-2"
                          style={{ fontFamily: '"Cinzel", serif', color: '#c0c8d8', fontSize: '0.9rem' }}
                        >
                          {game.name}
                        </h3>
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{
                              background: status.bg,
                              border: `1px solid ${status.color}25`,
                              fontSize: '0.65rem',
                              color: status.color,
                              fontFamily: '"Cinzel", serif',
                            }}
                          >
                            {game.phase === 'night' ? <Moon size={10} /> : <Sun size={10} />}
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Users size={11} style={{ color: '#6b7b9b' }} />
                            <span style={{ color: '#6b7b9b', fontSize: '0.65rem' }}>
                              {game.playerCount} joueurs
                            </span>
                          </div>
                          {game.aliveCount > 0 && game.aliveCount < game.playerCount && (
                            <div className="flex items-center gap-1">
                              <span style={{ color: '#6b8e5a', fontSize: '0.65rem' }}>
                                {game.aliveCount} vivants
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── SPECTATOR VIEW for a specific game ──
  const hasGame = state.players.length > 0;

  // No game loaded yet
  if (!hasGame) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: t.pageBg }}
      >
        <span className="text-5xl mb-4">👁️</span>
        <h1
          style={{
            fontFamily: '"Cinzel", serif',
            color: t.gold,
            fontSize: '1.3rem',
            textAlign: 'center',
          }}
        >
          Chargement de la partie...
        </h1>
        <p style={{ color: '#6b7b9b', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
          Connexion au serveur en cours.
        </p>
        <button
          onClick={() => navigate('/spectator')}
          className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl transition-all active:scale-95"
          style={{
            background: 'rgba(212,168,67,0.08)',
            border: '1.5px solid rgba(212,168,67,0.3)',
            color: '#d4a843',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.85rem',
          }}
        >
          <ArrowLeft size={16} />
          Retour
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <SpectatorGameView state={state} realtimeConnected={realtimeConnected} />
    </div>
  );
}