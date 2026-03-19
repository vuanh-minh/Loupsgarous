import React from 'react';
import { Dices } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';

/* ================================================================
   GMRandomVoteSettings — toggle to enable/disable automatic
   random vote assignment for inactive players during day vote.
   When enabled (default), abstainers get a random vote assigned.
   When disabled, abstainers simply don't vote.
   ================================================================ */

interface GMRandomVoteSettingsProps {
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  className?: string;
}

const ACCENT = '#e67e22';
const ACCENT_BG = 'rgba(230,126,34,0.04)';
const ACCENT_BORDER = 'rgba(230,126,34,0.12)';

export const GMRandomVoteSettings = React.memo(function GMRandomVoteSettings({
  state, updateState, t, className = '',
}: GMRandomVoteSettingsProps) {
  const isEnabled = state.randomVoteIfInactive !== false;

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}` }}
    >
      {/* Header + toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dices size={13} style={{ color: ACCENT }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: ACCENT, fontSize: '0.7rem' }}>
            Vote aleatoire si inactif
          </span>
        </div>
        <button
          onClick={() =>
            updateState((s) => ({
              ...s,
              randomVoteIfInactive: !isEnabled,
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
          ? 'Les joueurs qui ne votent pas recoivent un vote aleatoire automatique.'
          : 'Les joueurs inactifs ne votent pas — seuls les votes explicites comptent.'}
      </p>
    </div>
  );
});
