/**
 * SpectatorGameView.tsx
 * Shared fullscreen spectator game view, used by both SpectatorPage and GM "Spectateur" tab.
 * Renders backgrounds, phase badge, timer, victim overlays, player marquee, winner overlay, and phase transitions.
 */
import React, { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Moon, Maximize, Minimize } from 'lucide-react';
import type { Player, GameEvent } from '../../../context/GameContext';
import { getRoleById } from '../../../data/roles';
import { computeRemaining, formatTime } from '../../PhaseTimer';
const dayVillageBg = '/assets/backgrounds/day-village.png';
const dayVillagePeacefulBg = '/assets/backgrounds/day-village-peaceful.png';
const nightVillageBg = '/assets/backgrounds/night-village.png';
const electionVillageBg = '/assets/backgrounds/election-village.png';
import { PhaseTransitionOverlay } from './PhaseTransitionOverlay';
import { PlayerMarquee } from './PlayerMarquee';
import { RoleRevealSpectator } from './RoleRevealSpectator';
import { resolveAvatarUrl } from '../../../data/avatarResolver';

/** Hook: is screen < 640px? */
function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    setMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

/** Renders a player's avatar — image if uploaded, emoji otherwise */
function SAvatar({ player, size = 'text-lg', className = '', style }: {
  player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'> & { alive?: boolean };
  size?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  const sizeMap: Record<string, string> = {
    'text-xs': 'w-4 h-4', 'text-sm': 'w-5 h-5', 'text-base': 'w-6 h-6',
    'text-lg': 'w-7 h-7', 'text-xl': 'w-8 h-8', 'text-2xl': 'w-9 h-9',
    'text-3xl': 'w-11 h-11', 'text-4xl': 'w-14 h-14',
    'text-5xl': 'w-16 h-16', 'text-6xl': 'w-20 h-20',
  };
  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className={`${sizeMap[size] || 'w-7 h-7'} rounded-full object-cover inline-block ${className}`}
        style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}
      />
    );
  }
  return <span className={`${size} ${className}`} style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}>{player.avatar}</span>;
}

export interface SpectatorGameViewProps {
  state: any;
  /** When true, hides the back button and live indicator (e.g. when embedded in GM page) */
  embedded?: boolean;
  /** Callback for back button when embedded */
  onBack?: () => void;
  /** Realtime connection status — only used when not embedded */
  realtimeConnected?: boolean;
}

