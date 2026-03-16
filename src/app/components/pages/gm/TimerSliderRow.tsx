import React from 'react';
import { type GameThemeTokens } from './gmSharedTypes';
import { TIMER_PRESETS } from './gmSharedConstants';
import { formatTime } from '../../PhaseTimer';

export function TimerSliderRow({
  icon,
  label,
  value,
  onChange,
  accentColor,
  accentBg,
  accentBorder,
  t,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (seconds: number) => void;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  t: GameThemeTokens;
}) {
  const displayLabel = label.replace(/-mobile$/, '');
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <span style={{ fontFamily: '"Cinzel", serif', color: accentColor, fontSize: '0.6rem', fontWeight: 600 }}>
          {displayLabel}
        </span>
        <span
          className="ml-auto px-1.5 py-0.5 rounded-full"
          style={{
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            color: accentColor,
            fontSize: '0.55rem',
            fontFamily: '"Cinzel", serif',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            minWidth: '3.2rem',
            textAlign: 'center',
          }}
        >
          {formatTime(value)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 w-full">
        {TIMER_PRESETS.map((preset) => {
          const isActive = value === preset.seconds;
          return (
            <button
              key={preset.seconds}
              onClick={() => onChange(preset.seconds)}
              className="flex-1 min-w-0 rounded-md transition-all cursor-pointer whitespace-nowrap"
              style={{
                padding: '4px 0',
                background: isActive ? accentColor : `rgba(${t.overlayChannel}, 0.04)`,
                border: `1px solid ${isActive ? accentColor : `rgba(${t.overlayChannel}, 0.1)`}`,
                color: isActive ? '#fff' : t.textMuted,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.55rem',
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? `0 1px 6px ${accentColor}40` : 'none',
              }}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
