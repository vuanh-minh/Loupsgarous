import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, Users, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Player } from '../../../context/GameContext';
import type { RoleDefinition } from '../../../data/roles';
import { getRoleById } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface RoleRevealScreenProps {
  currentPlayer: Player;
  currentRole: RoleDefinition | null;
  revealAnimStep: 'idle' | 'flipping' | 'done';
  onReveal: () => void;
  onContinue: () => void;
  particlePositions: { left: number; top: number; duration: number; delay: number }[];
  t: GameThemeTokens;
  isVillageois: boolean;
  gmBackButton: React.ReactNode;
  allPlayers?: Player[];
  /** Override the "Continuer" button label (e.g. "Rejoindre le village") */
  continueLabel?: string;
  /** Override the helper text below the continue button */
  continueHint?: string;
}

export function RoleRevealScreen({
  currentPlayer,
  currentRole,
  revealAnimStep,
  onReveal,
  onContinue,
  particlePositions,
  t,
  isVillageois,
  gmBackButton,
  allPlayers = [],
  continueLabel,
  continueHint,
}: RoleRevealScreenProps) {
  const teamColor = currentRole?.team === 'werewolf' ? '#c41e3a' : currentRole?.team === 'village' ? '#6b8e5a' : t.gold;
  const teamLabel = currentRole?.team === 'werewolf' ? 'Loups-Garous' : currentRole?.team === 'village' ? 'Village' : 'Solitaire';

  const isWerewolfTeam = currentRole?.team === 'werewolf';
  const [showPackModal, setShowPackModal] = React.useState(false);

  // Fellow wolves (excluding self)
  const fellowWolves = React.useMemo(() => {
    if (!isWerewolfTeam) return [];
    return allPlayers.filter((p) => {
      if (p.id === currentPlayer.id) return false;
      const role = getRoleById(p.role);
      return role?.team === 'werewolf';
    });
  }, [allPlayers, currentPlayer.id, isWerewolfTeam]);

  // ── 5-second auto-continue timer ──
  const AUTO_CONTINUE_SECONDS = 5;
  const [countdown, setCountdown] = useState(AUTO_CONTINUE_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFiredRef = useRef(false);

  // Stable ref for onContinue to avoid effect re-runs when parent re-renders
  const onContinueRef = useRef(onContinue);
  useEffect(() => { onContinueRef.current = onContinue; }, [onContinue]);

  useEffect(() => {
    if (revealAnimStep !== 'done') {
      // Reset when not done
      setCountdown(AUTO_CONTINUE_SECONDS);
      hasFiredRef.current = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    if (hasFiredRef.current) return; // Already fired, don't restart
    // No auto-continue for werewolves (they need to see the pack)
    if (isWerewolfTeam) return;
    // Start 1-second interval countdown
    const startTime = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = AUTO_CONTINUE_SECONDS - elapsed;
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setCountdown(0);
        if (!hasFiredRef.current) {
          hasFiredRef.current = true;
          setShowPackModal(false);
          onContinueRef.current();
        }
      } else {
        setCountdown(remaining);
      }
    }, 250);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [revealAnimStep]);

  // Progress fraction for the circular countdown (1 = full, 0 = empty)
  const progressFraction = countdown / AUTO_CONTINUE_SECONDS;

  return (
    <div
      className="min-h-dvh max-w-md mx-auto flex flex-col items-center overflow-y-auto relative"
      style={{
        background: 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        paddingTop: 'max(calc(env(safe-area-inset-top, 20px) + 10px), 20px)',
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 20px) + 10px), 20px)',
      }}
    >
      {gmBackButton}
      {/* Spacer top — push content to center */}
      <div className="flex-1" />
      {/* Floating particles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particlePositions.map((pp, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: `${t.gold}4d`,
              left: `${pp.left}%`,
              top: `${pp.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: pp.duration,
              repeat: Infinity,
              delay: pp.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* The card (flip container) */}
      <div style={{ perspective: '1200px', width: '280px', height: '380px' }} className="relative mb-8 shrink-0">
        <motion.div
          className="w-full h-full relative"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{
            rotateY: revealAnimStep === 'idle' ? 0 : 180,
          }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Front of card — mystery (tappable to reveal) */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden cursor-pointer"
            style={{
              backfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, #1a1540 0%, #0d1025 50%, #15102a 100%)',
              border: `2px solid ${t.goldBorder}`,
              boxShadow: `0 0 40px ${t.gold}1a, inset 0 0 60px rgba(15,10,40,0.5)`,
            }}
            onClick={() => {
              if (revealAnimStep === 'idle') onReveal();
            }}
          >
            {/* Decorative border pattern */}
            <div
              className="absolute inset-3 rounded-xl pointer-events-none"
              style={{ border: `1px solid ${t.headerBorder}` }}
            />
            <motion.div
              className="w-24 h-24 rounded-full mb-6 overflow-hidden flex items-center justify-center"
              animate={{ rotateY: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                border: `2px solid ${t.goldBorder}`,
                boxShadow: `0 0 20px ${t.gold}33`,
              }}
            >
              <PAvatar
                player={currentPlayer}
                size="text-5xl"
              />
            </motion.div>
            <h2
              style={{
                fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                color: t.gold,
                fontSize: '1rem',
                textAlign: 'center',
                marginBottom: '0.5rem',
              }}
            >
              {currentPlayer.name}, ton destin t'attend
            </h2>
            <p style={{ color: t.textMuted, fontSize: '0.7rem', textAlign: 'center', padding: '0 2rem' }}>
              Appuyez pour decouvrir votre role dans cette partie
            </p>

            {/* Pulsing glow at bottom */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-1"
              style={{ background: `linear-gradient(90deg, transparent, ${t.gold}, transparent)` }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          {/* Back of card — role reveal */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: `linear-gradient(135deg, ${currentRole?.color || t.gold}15 0%, #0d1025 50%, ${currentRole?.color || t.gold}10 100%)`,
              border: `2px solid ${currentRole?.color || t.gold}50`,
              boxShadow: `0 0 40px ${currentRole?.color || t.gold}20, inset 0 0 60px rgba(15,10,40,0.5)`,
            }}
          >
            {/* Decorative border */}
            <div
              className="absolute inset-3 rounded-xl pointer-events-none"
              style={{ border: `1px solid ${currentRole?.color || t.gold}20` }}
            />

            {revealAnimStep === 'done' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200 }}
                className="flex flex-col items-center gap-3 px-6"
              >
                {/* Team badge */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="px-3 py-1 rounded-full"
                  style={{
                    background: `${teamColor}15`,
                    border: `1px solid ${teamColor}40`,
                  }}
                >
                  <span style={{ color: teamColor, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {teamLabel}
                  </span>
                </motion.div>

                {/* Role emoji */}
                <motion.span
                  className="text-7xl block"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
                >
                  {currentRole?.emoji || '❓'}
                </motion.span>

                {/* Role name */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                    color: currentRole?.color || t.gold,
                    fontSize: '1.3rem',
                    textAlign: 'center',
                  }}
                >
                  {currentRole?.name || 'Inconnu'}
                </motion.h2>

                {/* Role description */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  style={{
                    color: t.textSecondary,
                    fontSize: '0.65rem',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}
                >
                  {currentRole?.description || ''}
                </motion.p>

                {/* Power */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="w-full rounded-lg px-3 py-2 mt-1"
                  style={{
                    background: `${currentRole?.color || t.gold}08`,
                    border: `1px solid ${currentRole?.color || t.gold}15`,
                  }}
                >
                  <p style={{ color: t.textMuted, fontSize: '0.55rem', textAlign: 'center', lineHeight: 1.5 }}>
                    {currentRole?.power || ''}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Action button */}
      <AnimatePresence mode="wait">
        {revealAnimStep === 'idle' && (
          <motion.button
            key="reveal-btn"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReveal}
            className="flex items-center justify-center gap-3 py-4 px-10 rounded-xl shrink-0 relative z-10"
            style={{
              background: `linear-gradient(135deg, ${t.gold}, #b8860b)`,
              color: '#0a0e1a',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.95rem',
              fontWeight: 600,
              boxShadow: `0 4px 20px ${t.gold}4d`,
            }}
          >
            <Eye size={18} />
            Decouvrir mon role
          </motion.button>
        )}

        {revealAnimStep === 'done' && (
          <motion.div
            key="continue"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-2 flex flex-col items-center gap-3 shrink-0 relative z-10"
          >
            {/* Countdown indicator */}
            {!isWerewolfTeam && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 mb-1"
            >
              <div className="relative" style={{ width: 28, height: 28 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <circle
                    cx="14" cy="14" r="12"
                    fill="none"
                    stroke={currentRole?.color || t.gold}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 12}
                    strokeDashoffset={2 * Math.PI * 12 * (1 - progressFraction)}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                    opacity={0.7}
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: countdown <= 3 ? '#c41e3a' : (currentRole?.color || t.gold),
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  {countdown}
                </span>
              </div>
              <span style={{
                color: t.textDim,
                fontSize: '0.5rem',
                fontFamily: '"Cinzel", serif',
              }}>
                Suite automatique
              </span>
            </motion.div>
            )}

            {isWerewolfTeam && fellowWolves.length > 0 ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowPackModal(true)}
                  className="flex items-center justify-center gap-3 py-3.5 px-8 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(196,30,58,0.25), rgba(196,30,58,0.10))',
                    border: '1px solid rgba(196,30,58,0.45)',
                    color: '#e85a75',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <Users size={16} />
                  Voir la meute
                </motion.button>
                <p style={{ color: t.textDim, fontSize: '0.55rem' }}>
                  Decouvrez vos allies de la nuit
                </p>
              </>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onContinue}
                  className="flex items-center justify-center gap-3 py-3.5 px-8 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${t.gold}26, rgba(184,134,11,0.10))`,
                    border: `1px solid ${t.gold}59`,
                    color: t.gold,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {continueLabel || 'Continuer'}
                </motion.button>
                <p className="text-center mt-2" style={{ color: t.textDim, fontSize: '0.5rem' }}>
                  {continueHint || (!isVillageois ? 'Entrainez-vous avant la nuit' : 'Explorez l\'interface en attendant')}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wolf Pack Modal */}
      {createPortal(
        <AnimatePresence>
          {showPackModal && (
            <motion.div
              key="pack-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowPackModal(false)}
            >
              <motion.div
                key="pack-modal-content"
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-[90%] max-w-sm rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(180deg, #1a0a12 0%, #0d0815 50%, #0a0e1a 100%)',
                  border: '1px solid rgba(196,30,58,0.3)',
                  boxShadow: '0 0 60px rgba(196,30,58,0.15), 0 20px 40px rgba(0,0,0,0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setShowPackModal(false)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <X size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
                </button>

                {/* Header */}
                <div className="px-6 pt-6 pb-4 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    className="text-4xl mb-3"
                  >
                    🐺
                  </motion.div>
                  <h3 style={{
                    fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                    color: '#e85a75',
                    fontSize: '1.1rem',
                    marginBottom: '0.4rem',
                  }}>
                    Votre meute
                  </h3>
                  <p style={{ color: 'rgba(232,90,117,0.6)', fontSize: '0.6rem', lineHeight: 1.5 }}>
                    {fellowWolves.length === 1
                      ? 'Voici votre complice pour les nuits a venir'
                      : `Voici vos ${fellowWolves.length} complices pour les nuits a venir`}
                  </p>
                </div>

                {/* Decorative separator */}
                <div className="px-6">
                  <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(196,30,58,0.3), transparent)',
                  }} />
                </div>

                {/* Wolf list */}
                <div className="px-6 py-4 grid grid-cols-2 gap-2.5 overflow-y-auto" style={{ maxHeight: '40dvh' }}>
                  {fellowWolves.map((wolf, i) => {
                    const wolfRole = getRoleById(wolf.role);
                    return (
                      <motion.div
                        key={wolf.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 200 }}
                        className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl"
                        style={{
                          background: 'rgba(196,30,58,0.08)',
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: 'rgba(196,30,58,0.12)',
                          }}
                        >
                          <PAvatar player={wolf} size="text-xl" />
                        </div>
                        <div className="text-center min-w-0 w-full">
                          <p className="truncate" style={{
                            color: '#f0d0d8',
                            fontSize: '0.75rem',
                            fontFamily: '"Cinzel", serif',
                            fontWeight: 600,
                          }}>
                            {wolf.name}
                          </p>
                          {wolfRole && wolfRole.id !== 'loup-garou' ? (
                            <p style={{
                              color: wolfRole.color,
                              fontSize: '0.55rem',
                              marginTop: '0.15rem',
                            }}>
                              {wolfRole.emoji} {wolfRole.name}
                            </p>
                          ) : (
                            <p style={{
                              color: 'rgba(196,30,58,0.5)',
                              fontSize: '0.55rem',
                              marginTop: '0.15rem',
                            }}>
                              🐺
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* You row */}
                <div className="px-6 pb-2">
                  <div
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                    style={{
                      background: 'rgba(196,30,58,0.04)',
                      border: '1px dashed rgba(196,30,58,0.15)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(196,30,58,0.1)',
                        border: '2px solid rgba(196,30,58,0.25)',
                      }}
                    >
                      <PAvatar player={currentPlayer} size="text-base" />
                    </div>
                    <p style={{
                      color: 'rgba(232,90,117,0.6)',
                      fontSize: '0.65rem',
                      fontFamily: '"Cinzel", serif',
                      fontStyle: 'italic',
                    }}>
                      {currentPlayer.name} (vous)
                    </p>
                  </div>
                </div>

                {/* Decorative separator */}
                <div className="px-6 pt-1">
                  <div style={{
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(196,30,58,0.2), transparent)',
                  }} />
                </div>

                {/* Continue button */}
                <div className="px-6 py-5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setShowPackModal(false);
                      onContinue();
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${t.gold}26, rgba(184,134,11,0.10))`,
                      border: `1px solid ${t.gold}59`,
                      color: t.gold,
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    {continueLabel || 'Continuer'}
                  </motion.button>
                  <p className="text-center mt-2" style={{ color: t.textDim, fontSize: '0.5rem' }}>
                    Entrainez-vous avant la nuit
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Spacer bottom — push content to center */}
      <div className="flex-1" />
    </div>
  );
}