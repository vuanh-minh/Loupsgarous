/**
 * LastWillSection.tsx
 * "Derniere volonte" feature for dead players.
 * - Day/vote phase: shows voted players (hides 0-vote), sticky button to cast a one-time vote.
 * - Night phase: "Enqueter" button + sticky button to pre-cast a vote for the next day.
 * One-time use only.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Vote, Search, X, CircleCheck, Scroll, Users,
} from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { getRoleById } from '../../../data/roles';
import { PAvatar } from './PAvatar';
import { toast } from 'sonner';

interface LastWillSectionProps {
  phase: 'night' | 'day';
  dayStep: string;
  alivePlayers: Player[];
  currentPlayerId: number;
  votes: Record<number, number>;
  maireId: number | null;
  hypotheses: Record<number, string>;
  lastWillUsed: boolean;
  allLastWillUsed?: Record<number, boolean>;
  onLastWillVote: (targetId: number) => void;
  onNavigateToVillage: () => void;
  t: GameThemeTokens;
}

export function LastWillSection({
  phase, dayStep, alivePlayers, currentPlayerId,
  votes, maireId, hypotheses,
  lastWillUsed, allLastWillUsed = {}, onLastWillVote, onNavigateToVillage, t,
}: LastWillSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);

  const isNight = phase === 'night';
  const isVotePhase = !isNight && dayStep === 'vote';

  // Vote counts for display during day vote phase
  // Dernière volonté (dead players who used last will) included in tally
  const aliveIdSet = new Set(alivePlayers.map((p) => p.id));
  const voteCounts: Record<number, number> = {};
  if (isVotePhase) {
    Object.entries(votes).forEach(([voterId, targetId]) => {
      const vid = parseInt(voterId);
      if (!aliveIdSet.has(vid) && !allLastWillUsed[vid]) return; // skip dead players without dernière volonté
      const weight = (maireId !== null && vid === maireId) ? 2 : 1;
      voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
    });
  }

  // Players sorted by votes (for day phase display)
  const votedPlayers = isVotePhase
    ? alivePlayers
        .filter((p) => (voteCounts[p.id] || 0) > 0)
        .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
    : [];

  // Modal targets (exclude self — though dead player shouldn't be in alive list)
  const targets = alivePlayers.filter((p) => p.id !== currentPlayerId);
  const filteredTargets = search.trim()
    ? targets.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : targets;

  const selectedPlayer = pendingTarget !== null
    ? alivePlayers.find((p) => p.id === pendingTarget) ?? null
    : null;

  return (
    <div className="flex flex-col min-h-full px-4 py-4 pb-6">
      {/* Death banner */}
      <div className="flex flex-col items-center justify-center text-center mb-5">
        <span className="text-2xl block mb-2" style={{ filter: 'grayscale(1)' }}>💀</span>
        <h2
          style={{
            fontFamily: '"Cinzel", serif',
            color: '#999999',
            fontSize: '1.1rem',
            marginTop: '0.25rem',
          }}
        >
          Vous avez ete elimine
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Il vous reste une derniere volonte.{'\n'}Vous pouvez continuer a enqueter.
        </p>

        {/* Night: "Enqueter" tertiary button */}
        {isNight && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNavigateToVillage}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{
              background: `rgba(${t.overlayChannel}, 0.06)`,
              border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
              color: t.textMuted,
              fontSize: '0.65rem',
              fontFamily: '"Cinzel", serif',
              fontWeight: 600,
            }}
          >
            <Users size={13} />
            Enqueter
          </motion.button>
        )}
      </div>

      {/* Day vote phase: show voted players */}
      {isVotePhase && votedPlayers.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Vote size={13} style={{ color: '#c41e3a' }} />
            <span style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.7rem' }}>
              Votes en cours
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {votedPlayers.map((p) => {
              const voteCount = voteCounts[p.id] || 0;
              const hypRoleId = hypotheses[p.id];
              const hypRole = hypRoleId ? getRoleById(hypRoleId) : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                  }}
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        background: `rgba(${t.overlayChannel}, 0.06)`,
                        border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                      }}
                    >
                      <PAvatar player={p} size="text-base" />
                    </div>
                    {hypRole && (
                      <div
                        className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{
                          background: `${hypRole.color}40`,
                          border: `1.5px solid ${hypRole.color}80`,
                          fontSize: '0.6rem',
                          lineHeight: 1,
                        }}
                      >
                        {hypRole.emoji}
                      </div>
                    )}
                  </div>
                  <span
                    className="flex-1 truncate"
                    style={{ color: t.text, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}
                  >
                    {p.name}
                  </span>
                  <div className="flex flex-col items-center shrink-0" style={{ minWidth: 28 }}>
                    <span style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#c41e3a',
                    }}>
                      {voteCount}
                    </span>
                    <span style={{ color: t.textMuted, fontSize: '0.4rem', fontFamily: '"Cinzel", serif' }}>
                      vote{voteCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Spacer to push sticky button to bottom (night) or center it (day) */}
      <div className="flex-1" />

      {/* Last will used confirmation */}
      {lastWillUsed && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-3.5 text-center mb-4"
          style={{
            background: 'rgba(107,142,90,0.08)',
            border: '1px solid rgba(107,142,90,0.2)',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <CircleCheck size={13} style={{ color: '#6b8e5a' }} />
            <span style={{ color: '#6b8e5a', fontSize: '0.65rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>
              Derniere volonte utilisee
            </span>
          </div>
          <p style={{ color: t.textMuted, fontSize: '0.5rem', lineHeight: 1.4 }}>
            Votre vote posthume contre {alivePlayers.find((p) => p.id === votes[currentPlayerId])?.name ?? 'ce joueur'} a ete enregistre.
          </p>
        </motion.div>
      )}

      {/* Sticky "Derniere volonte" button */}
      {!lastWillUsed && (
        <div className="flex justify-center z-30">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              setSearch('');
              setPendingTarget(null);
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2.5 py-3.5 px-8 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.12))',
              border: '1.5px solid rgba(139,92,246,0.35)',
              color: '#c4b5fd',
              fontSize: '0.75rem',
              fontFamily: '"Cinzel", serif',
              fontWeight: 700,
              letterSpacing: '0.04em',
              boxShadow: '0 4px 20px rgba(139,92,246,0.2), 0 0 40px rgba(139,92,246,0.08)',
            }}
          >
            <Scroll size={16} />
            Derniere volonte
          </motion.button>
        </div>
      )}

      {/* Bottom spacer for centering */}
      {!lastWillUsed && <div className="flex-1" />}

      {/* Modal (portalled) */}
      {createPortal(
        <AnimatePresence>
          {showModal && (
            <motion.div
              key="last-will-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-end justify-center"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowModal(false)}
            >
              <motion.div
                key="last-will-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
                style={{
                  background: 'linear-gradient(180deg, #12111f 0%, #0a0e1a 100%)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderBottomWidth: 0,
                  maxHeight: '85vh',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                </div>

                {/* Header */}
                <div className="px-5 pt-2 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scroll size={16} style={{ color: '#a78bfa' }} />
                    <h3 style={{ fontFamily: '"Cinzel", serif', color: '#c4b5fd', fontSize: '0.95rem', fontWeight: 700 }}>
                      Derniere volonte
                    </h3>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowModal(false)}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: `rgba(${t.overlayChannel}, 0.08)` }}
                  >
                    <X size={14} style={{ color: t.textMuted }} />
                  </motion.button>
                </div>

                {/* Description */}
                <div className="px-5 pb-3">
                  <p style={{ color: 'rgba(196,181,253,0.6)', fontSize: '0.55rem', lineHeight: 1.5 }}>
                    {isNight
                      ? 'Choisissez un joueur. Votre vote sera automatiquement ajoute au prochain vote de jour. Cette action est irreversible et ne peut etre utilisee qu\'une seule fois.'
                      : 'Choisissez un joueur a accuser. Votre vote sera immediatement ajoute. Cette action est irreversible et ne peut etre utilisee qu\'une seule fois.'}
                  </p>
                </div>

                {/* Selected preview */}
                {selectedPlayer && (
                  <div className="px-5 pb-3">
                    <motion.div
                      key={selectedPlayer.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.2)',
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '2px solid rgba(139,92,246,0.3)' }}
                      >
                        <PAvatar player={selectedPlayer} size="text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: t.text, fontSize: '0.65rem', fontWeight: 600 }}>
                          {selectedPlayer.name}
                        </p>
                        <p style={{ color: '#a78bfa', fontSize: '0.5rem', fontStyle: 'italic' }}>
                          cible selectionnee
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setPendingTarget(null)}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: `rgba(${t.overlayChannel}, 0.08)` }}
                      >
                        <X size={11} style={{ color: t.textMuted }} />
                      </motion.button>
                    </motion.div>
                  </div>
                )}

                {/* Search */}
                <div className="px-5 pb-3">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: `rgba(${t.overlayChannel}, 0.05)`,
                      border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                    }}
                  >
                    <Search size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Rechercher un joueur..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoFocus
                      className="flex-1 bg-transparent outline-none"
                      style={{
                        color: t.text,
                        fontSize: '0.7rem',
                        fontFamily: '"Cinzel", serif',
                      }}
                    />
                    {search && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSearch('')}
                        style={{ color: t.textMuted }}
                      >
                        <X size={12} />
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Player list */}
                <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-6">
                  <div className="grid grid-cols-4 gap-2">
                    {filteredTargets.length === 0 ? (
                      <div className="col-span-4 py-8 text-center">
                        <p style={{ color: t.textMuted, fontSize: '0.65rem' }}>Aucun joueur trouve</p>
                      </div>
                    ) : (
                      filteredTargets.map((p) => {
                        const isPending = pendingTarget === p.id;
                        return (
                          <motion.button
                            key={p.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setPendingTarget(isPending ? null : p.id)}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl w-full text-center transition-all"
                            style={{
                              background: isPending
                                ? 'rgba(139,92,246,0.1)'
                                : `rgba(${t.overlayChannel}, 0.03)`,
                              border: isPending
                                ? '1px solid rgba(139,92,246,0.3)'
                                : `1px solid rgba(${t.overlayChannel}, 0.06)`,
                            }}
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                              style={{
                                background: isPending
                                  ? 'rgba(139,92,246,0.15)'
                                  : `rgba(${t.overlayChannel}, 0.06)`,
                                border: isPending
                                  ? '2px solid rgba(139,92,246,0.4)'
                                  : `1px solid rgba(${t.overlayChannel}, 0.1)`,
                              }}
                            >
                              <PAvatar player={p} size="text-base" />
                            </div>
                            <span
                              className="line-clamp-2 break-words"
                              style={{
                                color: isPending ? '#c4b5fd' : t.text,
                                fontSize: '0.55rem',
                                fontWeight: isPending ? 700 : 500,
                                fontFamily: '"Cinzel", serif',
                                lineHeight: 1.2,
                              }}
                            >
                              {p.name}
                            </span>
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Confirm footer */}
                <div
                  className="px-5 py-4 flex gap-3"
                  style={{
                    borderTop: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                    background: 'linear-gradient(180deg, rgba(18,17,31,0.95) 0%, #0a0e1a 100%)',
                  }}
                >
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                    style={{
                      background: `rgba(${t.overlayChannel}, 0.06)`,
                      border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                      color: t.textMuted,
                      fontSize: '0.65rem',
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 600,
                    }}
                  >
                    <X size={13} />
                    Annuler
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (pendingTarget !== null) {
                        const targetName = alivePlayers.find((p) => p.id === pendingTarget)?.name ?? 'ce joueur';
                        onLastWillVote(pendingTarget);
                        setShowModal(false);
                        setPendingTarget(null);
                        if (isNight) {
                          toast.success(`Derniere volonte enregistree contre ${targetName}. Votre vote sera applique au prochain jour.`);
                        } else {
                          toast.success(`Derniere volonte : vote enregistre contre ${targetName}.`);
                        }
                      }
                    }}
                    disabled={pendingTarget === null}
                    className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                    style={{
                      background: pendingTarget !== null
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(168,85,247,0.15))'
                        : `rgba(${t.overlayChannel}, 0.04)`,
                      border: pendingTarget !== null
                        ? '1px solid rgba(139,92,246,0.4)'
                        : `1px solid rgba(${t.overlayChannel}, 0.08)`,
                      color: pendingTarget !== null ? '#c4b5fd' : `rgba(${t.overlayChannel}, 0.25)`,
                      fontSize: '0.65rem',
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 700,
                      cursor: pendingTarget !== null ? 'pointer' : 'default',
                    }}
                  >
                    <Scroll size={13} />
                    {isNight ? 'Voter au prochain vote' : 'Confirmer'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}