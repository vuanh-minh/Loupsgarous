import React from 'react';
import { Skull } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMWolfKillsStepper — shared ± stepper for wolf kills per night.
   Used in both desktop GMGameControls and mobile MobileControlsView.
   ================================================================ */

interface GMWolfKillsStepperProps {
  wolfKillsPerNight: number;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  /** Extra Tailwind classes on the wrapper (e.g. "mb-4" on desktop). */
  className?: string;
}

export const GMWolfKillsStepper = React.memo(function GMWolfKillsStepper({
  wolfKillsPerNight, updateState, t, className = '',
}: GMWolfKillsStepperProps) {
  const value = wolfKillsPerNight || 1;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'rgba(196,30,58,0.04)', border: '1px solid rgba(196,30,58,0.12)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skull size={13} style={{ color: '#c41e3a' }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.7rem' }}>
            Victimes des loups
          </span>
        </div>
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{
            background: 'rgba(196,30,58,0.1)',
            border: '1px solid rgba(196,30,58,0.2)',
            color: '#c41e3a',
            fontSize: '0.5rem',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
          }}
        >
          prochaine nuit
        </span>
      </div>

      <p style={{ color: t.textMuted, fontSize: '0.55rem', marginTop: '0.35rem', marginBottom: '0.6rem' }}>
        Nombre de joueurs que les loups peuvent eliminer cette nuit.
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => updateState((s) => ({ ...s, wolfKillsPerNight: Math.max(1, (s.wolfKillsPerNight || 1) - 1) }))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: '1px solid rgba(196,30,58,0.2)',
            color: value <= 1 ? t.textDim : '#c41e3a',
            fontFamily: '"Cinzel", serif',
            fontSize: '1rem',
            fontWeight: 700,
            opacity: value <= 1 ? 0.4 : 1,
          }}
          disabled={value <= 1}
        >
          −
        </button>
        <span
          className="w-10 text-center"
          style={{
            fontFamily: '"Cinzel", serif',
            color: '#c41e3a',
            fontSize: '1.1rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <button
          onClick={() => updateState((s) => ({ ...s, wolfKillsPerNight: Math.min(5, (s.wolfKillsPerNight || 1) + 1) }))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: '1px solid rgba(196,30,58,0.2)',
            color: value >= 5 ? t.textDim : '#c41e3a',
            fontFamily: '"Cinzel", serif',
            fontSize: '1rem',
            fontWeight: 700,
            opacity: value >= 5 ? 0.4 : 1,
          }}
          disabled={value >= 5}
        >
          +
        </button>
        <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif', marginLeft: '0.25rem' }}>
          {value === 1 ? 'victime' : 'victimes'}
        </span>
      </div>
    </div>
  );
});
