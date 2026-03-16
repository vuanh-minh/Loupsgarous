/**
 * MaireElectionSuccessScreen.tsx
 *
 * Full-screen portal overlay celebrating the elected Mayor.
 * Festive background with floating golden particles + central card.
 *
 * Cinematic exit transition on "Continuer":
 *   1. Card flips (rotateY) revealing a night-themed back face with "Le village dort..."
 *   2. Background crossfades from election day image → night image
 *   3. Golden particles desaturate & fade, environment darkens
 *   4. Final fade-out → onDismiss fires
 *
 * NOTE: Because PlayerPage sets html.style.fontSize = 20px, and this component
 * renders via createPortal to document.body, all sizes use px (not rem).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Star, Sparkles } from 'lucide-react';
import type { Player } from '../../../context/gameTypes';
import { PAvatar } from './PAvatar';
import electionBg from "figma:asset/f54adbcfe4b6b635b5c6f68ca367a59c1d9e5161.png";
import nightBg from "figma:asset/970b6d36e9ae2b4285a385d4f028ab9db13a07a7.png";

interface MaireElectionSuccessScreenProps {
  maireId: number | null;
  players: Player[];
  currentPlayerId: number | null;
  onDismiss: () => void;
}

/** Transition phases after clicking Continuer */
type Phase = 'idle' | 'flip' | 'night' | 'fadeout';

