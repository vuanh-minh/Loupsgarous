/**
 * VoteSection.tsx
 * Vote UI: maire election candidate cards, regular vote grid,
 * vote confirmation banner, and cancel-vote banner.
 * Extracted from GamePanel.tsx.
 */
import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Vote, X,
  Crown, Search, UserPlus,
} from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import { getRoleById } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

export interface VoteSectionHandle {
  openNominate: () => void;
}

interface VoteSectionProps {
  alivePlayers: Player[];
  allPlayers: Player[];
  currentPlayerId: number | null;
  currentPlayerAlive: boolean;
  votes: Record<number, number>;
  onVote: (voterId: number, targetId: number) => void;
  onCancelVote: (voterId: number) => void;
  isMaireElection: boolean;
  isVotePhase: boolean;
  voteCounts: Record<number, number>;
  myVote: number | undefined;
  maireVoteTarget: number | undefined;
  maireId: number | null;
  maireCandidates: number[];
  maireCampaignMessages: Record<number, string>;
  hypotheses?: Record<number, string>;
  nominations: Record<number, number>;
  t: GameThemeTokens;
  isCandidate: boolean;
  onDeclareCandidacy?: (playerId: number, message?: string) => void;
  onWithdrawCandidacy?: (playerId: number) => void;
}

