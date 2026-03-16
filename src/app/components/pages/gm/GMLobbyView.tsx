import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Moon, Sun, Users, ArrowLeft, Crown,
  Trash2, Check, X, Plus, LayoutGrid,
} from 'lucide-react';
import { type GameThemeTokens, type GameListEntry } from './GMShared';

interface GMLobbyViewProps {
  t: GameThemeTokens;
  navigate: (path: string) => void;
  gamesList: GameListEntry[];
  lobbyLoading: boolean;
  deletingGameId: string | null;
  deleteGame: (gameId: string) => void;
  selectGame: (gameId: string) => void;
  showNewGameInput: boolean;
  setShowNewGameInput: (v: boolean) => void;
  newGameName: string;
  setNewGameName: (v: string) => void;
  createGame: (name: string) => Promise<GameListEntry | null>;
}

function getStatusInfo(g: GameListEntry) {
  if (g.screen === 'end') return { label: 'Terminee', color: '#6b7b9b', bg: 'rgba(107,123,155,0.1)' };
  if (g.screen === 'game' || g.screen === 'vote') {
    if (g.phase === 'night') return { label: `Nuit ${g.turn}`, color: '#7c8db5', bg: 'rgba(124,141,181,0.1)' };
    return { label: `Jour ${g.turn}`, color: '#f0c55b', bg: 'rgba(240,197,91,0.1)' };
  }
  return { label: 'Configuration', color: '#d4a843', bg: 'rgba(212,168,67,0.08)' };
}

