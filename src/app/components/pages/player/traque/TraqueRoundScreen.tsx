import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, SkipForward, X, ChevronDown, Search } from 'lucide-react';
import type { GameState, TraqueProgress } from '../../../../context/gameTypes';
import { getRoleById } from '../../../../data/roles';
import { PAvatar } from '../PAvatar';
import { resolveHintText } from '../../gm/gmPureHelpers';
import { Progress } from '../../../../components/ui/progress';

interface Props {
  state: GameState;
  progress: TraqueProgress;
  onAnswer: (targetPlayerId: number, guessedPlayerId: number | null) => void;
}

type FeedbackState = null | {
  status: 'correct' | 'wrong' | 'skipped';
  correctPlayer: (typeof state.players)[number];
  guessedPlayerId: number | null;
};

export function TraqueRoundScreen({ state, progress, onAnswer }: Props) {
  const targetPlayerId = progress.roleOrder[progress.currentIndex];
  const targetPlayer = state.players.find((p) => p.id === targetPlayerId) ?? null;
  const role = targetPlayer ? getRoleById(targetPlayer.role) : null;

  const hints = useMemo(() => {
    return (state.dynamicHints ?? [])
      .filter((h) => h.targetPlayerId === targetPlayerId)
      .sort((a, b) => a.priority - b.priority);
  }, [state.dynamicHints, targetPlayerId]);

  const groups = useMemo(() => {
    // Exclure uniquement les joueurs déjà révélés (cibles des manches passées)
    // Les mauvaises réponses restent disponibles dans la liste
    const revealedIds = new Set(Object.keys(progress.answers).map(Number));

    const eligible = state.players.filter((p) => {
      if (p.id === progress.selfPlayerId) return false;
      if (revealedIds.has(p.id)) return false;
      if (progress.selectedTags.length > 0) {
        const pTags = state.playerTags[p.id] ?? [];
        return pTags.some((t) => progress.selectedTags.includes(t));
      }
      return true;
    });
    const byTag: Record<string, typeof eligible> = {};
    eligible.forEach((p) => {
      const tags = state.playerTags[p.id];
      const tag = (tags && tags.length > 0 ? tags : ['Sans tag'])[0];
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(p);
    });
    Object.values(byTag).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return Object.entries(byTag).sort(([a], [b]) => a.localeCompare(b));
  }, [state.players, progress.selfPlayerId, state.playerTags, progress.selectedTags, progress.answers]);

  const campStats = useMemo(() => {
    const stats: Record<string, { found: number; total: number; emoji: string }> = {};
    progress.roleOrder.forEach((pid) => {
      const player = state.players.find((p) => p.id === pid);
      if (!player) return;
      const r = getRoleById(player.role);
      if (!r) return;
      if (!stats[r.team]) stats[r.team] = { found: 0, total: 0, emoji: r.team === 'werewolf' ? '🐺' : r.team === 'solo' ? '🌟' : '🏘️' };
      stats[r.team].total += 1;
      if (progress.answers[pid]?.correct) stats[r.team].found += 1;
    });
    return Object.entries(stats);
  }, [progress.roleOrder, progress.answers, state.players]);

  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [dragX, setDragX] = useState(0);

  const selectedPlayer = useMemo(
    () => selectedId ? state.players.find((p) => p.id === Number(selectedId)) ?? null : null,
    [selectedId, state.players],
  );

  if (!targetPlayer || !role) return null;

  const total = progress.roleOrder.length;
  const done = progress.currentIndex;
  const currentHint = hints.length > 0 ? hints[hintIndex] : null;

  function handleGuess(guessedPlayerId: number | null) {
    if (feedback) return;
    const correct = guessedPlayerId !== null && guessedPlayerId === targetPlayerId;
    const status = guessedPlayerId === null ? 'skipped' : correct ? 'correct' : 'wrong';
    setFeedback({ status, correctPlayer: targetPlayer!, guessedPlayerId });
  }

  function handleContinue() {
    onAnswer(targetPlayerId, feedback!.guessedPlayerId);
    setFeedback(null);
    setSelectedId('');
    setSheetOpen(false);
    setHintIndex(0);
  }

  function handleConfirm() {
    if (!selectedId) return;
    handleGuess(Number(selectedId));
  }

  function goToHint(idx: number) {
    setHintIndex(Math.max(0, Math.min(hints.length - 1, idx)));
  }

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: '#070b1a' }}
    >
      {/* ── Carousel full-screen ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 right-0 z-10 px-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <Progress value={(done / total) * 100} className="h-1" />
          <div className="flex items-center justify-between mt-1">
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem' }}>
              {done} / {total}
            </span>
            <div className="flex gap-2">
              {campStats.map(([camp, s]) => (
                <span key={camp} style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.58rem' }}>
                  {s.emoji} {s.found}/{s.total}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Slide image */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${targetPlayerId}-${hintIndex}`}
            initial={{ opacity: 0, x: dragX > 0 ? -40 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dragX > 0 ? 40 : -40 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -50 && hintIndex < hints.length - 1) {
                setDragX(-1);
                goToHint(hintIndex + 1);
              } else if (info.offset.x > 50 && hintIndex > 0) {
                setDragX(1);
                goToHint(hintIndex - 1);
              }
            }}
          >
            {currentHint?.imageUrl ? (
              <img
                src={currentHint.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                style={{ userSelect: 'none', WebkitUserDrag: 'none' } as React.CSSProperties}
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: `radial-gradient(ellipse at 50% 30%, ${role.color}22 0%, #070b1a 70%)`,
                }}
              />
            )}

            {/* Dark gradient overlay bottom */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(7,11,26,0.55) 0%, transparent 35%, transparent 45%, rgba(7,11,26,0.92) 100%)',
                pointerEvents: 'none',
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Role badge — top left */}
        <div
          className="absolute z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)',
            left: '1rem',
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${role.color}55`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '1rem' }}>{role.emoji}</span>
          <span style={{ fontFamily: '"Cinzel", serif', color: role.color, fontSize: '0.78rem', fontWeight: 700 }}>
            {role.name}
          </span>
        </div>

        {/* Indice N/X badge — top right */}
        {hints.length > 0 && (
          <div
            className="absolute z-10 px-2.5 py-1 rounded-xl"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)',
              right: '1rem',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
              Indice {hintIndex + 1}/{hints.length}
            </span>
          </div>
        )}

        {/* Hint text — bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5">
          <AnimatePresence mode="wait">
            <motion.p
              key={`text-${hintIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              style={{
                color: hints.length === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                fontStyle: hints.length === 0 ? 'italic' : 'normal',
                textShadow: '0 1px 8px rgba(0,0,0,0.8)',
              }}
            >
              {hints.length === 0
                ? 'Pas d\'indices — devinez à l\'aveugle.'
                : resolveHintText(currentHint!.text, targetPlayer)}
            </motion.p>
          </AnimatePresence>

          {/* Navigation dots */}
          {hints.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {hints.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDragX(i > hintIndex ? -1 : 1); goToHint(i); }}
                  className="transition-all"
                  style={{
                    width: i === hintIndex ? 20 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === hintIndex ? '#d4a843' : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky bottom actions ── */}
      <div
        className="shrink-0 px-4 flex flex-col gap-2.5"
        style={{
          paddingTop: '0.85rem',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
          background: 'linear-gradient(to bottom, rgba(7,11,26,0) 0%, #070b1a 18%)',
        }}
      >
        <AnimatePresence mode="wait">
          {feedback ? (
            /* ── Feedback ── */
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="rounded-2xl p-4 flex flex-col items-center text-center gap-2"
              style={{
                background:
                  feedback.status === 'correct'
                    ? 'linear-gradient(135deg, rgba(107,142,90,0.22) 0%, rgba(107,142,90,0.08) 100%)'
                    : feedback.status === 'wrong'
                      ? 'linear-gradient(135deg, rgba(196,30,58,0.22) 0%, rgba(196,30,58,0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(100,116,160,0.18) 0%, rgba(100,116,160,0.06) 100%)',
                border:
                  feedback.status === 'correct'
                    ? '1px solid rgba(107,142,90,0.4)'
                    : feedback.status === 'wrong'
                      ? '1px solid rgba(196,30,58,0.35)'
                      : '1px solid rgba(140,160,220,0.2)',
              }}
            >
              <p style={{
                fontFamily: '"Cinzel", serif',
                color: feedback.status === 'correct' ? '#7ac462' : feedback.status === 'wrong' ? '#e06060' : '#8090b0',
                fontSize: '0.95rem', fontWeight: 700,
              }}>
                {feedback.status === 'correct' ? '✅ Correct !' : feedback.status === 'wrong' ? '❌ Raté !' : '⏭️ Passé.'}
              </p>
              {feedback.status === 'correct' ? (
                <p style={{ color: '#c8d2f0', fontSize: '0.72rem' }}>
                  Tu as trouvé <strong style={{ color: role.color }}>{role.article === "l'" ? "l'" : `${role.article} `}{role.name}</strong> !
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <p style={{ color: '#8090b0', fontSize: '0.72rem' }}>La bonne réponse :</p>
                  <div className="w-6 h-6 rounded-full overflow-hidden">
                    <PAvatar player={feedback.correctPlayer} size="text-sm" />
                  </div>
                  <span style={{ fontFamily: '"Cinzel", serif', color: '#d0daf5', fontSize: '0.78rem', fontWeight: 700 }}>
                    {feedback.correctPlayer.name}
                  </span>
                </div>
              )}
              <button
                onClick={handleContinue}
                className="mt-1 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-95 transition-transform"
                style={{
                  background: 'rgba(212,168,67,0.15)',
                  border: '1px solid rgba(212,168,67,0.3)',
                  color: '#d4a843',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.82rem', fontWeight: 700,
                }}
              >
                Continuer <ChevronRight size={15} />
              </button>
            </motion.div>
          ) : (
            /* ── Sélection ── */
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="flex flex-col gap-2"
            >
              {/* Trigger */}
              <button
                onClick={() => { setSheetOpen(true); setSearch(''); }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl active:scale-95 transition-all"
                style={{
                  background: 'rgba(34,38,64,0.95)',
                  border: `1px solid ${selectedPlayer ? 'rgba(212,168,67,0.35)' : 'rgba(140,160,220,0.2)'}`,
                }}
              >
                {selectedPlayer ? (
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                      <PAvatar player={selectedPlayer} size="text-sm" />
                    </div>
                    <span style={{ fontFamily: '"Cinzel", serif', color: '#d0daf5', fontSize: '0.85rem', fontWeight: 600 }}>
                      {selectedPlayer.name}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: '#6b7b9b', fontFamily: '"Cinzel", serif', fontSize: '0.82rem' }}>
                    Sélectionne un joueur…
                  </span>
                )}
                <ChevronDown size={16} style={{ color: '#6b7b9b', flexShrink: 0 }} />
              </button>

              {/* Confirm */}
              <button
                onClick={handleConfirm}
                disabled={!selectedId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl active:scale-95 transition-all"
                style={{
                  background: selectedId ? 'linear-gradient(135deg, rgba(212,168,67,0.2) 0%, rgba(212,168,67,0.08) 100%)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedId ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: selectedId ? '#d4a843' : '#3a4260',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.85rem', fontWeight: 700,
                }}
              >
                <ChevronRight size={15} />
                Confirmer
              </button>

              {/* Skip */}
              <button
                onClick={() => handleGuess(null)}
                className="flex items-center justify-center gap-2 py-2 rounded-xl active:scale-95 transition-transform"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#4a5570',
                  fontSize: '0.75rem',
                }}
              >
                <SkipForward size={13} />
                Passer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom sheet ── */}
      {createPortal(
        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[200]"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                onClick={() => setSheetOpen(false)}
              />
              <motion.div
                key="sheet"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
                className="fixed left-0 right-0 bottom-0 z-[201] flex flex-col rounded-t-3xl"
                style={{
                  background: 'linear-gradient(180deg, #1a1d3a 0%, #111328 100%)',
                  border: '1px solid rgba(140,160,220,0.12)',
                  borderBottom: 'none',
                  maxHeight: '75vh',
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
                }}
              >
                <div className="mx-auto mt-2.5 mb-1 w-10 h-1 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
                  <p style={{ fontFamily: '"Cinzel", serif', color: '#d0daf5', fontSize: '0.85rem', fontWeight: 700 }}>
                    Qui avait ce rôle ?
                  </p>
                  <button onClick={() => setSheetOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full active:scale-90 transition-transform" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <X size={15} style={{ color: '#8090b0' }} />
                  </button>
                </div>
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Search size={14} style={{ color: '#6b7b9b', flexShrink: 0 }} />
                    <input
                      type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher…" autoFocus
                      className="flex-1 bg-transparent outline-none"
                      style={{ color: '#d0daf5', fontSize: '0.82rem', fontFamily: '"Cinzel", serif' }}
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="active:scale-90 transition-transform">
                        <X size={13} style={{ color: '#6b7b9b' }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 px-4 pb-2">
                  {(() => {
                    const q = search.trim().toLowerCase();
                    const filtered = groups
                      .map(([tag, players]) => ({ tag, players: q ? players.filter((p) => p.name.toLowerCase().includes(q)) : players }))
                      .filter((g) => g.players.length > 0);
                    if (filtered.length === 0) return <p className="text-center py-6" style={{ color: '#4a5570', fontSize: '0.78rem' }}>Aucun joueur trouvé</p>;
                    return filtered.map(({ tag, players }) => (
                      <div key={tag} className="mb-5">
                        {!q && <p className="mb-2 px-1" style={{ fontFamily: '"Cinzel", serif', color: '#7a88b5', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tag}</p>}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                          {players.map((player) => {
                            const isSelected = String(player.id) === selectedId;
                            return (
                              <button
                                key={player.id}
                                onClick={() => { setSelectedId(String(player.id)); setSheetOpen(false); }}
                                className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl active:scale-95 transition-transform"
                                style={{ background: isSelected ? 'rgba(212,168,67,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSelected ? 'rgba(212,168,67,0.35)' : 'rgba(255,255,255,0.07)'}` }}
                              >
                                <div
                                  className="rounded-full overflow-hidden"
                                  style={{ width: 44, height: 44, flexShrink: 0, outline: isSelected ? '2px solid #d4a843' : 'none', outlineOffset: 2 }}
                                >
                                  <PAvatar player={player} size="text-lg" style={{ width: 44, height: 44 }} />
                                </div>
                                <span className="text-center leading-tight" style={{ fontFamily: '"Cinzel", serif', color: isSelected ? '#d4a843' : '#c8d2f0', fontSize: '0.55rem', fontWeight: isSelected ? 700 : 500, wordBreak: 'break-word', maxWidth: '100%' }}>
                                  {player.name.split(' ')[0]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

    </div>
  );
}
