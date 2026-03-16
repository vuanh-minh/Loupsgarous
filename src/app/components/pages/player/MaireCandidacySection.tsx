/**
 * MaireCandidacySection.tsx
 * Floating candidacy button + bottom-sheet candidacy modal (portalled).
 * Extracted from GamePanel.tsx.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, X } from 'lucide-react';
import type { GameThemeTokens } from '../../../context/gameTheme';

interface MaireCandidacySectionProps {
  isMaireElection: boolean;
  isVotePhase: boolean;
  currentPlayerId: number | null;
  currentPlayerAlive: boolean;
  isCandidate: boolean;
  t: GameThemeTokens;
  onDeclareCandidacy?: (playerId: number, message?: string) => void;
  onWithdrawCandidacy?: (playerId: number) => void;
}

export const MaireCandidacySection = React.memo(function MaireCandidacySection({
  isMaireElection, isVotePhase,
  currentPlayerId, currentPlayerAlive, isCandidate,
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
      // The keyboard height is the difference between the layout viewport
      // (window.innerHeight) and the visual viewport height.
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

  // Reset when leaving vote phase
  useEffect(() => {
    if (!isVotePhase) { setShowCandidacyModal(false); setCampaignMessage(''); }
  }, [isVotePhase]);

  if (!isMaireElection || currentPlayerId === null || !currentPlayerAlive) return null;

  return (
    <>
      {/* Floating candidacy button */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="sticky bottom-4 z-40 mt-auto pt-4"
        >
          {isCandidate ? (
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
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setCampaignMessage(''); setShowCandidacyModal(true); }}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #d4a843, #b8960a)',
                boxShadow: '0 6px 24px rgba(212,168,67,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                color: '#0a0e1a',
              }}
            >
              <Crown size={18} style={{ color: '#0a0e1a' }} />
              <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.85rem', fontWeight: 700 }}>
                Se porter candidat(e)
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
                      if (e.target.value.length <= 100) setCampaignMessage(e.target.value);
                    }}
                    placeholder="Why should the kingdom trust you?"
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
                      color: campaignMessage.length >= 90 ? '#c41e3a' : '#a07808',
                      fontSize: '0.55rem',
                      fontFamily: '"Cinzel", serif',
                      opacity: 0.7,
                    }}
                  >
                    {campaignMessage.length}/100
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
        </AnimatePresence>
      , document.body)}
    </>
  );
});