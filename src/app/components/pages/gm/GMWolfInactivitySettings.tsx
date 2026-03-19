import React from 'react';
import { Moon, ShieldOff } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMWolfInactivitySettings — toggle on/off + stepper for the wolf
   inactivity threshold (consecutive missed votes before death).
   Used in both desktop GMGameControls and mobile MobileControlsView.
   ================================================================ */

interface GMWolfInactivitySettingsProps {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const ACCENT = '#7c8db5';
const ACCENT_BG = 'rgba(124,141,181,0.04)';
const ACCENT_BORDER = 'rgba(124,141,181,0.12)';

export const GMWolfInactivitySettings = React.memo(function GMWolfInactivitySettings({
  state, updateState, t, className = '',
}: GMWolfInactivitySettingsProps) {
  const threshold = state.wolfInactivityThreshold ?? 2;
  const isEnabled = threshold > 0;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}` }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldOff size={13} style={{ color: ACCENT }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: ACCENT, fontSize: '0.7rem' }}>
            Loups inactifs
          </span>
        </div>
        <button
          onClick={() =>
            updateState((s) => ({
              ...s,
              wolfInactivityThreshold: isEnabled ? 0 : 2,
            }))
          }
          className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
          style={{
            background: isEnabled ? ACCENT : `rgba(${t.overlayChannel}, 0.12)`,
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
            style={{
              background: isEnabled ? '#fff' : `rgba(${t.overlayChannel}, 0.3)`,
              transform: isEnabled ? 'translateX(20px)' : 'translateX(0)',
            }}
          />
        </button>
      </div>

      <p style={{ color: t.textMuted, fontSize: '0.55rem', marginTop: '0.35rem' }}>
        {isEnabled
          ? `Un loup qui ne vote pas ${threshold} nuit${threshold > 1 ? 's' : ''} consecutives est devore par les siens.`
          : 'Les loups inactifs ne sont pas penalises.'}
      </p>

      {/* Stepper */}
      {isEnabled && (
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1">
            <Moon size={12} style={{ color: ACCENT }} />
            <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
              Tolerance
            </span>
          </div>
          <button
            onClick={() =>
              updateState((s) => ({
                ...s,
                wolfInactivityThreshold: Math.max(1, (s.wolfInactivityThreshold ?? 2) - 1),
              }))
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              border: `1px solid ${ACCENT_BORDER}`,
              color: threshold <= 1 ? t.textDim : ACCENT,
              fontFamily: '"Cinzel", serif',
              fontSize: '1rem',
              fontWeight: 700,
              opacity: threshold <= 1 ? 0.4 : 1,
            }}
            disabled={threshold <= 1}
          >
            −
          </button>
          <span
            className="w-10 text-center"
            style={{
              fontFamily: '"Cinzel", serif',
              color: ACCENT,
              fontSize: '1.1rem',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {threshold}
          </span>
          <button
            onClick={() =>
              updateState((s) => ({
                ...s,
                wolfInactivityThreshold: Math.min(5, (s.wolfInactivityThreshold ?? 2) + 1),
              }))
            }
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{
              background: `rgba(${t.overlayChannel}, 0.04)`,
              border: `1px solid ${ACCENT_BORDER}`,
              color: threshold >= 5 ? t.textDim : ACCENT,
              fontFamily: '"Cinzel", serif',
              fontSize: '1rem',
              fontWeight: 700,
              opacity: threshold >= 5 ? 0.4 : 1,
            }}
            disabled={threshold >= 5}
          >
            +
          </button>
          <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif', marginLeft: '0.25rem' }}>
            nuit{threshold > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
});
