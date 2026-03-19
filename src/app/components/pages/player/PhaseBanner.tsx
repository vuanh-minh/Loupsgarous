/**
 * PhaseBanner.tsx
 * Main phase status card: eliminated, vote, night, or day state.
 * Extracted from GamePanel.tsx.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { RoleDefinition } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PhaseTimerDisplay, computeRemaining, formatTime } from '../../PhaseTimer';

interface PhaseBannerProps {
  isNight: boolean;
  isVotePhase: boolean;
  isMaireElection: boolean;
  currentPlayerAlive: boolean;
  canFlip?: boolean;
  onFlip?: () => void;
  isPracticeMode: boolean;
  isSimulationMode: boolean;
  isDemoMode?: boolean;
  tutorialStep: number;
  isVillageois: boolean;
  currentRole?: RoleDefinition;
  phaseTimerEndAt?: string | null;
  t: GameThemeTokens;
  /** Regular vote phase: total votes cast by alive players */
  totalVotes?: number;
  /** Regular vote phase: total alive players */
  totalAlivePlayers?: number;
  /** Number of players eliminated during the day vote (>1 = multi-elimination) */
  dayEliminationsCount?: number;
}

export const PhaseBanner = React.memo(function PhaseBanner({
  isNight, isVotePhase, isMaireElection,
  currentPlayerAlive, canFlip, onFlip,
  isPracticeMode, isSimulationMode, isDemoMode, tutorialStep, isVillageois, currentRole,
  phaseTimerEndAt, t,
  totalVotes, totalAlivePlayers, dayEliminationsCount,
}: PhaseBannerProps) {
  // Large countdown for immersive vote phase
  const [voteRemaining, setVoteRemaining] = useState(() =>
    isVotePhase && phaseTimerEndAt ? computeRemaining(phaseTimerEndAt) : -1
  );

  useEffect(() => {
    if (!isVotePhase || !phaseTimerEndAt) {
      setVoteRemaining(-1);
      return;
    }
    setVoteRemaining(computeRemaining(phaseTimerEndAt));
    const interval = setInterval(() => {
      const r = computeRemaining(phaseTimerEndAt);
      setVoteRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [isVotePhase, phaseTimerEndAt]);

  const isImmersiveVote = isVotePhase;
  const isUrgent = voteRemaining > 0 && voteRemaining <= 60;

  // Hide the banner entirely during day phase in demo/simulation mode
  const hideDayInDemo = (isSimulationMode || isDemoMode) && !isNight && !isImmersiveVote && currentPlayerAlive;

  return (
    <>
      {/* Timer removed for maire election — now handled by immersive layout */}
      <AnimatePresence mode="wait">
        {!hideDayInDemo && (
        <motion.div
          key={!currentPlayerAlive ? 'eliminated' : isImmersiveVote ? 'vote-immersive' : isNight ? 'night' : 'day'}
          initial={{ opacity: 0, y: -10 }}
          animate={
            currentPlayerAlive && isNight && canFlip
              ? { opacity: 1, y: 0, rotateY: [0, -3, 0, 2.5, 0] }
              : { opacity: 1, y: 0 }
          }
          transition={
            currentPlayerAlive && isNight && canFlip
              ? {
                  opacity: { duration: 0.3 },
                  y: { duration: 0.3 },
                  rotateY: { duration: 4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 3 },
                }
              : { duration: 0.3 }
          }
          exit={{ opacity: 0, y: 10 }}
          className={`${isImmersiveVote ? '' : 'rounded-xl'} text-center relative flex flex-col items-center justify-center overflow-hidden flex-1 min-h-0`}
          onClick={currentPlayerAlive && isNight && canFlip && onFlip ? onFlip : undefined}
          style={{
            marginTop: undefined,
            perspective: currentPlayerAlive && isNight && canFlip ? 800 : undefined,
            padding: isImmersiveVote
              ? 'clamp(12px, 4vh, 32px) 16px clamp(8px, 2vh, 16px)'
              : isVotePhase ? '16px' : '20px',
            background: !currentPlayerAlive
              ? 'linear-gradient(135deg, rgba(30,30,30,0.7), rgba(15,15,15,0.8))'
              : isImmersiveVote
                ? 'transparent'
                : isNight
                    ? 'rgba(12,13,21,0.4)'
                    : `linear-gradient(135deg, ${t.cardBg}, ${t.surfaceBg})`,
            border: isImmersiveVote
              ? 'none'
              : `1px solid ${
                !currentPlayerAlive
                  ? 'rgba(255,255,255,0.1)'
                  : isNight
                      ? canFlip ? 'rgba(212,168,67,0.35)' : 'rgba(124,141,181,0.15)'
                      : t.goldBorder
              }`,
            cursor: currentPlayerAlive && isNight && canFlip ? 'pointer' : undefined,
          }}
        >
          {/* Maire election festive background — removed, hero banner is now outside */}
          <div className="relative z-10">
            {!currentPlayerAlive ? (
              <>
                <span className="text-2xl block mb-2" style={{ filter: 'grayscale(1)' }}>&#x1F480;</span>
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
                  Vous ne pouvez plus participer aux votes.{'\n'}Vous pouvez continuer a enqueter.
                </p>
              </>
            ) : isImmersiveVote ? (
              /* ═══ IMMERSIVE VOTE PHASE — large timer + title ═══ */
              <>
                {/* Large countdown timer */}
                <motion.p
                  animate={isUrgent ? { opacity: [1, 0.5, 1] } : {}}
                  transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
                  style={{
                    fontFamily: '"Cinzel", serif',
                    fontWeight: 900,
                    fontSize: 'clamp(36px, 12vw, 72px)',
                    lineHeight: 1,
                    color: isUrgent ? '#f59e0b' : '#ffffff',
                    textAlign: 'center',
                    textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {voteRemaining >= 0 ? formatTime(voteRemaining) : '--:--'}
                </motion.p>

                {/* Title */}
                <p
                  style={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: 'clamp(11px, 2.5vw, 15px)',
                    color: 'rgba(255,255,255,0.9)',
                    textAlign: 'center',
                    letterSpacing: '1.5px',
                    marginTop: 'clamp(4px, 1.5vh, 12px)',
                    textTransform: 'uppercase',
                  }}
                >
                  {isMaireElection ? 'Votez pour le maire' : 'Votez qui eliminer'}
                </p>

                {/* Vote counter */}
                <p
                  style={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: 'clamp(10px, 2vw, 13px)',
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    marginTop: 'clamp(2px, 1vh, 6px)',
                  }}
                >
                  {totalVotes ?? 0} / {totalAlivePlayers ?? 0} votes
                </p>

                {/* Multi-elimination indicator */}
                {!isMaireElection && dayEliminationsCount && dayEliminationsCount > 1 && (
                  <p
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: 'clamp(9px, 1.8vw, 12px)',
                      color: '#f59e0b',
                      textAlign: 'center',
                      marginTop: 'clamp(2px, 0.8vh, 6px)',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ⚔️ {dayEliminationsCount} eliminations prevues au vote
                  </p>
                )}
              </>
            ) : isNight ? (
              <>
                <span className="text-4xl block mb-1">&#x1F319;</span>
                <h2
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: isPracticeMode ? t.gold : '#b4c3e6',
                    fontSize: '1.1rem',
                    marginTop: '0.25rem',
                    textShadow: '0 1px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  Le village dort...
                </h2>
                <p style={{
                  color: 'rgba(180,195,230,0.55)',
                  fontSize: '0.6rem',
                  marginTop: '0.3rem',
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}>
                  Les creatures de la nuit rodent dans l'ombre
                </p>
                {isSimulationMode && canFlip && tutorialStep === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-lg px-4 py-2"
                    style={{
                      background: 'rgba(212,168,67,0.1)',
                      border: '1px solid rgba(212,168,67,0.25)',
                    }}
                  >
                    <motion.p
                      style={{ color: t.gold, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Touchez la carte pour reveler vos pouvoirs
                    </motion.p>
                    <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.25rem' }}>
                      Etape 1/3 — Decouverte
                    </p>
                  </motion.div>
                )}
                {isSimulationMode && canFlip && tutorialStep >= 2 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ color: '#6b8e5a', fontSize: '0.6rem', marginTop: '0.5rem' }}
                  >
                    Touchez pour vous entrainer a nouveau
                  </motion.p>
                )}
                {isPracticeMode && (isVillageois || currentRole?.id === 'petite-fille') && (
                  <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                    {isVillageois
                      ? <>Vous etes Villageois — pas de pouvoir special.{'\n'}Explorez les onglets en attendant !</>
                      : <>Votre pouvoir d'espionnage s'active pendant la vraie nuit.{'\n'}Explorez les onglets en attendant !</>
                    }
                  </p>
                )}
                {!isSimulationMode && canFlip && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{ color: 'rgba(212,168,67,0.85)', fontSize: '0.7rem', marginTop: '0.5rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.5px' }}
                  >
                    Touchez pour retourner la carte
                  </motion.p>
                )}
                {phaseTimerEndAt && !isPracticeMode && (
                  <div className="mt-3">
                    <PhaseTimerDisplay endAt={phaseTimerEndAt} isNight={true} t={t} size="compact" />
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="text-4xl block mb-1">&#x2600;&#xFE0F;</span>
                <h2
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: t.gold,
                    fontSize: '1.1rem',
                    marginTop: '0.25rem',
                  }}
                >
                  Le village se reveille
                </h2>
                {phaseTimerEndAt && !isPracticeMode && (
                  <div className="mt-2">
                    <PhaseTimerDisplay endAt={phaseTimerEndAt} isNight={false} t={t} size="compact" />
                  </div>
                )}
                {dayEliminationsCount && dayEliminationsCount > 1 && (
                  <p
                    style={{
                      fontFamily: '"Cinzel", serif',
                      color: '#f59e0b',
                      fontSize: '0.6rem',
                      marginTop: '0.5rem',
                      textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    ⚔️ {dayEliminationsCount} eliminations prevues au vote
                  </p>
                )}
              </>
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});