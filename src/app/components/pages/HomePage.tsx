import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Crown, Eye, Lock, X, AlertCircle, LogIn, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useGame } from '../../context/GameContext';
import { API_BASE, publicAnonKey } from '../../context/apiConfig';
import { localLoadGamesList } from '../../context/gameContextConstants';
import { usePWAContext } from '../layout/RootLayout';
import { PWAInstallBanner } from '../PWAInstallBanner';
import wolfIcon from 'figma:asset/f25450638f641bf3950904ddd9c219ce09dc887b.png';
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 4;
const SUPER_ADMIN_CODE = '0000';

export function HomePage() {
  const navigate = useNavigate();
  const { setIsGM, localMode } = useGame();
  const pwa = usePWAContext();

  // Join game state
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '']);
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // GM modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Create game modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Auto-focus first code input on mount
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+D / Ctrl+D to open GM modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowPasswordModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Join game logic
  const handleJoinGame = useCallback(async (code: string) => {
    const shortCode = code.toUpperCase().trim();
    if (shortCode.length !== CODE_LENGTH) {
      setJoinError('Code à 4 caractères requis');
      return;
    }
    // Validate characters
    for (const ch of shortCode) {
      if (!CODE_ALPHABET.includes(ch)) {
        setJoinError('Caractère invalide dans le code');
        return;
      }
    }

    // Super admin code — direct access to Game Master (all games)
    if (shortCode === SUPER_ADMIN_CODE) {
      setIsGM(true);
      // Clear any pending game lock so GM sees all games
      try {
        sessionStorage.removeItem('loup-garou-pendingGameId');
        sessionStorage.removeItem('loup-garou-pendingGameName');
      } catch { /* ignore */ }
      navigate('/master');
      return;
    }

    // In local mode, navigate directly — no server verification needed
    if (localMode) {
      // Check if code matches a game's GM access code (first 4 chars of gameId)
      const games = localLoadGamesList();
      for (const game of games) {
        const gmCode = game.id.replace(/-/g, '').slice(0, 4).toUpperCase();
        if (gmCode === shortCode) {
          // GM code matched — lock to this game and navigate to master
          try {
            sessionStorage.setItem('loup-garou-pendingGameId', game.id);
            if (game.name) {
              sessionStorage.setItem('loup-garou-pendingGameName', String(game.name));
            }
          } catch { /* ignore */ }
          setIsGM(true);
          navigate('/master');
          return;
        }
      }
      // Otherwise treat as player shortCode
      navigate(`/player/${shortCode}`);
      return;
    }

    setJoining(true);
    setJoinError('');
    try {
      // 1. Try as GM access code — first via dedicated endpoint, then via games list fallback
      let gmMatched = false;
      try {
        const gmRes = await fetch(`${API_BASE}/game/state?gmCode=${shortCode}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const gmData = await gmRes.json();
        if (gmRes.ok && gmData.gameId) {
          // GM code matched via server endpoint
          try {
            sessionStorage.setItem('loup-garou-pendingGameId', gmData.gameId);
            if (gmData.gameName) {
              sessionStorage.setItem('loup-garou-pendingGameName', gmData.gameName);
            }
          } catch { /* ignore */ }
          setIsGM(true);
          navigate('/master');
          return;
        }
      } catch { /* server doesn't support gmCode param yet — try fallback */ }

      // Fallback: fetch all games and derive GM code client-side
      if (!gmMatched) {
        try {
          const gamesRes = await fetch(`${API_BASE}/games`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });
          if (gamesRes.ok) {
            const gamesData = await gamesRes.json();
            const games: { id: string; name?: string }[] = gamesData.games || [];
            for (const game of games) {
              const gmCode = game.id.replace(/-/g, '').slice(0, 4).toUpperCase();
              if (gmCode === shortCode) {
                try {
                  sessionStorage.setItem('loup-garou-pendingGameId', game.id);
                  if (game.name) {
                    sessionStorage.setItem('loup-garou-pendingGameName', game.name);
                  }
                } catch { /* ignore */ }
                setIsGM(true);
                navigate('/master');
                return;
              }
            }
          }
        } catch { /* ignore fallback error */ }
      }

      // 2. Try as player shortCode
      const res = await fetch(`${API_BASE}/game/state?shortCode=${shortCode}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (res.ok && data.gameState) {
        navigate(`/player/${shortCode}`);
      } else {
        setJoinError(data.error || 'Code introuvable. Vérifiez votre code.');
      }
    } catch (err) {
      setJoinError('Code invalide ou erreur réseau. Vérifiez votre connexion.');
    } finally {
      setJoining(false);
    }
  }, [navigate, localMode, setIsGM]);

  // Handle digit input
  const handleDigitChange = (index: number, value: string) => {
    const ch = value.toUpperCase().slice(-1);
    if (ch && !CODE_ALPHABET.includes(ch)) return;

    const newDigits = [...codeDigits];
    newDigits[index] = ch;
    setCodeDigits(newDigits);
    setJoinError('');

    // Auto-advance to next input
    if (ch && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (ch && index === CODE_LENGTH - 1) {
      const fullCode = newDigits.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleJoinGame(fullCode);
      }
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      const newDigits = [...codeDigits];
      newDigits[index - 1] = '';
      setCodeDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const fullCode = codeDigits.join('');
      if (fullCode.length === CODE_LENGTH) {
        handleJoinGame(fullCode);
      }
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().trim();
    const chars = pasted.split('').filter((ch) => CODE_ALPHABET.includes(ch)).slice(0, CODE_LENGTH);
    const newDigits = ['', '', '', ''];
    chars.forEach((ch, i) => { newDigits[i] = ch; });
    setCodeDigits(newDigits);
    setJoinError('');
    if (chars.length === CODE_LENGTH) {
      handleJoinGame(chars.join(''));
    } else {
      inputRefs.current[chars.length]?.focus();
    }
  };

  // GM login
  const handleGMLogin = async () => {
    if (!password.trim()) return;
    // In local mode, check password locally
    if (localMode) {
      if (password.trim() === 'loupgarou') {
        setIsGM(true);
        navigate('/master');
      } else {
        setError('Mot de passe incorrect');
      }
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/game/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIsGM(true);
        navigate('/master');
      } else {
        setError(data.error || 'Mot de passe incorrect');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  // Create game
  const handleCreateGame = async () => {
    const name = newGameName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError('');

    if (localMode) {
      // Local mode: create game locally
      const localGameId = `local-${Date.now()}`;
      try {
        sessionStorage.setItem('loup-garou-pendingGameId', localGameId);
        sessionStorage.setItem('loup-garou-pendingGameName', name);
      } catch { /* ignore */ }
      setIsGM(true);
      navigate('/master');
      setShowCreateModal(false);
      setCreating(false);
      return;
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
      const data = await res.json();
      if (data.game) {
        try {
          sessionStorage.setItem('loup-garou-pendingGameId', data.game.id);
          sessionStorage.setItem('loup-garou-pendingGameName', name);
        } catch { /* ignore */ }
        setIsGM(true);
        navigate('/master');
        setShowCreateModal(false);
      } else {
        setCreateError('Impossible de créer la partie. Réessayez.');
      }
    } catch (err) {
      setCreateError('Erreur de connexion au serveur.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 30%, #1a1040 60%, #0d0f20 100%)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              top: `${Math.random() * 70}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
            animate={{ opacity: [0.3, 0.9, 0.3] }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Moon */}
      <motion.div
        className="absolute top-12 right-8 lg:right-24"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, delay: 0.3 }}
      >
        <div className="relative">
          <div
            className="w-20 h-20 rounded-full"
            style={{
              background: 'radial-gradient(circle, #f0e68c 0%, #daa520 50%, #b8860b 100%)',
              boxShadow: '0 0 40px rgba(218,165,32,0.4), 0 0 80px rgba(218,165,32,0.2)',
            }}
          />
          <div
            className="absolute top-2 left-4 w-16 h-16 rounded-full"
            style={{ background: 'radial-gradient(circle at 30% 40%, transparent 50%, rgba(0,0,0,0.15) 100%)' }}
          />
        </div>
      </motion.div>

      {/* Village silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none">
        <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,120 L0,80 L20,80 L20,60 L30,45 L40,60 L40,80 L60,80 L60,50 L65,30 L70,50 L70,80 L100,80 L100,70 L110,55 L115,40 L120,55 L120,70 L130,70 L130,60 L140,45 L145,25 L150,45 L150,60 L170,60 L170,50 L175,30 L180,50 L180,80 L200,80 L200,65 L210,50 L215,20 L220,50 L220,65 L240,65 L240,75 L250,60 L255,35 L260,60 L260,75 L280,75 L280,55 L290,40 L295,25 L300,40 L300,55 L320,55 L320,70 L330,55 L335,30 L340,55 L340,70 L360,70 L360,80 L370,65 L375,45 L380,65 L380,80 L400,80 L400,120 Z"
            fill="#0a0e1a"
          />
          <rect x="25" y="65" width="3" height="4" fill="#d4a843" opacity="0.7" rx="0.5" />
          <rect x="105" y="62" width="3" height="4" fill="#d4a843" opacity="0.8" rx="0.5" />
          <rect x="205" y="58" width="3" height="4" fill="#d4a843" opacity="0.7" rx="0.5" />
          <rect x="325" y="60" width="3" height="4" fill="#d4a843" opacity="0.8" rx="0.5" />
          <rect x="375" y="70" width="3" height="4" fill="#d4a843" opacity="0.6" rx="0.5" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 pb-52">
        {/* Wolf icon */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-4"
        >
          <div
            className="w-20 h-20 mt-6 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer"
            style={{
              background: 'radial-gradient(circle, rgba(218,165,32,0.15) 0%, transparent 70%)',
              border: '2px solid rgba(218,165,32,0.3)',
            }}
            onClick={() => navigate('/demo')}
          >
            <img src={wolfIcon} alt="Loup-Garou" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-center mb-2"
        >
          <h1
            className="text-3xl tracking-wider mb-1"
            style={{
              fontFamily: '"Cinzel Decorative", serif',
              color: '#d4a843',
              textShadow: '0 0 20px rgba(212,168,67,0.3)',
            }}
          >
            Les Loups-Garous
          </h1>
          <p
            className="tracking-widest uppercase opacity-70"
            style={{
              fontFamily: '"Cinzel", serif',
              color: '#b8a070',
              fontSize: '0.7rem',
              letterSpacing: '0.25em',
            }}
          >
            de Thiercelieux
          </p>
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex items-center gap-3 my-6"
        >
          <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, transparent, #d4a843)' }} />
          <Moon size={14} style={{ color: '#d4a843' }} />
          <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, #d4a843, transparent)' }} />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="text-center mb-10 px-4 max-w-md"
          style={{ color: '#8090b0', fontFamily: '"Cinzel", serif', fontSize: '0.85rem' }}
        >
          Quand la nuit tombe sur le village, les loups rodent parmi vous...
        </motion.p>

        {/* Main buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="flex flex-col gap-4 w-full max-w-sm"
        >
          {/* Join panel — 4-char code input (always visible) */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            <div
              className="rounded-xl p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,168,67,0.15)',
              }}
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <LogIn size={16} style={{ color: '#d4a843' }} />
                <p
                  style={{ color: '#d4a843', fontSize: '0.9rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}
                >
                  Rejoindre une partie
                </p>
              </div>
              <p
                className="text-center mb-4"
                style={{ color: '#8090b0', fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}
              >
                Entrez votre code joueur
              </p>

              {/* 4-digit code inputs */}
              <div className="flex justify-center gap-3 mb-4" onPaste={handlePaste}>
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-14 h-16 rounded-xl text-center outline-none transition-all duration-200 focus:ring-2"
                    style={{
                      background: digit ? 'rgba(212,168,67,0.08)' : 'rgba(0,0,0,0.3)',
                      border: joinError
                        ? '2px solid rgba(196,30,58,0.5)'
                        : digit
                          ? '2px solid rgba(212,168,67,0.4)'
                          : '2px solid rgba(255,255,255,0.08)',
                      color: '#d4a843',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      caretColor: '#d4a843',
                      // @ts-expect-error ring color
                      '--tw-ring-color': 'rgba(212,168,67,0.3)',
                    }}
                  />
                ))}
              </div>

              {/* Error */}
              <AnimatePresence>
                {joinError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center justify-center gap-2 mb-3"
                  >
                    <AlertCircle size={14} style={{ color: '#c41e3a' }} />
                    <span style={{ color: '#c41e3a', fontSize: '0.75rem' }}>{joinError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Join button */}
              <button
                onClick={() => handleJoinGame(codeDigits.join(''))}
                disabled={joining || codeDigits.join('').length < CODE_LENGTH}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: codeDigits.join('').length === CODE_LENGTH
                    ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)'
                    : 'rgba(255,255,255,0.04)',
                  color: codeDigits.join('').length === CODE_LENGTH ? '#0a0e1a' : '#4a5568',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.85rem',
                  cursor: codeDigits.join('').length === CODE_LENGTH ? 'pointer' : 'not-allowed',
                  opacity: joining ? 0.7 : 1,
                }}
              >
                {joining ? (
                  <span>Connexion...</span>
                ) : (
                  <>
                    <LogIn size={16} />
                    Rejoindre
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Créer une partie — outlined golden button */}
          

          {/* Spectateur */}
          <button
            onClick={() => navigate('/spectator')}
            className="flex items-center justify-center gap-3 py-4 px-8 rounded-xl transition-all duration-300 active:scale-95 hover:shadow-lg"
            style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1.5px solid rgba(139,92,246,0.3)',
              color: '#a78bfa',
              fontFamily: '"Cinzel", serif',
            }}
          >
            <Eye size={20} />
            Spectateur
          </button>

          {/* Demo - hidden, accessible via wolf icon */}
          {/* <button
            onClick={() => navigate('/demo')}
            className="flex items-center justify-center gap-3 py-4 px-8 rounded-xl transition-all duration-300 active:scale-95 hover:shadow-lg"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1.5px solid rgba(245,158,11,0.3)',
              color: '#f59e0b',
              fontFamily: '"Cinzel", serif',
            }}
          >
            <Sparkles size={20} />
            Mode Demo
          </button> */}
        </motion.div>
      </div>

      {/* GM Password Modal (hidden, accessed via Cmd+D) */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowPasswordModal(false); setPassword(''); setError(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-2xl p-6 relative"
              style={{
                background: 'linear-gradient(135deg, #0f1629 0%, #1a1040 100%)',
                border: '1px solid rgba(212,168,67,0.2)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => { setShowPasswordModal(false); setPassword(''); setError(''); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <X size={16} style={{ color: '#6b7b9b' }} />
              </button>

              {/* Lock icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(212,168,67,0.1)',
                    border: '2px solid rgba(212,168,67,0.25)',
                  }}
                >
                  <Lock size={24} style={{ color: '#d4a843' }} />
                </div>
              </div>

              <h2
                className="text-center mb-1"
                style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1.1rem' }}
              >
                Maitre du Jeu
              </h2>
              <p
                className="text-center mb-5"
                style={{ color: '#6b7b9b', fontSize: '0.75rem' }}
              >
                Entrez le mot de passe pour acceder au tableau de bord
              </p>

              {/* Password input */}
              <div className="mb-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGMLogin(); }}
                  placeholder="Mot de passe..."
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-transparent outline-none text-center"
                  style={{
                    color: '#c0c8d8',
                    fontSize: '1rem',
                    letterSpacing: '0.15em',
                    border: error ? '1.5px solid rgba(196,30,58,0.5)' : '1.5px solid rgba(212,168,67,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    fontFamily: '"Cinzel", serif',
                  }}
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center justify-center gap-2 mb-4"
                  >
                    <AlertCircle size={14} style={{ color: '#c41e3a' }} />
                    <span style={{ color: '#c41e3a', fontSize: '0.75rem' }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                onClick={handleGMLogin}
                disabled={loading || !password.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: password.trim()
                    ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)'
                    : 'rgba(255,255,255,0.04)',
                  color: password.trim() ? '#0a0e1a' : '#4a5568',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.9rem',
                  cursor: password.trim() ? 'pointer' : 'not-allowed',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <span>Verification...</span>
                ) : (
                  <>
                    <Crown size={16} />
                    Entrer
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Game Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setNewGameName(''); setCreateError(''); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-2xl p-6 relative"
              style={{
                background: 'linear-gradient(135deg, #0f1629 0%, #1a1040 100%)',
                border: '1px solid rgba(212,168,67,0.2)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => { setShowCreateModal(false); setNewGameName(''); setCreateError(''); }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <X size={16} style={{ color: '#6b7b9b' }} />
              </button>

              {/* Crown icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(212,168,67,0.1)',
                    border: '2px solid rgba(212,168,67,0.25)',
                  }}
                >
                  <Crown size={24} style={{ color: '#d4a843' }} />
                </div>
              </div>

              <h2
                className="text-center mb-1"
                style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#d4a843', fontSize: '1.1rem' }}
              >
                Nouvelle partie
              </h2>
              <p
                className="text-center mb-5"
                style={{ color: '#6b7b9b', fontSize: '0.75rem' }}
              >
                Donnez un nom a votre partie
              </p>

              {/* Game name input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={newGameName}
                  onChange={(e) => { setNewGameName(e.target.value); setCreateError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newGameName.trim()) handleCreateGame(); }}
                  placeholder="Ex: Soiree du samedi..."
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-transparent outline-none text-center"
                  style={{
                    color: '#c0c8d8',
                    fontSize: '0.95rem',
                    border: createError ? '1.5px solid rgba(196,30,58,0.5)' : '1.5px solid rgba(212,168,67,0.2)',
                    background: 'rgba(0,0,0,0.3)',
                    fontFamily: '"Cinzel", serif',
                  }}
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {createError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center justify-center gap-2 mb-4"
                  >
                    <AlertCircle size={14} style={{ color: '#c41e3a' }} />
                    <span style={{ color: '#c41e3a', fontSize: '0.75rem' }}>{createError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                onClick={handleCreateGame}
                disabled={creating || !newGameName.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                style={{
                  background: newGameName.trim()
                    ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)'
                    : 'rgba(255,255,255,0.04)',
                  color: newGameName.trim() ? '#0a0e1a' : '#4a5568',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: newGameName.trim() ? 'pointer' : 'not-allowed',
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? (
                  <span>Creation...</span>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Creer la partie
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Banner */}
      <PWAInstallBanner pwa={pwa} variant="dark" />
    </div>
  );
}