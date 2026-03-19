/**
 * LoverBanner.tsx
 * Shows Cupid lover pair notification for the current player.
 * Extracted from GamePanel.tsx.
 */
import React from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface LoverBannerProps {
  currentPlayerId: number | null;
  isPracticeMode: boolean;
  loverPairs: [number, number][];
  allPlayers: Player[];
  t: GameThemeTokens;
}

export const LoverBanner = React.memo(function LoverBanner({
  currentPlayerId, isPracticeMode, loverPairs, allPlayers, t,
}: LoverBannerProps) {
  if (currentPlayerId === null || isPracticeMode || loverPairs.length === 0) return null;

  const myPair = loverPairs.find(
    (pair) => pair[0] === currentPlayerId || pair[1] === currentPlayerId,
  );
  if (!myPair) return null;

  const loverId = myPair[0] === currentPlayerId ? myPair[1] : myPair[0];
  const lover = allPlayers.find((p) => p.id === loverId);
  if (!lover) return null;

  const loverAlive = lover.alive;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -6 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
      className="mt-3 overflow-hidden"
    >
      <div
        className="rounded-xl px-3.5 py-2.5 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(236,72,153,0.02))',
          border: '1px solid rgba(236,72,153,0.2)',
        }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
          style={{
            background: 'rgba(236,72,153,0.1)',
            border: '2px solid rgba(236,72,153,0.3)',
          }}
        >
          <PAvatar player={lover} size="text-base" className={loverAlive ? '' : 'grayscale'} />
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: '#ec4899', border: `2px solid ${t.dotBorderColor}` }}
          >
            <Heart size={8} style={{ color: 'white', fill: 'white' }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{
            color: '#ec4899', fontSize: '0.7rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
          }}>
            💘 Lie(e) avec {lover.name}
          </p>
          <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.15rem', lineHeight: 1.4 }}>
            {loverAlive
              ? 'Si l\'un meurt, l\'autre meurt de chagrin. Survivez ensemble !'
              : `💔 ${lover.name} a ete elimine...`}
          </p>
        </div>
        {loverAlive ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart size={16} style={{ color: '#ec4899', fill: '#ec4899' }} />
          </motion.div>
        ) : (
          <Heart size={16} style={{ color: '#6b7280', opacity: 0.4 }} />
        )}
      </div>
    </motion.div>
  );
});
