/**
 * VictimBanner.tsx
 * Shows last village-vote victim (at night) or night victims (at day).
 * Extracted from GamePanel.tsx.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { Player, GameEvent } from '../../../context/GameContext';
import { getRoleById } from '../../../data/roles';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface VictimBannerProps {
  isNight: boolean;
  isPracticeMode: boolean;
  phase: string;
  turn: number;
  events: GameEvent[];
  deadPlayers: Player[];
  t: GameThemeTokens;
}

export const VictimBanner = React.memo(function VictimBanner({
  isNight, isPracticeMode, phase, turn, events, deadPlayers, t,
}: VictimBannerProps) {
  // ── Night victims (shown at day) ──
  const nightVictims = (() => {
    if (isNight) return [] as Player[];
    return deadPlayers.filter((p) =>
      events.some(
        (e) =>
          e.turn === turn &&
          e.phase === 'night' &&
          e.message.includes(p.name) &&
          (e.message.includes('devore') ||
           e.message.includes('empoisonne') ||
           e.message.includes('meurt de chagrin') ||
           e.message.includes('Chasseur tire')),
      ),
    );
  })();

  const hasVictimBanner = nightVictims.length > 0;

  // Dismiss state — resets when phase or turn changes
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const bannerResetKey = `${phase}-${turn}`;
  const prevBannerResetRef = useRef(bannerResetKey);
  useEffect(() => {
    if (prevBannerResetRef.current !== bannerResetKey) {
      prevBannerResetRef.current = bannerResetKey;
      setBannerDismissed(false);
    }
  }, [bannerResetKey]);

  if (!hasVictimBanner || isPracticeMode || bannerDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, y: -8 }}
        animate={{ opacity: 1, height: 'auto', y: 0 }}
        exit={{ opacity: 0, height: 0, y: -8 }}
        transition={{ delay: 0.8, duration: 0.45, ease: 'easeOut' }}
        className="mb-3 overflow-hidden"
      >
        {nightVictims.length > 0 ? (
          null
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
});