export const SpectatorGameView = React.memo(function SpectatorGameView({
  state,
  embedded = false,
  onBack,
  realtimeConnected = false,
}: SpectatorGameViewProps) {
  const navigate = useNavigate();
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isMobile = useIsMobile();

  // Fullscreen toggle
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Reset dismiss when winner changes
  React.useEffect(() => {
    if (state.winner) setWinnerDismissed(false);
  }, [state.winner]);

  // Phase timer
  const [phaseRemaining, setPhaseRemaining] = React.useState(() => computeRemaining(state.phaseTimerEndAt ?? null));
  React.useEffect(() => {
    if (!state.phaseTimerEndAt) {
      setPhaseRemaining(-1);
      return;
    }
    setPhaseRemaining(computeRemaining(state.phaseTimerEndAt));
    const interval = setInterval(() => {
      setPhaseRemaining(computeRemaining(state.phaseTimerEndAt));
    }, 250);
    return () => clearInterval(interval);
  }, [state.phaseTimerEndAt]);
  const timerDisplay = phaseRemaining >= 0 ? formatTime(phaseRemaining) : formatTime(state.timer || 0);
  const timerDisabled = !state.phaseTimerDuration || state.phaseTimerDuration <= 0;

  const isNight = state.phase === 'night';
  const alivePlayers = state.players.filter((p: Player) => p.alive);
  const deadPlayers = state.players.filter((p: Player) => !p.alive);

  // Vote data
  const isVotePhase = !isNight && (state.dayStep === 'vote' || state.dayStep === 'result');
  const isVoteResult = state.dayStep === 'result';
  const isMaireElection = !isNight && state.dayStep === 'vote' && !state.maireElectionDone && state.turn === 1 && state.roleRevealDone;
  const totalAlive = alivePlayers.length;
  const totalVotes = Object.keys(state.votes).length;

  const voteCounts: Record<number, number> = {};
  Object.values(state.votes).forEach((targetId: any) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  const ranking = Object.entries(voteCounts)
    .map(([id, count]) => ({
      player: state.players.find((p: Player) => p.id === parseInt(id)),
      count,
    }))
    .filter((r: any) => r.player)
    .sort((a: any, b: any) => b.count - a.count);

  const eliminatedPlayers = (state.voteResults || [])
    .map((id: number) => state.players.find((p: Player) => p.id === id))
    .filter(Boolean) as Player[];

  const lastVoteEliminated = [...deadPlayers].reverse().find((p) => {
    return state.events.some(
      (e: GameEvent) => e.message.includes(p.name) && e.message.includes('elimine par le village'),
    );
  });

  const nightVictims = deadPlayers.filter((p) => {
    return state.events.some(
      (e: GameEvent) =>
        e.turn === state.turn &&
        e.phase === 'night' &&
        e.message.includes(p.name) &&
        (e.message.includes('devore') ||
         e.message.includes('empoisonne') ||
         e.message.includes('meurt de chagrin') ||
         e.message.includes('Chasseur tire')),
    );
  });

  // Revived players this turn (alive players who have a "ressuscite" event)
  const revivedPlayers = alivePlayers.filter((p) => {
    return state.events.some(
      (e: GameEvent) =>
        e.turn === state.turn &&
        e.message.includes(p.name) &&
        e.message.includes('ressuscite'),
    );
  });

  const topVotedPlayer = ranking.length > 0 && ranking[0].count > 0 ? ranking[0].player : null;
  const currentDayBg = isMaireElection ? electionVillageBg : (nightVictims.length === 0 ? dayVillagePeacefulBg : dayVillageBg);

  const BG_FADE = 1.8;
  const PANEL_SLIDE = 0.7;

  const getDeathCause = (victim: Player) => {
    const deathEvent = state.events.find(
      (e: GameEvent) =>
        e.turn === state.turn && e.phase === 'night' && e.message.includes(victim.name) &&
        (e.message.includes('devore') || e.message.includes('empoisonne') || e.message.includes('meurt de chagrin') || e.message.includes('Chasseur tire')),
    );
    if (deathEvent) {
      if (deathEvent.message.includes('devore')) return { label: 'Devore par les loups', icon: '🐺' };
      if (deathEvent.message.includes('empoisonne')) return { label: 'Empoisonne', icon: '🧪' };
      if (deathEvent.message.includes('meurt de chagrin')) return { label: 'Mort de chagrin', icon: '💔' };
      if (deathEvent.message.includes('Chasseur tire')) return { label: 'Abattu par le Chasseur', icon: '🏹' };
    }
    return { label: 'Mort durant la nuit', icon: '💀' };
  };

  // ═══ Role Reveal phase — show dedicated screen ═══
  if (state.roleRevealDone === false && state.players.length > 0) {
    return (
      <RoleRevealSpectator
        players={state.players}
        roleRevealedBy={state.roleRevealedBy ?? []}
      />
    );
  }

  return (
    <div
      className="h-full w-full relative overflow-hidden select-none"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* ═══ FULLSCREEN BACKGROUND — crossfade ═══ */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: isNight ? 0 : 1 }}
        transition={{ duration: BG_FADE, ease: 'easeInOut' }}
        style={{ backgroundImage: `url(${currentDayBg})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', imageRendering: 'pixelated' }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.12) 40%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 20%)' }} />
      </motion.div>
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: isNight ? 1 : 0 }}
        transition={{ duration: BG_FADE, ease: 'easeInOut' }}
        style={{ backgroundImage: `url(${nightVillageBg})`, backgroundSize: 'cover', backgroundPosition: 'center bottom', imageRendering: 'pixelated', pointerEvents: isNight ? 'auto' : 'none' }}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.18) 40%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%)' }} />
      </motion.div>

      {/* ═══ TOP BAR — phase badge + optional back/live ═══ */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between ${isMobile ? 'px-3 py-2' : 'px-10 py-6'}`}>
        {!embedded ? (
          <button
            onClick={() => navigate('/spectator')}
            className={`${isMobile ? 'p-2' : 'p-4'} rounded-xl transition-all active:scale-95`}
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={isMobile ? 18 : 32} style={{ color: isNight ? '#7c8db5' : '#fff' }} />
          </button>
        ) : (
          <button
            onClick={onBack}
            className={`${isMobile ? 'p-2' : 'p-4'} rounded-xl transition-all active:scale-95`}
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={isMobile ? 18 : 32} style={{ color: isNight ? '#7c8db5' : '#fff' }} />
          </button>
        )}

        {/* Phase badge — large for TV, compact for mobile */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 flex items-center ${isMobile ? 'gap-2 px-3 py-1.5 rounded-xl' : 'gap-5 px-8 py-4 rounded-2xl'}`}
          style={{
            top: isMobile ? '0.5rem' : '1.5rem',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            border: `${isMobile ? '1px' : '2px'} solid ${isNight ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <span style={{ fontSize: isMobile ? '1.1rem' : '2.5rem' }}>{isNight ? '🌙' : '☀️'}</span>
          <span style={{
            fontFamily: '"Cinzel", serif',
            color: isNight ? '#a78bfa' : '#fff',
            fontSize: isMobile ? '0.85rem' : '2.2rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: isMobile ? '0.08em' : '0.15em',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}>
            {isNight ? `Nuit ${state.turn}` : `Jour ${state.turn}`}
          </span>
          {!isMobile && <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isNight ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.3)',
            display: 'inline-block',
          }} />}
          <span style={{
            fontFamily: '"Cinzel", serif',
            color: isNight ? '#8090b0' : 'rgba(255,255,255,0.7)',
            fontSize: isMobile ? '0.65rem' : '1.6rem',
            fontWeight: 500,
          }}>
            {alivePlayers.length} en vie{deadPlayers.length > 0 ? ` · ${deadPlayers.length} mort${deadPlayers.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>

        {!embedded ? (
          <div
            className={`flex items-center ${isMobile ? 'gap-1.5 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-6 py-4 rounded-2xl'}`}
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: `${isMobile ? '1px' : '2px'} solid ${realtimeConnected ? 'rgba(107,142,90,0.35)' : 'rgba(239,68,68,0.35)'}` }}
          >
            <div className={`${isMobile ? 'w-2 h-2' : 'w-3.5 h-3.5'} rounded-full ${realtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
            <span style={{ color: isNight ? '#8090b0' : '#fff', fontSize: isMobile ? '0.6rem' : '1.2rem', fontFamily: '"Cinzel", serif' }}>
              {realtimeConnected ? 'En direct' : '...'}
            </span>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* ═══ CENTER — timer or night label ═══ */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {!isTransitioning && (
            isNight ? (
              <motion.div key="night-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.7, ease: 'easeOut' }} className="text-center">
                {timerDisabled ? (
                  <motion.div animate={{ scale: [1, 1.03, 1], opacity: [0.85, 1, 0.85] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
                    <Moon size={isMobile ? 48 : 100} style={{ color: '#8b5cf6', margin: isMobile ? '0 auto 1rem' : '0 auto 2rem', filter: 'drop-shadow(0 0 40px rgba(139,92,246,0.4))' }} />
                  </motion.div>
                ) : (
                  <p style={{
                    fontFamily: '"Cinzel", serif', color: '#a78bfa',
                    fontSize: isMobile ? '4.5rem' : '16rem', fontWeight: 900, lineHeight: 0.85,
                    textShadow: '0 0 80px rgba(139,92,246,0.4), 0 6px 24px rgba(0,0,0,0.5)',
                  }}>{timerDisplay}</p>
                )}
                <p style={{
                  fontFamily: '"Cinzel", serif', color: 'rgba(180,195,230,0.9)',
                  fontSize: isMobile ? '1rem' : '3rem', marginTop: isMobile ? '0.6rem' : '1.2rem',
                  textShadow: '0 3px 16px rgba(0,0,0,0.8), 0 0 40px rgba(139,92,246,0.3)',
                  letterSpacing: '0.08em',
                }}>Le village dort...</p>
              </motion.div>
            ) : (
              <motion.div key="day-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.7, ease: 'easeOut' }} className="text-center">
                {!timerDisabled && (
                  <p style={{
                    fontFamily: '"Cinzel", serif', color: '#fff',
                    fontSize: isMobile ? '4.5rem' : '16rem', fontWeight: 900, lineHeight: 0.85,
                    textShadow: '0 6px 24px rgba(0,0,0,0.7), 0 0 80px rgba(0,0,0,0.4)',
                  }}>{timerDisplay}</p>
                )}
                {isVotePhase && !isVoteResult && (
                  <div className={isMobile ? 'mt-3' : 'mt-6'}>
                    <p style={{
                      fontFamily: '"Cinzel", serif', color: 'rgba(255,255,255,0.9)',
                      fontSize: isMobile ? '0.95rem' : '2.6rem', letterSpacing: '0.1em',
                      textShadow: '0 3px 10px rgba(0,0,0,0.6)',
                    }}>
                      {isMaireElection ? 'Election du Maire' : 'Le village cherche un coupable...'}
                    </p>
                    <p style={{
                      fontFamily: '"Cinzel", serif', color: 'rgba(255,255,255,0.6)',
                      fontSize: isMobile ? '0.8rem' : '2rem', marginTop: '0.4rem',
                      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}>
                      {totalVotes} / {totalAlive} votes
                    </p>
                  </div>
                )}
                {isVoteResult && eliminatedPlayers.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${isMobile ? 'mt-3' : 'mt-6'} flex flex-col items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
                    {/* Horizontal row so all eliminated players are visible side-by-side */}
                    <div className={`flex flex-wrap justify-center ${isMobile ? 'gap-4' : 'gap-8'}`}>
                      {eliminatedPlayers.map((ep) => {
                        const role = getRoleById(ep.role);
                        return (
                          <motion.div
                            key={ep.id}
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="flex flex-col items-center"
                          >
                            <div
                              className="rounded-full flex items-center justify-center mb-2"
                              style={{
                                width: isMobile ? '72px' : (eliminatedPlayers.length > 1 ? '120px' : '140px'),
                                height: isMobile ? '72px' : (eliminatedPlayers.length > 1 ? '120px' : '140px'),
                                background: 'rgba(196,30,58,0.2)',
                                border: `${isMobile ? '3px' : '5px'} solid rgba(196,30,58,0.5)`,
                                boxShadow: '0 0 50px rgba(196,30,58,0.3)',
                              }}
                            >
                              <SAvatar player={ep} size={isMobile ? 'text-3xl' : (eliminatedPlayers.length > 1 ? 'text-5xl' : 'text-6xl')} className="grayscale" />
                            </div>
                            <p style={{
                              fontFamily: '"Cinzel", serif', color: '#fff',
                              fontSize: isMobile ? (eliminatedPlayers.length > 1 ? '1rem' : '1.2rem') : (eliminatedPlayers.length > 1 ? '2rem' : '2.8rem'),
                              fontWeight: 700,
                              textShadow: '0 4px 16px rgba(0,0,0,0.7)',
                              textDecoration: 'line-through', textDecorationColor: 'rgba(196,30,58,0.6)',
                            }}>{ep.name}</p>
                            {role && eliminatedPlayers.length > 1 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span style={{ fontSize: isMobile ? '0.8rem' : '1.3rem' }}>{role.emoji}</span>
                                <span style={{
                                  fontFamily: '"Cinzel", serif',
                                  color: role.color || '#aaa',
                                  fontSize: isMobile ? '0.6rem' : '1rem',
                                }}>{role.name}</span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                    <p style={{
                      fontFamily: '"Cinzel", serif', color: 'rgba(255,200,200,0.9)', fontSize: isMobile ? '0.8rem' : '1.8rem',
                      textShadow: '0 2px 10px rgba(0,0,0,0.6)', marginTop: '0.2rem',
                    }}>{eliminatedPlayers.length > 1 ? 'Elimines par le village' : 'Elimine par le village'}</p>
                  </motion.div>
                )}
                {isVoteResult && eliminatedPlayers.length === 0 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                    fontFamily: '"Cinzel", serif', color: 'rgba(255,255,255,0.85)', fontSize: isMobile ? '1rem' : '2.6rem',
                    textShadow: '0 3px 10px rgba(0,0,0,0.6)', marginTop: '1.2rem',
                  }}>Egalite — aucune elimination</motion.p>
                )}
                {!isVotePhase && !isVoteResult && timerDisabled && (
                  <p style={{
                    fontFamily: '"Cinzel", serif', color: 'rgba(255,255,255,0.7)',
                    fontSize: isMobile ? '1rem' : '2.6rem', textShadow: '0 3px 10px rgba(0,0,0,0.6)',
                  }}>
                    {alivePlayers.length} en vie{deadPlayers.length > 0 ? ` · ${deadPlayers.length} mort${deadPlayers.length > 1 ? 's' : ''}` : ''}
                  </p>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* ═══ LEFT OVERLAY — contextual info (victims / eliminated) ═══ */}
      <AnimatePresence>
        {!isTransitioning && !isNight && nightVictims.length > 0 && (
          <motion.div
            key="victims-overlay"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute ${isMobile ? 'left-2 right-2' : 'left-10'} z-15 flex flex-col ${isMobile ? 'gap-2' : 'gap-5'}`}
            style={{ top: isMobile ? '52px' : '140px', maxWidth: isMobile ? undefined : '480px' }}
          >
            <div
              className={`${isMobile ? 'rounded-xl p-3' : 'rounded-2xl p-6'}`}
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(12px)',
                border: `${isMobile ? '1px' : '2px'} solid rgba(196,30,58,0.2)`,
              }}
            >
              <p style={{
                fontFamily: '"Cinzel", serif', color: 'rgba(255,200,200,0.9)',
                fontSize: isMobile ? '0.65rem' : '1.4rem', textTransform: 'uppercase', letterSpacing: '0.15em',
                marginBottom: isMobile ? '0.5rem' : '1.2rem',
              }}>
                {nightVictims.length === 1 ? 'Victime de la nuit' : 'Victimes de la nuit'}
              </p>
              <div className={`flex flex-col ${isMobile ? 'gap-2' : 'gap-5'}`}>
                {nightVictims.map((victim) => {
                  const role = getRoleById(victim.role);
                  const cause = getDeathCause(victim);
                  return (
                    <div key={victim.id} className={`flex items-center ${isMobile ? 'gap-2' : 'gap-5'}`}>
                      <div
                        className="rounded-full flex items-center justify-center shrink-0"
                        style={{ width: isMobile ? '40px' : '80px', height: isMobile ? '40px' : '80px', background: 'rgba(196,30,58,0.15)', border: `${isMobile ? '2px' : '3px'} solid rgba(196,30,58,0.3)` }}
                      >
                        <SAvatar player={victim} size={isMobile ? 'text-xl' : 'text-4xl'} className="grayscale" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{
                          color: '#fff', fontSize: isMobile ? '0.8rem' : '1.6rem', fontWeight: 700,
                          textDecoration: 'line-through', textDecorationColor: 'rgba(196,30,58,0.5)',
                        }}>{victim.name}</p>
                        {role && (
                          <div className={`flex items-center ${isMobile ? 'gap-1.5 mt-0.5' : 'gap-3 mt-1.5'}`}>
                            <span style={{ fontSize: isMobile ? '0.75rem' : '1.5rem' }}>{role.emoji}</span>
                            <span style={{ color: role.color, fontSize: isMobile ? '0.65rem' : '1.3rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>{role.name}</span>
                            {!isMobile && <span className="px-3 py-1 rounded-full" style={{
                              background: role.team === 'werewolf' ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)',
                              border: `1px solid ${role.team === 'werewolf' ? 'rgba(196,30,58,0.3)' : 'rgba(107,142,90,0.3)'}`,
                              color: role.team === 'werewolf' ? '#ff6b7d' : '#8bc470',
                              fontSize: '1rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase' as const, letterSpacing: '0.08em',
                            }}>
                              {role.team === 'village' ? 'Village' : role.team === 'werewolf' ? 'Loup' : 'Solo'}
                            </span>}
                          </div>
                        )}
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: isMobile ? '0.55rem' : '1.1rem', marginTop: '0.3rem' }}>
                          {cause.icon} {cause.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Day: revived player card */}
        {!isTransitioning && !isNight && revivedPlayers.length > 0 && (
          <motion.div
            key="revived-overlay"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ duration: 0.7, delay: nightVictims.length > 0 ? 0.8 : 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute ${isMobile ? 'left-2 right-2' : 'left-10'} z-15`}
            style={{
              top: nightVictims.length > 0
                ? (isMobile ? `${52 + nightVictims.length * 56 + 60}px` : `${140 + nightVictims.length * 110 + 100}px`)
                : (isMobile ? '52px' : '140px'),
              maxWidth: isMobile ? undefined : '480px',
            }}
          >
            <div
              className={`${isMobile ? 'rounded-xl p-3' : 'rounded-2xl p-6'}`}
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(12px)',
                border: `${isMobile ? '1px' : '2px'} solid rgba(107,142,90,0.25)`,
              }}
            >
              <p style={{
                fontFamily: '"Cinzel", serif', color: 'rgba(180,230,180,0.9)',
                fontSize: isMobile ? '0.65rem' : '1.4rem', textTransform: 'uppercase', letterSpacing: '0.15em',
                marginBottom: isMobile ? '0.5rem' : '1.2rem',
              }}>
                {revivedPlayers.length === 1 ? 'Ressuscite' : 'Ressuscites'}
              </p>
              <div className={`flex flex-col ${isMobile ? 'gap-2' : 'gap-5'}`}>
                {revivedPlayers.map((player) => (
                  <div key={player.id} className={`flex items-center ${isMobile ? 'gap-2' : 'gap-5'}`}>
                    <div
                      className="rounded-full flex items-center justify-center shrink-0"
                      style={{
                        width: isMobile ? '40px' : '80px',
                        height: isMobile ? '40px' : '80px',
                        background: 'rgba(107,142,90,0.15)',
                        border: `${isMobile ? '2px' : '3px'} solid rgba(107,142,90,0.35)`,
                        boxShadow: '0 0 20px rgba(107,142,90,0.15)',
                      }}
                    >
                      <SAvatar player={player} size={isMobile ? 'text-xl' : 'text-4xl'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{
                        color: '#fff', fontSize: isMobile ? '0.8rem' : '1.6rem', fontWeight: 700,
                      }}>
                        {player.name}
                      </p>
                      <p style={{
                        color: 'rgba(139,196,112,0.8)',
                        fontSize: isMobile ? '0.55rem' : '1.1rem',
                        marginTop: '0.3rem',
                      }}>
                        ✨ De retour parmi les vivants
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Night 1: elected maire card */}
        {!isTransitioning && isNight && state.turn === 1 && state.maireElectionDone && state.maireId != null && (() => {
          const mairePlayer = state.players.find((p: Player) => p.id === state.maireId);
          if (!mairePlayer) return null;
          return (
            <motion.div
              key="maire-elected-overlay"
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute ${isMobile ? 'left-2 right-2' : 'left-10'} z-15`}
              style={{ top: isMobile ? '52px' : '140px', maxWidth: isMobile ? undefined : '480px' }}
            >
              <div
                className={`${isMobile ? 'rounded-xl p-3' : 'rounded-2xl p-6'} flex items-center ${isMobile ? 'gap-3' : 'gap-6'}`}
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(12px)',
                  border: `${isMobile ? '1px' : '2px'} solid rgba(212,168,67,0.25)`,
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: isMobile ? '44px' : '88px',
                    height: isMobile ? '44px' : '88px',
                    background: 'rgba(212,168,67,0.12)',
                    border: `${isMobile ? '2px' : '4px'} solid rgba(212,168,67,0.35)`,
                    boxShadow: '0 0 24px rgba(212,168,67,0.15)',
                  }}
                >
                  <SAvatar player={mairePlayer} size={isMobile ? 'text-xl' : 'text-5xl'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center ${isMobile ? 'gap-1.5 mb-0.5' : 'gap-3 mb-2'}`}>
                    <span style={{ fontSize: isMobile ? '0.85rem' : '1.8rem' }}>👑</span>
                    <span style={{
                      fontFamily: '"Cinzel", serif',
                      color: '#d4a843',
                      fontSize: isMobile ? '0.6rem' : '1.3rem',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.12em',
                      fontWeight: 600,
                    }}>
                      Maire elu
                    </span>
                  </div>
                  <p className="truncate" style={{
                    color: '#fff',
                    fontSize: isMobile ? '0.9rem' : '1.8rem',
                    fontWeight: 700,
                    fontFamily: '"Cinzel", serif',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  }}>
                    {mairePlayer.name}
                  </p>
                  <p style={{
                    color: 'rgba(212,168,67,0.7)',
                    fontSize: isMobile ? '0.55rem' : '1.1rem',
                    marginTop: isMobile ? '0.2rem' : '0.4rem',
                    fontFamily: '"Cinzel", serif',
                  }}>
                    Sa voix compte double
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* New Maire successor card (shown when succession completed) */}
        {!isTransitioning && state.maireId != null && state.maireElectionDone && (() => {
          // Detect if there's a recent succession event (distinct from initial election)
          const successionEvent = (state.events || []).find((e: any) =>
            e.turn === state.turn && (e.message.includes('designe(e) nouveau Maire') || e.message.includes('designe(e) Maire par le destin'))
          );
          if (!successionEvent) return null;
          const newMaire = state.players.find((p: Player) => p.id === state.maireId);
          if (!newMaire) return null;
          return (
            <motion.div
              key="maire-successor-overlay"
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className={`absolute ${isMobile ? 'left-2 right-2' : 'left-10'} z-15`}
              style={{
                top: nightVictims.length > 0
                  ? (isMobile ? `${52 + nightVictims.length * 56 + 60}px` : `${140 + nightVictims.length * 110 + 100}px`)
                  : (isMobile ? '52px' : '140px'),
                maxWidth: isMobile ? undefined : '480px',
              }}
            >
              <div
                className={`${isMobile ? 'rounded-xl p-3' : 'rounded-2xl p-6'} flex items-center ${isMobile ? 'gap-3' : 'gap-6'}`}
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  backdropFilter: 'blur(12px)',
                  border: `${isMobile ? '1px' : '2px'} solid rgba(212,168,67,0.25)`,
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: isMobile ? '44px' : '88px',
                    height: isMobile ? '44px' : '88px',
                    background: 'rgba(212,168,67,0.12)',
                    border: `${isMobile ? '2px' : '4px'} solid rgba(212,168,67,0.35)`,
                    boxShadow: '0 0 24px rgba(212,168,67,0.15)',
                  }}
                >
                  <SAvatar player={newMaire} size={isMobile ? 'text-xl' : 'text-5xl'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`flex items-center ${isMobile ? 'gap-1.5 mb-0.5' : 'gap-3 mb-2'}`}>
                    <span style={{ fontSize: isMobile ? '0.85rem' : '1.8rem' }}>👑</span>
                    <span style={{
                      fontFamily: '"Cinzel", serif',
                      color: '#d4a843',
                      fontSize: isMobile ? '0.6rem' : '1.3rem',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.12em',
                      fontWeight: 600,
                    }}>
                      Nouveau Maire
                    </span>
                  </div>
                  <p className="truncate" style={{
                    color: '#fff',
                    fontSize: isMobile ? '0.9rem' : '1.8rem',
                    fontWeight: 700,
                    fontFamily: '"Cinzel", serif',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                  }}>
                    {newMaire.name}
                  </p>
                  <p style={{
                    color: 'rgba(212,168,67,0.7)',
                    fontSize: isMobile ? '0.55rem' : '1.1rem',
                    marginTop: isMobile ? '0.2rem' : '0.4rem',
                    fontFamily: '"Cinzel", serif',
                  }}>
                    Designe(e) par le Maire defunt
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Night: last eliminated card */}
        {!isTransitioning && isNight && lastVoteEliminated && (
          <motion.div
            key="last-eliminated-overlay"
            initial={{ x: -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -80, opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute ${isMobile ? 'left-2 right-2' : 'left-10'} z-15`}
            style={{ top: isMobile ? '52px' : '140px', maxWidth: isMobile ? undefined : '480px' }}
          >
            <div
              className={`${isMobile ? 'rounded-xl p-3' : 'rounded-2xl p-6'} flex items-center ${isMobile ? 'gap-3' : 'gap-6'}`}
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(12px)',
                border: `${isMobile ? '1px' : '2px'} solid rgba(196,30,58,0.15)`,
              }}
            >
              <div
                className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: isMobile ? '40px' : '80px', height: isMobile ? '40px' : '80px', background: 'rgba(196,30,58,0.15)', border: `${isMobile ? '2px' : '3px'} solid rgba(196,30,58,0.25)` }}
              >
                <SAvatar player={lastVoteEliminated} size={isMobile ? 'text-xl' : 'text-4xl'} className="grayscale" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ color: '#c0c8d8', fontSize: isMobile ? '0.8rem' : '1.5rem', fontWeight: 600, textDecoration: 'line-through', textDecorationColor: 'rgba(196,30,58,0.4)' }}>
                  {lastVoteEliminated.name}
                </p>
                {(() => {
                  const role = getRoleById(lastVoteEliminated.role);
                  return role ? (
                    <div className={`flex items-center ${isMobile ? 'gap-1.5 mt-1' : 'gap-3 mt-2'}`}>
                      <span style={{ fontSize: isMobile ? '0.75rem' : '1.4rem' }}>{role.emoji}</span>
                      <span style={{ color: role.color, fontSize: isMobile ? '0.65rem' : '1.2rem', fontFamily: '"Cinzel", serif' }}>{role.name}</span>
                    </div>
                  ) : null;
                })()}
                <p style={{ color: '#6b7b9b', fontSize: isMobile ? '0.55rem' : '1.1rem', marginTop: '0.4rem' }}>Elimine par le village</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BOTTOM STRIP — player avatars ═══ */}
      <AnimatePresence>
        {!isTransitioning && (
          <motion.div
            key="player-strip"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: PANEL_SLIDE, ease: [0.4, 0, 0.2, 1] }}
            className="absolute bottom-0 left-0 right-0 z-15"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)',
              paddingTop: isMobile ? '1.5rem' : '3.5rem',
            }}
          >
            <PlayerMarquee
              players={state.players}
              isNight={isNight}
              voteCounts={voteCounts}
              topVotedId={topVotedPlayer?.id ?? null}
              isVotePhase={isVotePhase}
              isVoteResult={isVoteResult}
              totalVotes={totalVotes}
              totalAlive={totalAlive}
              isMaireElection={isMaireElection}
              maireCandidates={state.maireCandidates ?? []}
              nominations={state.nominations ?? {}}
              maireId={state.maireId ?? null}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ WINNER OVERLAY ═══ */}
      <AnimatePresence>
        {state.winner && !winnerDismissed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className={`rounded-3xl ${isMobile ? 'p-6 mx-4' : 'p-14'} text-center`}
              style={{
                maxWidth: isMobile ? '340px' : '750px',
                background: isNight
                  ? 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(10,14,30,0.98))'
                  : 'linear-gradient(135deg, #f0e6d0, #e8dcc4)',
                border: isNight ? `${isMobile ? '2px' : '4px'} solid rgba(139,92,246,0.3)` : `${isMobile ? '3px' : '5px'} solid #8B7355`,
                boxShadow: isNight ? '0 0 120px rgba(139,92,246,0.25)' : '0 0 120px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: isMobile ? '3.5rem' : '7rem' }}>
                {state.winner === 'werewolf' ? '🐺' : state.winner === 'lovers' ? '💕' : '🏘️'}
              </span>
              <h2 className={isMobile ? 'mt-3' : 'mt-6'} style={{
                fontFamily: '"Cinzel Decorative", serif',
                color: state.winner === 'werewolf' ? '#c41e3a' : state.winner === 'lovers' ? (isNight ? '#ec4899' : '#c44a7a') : (isNight ? '#6b8e5a' : '#4a6e3a'),
                fontSize: isMobile ? '1.3rem' : '3.2rem',
              }}>
                {state.winner === 'werewolf' ? 'Les Loups-Garous ont gagne !' : state.winner === 'lovers' ? 'Les Amoureux triomphent !' : 'Le Village a gagne !'}
              </h2>
              <p style={{ color: isNight ? '#8090b0' : '#5a3e28', fontSize: isMobile ? '0.75rem' : '1.5rem', fontFamily: '"Cinzel", serif', marginTop: '0.8rem' }}>
                La partie est terminee.
              </p>
              <button
                onClick={() => setWinnerDismissed(true)}
                className={`${isMobile ? 'mt-4 px-6 py-2.5' : 'mt-8 px-10 py-4'} rounded-xl transition-all active:scale-95`}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontFamily: '"Cinzel", serif',
                  fontSize: isMobile ? '0.8rem' : '1.4rem',
                }}
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase transition cinematic overlay (day/night) */}
      <PhaseTransitionOverlay phase={state.phase} turn={state.turn} onTransitionChange={setIsTransitioning} />

      {/* ═══ FULLSCREEN TOGGLE BUTTON ═══ */}
      <button
        onClick={toggleFullscreen}
        className="absolute z-25 rounded-lg transition-all active:scale-90 hover:opacity-100 opacity-40"
        style={{
          bottom: isMobile ? '4.5rem' : '8rem',
          right: isMobile ? '0.5rem' : '1.5rem',
          padding: isMobile ? '6px' : '10px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          border: `1px solid rgba(255,255,255,0.1)`,
        }}
        title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
      >
        {isFullscreen
          ? <Minimize size={isMobile ? 14 : 20} style={{ color: isNight ? '#8090b0' : 'rgba(255,255,255,0.8)' }} />
          : <Maximize size={isMobile ? 14 : 20} style={{ color: isNight ? '#8090b0' : 'rgba(255,255,255,0.8)' }} />
        }
      </button>
    </div>
  );
});