export const MaireElectionSuccessScreen = React.memo(function MaireElectionSuccessScreen({
  maireId,
  players,
  currentPlayerId,
  onDismiss,
}: MaireElectionSuccessScreenProps) {
  const mairePlayer = players.find((p) => p.id === maireId);
  const isElected = currentPlayerId !== null && currentPlayerId === maireId;

  const [showContent, setShowContent] = useState(false);
  const [showSubtext, setShowSubtext] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 400);
    const t2 = setTimeout(() => setShowSubtext(true), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /** Kick off the cinematic exit sequence */
  const handleContinue = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('flip');
    // After card finishes flipping, start night crossfade
    setTimeout(() => setPhase('night'), 600);
    // Then final fade-out
    setTimeout(() => setPhase('fadeout'), 1050);
    // Dismiss after everything is gone
    setTimeout(() => dismissRef.current(), 1350);
  }, [phase]);

  // Floating golden particles (background)
  const particles = React.useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 5,
      size: 2 + Math.random() * 5,
      opacity: 0.15 + Math.random() * 0.3,
    })),
  []);

  // Sparkle bursts around the card
  const sparkles = React.useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i / 8) * 360,
      distance: 140 + Math.random() * 60,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 1.5,
      size: 8 + Math.random() * 8,
    })),
  []);

  // Night-themed twinkling stars for the back face
  const nightStars = React.useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 1.5 + Math.random() * 2.5,
      delay: Math.random() * 2,
      duration: 1.5 + Math.random() * 2,
    })),
  []);

  const isTransitioning = phase !== 'idle';
  const isNightOrLater = phase === 'night' || phase === 'fadeout';
  const isFadingOut = phase === 'fadeout';

  const content = (
    <AnimatePresence>
      <motion.div
        key="maire-success-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: isFadingOut ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: isFadingOut ? 0.3 : 0.7 }}
        className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
        style={{ fontSize: '16px' }}
      >
        {/* ── Day background image ── */}
        <motion.img
          src={electionBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          animate={{
            opacity: isNightOrLater ? 0 : 1,
            filter: isTransitioning
              ? 'saturate(0.3) brightness(0.6)'
              : 'saturate(1) brightness(1)',
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        {/* ── Night background image (crossfades in) ── */}
        <motion.img
          src={nightBg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isNightOrLater ? 1 : 0 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
        />

        {/* Dark overlay – intensifies during transition */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: isNightOrLater
              ? 'radial-gradient(ellipse at 50% 40%, rgba(8,10,30,0.35) 0%, rgba(3,5,20,0.70) 100%)'
              : isElected
                ? 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.50) 100%)'
                : 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Floating particles – fade out during transition */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            opacity: isTransitioning ? 0 : 1,
            filter: isTransitioning ? 'saturate(0)' : 'saturate(1)',
          }}
          transition={{ duration: 0.4 }}
        >
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                background: isElected
                  ? `rgba(212,168,67,${p.opacity})`
                  : `rgba(180,150,80,${p.opacity * 0.7})`,
                filter: 'blur(0.5px)',
              }}
              initial={{ y: '110vh', opacity: 0 }}
              animate={{
                y: '-10vh',
                opacity: [0, p.opacity, p.opacity, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          ))}
        </motion.div>

        {/* Large ambient glow – fades during transition */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 420,
            height: 420,
            background: isElected
              ? 'radial-gradient(circle, rgba(212,168,67,0.15) 0%, transparent 65%)'
              : 'radial-gradient(circle, rgba(180,150,80,0.10) 0%, transparent 65%)',
          }}
          animate={{
            scale: isTransitioning ? 1.3 : [1, 1.15, 1],
            opacity: isTransitioning ? 0 : [0.4, 0.8, 0.4],
          }}
          transition={isTransitioning
            ? { duration: 0.5, ease: 'easeOut' }
            : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          }
        />

        {/* Sparkle bursts – fade out during transition */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: isTransitioning ? 0 : 1 }}
          transition={{ duration: 0.35 }}
        >
          {sparkles.map((s) => {
            const rad = (s.angle * Math.PI) / 180;
            return (
              <motion.div
                key={`sparkle-${s.id}`}
                className="absolute pointer-events-none"
                style={{
                  left: '50%',
                  top: '50%',
                  marginLeft: Math.cos(rad) * s.distance,
                  marginTop: Math.sin(rad) * s.distance,
                }}
                animate={{
                  opacity: [0, 0.7, 0],
                  scale: [0.5, 1.2, 0.5],
                }}
                transition={{
                  duration: s.duration,
                  delay: s.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Sparkles
                  size={s.size}
                  style={{ color: isElected ? 'rgba(212,168,67,0.6)' : 'rgba(180,150,80,0.45)' }}
                  strokeWidth={1.5}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* ═══════════════════ Card with 3D flip ═══════════════════ */}
        <div
          className="relative z-10"
          style={{
            perspective: 900,
            maxWidth: 340,
            width: 'calc(100% - 48px)',
          }}
        >
          <motion.div
            animate={{
              rotateY: isTransitioning ? 180 : 0,
            }}
            transition={{ duration: 0.6, ease: [0.4, 0.0, 0.2, 1] }}
            style={{
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            {/* ── FRONT FACE (Day / Election result) ── */}
            <motion.div
              className="flex flex-col items-center text-center"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                padding: '36px 28px 32px',
                borderRadius: 24,
                background: isElected
                  ? 'linear-gradient(175deg, rgba(252,244,225,0.97) 0%, rgba(245,237,214,0.95) 60%, rgba(235,220,185,0.93) 100%)'
                  : 'linear-gradient(175deg, rgba(248,242,228,0.96) 0%, rgba(240,232,210,0.94) 60%, rgba(230,218,185,0.92) 100%)',
                border: isElected
                  ? '1.5px solid rgba(212,168,67,0.35)'
                  : '1.5px solid rgba(180,150,80,0.25)',
                boxShadow: isElected
                  ? '0 8px 40px rgba(184,134,11,0.25), 0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)'
                  : '0 8px 40px rgba(160,130,60,0.18), 0 2px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
            >
              {/* Subtle inner glow at top of card */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 200,
                  height: 100,
                  borderRadius: '0 0 50% 50%',
                  background: isElected
                    ? 'radial-gradient(ellipse, rgba(212,168,67,0.10) 0%, transparent 70%)'
                    : 'radial-gradient(ellipse, rgba(180,150,80,0.07) 0%, transparent 70%)',
                }}
              />

              {/* Crown icon */}
              <motion.div
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.25 }}
                style={{ marginBottom: 16 }}
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{ width: 72, height: 72 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: isElected
                        ? 'radial-gradient(circle, rgba(212,168,67,0.20) 0%, transparent 70%)'
                        : 'radial-gradient(circle, rgba(180,150,80,0.14) 0%, transparent 70%)',
                    }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <Crown
                    size={isElected ? 48 : 42}
                    style={{ color: isElected ? '#b8860b' : '#a08032' }}
                    strokeWidth={1.5}
                  />
                </div>
              </motion.div>

              {/* Decorative separator */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                style={{
                  width: 60,
                  height: 1,
                  background: isElected
                    ? 'linear-gradient(90deg, transparent, rgba(184,134,11,0.4), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(160,130,60,0.3), transparent)',
                  marginBottom: 16,
                }}
              />

              {/* Title */}
              <AnimatePresence>
                {showContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <h1
                      style={{
                        fontFamily: '"Cinzel", serif',
                        fontSize: isElected ? '20px' : '17px',
                        fontWeight: 700,
                        color: isElected ? '#7a5c12' : '#6b5a2a',
                        lineHeight: 1.3,
                        textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                        margin: 0,
                      }}
                    >
                      {isElected ? (
                        <>Vous avez été élu Maire !</>
                      ) : (
                        <>Le Village a choisi...</>
                      )}
                    </h1>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Avatar + Name */}
              <AnimatePresence>
                {showContent && mairePlayer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.25 }}
                    className="flex flex-col items-center"
                    style={{ marginTop: 20, gap: 10 }}
                  >
                    {/* Avatar with crown badge */}
                    <div className="relative">
                      <motion.div
                        className="rounded-full overflow-hidden flex items-center justify-center"
                        style={{
                          width: 48,
                          height: 48,
                          border: `2.5px solid ${isElected ? 'rgba(184,134,11,0.45)' : 'rgba(160,130,60,0.35)'}`,
                          background: 'rgba(255,255,255,0.55)',
                          boxShadow: isElected
                            ? '0 0 24px rgba(184,134,11,0.15), 0 4px 12px rgba(0,0,0,0.08)'
                            : '0 0 16px rgba(160,130,60,0.10), 0 4px 12px rgba(0,0,0,0.06)',
                        }}
                        animate={isElected ? {
                          boxShadow: [
                            '0 0 16px rgba(184,134,11,0.10), 0 4px 12px rgba(0,0,0,0.08)',
                            '0 0 32px rgba(184,134,11,0.22), 0 4px 12px rgba(0,0,0,0.08)',
                            '0 0 16px rgba(184,134,11,0.10), 0 4px 12px rgba(0,0,0,0.08)',
                          ],
                        } : undefined}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <PAvatar player={mairePlayer} size="text-2xl" />
                      </motion.div>
                      {/* Crown badge */}
                      <motion.div
                        initial={{ scale: 0, y: 5 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.9 }}
                        className="absolute -top-2 -right-2 flex items-center justify-center"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: isElected
                            ? 'linear-gradient(135deg, #d4a843 0%, #8b6914 100%)'
                            : 'linear-gradient(135deg, #b8a050 0%, #7a6830 100%)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        <Crown size={13} style={{ color: '#fff' }} strokeWidth={2.2} />
                      </motion.div>
                    </div>

                    {/* Player name */}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      style={{
                        fontFamily: '"Cinzel", serif',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: '#4a3d1a',
                        letterSpacing: '0.02em',
                        margin: 0,
                      }}
                    >
                      {mairePlayer.name}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main message */}
              <AnimatePresence>
                {showContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    style={{ marginTop: 16 }}
                  >
                    <p
                      style={{
                        fontFamily: '"Cinzel", serif',
                        fontSize: '12px',
                        color: isElected ? '#5c4a1e' : '#6b5d3a',
                        lineHeight: 1.7,
                        fontWeight: 500,
                        margin: 0,
                      }}
                    >
                      {isElected ? (
                        <>Le village vous a accordé sa confiance.<br />Votre vote aura désormais plus de poids.</>
                      ) : mairePlayer ? (
                        <><strong style={{ color: '#7a5c12' }}>{mairePlayer.name}</strong> a été élu Maire.</>
                      ) : (
                        <>Aucun Maire n'a été élu.</>
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Subtext */}
              <AnimatePresence>
                {showSubtext && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    style={{ marginTop: 14 }}
                  >
                    {isElected ? (
                      <div className="flex items-center justify-center" style={{ gap: 6 }}>
                        <Star size={11} style={{ color: 'rgba(184,134,11,0.45)' }} />
                        <p style={{
                          fontSize: '10px',
                          color: 'rgba(122,92,18,0.50)',
                          fontStyle: 'italic',
                          fontFamily: '"Cinzel", serif',
                          margin: 0,
                        }}>
                          Gouvernez avec sagesse. La nuit approche.
                        </p>
                        <Star size={11} style={{ color: 'rgba(184,134,11,0.45)' }} />
                      </div>
                    ) : (
                      <p style={{
                        fontSize: '10px',
                        color: 'rgba(107,90,42,0.50)',
                        fontFamily: '"Cinzel", serif',
                        margin: 0,
                      }}>Le vote du Maire comptera double. En cas d'égalité, la voix du maire l'emporte.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Continue button */}
              <AnimatePresence>
                {showSubtext && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    onClick={handleContinue}
                    className="cursor-pointer"
                    style={{
                      marginTop: 28,
                      padding: '10px 36px',
                      borderRadius: 14,
                      fontFamily: '"Cinzel", serif',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#fff',
                      background: isElected
                        ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 100%)'
                        : 'linear-gradient(135deg, #8a7a40 0%, #b8a050 100%)',
                      border: 'none',
                      boxShadow: isElected
                        ? '0 4px 16px rgba(184,134,11,0.3), 0 2px 6px rgba(0,0,0,0.12)'
                        : '0 4px 16px rgba(160,130,60,0.25), 0 2px 6px rgba(0,0,0,0.10)',
                      letterSpacing: '0.04em',
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    Continuer
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── BACK FACE (Night card — matches PhaseBanner night variant) ── */}
            <div
              className="absolute inset-0 rounded-xl p-5 text-center flex flex-col items-center justify-center overflow-hidden"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'rgba(12,13,21,0.92)',
                border: '1px solid rgba(124,141,181,0.15)',
              }}
            >
              {/* Twinkling stars inside card */}
              {nightStars.map((s) => (
                <motion.div
                  key={`nstar-${s.id}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: s.size,
                    height: s.size,
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    background: 'rgba(180,195,240,0.5)',
                  }}
                  animate={{
                    opacity: [0.15, 0.7, 0.15],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{
                    duration: s.duration,
                    delay: s.delay,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              ))}

              <div className="relative z-10 flex flex-col items-center">
                {/* Moon emoji — matching PhaseBanner */}
                <motion.span
                  className="block"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={isTransitioning ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.45, delay: 0.25 }}
                  style={{ fontSize: '42px', marginBottom: '8px' }}
                >
                  {'\u{1F319}'}
                </motion.span>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={isTransitioning ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.4, delay: 0.35 }}
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: '#b4c3e6',
                    fontSize: '18px',
                    marginTop: '4px',
                    margin: '4px 0 0 0',
                    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  Le village dort...
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={isTransitioning ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  style={{
                    color: 'rgba(180,195,230,0.55)',
                    fontSize: '10px',
                    marginTop: '6px',
                    margin: '6px 0 0 0',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  Les créatures de la nuit rodent dans l'ombre
                </motion.p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
});