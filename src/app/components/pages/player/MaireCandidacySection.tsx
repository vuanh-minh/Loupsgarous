/**
 * MaireCandidacySection.tsx
 * Floating candidacy button + bottom-sheet candidacy modal (portalled).
 * Works during both:
 *   - Discovery (role revelation) phase: early candidacy before election
 *   - Mayor election vote phase: standard candidacy during election
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, X } from 'lucide-react';
import type { GameThemeTokens } from '../../../context/gameTheme';

interface MaireCandidacySectionProps {
  isMaireElection: boolean;
  isVotePhase: boolean;
  isDiscoveryPhase?: boolean;
  /** Renders a compact inline pill button instead of full-width (for use in PhaseBanner) */
  compact?: boolean;
  currentPlayerId: number | null;
  currentPlayerAlive: boolean;
  isCandidate: boolean;
  campaignMessageFromState?: string;
  t: GameThemeTokens;
  onDeclareCandidacy?: (playerId: number, message?: string) => void;
  onWithdrawCandidacy?: (playerId: number) => void;
}

const MAX_CHARS = 200;

export const MaireCandidacySection = React.memo(function MaireCandidacySection({
  isMaireElection, isVotePhase, isDiscoveryPhase = false, compact = false,
  currentPlayerId, currentPlayerAlive, isCandidate,
  campaignMessageFromState,
  t, onDeclareCandidacy, onWithdrawCandidacy,
}: MaireCandidacySectionProps) {
  const [showCandidacyModal, setShowCandidacyModal] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState('');

  // Track virtual keyboard height via visualViewport so the bottom-sheet
  // elevates above the native keyboard on mobile.
  const [kbOffset, setKbOffset] = useState(0);

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

  // Reset modal when leaving both vote phase AND discovery phase
  useEffect(() => {
    if (!isVotePhase && !isDiscoveryPhase) {
      setShowCandidacyModal(false);
      setCampaignMessage('');
    }
  }, [isVotePhase, isDiscoveryPhase]);

  // Only render during mayor election OR discovery phase
  if ((!isMaireElection && !isDiscoveryPhase) || currentPlayerId === null || !currentPlayerAlive) return null;

  return (
    <>
      {/* Floating candidacy button */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={isDiscoveryPhase ? 'mt-3' : 'sticky bottom-4 z-40 mt-auto pt-4'}
        >
          {isCandidate ? (
            isDiscoveryPhase ? (
              /* ── Discovery confirmed state: show confirmation card ── */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-xl p-4 text-center"
                style={{
                  background: 'rgba(212,168,67,0.08)',
                  border: '1.5px solid rgba(212,168,67,0.3)',
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Crown size={16} style={{ color: '#d4a843' }} />
                  <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.75rem', fontWeight: 700, color: '#d4a843' }}>
                    Vous etes candidat au poste de maire
                  </span>
                </div>
                {campaignMessageFromState && (
                  <p style={{
                    color: t.textMuted,
                    fontSize: '0.6rem',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    marginTop: 4,
                  }}>
                    « {campaignMessageFromState} »
                  </p>
                )}
              </motion.div>
            ) : (
              /* ── Election confirmed state: with withdraw option ── */
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => onWithdrawCandidacy?.(currentPlayerId)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl transition-all"
                style={{
                  background: 'transparent',
                  border: '1.5px solid rgba(212,168,67,0.5)',
                  color: '#d4a843',
                }}
              >
                <Crown size={18} style={{ color: '#d4a843' }} />
                <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.85rem', fontWeight: 700 }}>
                  Vous etes candidat(e)
                </span>
                <span style={{ color: 'rgba(212,168,67,0.5)', fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>
                  · Retirer
                </span>
              </motion.button>
            )
          ) : (
            /* ── Not a candidate: show declare button ── */
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setCampaignMessage(''); setShowCandidacyModal(true); }}
              className={`${compact ? 'mx-auto px-4 py-1.5 rounded-xl' : 'w-full py-3.5 rounded-2xl'} flex items-center justify-center gap-1.5 transition-all`}
              style={{
                background: 'linear-gradient(135deg, #d4a843, #b8960a)',
                boxShadow: compact ? '0 2px 8px rgba(212,168,67,0.3)' : '0 6px 24px rgba(212,168,67,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                color: '#0a0e1a',
              }}
            >
              <Crown size={compact ? 13 : 18} style={{ color: '#0a0e1a' }} />
              <span style={{ fontFamily: '"Cinzel", serif', fontSize: compact ? '0.7rem' : '0.85rem', fontWeight: 700 }}>
                {isDiscoveryPhase ? 'Candidater au poste de maire' : 'Se porter candidat(e)'}
              </span>
            </motion.button>
          )}
        </motion.div>
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
                      if (e.target.value.length <= MAX_CHARS) setCampaignMessage(e.target.value);
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
                      color: campaignMessage.length >= (MAX_CHARS - 20) ? '#c41e3a' : '#a07808',
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                      opacity: 0.7,
                    }}
                  >
                    {campaignMessage.length}/{MAX_CHARS}
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
                    Candidater
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      , document.body)}
    </>
  );
});
