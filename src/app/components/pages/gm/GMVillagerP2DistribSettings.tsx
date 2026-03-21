import React from 'react';
import { Home } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMVillagerP2DistribSettings — toggle to enable/disable automatic
   distribution of P2 villager clues at each phase transition.
   When disabled, the GM can still distribute manually.
   ================================================================ */

interface Props {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const ACCENT = '#8ba1c4';
const ACCENT_BG = 'rgba(139,161,196,0.04)';
const ACCENT_BORDER = 'rgba(139,161,196,0.12)';

export const GMVillagerP2DistribSettings = React.memo(function GMVillagerP2DistribSettings({
  state, updateState, t, className = '',
}: Props) {
  const isEnabled = state.villagerP2AutoDistrib !== false;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home size={13} style={{ color: ACCENT }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: ACCENT, fontSize: '0.7rem' }}>
            Indices Villageois auto
          </span>
        </div>
        <button
          onClick={() =>
            updateState((s) => ({ ...s, villagerP2AutoDistrib: !isEnabled }))
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
          ? 'Un indice P2 Villageois est distribué automatiquement à chaque changement de phase.'
          : 'Distribution automatique désactivée — le GM peut toujours distribuer manuellement.'}
      </p>
    </div>
  );
});
