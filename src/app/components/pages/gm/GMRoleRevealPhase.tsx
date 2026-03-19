import React from 'react';
import { motion } from 'motion/react';
import { Eye, Check, Moon, Crown } from 'lucide-react';
import { type Player, type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar } from './GMShared';

/* ================================================================
   Role Reveal Phase — shown when roleRevealDone === false
   Extracted from GMGamePanel.tsx
   ================================================================ */

interface GMRoleRevealPhaseProps {
  state: GameState;
  t: GameThemeTokens;
  navigate: (to: string) => void;
  handleStartNight1: () => void;
}

export const GMRoleRevealPhase = React.memo(function GMRoleRevealPhase({
  state,
  t,
  navigate,
  handleStartNight1,
}: GMRoleRevealPhaseProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.span
          className="text-6xl block mb-4"
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          🃏
        </motion.span>
        <h2 style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#d4a843', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          Decouverte des roles
        </h2>
        <p style={{ color: '#8090b0', fontSize: '0.8rem', maxWidth: '24rem', margin: '0 auto' }}>
          Les joueurs decouvrent leur role secret. Attendez que tout le monde ait consulte son role avant de lancer la premiere nuit.
        </p>
      </motion.div>

      {/* Player grid showing role-seen status */}
      <div className="w-full">
        {/* Progress counter */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <Eye size={14} style={{ color: '#d4a843' }} />
          <span style={{ color: '#8090b0', fontSize: '0.75rem' }}>
            <span style={{ color: (state.roleRevealedBy ?? []).length === state.players.length ? '#6b8e5a' : '#d4a843', fontWeight: 600 }}>
              {(state.roleRevealedBy ?? []).length}
            </span>
            {' / '}{state.players.length} ont vu leur role
          </span>
          {(state.roleRevealedBy ?? []).length === state.players.length && (
            <Check size={14} style={{ color: '#6b8e5a' }} />
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {state.players.map((p: Player) => {
            const hasSeen = (state.roleRevealedBy ?? []).includes(p.id);
            const compact = state.players.length > 16;
            const avatarSize = compact ? 'w-9 h-9' : 'w-12 h-12';
            const badgeSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
            const emojiSize = compact ? 'text-base' : 'text-xl';
            const nameWidth = compact ? 'max-w-[2.8rem]' : 'max-w-[3.5rem]';
            const nameFontSize = compact ? '0.5rem' : '0.55rem';
            return (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <div
                  className={`${avatarSize} rounded-full flex items-center justify-center relative cursor-pointer transition-transform hover:scale-110 active:scale-95`}
                  style={{
                    background: hasSeen ? 'rgba(107,142,90,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${hasSeen ? 'rgba(107,142,90,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                  onClick={() => {
                    sessionStorage.setItem('__gm_preview', '1');
                    navigate(`/player/${p.shortCode}`);
                  }}
                  title={`Voir la page de ${p.name}`}
                >
                  <GMAvatar player={p} size={emojiSize} />
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 ${badgeSize} rounded-full flex items-center justify-center`}
                    style={{
                      background: hasSeen ? '#6b8e5a' : '#4a5568',
                      border: '2px solid #0a0e1a',
                    }}
                  >
                    {hasSeen && <Check size={compact ? 6 : 8} style={{ color: '#fff' }} />}
                  </div>
                </div>
                <span style={{ color: hasSeen ? t.text : t.textDim, fontSize: nameFontSize, textAlign: 'center' }} className={`truncate ${nameWidth}`}>
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleStartNight1}
        className="flex items-center justify-center gap-3 py-4 px-10 rounded-xl transition-all"
        style={{
          background: 'linear-gradient(135deg, #d4a843, #b8860b)',
          color: '#0a0e1a',
          fontFamily: '"Cinzel", serif',
          fontSize: '1rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(212,168,67,0.3)',
        }}
      >
        {state.maireElectionDone ? <Moon size={18} /> : <Crown size={18} />}
        {state.maireElectionDone ? 'Lancer la Nuit 1' : 'Lancer l\'Election du Maire'}
      </motion.button>
    </div>
  );
});