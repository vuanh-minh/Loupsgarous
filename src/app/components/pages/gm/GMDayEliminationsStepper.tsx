import React from 'react';
import { Users } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMDayEliminationsStepper — ± stepper for the number of players
   eliminated during the day vote. Range: 1–3, default 1.
   ================================================================ */

interface GMDayEliminationsStepperProps {
  dayEliminationsCount: number;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

export const GMDayEliminationsStepper = React.memo(function GMDayEliminationsStepper({
  dayEliminationsCount, updateState, t, className = '',
}: GMDayEliminationsStepperProps) {
  const value = dayEliminationsCount || 1;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.12)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={13} style={{ color: '#d4a843' }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.7rem' }}>
            Eliminations du jour
          </span>
        </div>
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{
            background: 'rgba(212,168,67,0.1)',
            border: '1px solid rgba(212,168,67,0.2)',
            color: '#d4a843',
            fontSize: '0.5rem',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
          }}
        >
          prochain vote
        </span>
      </div>

      <p style={{ color: t.textMuted, fontSize: '0.55rem', marginTop: '0.35rem', marginBottom: '0.6rem' }}>
        Nombre de joueurs elimines par le vote du village chaque jour.
        {value > 1 && ' Les joueurs ayant le plus de votes seront elimines.'}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => updateState((s) => ({ ...s, dayEliminationsCount: Math.max(1, (s.dayEliminationsCount || 1) - 1) }))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: '1px solid rgba(212,168,67,0.2)',
            color: value <= 1 ? t.textDim : '#d4a843',
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
            color: '#d4a843',
            fontSize: '1.1rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <button
          onClick={() => updateState((s) => ({ ...s, dayEliminationsCount: Math.min(3, (s.dayEliminationsCount || 1) + 1) }))}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: '1px solid rgba(212,168,67,0.2)',
            color: value >= 3 ? t.textDim : '#d4a843',
            fontFamily: '"Cinzel", serif',
            fontSize: '1rem',
            fontWeight: 700,
            opacity: value >= 3 ? 0.4 : 1,
          }}
          disabled={value >= 3}
        >
          +
        </button>
        <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif', marginLeft: '0.25rem' }}>
          {value === 1 ? 'elimination' : 'eliminations'}
        </span>
      </div>
    </div>
  );
});