export const GMLobbyView = React.memo(function GMLobbyView({
  t, navigate, gamesList, lobbyLoading, deletingGameId,
  deleteGame, selectGame, showNewGameInput, setShowNewGameInput,
  newGameName, setNewGameName, createGame,
}: GMLobbyViewProps) {
  const handleCreateAndSelect = (name: string) => {
    createGame(name).then((game) => {
      if (game) {
        setNewGameName('');
        setShowNewGameInput(false);
        selectGame(game.id);
      }
    });
  };

  // Long-press state for mobile delete
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((gameId: string) => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setLongPressId((prev) => (prev === gameId ? null : gameId));
    }, 500);
  }, [clearLongPress]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: t.pageBg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Lobby header */}
      <header
        className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          background: t.headerBg,
          borderBottom: `1px solid ${t.headerBorder}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${t.overlayChannel}, 0.06)`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ArrowLeft size={18} style={{ color: t.textMuted }} />
            </button>
            <Crown size={20} style={{ color: t.gold }} />
            <h1 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1.1rem' }}>
              Mes Parties
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <div className="max-w-4xl mx-auto">
          {lobbyLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <LayoutGrid size={24} style={{ color: t.gold, margin: '0 auto 0.75rem' }} />
                <p style={{ fontFamily: '"Cinzel", serif', color: t.textMuted, fontSize: '0.85rem' }}>
                  Chargement des parties...
                </p>
              </div>
            </div>
          ) : (
            <>
              {gamesList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
                    style={{ background: t.goldBg, border: `2px solid ${t.goldBorder}` }}
                  >
                    <span className="text-4xl">{'\uD83D\uDC3A'}</span>
                  </div>
                  <p style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1rem', marginBottom: '0.25rem' }}>
                    Aucune partie
                  </p>
                  <p style={{ color: t.textMuted, fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                    Creez votre premiere partie pour commencer
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {gamesList.map((game) => {
                    const status = getStatusInfo(game);
                    const isDeleting = deletingGameId === game.id;
                    return (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] group relative"
                        style={{
                          background: t.cardBg,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: t.cardBorder,
                          opacity: isDeleting ? 0.4 : 1,
                        }}
                        onClick={() => {
                          if (isDeleting) return;
                          if (longPressId === game.id) { setLongPressId(null); return; }
                          selectGame(game.id);
                        }}
                        onPointerDown={() => handlePointerDown(game.id)}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {/* Delete button — visible on hover (desktop) or long-press (mobile) */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteGame(game.id); setLongPressId(null); }}
                          className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${longPressId === game.id ? 'opacity-100 scale-110' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ background: longPressId === game.id ? 'rgba(196,30,58,0.12)' : 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${t.overlayChannel}, 0.1)`}
                          onMouseLeave={(e) => e.currentTarget.style.background = longPressId === game.id ? 'rgba(196,30,58,0.12)' : 'transparent'}
                          title="Supprimer cette partie"
                        >
                          <Trash2 size={12} style={{ color: '#c41e3a' }} />
                        </button>

                        {/* Game name */}
                        <h3
                          className="truncate mb-2 pr-8"
                          style={{ fontFamily: '"Cinzel", serif', color: t.text, fontSize: '0.9rem' }}
                        >
                          {game.name}
                        </h3>

                        {/* Status badge */}
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

                        {/* Stats */}
                        <div className="flex items-center gap-3">
                          {game.playerCount > 0 ? (
                            <>
                              <div className="flex items-center gap-1">
                                <Users size={11} style={{ color: t.textMuted }} />
                                <span style={{ color: t.textMuted, fontSize: '0.65rem' }}>
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
                            </>
                          ) : (
                            <span style={{ color: t.textDim, fontSize: '0.65rem', fontStyle: 'italic' }}>
                              Pas encore de joueurs
                            </span>
                          )}
                          {/* GM Access Code */}
                          <div
                            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded"
                            style={{
                              background: 'rgba(184,134,11,0.08)',
                              border: '1px solid rgba(184,134,11,0.15)',
                            }}
                          >
                            <Crown size={10} style={{ color: t.gold, opacity: 0.7 }} />
                            <span style={{ color: t.gold, fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                              {game.id.replace(/-/g, '').slice(0, 4).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Created date */}
                        <p style={{ color: t.textDim, fontSize: '0.55rem', marginTop: '0.5rem' }}>
                          {new Date(game.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Create game */}
              {showNewGameInput ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-5 max-w-md mx-auto"
                  style={{
                    background: t.goldBg,
                    border: `1px solid ${t.goldBorder}`,
                  }}
                >
                  <p style={{ color: t.gold, fontSize: '0.8rem', fontFamily: '"Cinzel", serif', marginBottom: '0.75rem' }}>
                    Nouvelle partie
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newGameName}
                      onChange={(e) => setNewGameName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newGameName.trim()) {
                          handleCreateAndSelect(newGameName.trim());
                        }
                        if (e.key === 'Escape') { setShowNewGameInput(false); setNewGameName(''); }
                      }}
                      placeholder="Nom de la partie..."
                      className="flex-1 bg-transparent outline-none px-4 py-3 rounded-lg"
                      style={{
                        color: t.inputText,
                        fontSize: '0.85rem',
                        border: `1px solid ${t.goldBorder}`,
                        background: t.inputBg,
                        fontFamily: '"Cinzel", serif',
                      }}
                    />
                    <button
                      onClick={() => {
                        if (!newGameName.trim()) return;
                        handleCreateAndSelect(newGameName.trim());
                      }}
                      disabled={!newGameName.trim()}
                      className="px-5 py-3 rounded-lg flex items-center gap-2 transition-colors"
                      style={{
                        background: newGameName.trim()
                          ? 'linear-gradient(135deg, #b8860b, #d4a843)'
                          : `rgba(${t.overlayChannel}, 0.03)`,
                        color: newGameName.trim() ? '#0a0e1a' : t.textDim,
                        fontFamily: '"Cinzel", serif',
                        fontSize: '0.8rem',
                        cursor: newGameName.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <Check size={16} />
                      Creer
                    </button>
                    <button
                      onClick={() => { setShowNewGameInput(false); setNewGameName(''); }}
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${t.overlayChannel}, 0.06)`}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <X size={16} style={{ color: t.textMuted }} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowNewGameInput(true)}
                  className="w-full max-w-md mx-auto flex items-center justify-center gap-3 py-4 rounded-xl transition-colors block"
                  style={{
                    background: `linear-gradient(135deg, ${t.goldBg}, ${t.goldBg})`,
                    borderWidth: '1.5px',
                    borderStyle: 'dashed',
                    borderColor: t.goldBorder,
                    color: t.gold,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={18} />
                  Nouvelle partie
                </motion.button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
});