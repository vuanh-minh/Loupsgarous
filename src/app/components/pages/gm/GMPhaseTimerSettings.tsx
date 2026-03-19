import React from 'react';
import { Sun, Moon, Timer, Crown } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { TimerSliderRow } from './GMShared';

/* ================================================================
   GMPhaseTimerSettings — shared toggle + day/night duration sliders.
   Used in both desktop GMGameControls and mobile MobileControlsView.
   ================================================================ */

interface GMPhaseTimerSettingsProps {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  /** Extra Tailwind classes on the wrapper (e.g. "mb-4" on desktop). */
  className?: string;
}

export const GMPhaseTimerSettings = React.memo(function GMPhaseTimerSettings({
  state, updateState, t, className = '',
}: GMPhaseTimerSettingsProps) {
  const isOn = state.phaseTimerDuration > 0;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={13} style={{ color: t.gold }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.7rem' }}>
            Chronomètre de phase
          </span>
        </div>
        <button
          onClick={() =>
            updateState((s) => ({
              ...s,
              phaseTimerDuration: isOn ? 0 : (s.phaseTimerDayDuration || 900),
              phaseTimerEndAt: isOn ? null : s.phaseTimerEndAt,
            }))
          }
          className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
          style={{
            background: isOn ? t.gold : `rgba(${t.overlayChannel}, 0.12)`,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: isOn ? '#fff' : `rgba(${t.overlayChannel}, 0.3)`,
              transform: isOn ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      {/* Sliders */}
      {isOn && (
        <div className="flex flex-col gap-3 mt-3">
          <TimerSliderRow
            icon={<Sun size={12} style={{ color: '#d4a843' }} />}
            label="Jour"
            value={state.phaseTimerDayDuration || 900}
            onChange={(v) => updateState((s) => ({ ...s, phaseTimerDayDuration: v }))}
            accentColor="#d4a843"
            accentBg="rgba(212,168,67,0.04)"
            accentBorder="rgba(212,168,67,0.12)"
            t={t}
          />
          <TimerSliderRow
            icon={<Moon size={12} style={{ color: '#7c8db5' }} />}
            label="Nuit"
            value={state.phaseTimerNightDuration || 900}
            onChange={(v) => updateState((s) => ({ ...s, phaseTimerNightDuration: v }))}
            accentColor="#7c8db5"
            accentBg="rgba(124,141,181,0.04)"
            accentBorder="rgba(124,141,181,0.12)"
            t={t}
          />
          <TimerSliderRow
            icon={<Crown size={12} style={{ color: '#a78bfa' }} />}
            label="Election du Maire"
            value={state.phaseTimerMaireDuration || state.phaseTimerDayDuration || 900}
            onChange={(v) => updateState((s) => ({ ...s, phaseTimerMaireDuration: v }))}
            accentColor="#a78bfa"
            accentBg="rgba(167,139,250,0.04)"
            accentBorder="rgba(167,139,250,0.12)"
            t={t}
          />
        </div>
      )}
    </div>
  );
});