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
import { Crown, X, SendHorizonal } from 'lucide-react';
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
  const [isInputFocused, setIsInputFocused] = useState(false);

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
          {showCandidacyModal && (() => {
            // Theme tokens — dark for discovery phase, light for election
            const dk = isDiscoveryPhase;
            const sh = {
              bg:           dk ? '#0d0b09'                          : '#f5f0e8',
              shadow:       dk ? '0 -8px 40px rgba(0,0,0,0.7)'     : '0 -8px 40px rgba(0,0,0,0.3)',
              handle:       dk ? 'rgba(212,168,67,0.25)'            : 'rgba(160,120,8,0.25)',
              heading:      dk ? '#e8c560'                           : '#3a2518',
              subtitle:     dk ? 'rgba(212,168,67,0.55)'            : '#7a6a4a',
              label:        dk ? 'rgba(212,168,67,0.7)'             : '#7a6a4a',
              inputBg:      dk ? 'rgba(255,255,255,0.06)'           : '#fff',
              inputBorder:  campaignMessage.trim()
                              ? (dk ? 'rgba(212,168,67,0.5)' : 'rgba(212,168,67,0.4)')
                              : (dk ? 'rgba(212,168,67,0.18)' : 'rgba(160,120,8,0.15)'),
              inputText:    dk ? 'rgba(255,255,255,0.88)'           : '#3a2518',
              charColor:    campaignMessage.length >= MAX_CHARS - 20 ? '#e05555' : (dk ? 'rgba(212,168,67,0.65)' : '#a07808'),
              cancelBg:     dk ? 'rgba(255,255,255,0.07)'           : 'rgba(160,120,8,0.08)',
              cancelBorder: dk ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(160,120,8,0.2)',
              cancelColor:  dk ? 'rgba(255,255,255,0.55)'           : '#a07808',
            };
            return (
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
                  background: sh.bg,
                  boxShadow: sh.shadow,
                  bottom: kbOffset > 0 ? kbOffset : 0,
                  position: 'relative',
                  transition: 'bottom 0.25s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: sh.handle }} />

                {/* Header — hidden when input is focused */}
                <AnimatePresence initial={false}>
                  {!isInputFocused && (
                    <motion.div
                      key="header"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4a843, #b8960a)' }}>
                          <Crown size={18} style={{ color: '#0a0e1a' }} />
                        </div>
                        <div>
                          <h3 style={{ fontFamily: '"Cinzel", serif', color: sh.heading, fontSize: '1rem', fontWeight: 700 }}>
                            Candidature au poste de Maire
                          </h3>
                          <p style={{ color: sh.subtitle, fontSize: '0.65rem', marginTop: 2 }}>
                            Convainquez les villageois de voter pour vous !
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <label style={{ fontFamily: '"Cinzel", serif', color: sh.label, fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Message de campagne <span style={{ color: '#c41e3a' }}>*</span>
                </label>
                <div className="relative mb-2">
                  <textarea
                    autoFocus
                    value={campaignMessage}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHARS) setCampaignMessage(e.target.value);
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder="Pourquoi devriez-vous etre elu maire ?"
                    rows={3}
                    className="w-full rounded-xl px-3.5 py-3 outline-none resize-none"
                    style={{
                      background: sh.inputBg,
                      border: `1.5px solid ${sh.inputBorder}`,
                      color: sh.inputText,
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      boxShadow: dk ? 'inset 0 1px 3px rgba(0,0,0,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.06)',
                      paddingBottom: isInputFocused ? '2.4rem' : '1.75rem',
                    }}
                  />
                  {/* Char count — bottom left when focused, bottom right otherwise */}
                  <span
                    className="absolute bottom-2"
                    style={{
                      left: isInputFocused ? 12 : undefined,
                      right: isInputFocused ? undefined : 12,
                      color: sh.charColor,
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                      opacity: 0.7,
                      transition: 'left 0.15s, right 0.15s',
                    }}
                  >
                    {campaignMessage.length}/{MAX_CHARS}
                  </span>
                  {/* Send button — appears inside textarea when focused */}
                  <AnimatePresence>
                    {isInputFocused && (
                      <motion.button
                        key="send-btn"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.15 }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (campaignMessage.trim() && currentPlayerId !== null) {
                            onDeclareCandidacy?.(currentPlayerId, campaignMessage.trim());
                            setShowCandidacyModal(false);
                            setCampaignMessage('');
                          }
                        }}
                        className="absolute bottom-1.5 right-1.5 w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{
                          background: campaignMessage.trim()
                            ? 'linear-gradient(135deg, #d4a843, #b8960a)'
                            : (dk ? 'rgba(212,168,67,0.1)' : 'rgba(160,120,8,0.12)'),
                          color: campaignMessage.trim() ? '#0a0e1a' : (dk ? 'rgba(212,168,67,0.3)' : 'rgba(160,120,8,0.4)'),
                          boxShadow: campaignMessage.trim() ? '0 2px 8px rgba(212,168,67,0.4)' : 'none',
                          cursor: campaignMessage.trim() ? 'pointer' : 'not-allowed',
                          transition: 'background 0.15s, box-shadow 0.15s',
                        }}
                        disabled={!campaignMessage.trim()}
                      >
                        <SendHorizonal size={15} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Bottom buttons — hidden when input is focused */}
                <AnimatePresence initial={false}>
                  {!isInputFocused && (
                    <motion.div
                      key="buttons"
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}
                      className="flex gap-2.5"
                    >
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowCandidacyModal(false)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                        style={{
                          background: sh.cancelBg,
                          border: sh.cancelBorder,
                          color: sh.cancelColor,
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
                            : (dk ? 'rgba(212,168,67,0.08)' : 'rgba(160,120,8,0.08)'),
                          color: campaignMessage.trim() ? '#0a0e1a' : (dk ? 'rgba(212,168,67,0.3)' : '#a0780880'),
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      , document.body)}
    </>
  );
});
