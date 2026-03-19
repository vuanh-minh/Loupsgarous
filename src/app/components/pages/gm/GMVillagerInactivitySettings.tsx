import React from 'react';
import { Sun, DoorOpen } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMVillagerInactivitySettings — toggle on/off + stepper for the
   villager inactivity threshold (consecutive missed day votes
   before automatic elimination: "X a fui le village...").
   ================================================================ */

interface GMVillagerInactivitySettingsProps {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const ACCENT = '#c27a3a';
const ACCENT_BG = 'rgba(194,122,58,0.04)';
const ACCENT_BORDER = 'rgba(194,122,58,0.12)';

export const GMVillagerInactivitySettings = React.memo(function GMVillagerInactivitySettings({
  state, updateState, t, className = '',
}: GMVillagerInactivitySettingsProps) {
  const threshold = state.villagerInactivityThreshold ?? 2;
  const isEnabled = threshold > 0;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}` }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorOpen size={13} style={{ color: ACCENT }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: ACCENT, fontSize: '0.7rem' }}>
            Joueurs inactifs
          </span>
        </div>
        <button
          onClick={() =>
            updateState((s) => ({
              ...s,
              villagerInactivityThreshold: isEnabled ? 0 : 2,
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
          ? `Un joueur qui ne vote pas ${threshold} jour${threshold > 1 ? 's' : ''} consecutif${threshold > 1 ? 's' : ''} est elimine ("a fui le village").`
          : 'Les joueurs inactifs ne sont pas penalises.'}
      </p>

      {/* Stepper */}
      {isEnabled && (
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1">
            <Sun size={12} style={{ color: ACCENT }} />
            <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
              Tolerance
            </span>
          </div>
          <button
            onClick={() =>
              updateState((s) => ({
                ...s,
                villagerInactivityThreshold: Math.max(1, (s.villagerInactivityThreshold ?? 2) - 1),
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
                villagerInactivityThreshold: Math.min(5, (s.villagerInactivityThreshold ?? 2) + 1),
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
            jour{threshold > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
});
