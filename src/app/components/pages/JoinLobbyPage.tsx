/**
 * JoinLobbyPage — Player-facing page for joining a game lobby via QR/link.
 *
 * Flow:
 * 1. Player visits /join/:gameId
 * 2. Enters their name → generates a shortCode immediately
 * 3. Broadcasts a lobby-join event via Realtime (includes shortCode)
 * 4. Waits for GM to start the game
 * 5. When game starts, navigates to /player/:shortCode
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate } from 'react-router';
import { Moon, Users, CheckCircle, Loader2, AlertCircle, LogIn, Wifi, WifiOff, Copy, Check } from 'lucide-react';
import { useRealtimeSync } from '../../context/useRealtimeSync';
import { API_BASE, publicAnonKey } from '../../context/apiConfig';
import type { GameState } from '../../context/gameTypes';
import { generateShortCode } from '../../context/gameContextConstants';
const wolfIcon = '/assets/icons/wolf-icon.png';

type JoinStep = 'name' | 'waiting' | 'started' | 'error';

export function JoinLobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<JoinStep>('name');
  const [playerName, setPlayerName] = useState('');
  const [gameName, setGameName] = useState('');
  const [lobbyCount, setLobbyCount] = useState(0);
  const [lobbyPlayersList, setLobbyPlayersList] = useState<Array<{ id: string; name: string }>>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [myShortCode, setMyShortCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Generate a stable player ID for this session
  const playerId = useMemo(() => {
    const stored = sessionStorage.getItem(`loup-garou-lobby-id-${gameId}`);
    if (stored) return stored;
    const id = `lobby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(`loup-garou-lobby-id-${gameId}`, id);
    return id;
  }, [gameId]);

  // Track if game has started — poll for game state
  const gameStartedRef = useRef(false);
  const myShortCodeRef = useRef<string | null>(null);

  // Realtime: listen for GM state broadcasts + lobby responses
  const handleStateReceived = useCallback((gs: GameState) => {
    // If game has players and is in game/vote/end screen, the game has started
    if (gs.players?.length > 0 && (gs.screen === 'game' || gs.screen === 'vote' || gs.screen === 'end')) {
      // Find the player by matching name OR shortCode
      const savedName = sessionStorage.getItem(`loup-garou-lobby-name-${gameId}`) || playerName;
      const savedCode = sessionStorage.getItem(`loup-garou-lobby-code-${gameId}`) || myShortCodeRef.current;
      const me = gs.players.find(p => p.name === savedName)
        || (savedCode ? gs.players.find(p => p.shortCode === savedCode) : undefined);
      if (me) {
        myShortCodeRef.current = me.shortCode;
        gameStartedRef.current = true;
        setStep('started');
        setMyShortCode(me.shortCode);
        try { sessionStorage.setItem('loup-garou-player-gameId', gameId || ''); } catch {}
        setTimeout(() => {
          navigate(`/player/${me.shortCode}`);
        }, 5000);
      } else if (savedCode) {
        // Player has a lobby shortCode but wasn't found in game — navigate directly
        gameStartedRef.current = true;
        setStep('started');
        setMyShortCode(savedCode);
        try { sessionStorage.setItem('loup-garou-player-gameId', gameId || ''); } catch {}
        setTimeout(() => {
          navigate(`/player/${savedCode}`);
        }, 5000);
      }
    }
    // Update lobby count
    if (gs.lobbyPlayers) {
      setLobbyCount(gs.lobbyPlayers.length);
      setLobbyPlayersList(gs.lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
    }
    // Grab game name from state if available
    // (not directly in state, but we can show player count)
  }, [gameId, playerName, navigate]);

  const handleLobbyResponse = useCallback((response: { playerId: string; accepted: boolean; gameName?: string }) => {
    if (response.playerId === playerId) {
      setAccepted(response.accepted);
      if (response.gameName) setGameName(response.gameName);
    }
  }, [playerId]);

  const { isConnected, broadcastLobbyJoin } = useRealtimeSync({
    isGM: false,
    gameId: gameId || null,
    onStateReceived: handleStateReceived,
    onLobbyResponse: handleLobbyResponse,
  });

  // Fetch game info on mount
  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/game/state?gameId=${encodeURIComponent(gameId)}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const data = await res.json();
        if (data.gameState) {
          const gs = data.gameState as GameState;
          // Check if game already started
          if (gs.players?.length > 0 && (gs.screen === 'game' || gs.screen === 'vote' || gs.screen === 'end')) {
            // Already started — check if we have a saved name/shortCode match
            const savedName = sessionStorage.getItem(`loup-garou-lobby-name-${gameId}`);
            const savedCode = sessionStorage.getItem(`loup-garou-lobby-code-${gameId}`);
            if (savedName || savedCode) {
              const me = (savedName ? gs.players.find(p => p.name === savedName) : undefined)
                || (savedCode ? gs.players.find(p => p.shortCode === savedCode) : undefined);
              if (me) {
                navigate(`/player/${me.shortCode}`);
                return;
              }
              // If we have a saved code but player not found in game, still try navigating
              if (savedCode) {
                navigate(`/player/${savedCode}`);
                return;
              }
            }
            setErrorMsg('La partie a deja commence. Demandez votre code au Maitre du Jeu.');
            setStep('error');
            return;
          }
          // Show lobby count
          if (gs.lobbyPlayers) {
            setLobbyCount(gs.lobbyPlayers.length);
            setLobbyPlayersList(gs.lobbyPlayers.map(p => ({ id: p.id, name: p.name })));
          }
        }
      } catch {
        // Server unreachable — still allow joining via Realtime
      }
    })();
  }, [gameId, navigate]);

  // Re-broadcast join periodically to handle GM reloads
  useEffect(() => {
    if (step !== 'waiting' || !isConnected) return;
    const savedName = sessionStorage.getItem(`loup-garou-lobby-name-${gameId}`) || playerName;
    const savedCode = sessionStorage.getItem(`loup-garou-lobby-code-${gameId}`) || myShortCodeRef.current || '';
    if (!savedName || !savedCode) return;

    // Re-broadcast every 10s
    const interval = setInterval(() => {
      broadcastLobbyJoin({ id: playerId, name: savedName, shortCode: savedCode });
    }, 10000);

    return () => clearInterval(interval);
  }, [step, isConnected, playerId, playerName, gameId, broadcastLobbyJoin]);

  // Poll for game start (fallback if Realtime misses the broadcast)
  useEffect(() => {
    if (step !== 'waiting' || !gameId) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/game/state?gameId=${encodeURIComponent(gameId)}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const data = await res.json();
        if (data.gameState) {
          const gs = data.gameState as GameState;
          if (gs.players?.length > 0 && (gs.screen === 'game' || gs.screen === 'vote' || gs.screen === 'end')) {
            const savedName = sessionStorage.getItem(`loup-garou-lobby-name-${gameId}`) || playerName;
            const savedCode = sessionStorage.getItem(`loup-garou-lobby-code-${gameId}`) || myShortCodeRef.current;
            const me = gs.players.find(p => p.name === savedName)
              || (savedCode ? gs.players.find(p => p.shortCode === savedCode) : undefined);
            if (me) {
              myShortCodeRef.current = me.shortCode;
              gameStartedRef.current = true;
              setStep('started');
              setMyShortCode(me.shortCode);
              setTimeout(() => navigate(`/player/${me.shortCode}`), 5000);
            } else if (savedCode) {
              gameStartedRef.current = true;
              setStep('started');
              setMyShortCode(savedCode);
              setTimeout(() => navigate(`/player/${savedCode}`), 5000);
            }
          }
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [step, gameId, playerName, navigate]);

  // Check if we were already in waiting mode (page reload)
  useEffect(() => {
    const savedName = sessionStorage.getItem(`loup-garou-lobby-name-${gameId}`);
    const savedCode = sessionStorage.getItem(`loup-garou-lobby-code-${gameId}`);
    if (savedName) {
      setPlayerName(savedName);
      if (savedCode) {
        setMyShortCode(savedCode);
        myShortCodeRef.current = savedCode;
      }
      setStep('waiting');
    }
  }, [gameId]);

  const handleJoin = () => {
    const name = playerName.trim();
    if (!name) return;
    // Generate shortCode immediately
    const code = generateShortCode(name, new Set());
    sessionStorage.setItem(`loup-garou-lobby-name-${gameId}`, name);
    sessionStorage.setItem(`loup-garou-lobby-code-${gameId}`, code);
    setMyShortCode(code);
    myShortCodeRef.current = code;
    broadcastLobbyJoin({ id: playerId, name, shortCode: code });
    setStep('waiting');
  };

  const handleCopyCode = () => {
    if (myShortCode) {
      navigator.clipboard.writeText(myShortCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 30%, #1a1040 60%, #0d0f20 100%)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2.5 + 0.5,
              height: Math.random() * 2.5 + 0.5,
              top: `${Math.random() * 70}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
            }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Wolf logo */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-5"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{
              background: 'radial-gradient(circle, rgba(218,165,32,0.15) 0%, transparent 70%)',
              border: '2px solid rgba(218,165,32,0.3)',
            }}
          >
            <img src={wolfIcon} alt="Loup-Garou" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-1"
          style={{
            fontFamily: '"Cinzel Decorative", serif',
            color: '#d4a843',
            fontSize: '1.3rem',
            textShadow: '0 0 20px rgba(212,168,67,0.3)',
          }}
        >
          Rejoindre le village
        </motion.h1>

        {gameName && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mb-1"
            style={{ color: '#8090b0', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}
          >
            {gameName}
          </motion.p>
        )}

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 my-5"
        >
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, transparent, #d4a843)' }} />
          <Moon size={12} style={{ color: '#d4a843' }} />
          <div className="h-px w-12" style={{ background: 'linear-gradient(90deg, #d4a843, transparent)' }} />
        </motion.div>

        {/* Connection indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-1.5 mb-6"
        >
          {isConnected ? (
            <>
              <Wifi size={12} style={{ color: '#4ade80' }} />
              <span style={{ color: '#4ade80', fontSize: '0.6rem' }}>Connecte</span>
            </>
          ) : (
            <>
              <WifiOff size={12} style={{ color: '#f0c55b' }} />
              <span style={{ color: '#f0c55b', fontSize: '0.6rem' }}>Connexion...</span>
            </>
          )}
        </motion.div>

        {/* ── Step: Enter Name ── */}
        <AnimatePresence mode="wait">
          {step === 'name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,168,67,0.15)',
                }}
              >
                <p
                  className="text-center mb-4"
                  style={{ color: '#8090b0', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}
                >
                  Entrez votre nom pour rejoindre
                </p>

                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && playerName.trim()) handleJoin(); }}
                  placeholder="Votre nom..."
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-xl bg-transparent outline-none text-center mb-4"
                  style={{
                    color: '#c0c8d8',
                    fontSize: '1rem',
                    border: '1.5px solid rgba(212,168,67,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    fontFamily: '"MedievalSharp", serif',
                  }}
                />

                <button
                  onClick={handleJoin}
                  disabled={!playerName.trim() || !isConnected}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl transition-all active:scale-95"
                  style={{
                    background: playerName.trim() && isConnected
                      ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)'
                      : 'rgba(255,255,255,0.04)',
                    color: playerName.trim() && isConnected ? '#0a0e1a' : '#4a5568',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: playerName.trim() && isConnected ? 'pointer' : 'not-allowed',
                    boxShadow: playerName.trim() && isConnected
                      ? '0 4px 20px rgba(212,168,67,0.3)'
                      : 'none',
                  }}
                >
                  <LogIn size={18} />
                  Rejoindre
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step: Waiting ── */}
          {step === 'waiting' && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <div
                className="rounded-2xl p-6 text-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,168,67,0.15)',
                }}
              >
                {/* Status indicator */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: accepted
                        ? 'rgba(74,222,128,0.1)'
                        : 'rgba(212,168,67,0.08)',
                      border: `2px solid ${accepted ? 'rgba(74,222,128,0.3)' : 'rgba(212,168,67,0.2)'}`,
                    }}
                    animate={{
                      boxShadow: [
                        `0 0 0 0px ${accepted ? 'rgba(74,222,128,0.2)' : 'rgba(212,168,67,0.15)'}`,
                        `0 0 0 15px ${accepted ? 'rgba(74,222,128,0)' : 'rgba(212,168,67,0)'}`,
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {accepted ? (
                      <CheckCircle size={28} style={{ color: '#4ade80' }} />
                    ) : (
                      <Loader2
                        size={28}
                        style={{ color: '#d4a843' }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Player name badge */}
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-3"
                  style={{
                    background: accepted ? 'rgba(74,222,128,0.08)' : 'rgba(212,168,67,0.06)',
                    border: `1px solid ${accepted ? 'rgba(74,222,128,0.2)' : 'rgba(212,168,67,0.15)'}`,
                  }}
                >
                  <span
                    className="block w-2 h-2 rounded-full"
                    style={{
                      background: accepted ? '#4ade80' : '#d4a843',
                      boxShadow: `0 0 6px ${accepted ? 'rgba(74,222,128,0.5)' : 'rgba(212,168,67,0.4)'}`,
                    }}
                  />
                  <span
                    style={{
                      fontFamily: '"MedievalSharp", serif',
                      color: accepted ? '#4ade80' : '#d4a843',
                      fontSize: '0.9rem',
                    }}
                  >
                    {playerName}
                  </span>
                </div>

                {/* Access code display */}
                {myShortCode && (
                  <div className="mb-3">
                    <p style={{ color: '#6b7b9b', fontSize: '0.6rem', marginBottom: '0.4rem', fontFamily: '"Cinzel", serif' }}>
                      Votre code joueur
                    </p>
                    <div
                      className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: `1.5px solid ${accepted ? 'rgba(74,222,128,0.25)' : 'rgba(212,168,67,0.2)'}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: accepted ? '#4ade80' : '#d4a843',
                          fontSize: '1.3rem',
                          letterSpacing: '0.15em',
                          fontWeight: 700,
                        }}
                      >
                        {myShortCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all active:scale-90"
                        style={{
                          background: codeCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${codeCopied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          color: codeCopied ? '#4ade80' : '#8090b0',
                          fontSize: '0.55rem',
                          fontFamily: '"Cinzel", serif',
                        }}
                      >
                        {codeCopied ? <Check size={11} /> : <Copy size={11} />}
                        {codeCopied ? 'Copi\u00e9 !' : 'Copier'}
                      </button>
                    </div>
                    <p style={{ color: '#5a6a8a', fontSize: '0.55rem', marginTop: '0.35rem' }}>
                      Entrez ce code dans &laquo;&thinsp;Rejoindre une partie&thinsp;&raquo; pour acc\u00e9der au jeu
                    </p>
                  </div>
                )}

                <p style={{ color: '#6b7b9b', fontSize: '0.72rem', marginBottom: '0.75rem' }}>
                  {accepted
                    ? 'Vous \u00eates inscrit. Le Ma\u00eetre du Jeu va bient\u00f4t lancer la partie.'
                    : 'Votre demande a \u00e9t\u00e9 envoy\u00e9e au Ma\u00eetre du Jeu'}
                </p>

                {/* Waiting spinner */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 size={18} style={{ color: '#d4a843', opacity: 0.4 }} />
                  </motion.div>
                  <span style={{ color: '#5a6a8a', fontSize: '0.65rem', marginLeft: '0.5rem', alignSelf: 'center' }}>
                    {accepted ? 'En attente du lancement...' : 'En attente de confirmation...'}
                  </span>
                </div>

                {/* Other lobby players */}
                {lobbyPlayersList.length > 0 && (
                  <div className="mt-2">
                    <div
                      className="flex items-center justify-center gap-1.5 mb-2.5"
                    >
                      <Users size={12} style={{ color: '#d4a843' }} />
                      <span style={{ color: '#d4a843', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                        {lobbyPlayersList.length} joueur{lobbyPlayersList.length > 1 ? 's' : ''} dans le lobby
                      </span>
                    </div>

                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      {lobbyPlayersList.map((lp, idx) => {
                        const isMe = lp.name === playerName;
                        return (
                          <motion.div
                            key={lp.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center gap-2.5 px-3 py-2"
                            style={{
                              borderBottom: idx < lobbyPlayersList.length - 1
                                ? '1px solid rgba(255,255,255,0.04)'
                                : 'none',
                              background: isMe ? 'rgba(74,222,128,0.04)' : 'transparent',
                            }}
                          >
                            <span
                              className="block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: isMe ? '#4ade80' : '#d4a843',
                                boxShadow: `0 0 4px ${isMe ? 'rgba(74,222,128,0.4)' : 'rgba(212,168,67,0.3)'}`,
                              }}
                            />
                            <span
                              className="flex-1 text-left truncate"
                              style={{
                                fontFamily: '"MedievalSharp", serif',
                                color: isMe ? '#4ade80' : '#8090b0',
                                fontSize: '0.75rem',
                              }}
                            >
                              {lp.name}
                            </span>
                            {isMe && (
                              <span
                                style={{
                                  fontSize: '0.55rem',
                                  color: 'rgba(74,222,128,0.6)',
                                  fontFamily: '"Cinzel", serif',
                                }}
                              >
                                vous
                              </span>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Step: Game Started — show shortCode prominently ── */}
          {step === 'started' && (
            <motion.div
              key="started"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full text-center"
            >
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(74,222,128,0.05)',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="flex justify-center mb-4"
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(74,222,128,0.15)',
                      border: '2px solid rgba(74,222,128,0.4)',
                    }}
                  >
                    <CheckCircle size={32} style={{ color: '#4ade80' }} />
                  </div>
                </motion.div>

                <h2 style={{ fontFamily: '"Cinzel", serif', color: '#4ade80', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                  La partie commence !
                </h2>

                {/* Short code display */}
                {myShortCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="my-4"
                  >
                    <p style={{ color: '#6b7b9b', fontSize: '0.65rem', marginBottom: '0.5rem', fontFamily: '"Cinzel", serif' }}>
                      Votre code d'acces
                    </p>
                    <div
                      className="inline-flex items-center gap-3 px-5 py-3 rounded-xl"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1.5px solid rgba(74,222,128,0.25)',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: '#4ade80',
                          fontSize: '1.4rem',
                          letterSpacing: '0.15em',
                          fontWeight: 700,
                        }}
                      >
                        {myShortCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-90"
                        style={{
                          background: codeCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${codeCopied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
                          color: codeCopied ? '#4ade80' : '#8090b0',
                          fontSize: '0.6rem',
                          fontFamily: '"Cinzel", serif',
                        }}
                      >
                        {codeCopied ? <Check size={12} /> : <Copy size={12} />}
                        {codeCopied ? 'Copie !' : 'Copier'}
                      </button>
                    </div>
                    <p style={{ color: '#5a6a8a', fontSize: '0.6rem', marginTop: '0.5rem' }}>
                      Conservez ce code pour rejoindre la partie
                    </p>
                  </motion.div>
                )}

                <p style={{ color: '#8090b0', fontSize: '0.7rem' }}>
                  Redirection automatique...
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Step: Error ── */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full text-center"
            >
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(196,30,58,0.05)',
                  border: '1px solid rgba(196,30,58,0.2)',
                }}
              >
                <div className="flex justify-center mb-3">
                  <AlertCircle size={28} style={{ color: '#c41e3a' }} />
                </div>
                <p style={{ color: '#c41e3a', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {errorMsg || 'Erreur de connexion'}
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-5 py-2.5 rounded-xl transition-all active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8090b0',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.75rem',
                  }}
                >
                  Retour a l'accueil
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}