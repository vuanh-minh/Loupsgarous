import React from 'react';
import { type Player, type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { getRoleById } from '../../../data/roles';
import { PhaseTimerBar } from '../../PhaseTimer';
const dayVillageBg = '/assets/backgrounds/day-village.png';
const nightVillageBg = '/assets/backgrounds/night-village.png';

/* ================================================================
   GMPhaseBanner — shared phase header (desktop + mobile).
   Desktop: large centered banner with text shadows, no alive/dead badges.
   Mobile (compact): horizontal layout with alive/dead count badges.
   Includes the PhaseTimerBar when a timer is active.
   ================================================================ */

interface GMPhaseBannerProps {
  state: GameState;
  isNight: boolean;
  alivePlayers: Player[];
  t: GameThemeTokens;
  compact?: boolean;
  /** Extra Tailwind classes on the outermost wrapper. */
  className?: string;
}

/** Compute the phase title from game state. */
function getPhaseTitle(state: GameState, isNight: boolean): string {
  if (isNight) return `Nuit ${state.turn}`;
  if (!state.maireElectionDone && state.turn === 1 && state.roleRevealDone) return 'Election du Maire';
  return `Jour ${state.turn}`;
}

/** Compute the phase emoji from game state. */
function getPhaseEmoji(state: GameState, isNight: boolean, compact: boolean): string {
  if (isNight) return '🌙';
  if (compact && !state.maireElectionDone && state.turn === 1 && state.roleRevealDone) return '🏛️';
  return '☀️';
}

export const GMPhaseBanner = React.memo(function GMPhaseBanner({
  state, isNight, alivePlayers, t, compact = false, className = '',
}: GMPhaseBannerProps) {
  const title = getPhaseTitle(state, isNight);
  const emoji = getPhaseEmoji(state, isNight, compact);
  const deadCount = state.players.filter((p: Player) => !p.alive).length;
  const aliveWolvesCount = state.players.filter(
    (p: Player) => p.alive && getRoleById(p.role)?.team === 'werewolf'
  ).length;

  return (
    <div className={className}>
      {/* Banner card */}
      <div
        className={compact ? 'rounded-xl p-4 text-center relative overflow-hidden' : 'rounded-xl p-6 mb-6 text-center relative overflow-hidden'}
        style={{
          background: isNight
            ? 'linear-gradient(135deg, rgba(15,10,40,0.6), rgba(10,16,37,0.6))'
            : 'linear-gradient(135deg, rgba(50,40,20,0.3), rgba(35,30,15,0.3))',
          border: `1px solid ${isNight ? 'rgba(124,141,181,0.12)' : 'rgba(240,197,91,0.12)'}`,
        }}
      >
        {/* Pixel-art background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${isNight ? nightVillageBg : dayVillageBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center bottom',
            imageRendering: 'pixelated',
          }}
        />

        {compact ? (
          /* ── Mobile layout: horizontal emoji + title ── */
          <>
            <div className="relative flex items-center justify-center gap-3">
              <span className="text-2xl">{emoji}</span>
              <div>
                <h2
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: isNight ? '#7c8db5' : '#f0c55b',
                    fontSize: '0.95rem',
                  }}
                >
                  {title}
                </h2>
                <p
                  style={{
                    color: isNight ? 'rgba(124,141,181,0.55)' : 'rgba(240,197,91,0.55)',
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    marginTop: '0.1rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  🐺 {aliveWolvesCount} loup{aliveWolvesCount > 1 ? 's' : ''} restant{aliveWolvesCount > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {/* Alive / Dead badges */}
            <div className="relative flex items-center justify-center gap-3 mt-2">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full"
                style={{
                  color: isNight ? '#a8d89a' : '#e8f5e0',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isNight ? 'rgba(107,142,90,0.25)' : 'rgba(58,80,45,0.85)',
                  border: `1px solid ${isNight ? 'rgba(107,142,90,0.4)' : 'rgba(58,80,45,0.9)'}`,
                }}
              >
                {alivePlayers.length} vivants
              </span>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full"
                style={{
                  color: isNight ? '#f08090' : '#fde0e4',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: isNight ? 'rgba(196,30,58,0.25)' : 'rgba(140,20,40,0.85)',
                  border: `1px solid ${isNight ? 'rgba(196,30,58,0.4)' : 'rgba(140,20,40,0.9)'}`,
                }}
              >
                {deadCount} morts
              </span>
            </div>
          </>
        ) : (
          /* ── Desktop layout: stacked emoji + title ── */
          <div className="relative">
            <span className="text-4xl">{emoji}</span>
            <h2
              style={{
                fontFamily: '"Cinzel", serif',
                color: isNight ? '#c5d0e8' : '#f5d97a',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginTop: '0.5rem',
                textShadow: isNight
                  ? '0 1px 6px rgba(0,0,0,0.8), 0 0 12px rgba(124,141,181,0.4)'
                  : '0 1px 6px rgba(0,0,0,0.6), 0 0 12px rgba(240,197,91,0.35)',
                letterSpacing: '0.03em',
              }}
            >
              {title}
            </h2>
            <p
              style={{
                color: isNight ? 'rgba(124,141,181,0.55)' : 'rgba(240,197,91,0.55)',
                fontSize: '0.6rem',
                fontWeight: 600,
                marginTop: '0.1rem',
                letterSpacing: '0.04em',
              }}
            >
              🐺 {aliveWolvesCount} loup{aliveWolvesCount > 1 ? 's' : ''} restant{aliveWolvesCount > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Phase Timer Bar (shared, identical props) */}
      {(state.phaseTimerDuration > 0 || state.phaseTimerEndAt) && (
        <PhaseTimerBar
          endAt={state.phaseTimerEndAt}
          duration={
            isNight
              ? (state.phaseTimerNightDuration || state.phaseTimerDuration)
              : (state.phaseTimerDayDuration || state.phaseTimerDuration)
          }
          isNight={isNight}
          t={t}
        />
      )}
    </div>
  );
});