export const VoteSection = React.memo(forwardRef<VoteSectionHandle, VoteSectionProps>(function VoteSection({
  alivePlayers, allPlayers, currentPlayerId, currentPlayerAlive,
  votes, onVote, onCancelVote,
  isMaireElection, isVotePhase,
  voteCounts, myVote, maireVoteTarget,
  maireId, maireCandidates, maireCampaignMessages,
  hypotheses, nominations, t,
  isCandidate, onDeclareCandidacy, onWithdrawCandidacy,
}, ref) {
  const [voteSearch, setVoteSearch] = useState('');
  const [nominateOpen, setNominateOpen] = useState(false);
  const [showVoteBanner, setShowVoteBanner] = useState(false);
  const [showCandidacyModal, setShowCandidacyModal] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [kbOffset, setKbOffset] = useState(0);

  useImperativeHandle(ref, () => ({
    openNominate: () => { setVoteSearch(''); setNominateOpen(true); },
  }));

  // Reset state when phase changes
  useEffect(() => {
    if (!isVotePhase) { setVoteSearch(''); setNominateOpen(false); setShowCandidacyModal(false); setCampaignMessage(''); }
  }, [isVotePhase]);

  // Auto-show then auto-hide vote confirmation banner
  useEffect(() => {
    if (myVote !== undefined) {
      setShowVoteBanner(true);
      const timer = setTimeout(() => setShowVoteBanner(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowVoteBanner(false);
    }
  }, [myVote]);

  // Track virtual keyboard height for candidacy modal
  useEffect(() => {
    if (!showCandidacyModal) { setKbOffset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height);
      setKbOffset(offset);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [showCandidacyModal]);

  const hasCandidates = maireCandidates.length > 0;

  // Filter players for nominate sheet (exclude self)
  const nominatePlayers = alivePlayers.filter((p) => p.id !== currentPlayerId);
  const filteredNominatePlayers = voteSearch
    ? nominatePlayers.filter((p) => p.name.toLowerCase().includes(voteSearch.toLowerCase()))
    : nominatePlayers;

  if (!isVotePhase) return null;

  return (
    <>

      {/* Section header (maire election only) */}
      {isMaireElection && (
      <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: '14px' }}>⭐️</span>
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            color: '#d4a843',
            fontSize: '0.75rem',
          }}
        >
          {hasCandidates ? 'Votez pour un candidat' : 'Qui se presente ?'}
        </span>
        {myVote !== undefined && (
          <span
            className="ml-auto px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(212,168,67,0.12)',
              border: `1px solid rgba(212,168,67,0.25)`,
              color: '#d4a843',
              fontSize: '0.55rem',
              fontFamily: '"Cinzel", serif',
            }}
          >
            Vote enregistre
          </span>
        )}
      </div>
      )}

      {/* ── Maire election: vertical candidate card list ── */}
      {isMaireElection && (
        <div className="mb-6">
          {!hasCandidates && (
            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(0,0,0,0.33)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 4px rgba(0,0,0,0.25)' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', lineHeight: 1.5 }}>Aucun candidat pour le moment. Presentez-vous ci-dessous !</p>
            </div>
          )}
          {hasCandidates && (
            <div className="flex flex-col gap-2.5">
              {maireCandidates
                .map((cId) => allPlayers.find((p) => p.id === cId))
                .filter(Boolean)
                .map((p) => {
                  const player = p!;
                  const isMyVoteTarget = myVote === player.id;
                  const voteCount = voteCounts[player.id] || 0;
                  const msg = maireCampaignMessages[player.id] || '';
                  const isSelf = player.id === currentPlayerId;
                  return (
                    <motion.button
                      key={player.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (currentPlayerId === null || !currentPlayerAlive) return;
                        if (isMyVoteTarget) return;
                        onVote(currentPlayerId, player.id);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left backdrop-blur-md"
                      style={{
                        background: isMyVoteTarget ? 'rgba(212,168,67,0.12)' : 'rgba(0, 0, 0, 0.45)',
                        border: `1.5px solid ${isMyVoteTarget ? '#d4a843' : `rgba(${t.overlayChannel}, 0.08)`}`,
                        boxShadow: isMyVoteTarget ? '0 0 16px rgba(212,168,67,0.2)' : 'none',
                      }}
                    >
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{
                          background: isMyVoteTarget ? 'rgba(212,168,67,0.2)' : `rgba(${t.overlayChannel}, 0.06)`,
                          border: `2px solid ${isMyVoteTarget ? '#d4a843' : `rgba(${t.overlayChannel}, 0.12)`}`,
                        }}>
                          <PAvatar player={player} size="text-xl" />
                        </div>
                        {isMyVoteTarget && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center" style={{ background: '#d4a843', border: `2px solid ${t.dotBorderColor}`, width: 18, height: 18 }}>
                            <Vote size={8} style={{ color: 'white' }} />
                          </motion.div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold truncate" style={{ color: isMyVoteTarget ? '#d4a843' : '#f0ead8', fontSize: '0.75rem' }}>{player.name}</span>
                          {isSelf && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.5rem', fontStyle: 'italic' }}>vous</span>}
                        </div>
                        {msg ? (
                          <p className="mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{msg}"</p>
                        ) : (
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.55rem', opacity: 0.6, marginTop: 2 }}>Pas de message de campagne</p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-center justify-center ml-1" style={{ minWidth: 32 }}>
                        <span style={{ fontFamily: '"Cinzel", serif', fontSize: voteCount > 0 ? '1.1rem' : '0.85rem', fontWeight: 700, color: voteCount > 0 ? '#d4a843' : 'rgba(255,255,255,0.4)' }}>{voteCount}</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.45rem', fontFamily: '"Cinzel", serif', marginTop: -1 }}>vote{voteCount !== 1 ? 's' : ''}</span>
                      </div>
                    </motion.button>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── Regular vote grid (non-maire) ── */}
      {!isMaireElection && (
        <div className="mb-6" style={{ marginBottom: 'clamp(8px, 2vh, 24px)' }}>
          {(() => {
            const playersWithVotes = alivePlayers
              .filter((p) => (voteCounts[p.id] || 0) > 0 || myVote === p.id)
              .sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0));
            return playersWithVotes.length > 0 ? (
              <div className="flex items-start justify-center gap-5 flex-wrap pt-2 px-1" style={{ gap: 'clamp(10px, 3vw, 20px)', paddingTop: 'clamp(4px, 1vh, 8px)' }}>
                {playersWithVotes.map((p) => {
                  const isSelf = p.id === currentPlayerId;
                  const isMyVoteTarget = myVote === p.id;
                  const voteCount = voteCounts[p.id] || 0;
                  const isMaireVoteTarget = maireVoteTarget === p.id;
                  const hypRoleId = hypotheses?.[p.id];
                  const hypRole = hypRoleId ? getRoleById(hypRoleId) : null;
                  const nominatorId = nominations[p.id];
                  const nominator = nominatorId !== undefined ? allPlayers.find((pl) => pl.id === nominatorId) : null;

                  return (
                    <motion.button
                      key={p.id}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (isSelf || currentPlayerId === null || !currentPlayerAlive) return;
                        if (isMyVoteTarget) {
                          onCancelVote(currentPlayerId);
                          return;
                        }
                        onVote(currentPlayerId, p.id);
                      }}
                      className="flex flex-col items-center gap-1"
                      style={{
                        opacity: isSelf ? 0.4 : myVote !== undefined && !isMyVoteTarget ? 0.5 : 1,
                        overflow: 'visible',
                        width: 'clamp(52px, 18vw, 70px)',
                      }}
                    >
                      {/* Avatar circle */}
                      <div
                        className="rounded-full flex items-center justify-center relative transition-all duration-200"
                        style={{
                          width: 'clamp(48px, 16vw, 70px)',
                          height: 'clamp(48px, 16vw, 70px)',
                          background: isMyVoteTarget
                            ? 'rgba(196,30,58,0.2)'
                            : 'rgba(79,79,79,0.2)',
                          border: `2.5px solid ${
                            isMyVoteTarget
                              ? 'rgba(196,30,58,0.6)'
                              : 'rgba(255,255,255,0.6)'
                          }`,
                          boxShadow: isMyVoteTarget
                            ? '0 0 24px rgba(196,30,58,0.3)'
                            : '0 0 24px rgba(0,0,0,0.3)',
                          overflow: 'visible',
                        }}
                      >
                        <PAvatar player={p} size="text-2xl" />
                        {/* Vote count badge (top-right red circle) */}
                        {voteCount > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute flex items-center justify-center z-10"
                            style={{
                              top: -1,
                              right: -4,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#c41e3a',
                              border: '2px solid rgba(255,255,255,0.2)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                              color: 'white',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}
                          >
                            {voteCount}
                          </motion.div>
                        )}
                        {/* Hypothesis badge */}
                        {hypRole && !isSelf && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10"
                            style={{
                              background: `${hypRole.color}40`,
                              border: `2px solid ${hypRole.color}80`,
                              fontSize: '0.75rem',
                              lineHeight: 1,
                            }}
                          >
                            {hypRole.emoji}
                          </motion.div>
                        )}
                        {/* Maire double-vote badge */}
                        {isMaireVoteTarget && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center z-10"
                            style={{
                              background: 'linear-gradient(135deg, #d4a843, #b8922e)',
                              borderWidth: 2,
                              borderStyle: 'solid',
                              borderColor: 'rgba(255,255,255,0.3)',
                              boxShadow: '0 0 6px rgba(212,168,67,0.4)',
                            }}
                          >
                            <Crown size={8} style={{ color: '#0a0e1a' }} />
                          </motion.div>
                        )}
                      </div>
                      {/* Name */}
                      <span
                        style={{
                          color: isMyVoteTarget ? '#ff8a95' : 'white',
                          fontSize: 'clamp(8px, 2.5vw, 9.6px)',
                          fontWeight: 700,
                          textAlign: 'center',
                          lineHeight: 1.2,
                        }}
                        className="truncate max-w-[4.5rem]"
                      >
                        {p.name}
                      </span>
                      {/* Vote count text */}
                      {voteCount > 0 && (
                        <span
                          style={{
                            fontFamily: '"Cinzel", serif',
                            fontSize: 'clamp(9px, 2.8vw, 11px)',
                            fontWeight: 700,
                            color: '#d4a843',
                            marginTop: '-2px',
                          }}
                        >
                          {voteCount} vote{voteCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {/* Nominator info */}
                      {nominator && (
                        <span
                          className="flex flex-col items-center truncate max-w-[4rem]"
                          style={{
                            fontSize: '9px',
                            lineHeight: 1.2,
                            marginTop: voteCount > 0 ? '-2px' : undefined,
                          }}
                        >
                          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Nommé par</span>
                          <span style={{ color: 'white' }} className="truncate max-w-full">{nominator.name}</span>
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-xl text-center cursor-pointer active:scale-[0.98] transition-transform"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', padding: 'clamp(8px, 2vh, 16px)' }}
                onClick={() => { setVoteSearch(''); setNominateOpen(true); }}
              >
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'clamp(0.55rem, 1.8vw, 0.65rem)', lineHeight: 1.5 }}>
                  Aucun joueur nomme pour le moment.{'\n'}Appuyez sur « Nominer » pour commencer.
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Nominate bottom sheet (portaled to body to escape transform context) ── */}
      {createPortal(
        <AnimatePresence>
          {nominateOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setNominateOpen(false)}
              />
              {/* Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] flex flex-col"
                style={{
                  background: '#E9E1CE',
                  height: '70vh',
                  maxHeight: '70vh',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(120,100,60,0.25)' }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3">
                  <h3 style={{ fontFamily: '"Cinzel", serif', color: '#3d3424', fontSize: '0.9rem', fontWeight: 600 }}>
                    Nominer un joueur
                  </h3>
                  <button
                    onClick={() => setNominateOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(120,100,60,0.1)' }}
                  >
                    <X size={16} style={{ color: '#7a6a4a' }} />
                  </button>
                </div>

                {/* Search bar */}
                <div className="px-5 pb-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#a09480' }} />
                    <input
                      type="text"
                      placeholder="Rechercher un joueur..."
                      value={voteSearch}
                      onChange={(e) => setVoteSearch(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.5)',
                        border: '1px solid rgba(120,100,60,0.15)',
                        color: '#3d3424',
                        fontSize: '0.75rem',
                      }}
                    />
                    {voteSearch && (
                      <button
                        onClick={() => setVoteSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(120,100,60,0.1)' }}
                      >
                        <X size={11} style={{ color: '#7a6a4a' }} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Player list */}
                <div className="flex-1 overflow-y-auto px-5 pb-5">
                  {filteredNominatePlayers.length === 0 ? (
                    <p style={{ color: '#a09480', fontSize: '0.7rem', textAlign: 'center', padding: '1.5rem 0' }}>
                      Aucun joueur ne correspond.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {filteredNominatePlayers.map((p) => {
                        const voteCount = voteCounts[p.id] || 0;
                        const hypRoleId = hypotheses?.[p.id];
                        const hypRole = hypRoleId ? getRoleById(hypRoleId) : null;
                        return (
                          <motion.button
                            key={p.id}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (currentPlayerId !== null && currentPlayerAlive) {
                                onVote(currentPlayerId, p.id);
                                setNominateOpen(false);
                              }
                            }}
                            className="flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all relative"
                            style={{
                              background: 'rgba(255,255,255,0.35)',
                              border: '1px solid rgba(120,100,60,0.1)',
                            }}
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                                background: 'rgba(120,100,60,0.08)',
                                border: '2px solid rgba(120,100,60,0.12)',
                              }}>
                                <PAvatar player={p} size="text-lg" />
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
                            <span className="w-full text-center line-clamp-2 break-words" style={{ color: '#3d3424', fontSize: '0.5rem', fontWeight: 500 }}>
                              {p.name}
                            </span>
                            {maireId === p.id && (
                              <span style={{ color: '#a07808', fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>Maire</span>
                            )}
                            {voteCount > 0 && (
                              <span
                                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                                style={{
                                  background: 'rgba(196,30,58,0.8)',
                                  color: '#fff',
                                  fontSize: '0.5rem',
                                  fontFamily: '"Cinzel", serif',
                                  fontWeight: 700,
                                }}
                              >
                                {voteCount}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Vote confirmation toaster (non-maire) */}
      <AnimatePresence>
        {!isMaireElection && myVote !== undefined && currentPlayerId !== null && showVoteBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-xl p-3 sticky z-10"
            style={{
              bottom: '24px',
              marginTop: '8px',
              background: 'linear-gradient(135deg, rgba(196,30,58,0.25), rgba(140,20,40,0.2))',
              border: '1px solid rgba(196,30,58,0.35)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Vote size={14} style={{ color: '#ff8a95' }} />
                <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.7rem' }}>
                  Vote enregistré contre{' '}
                  <span style={{ color: '#ff8a95', fontFamily: '"Cinzel", serif' }}>
                    {alivePlayers.find((p) => p.id === myVote)?.name}
                  </span>
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowVoteBanner(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                <X size={14} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Candidacy Modal (portalled) ── */}
      {createPortal(
        <AnimatePresence>
          {showCandidacyModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setShowCandidacyModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-full max-w-lg rounded-t-3xl p-5 pb-8"
                style={{
                  background: '#f5f0e8',
                  boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
                  bottom: kbOffset > 0 ? kbOffset : 0,
                  position: 'relative',
                  transition: 'bottom 0.25s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(160,120,8,0.25)' }} />
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4a843, #b8960a)' }}>
                    <Crown size={18} style={{ color: '#0a0e1a' }} />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: '"Cinzel", serif', color: '#3a2518', fontSize: '1rem', fontWeight: 700 }}>
                      Candidature au poste de Maire
                    </h3>
                    <p style={{ color: '#7a6a4a', fontSize: '0.65rem', marginTop: 2 }}>
                      Convainquez les villageois de voter pour vous !
                    </p>
                  </div>
                </div>

                <label style={{ fontFamily: '"Cinzel", serif', color: '#7a6a4a', fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Message de campagne <span style={{ color: '#c41e3a' }}>*</span>
                </label>
                <div className="relative mb-2">
                  <textarea
                    autoFocus
                    value={campaignMessage}
                    onChange={(e) => {
                      if (e.target.value.length <= 200) setCampaignMessage(e.target.value);
                    }}
                    placeholder="Pourquoi devriez-vous etre elu maire ?"
                    rows={3}
                    className="w-full rounded-xl px-3.5 py-3 outline-none resize-none"
                    style={{
                      background: '#fff',
                      border: `1.5px solid ${campaignMessage.trim() ? 'rgba(212,168,67,0.4)' : 'rgba(160,120,8,0.15)'}`,
                      color: '#3a2518',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  />
                  <span
                    className="absolute bottom-2 right-3"
                    style={{
                      color: campaignMessage.length >= 180 ? '#c41e3a' : '#a07808',
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                      opacity: 0.7,
                    }}
                  >
                    {campaignMessage.length}/200
                  </span>
                </div>

                <div className="flex gap-2.5 mt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCandidacyModal(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                    style={{
                      background: 'rgba(160,120,8,0.08)',
                      border: '1px solid rgba(160,120,8,0.2)',
                      color: '#a07808',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.75rem',
                    }}
                  >
                    <X size={14} />
                    Annuler
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (campaignMessage.trim() && currentPlayerId !== null) {
                        onDeclareCandidacy?.(currentPlayerId, campaignMessage.trim());
                        setShowCandidacyModal(false);
                        setCampaignMessage('');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                    style={{
                      background: campaignMessage.trim()
                        ? 'linear-gradient(135deg, #d4a843, #b8960a)'
                        : 'rgba(160,120,8,0.08)',
                      color: campaignMessage.trim() ? '#0a0e1a' : '#a0780880',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      boxShadow: campaignMessage.trim() ? '0 4px 16px rgba(212,168,67,0.3)' : 'none',
                      cursor: campaignMessage.trim() ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!campaignMessage.trim()}
                  >
                    <Crown size={14} />
                    Confirmer
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}));