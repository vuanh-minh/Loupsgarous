/**
 * JoinVillageScreen.tsx — Scenario B: the player has already seen their role
 * but hasn't joined the village yet (they were "away" when the game started).
 * Shows only their avatar + a "Rejoindre le village" CTA (role is NOT re-shown).
 */
import React from 'react';
import { motion } from 'motion/react';
import { Users } from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

interface JoinVillageScreenProps {
  currentPlayer: Player;
  onJoin: () => void;
  t: GameThemeTokens;
  gmBackButton: React.ReactNode;
  particlePositions: { left: number; top: number; duration: number; delay: number }[];
}

export function JoinVillageScreen({
  currentPlayer,
  onJoin,
  t,
  gmBackButton,
  particlePositions,
}: JoinVillageScreenProps) {
  const accentColor = t.gold;

  return (
    <div
      className="min-h-dvh max-w-md mx-auto flex flex-col items-center overflow-y-auto relative"
      style={{
        background: 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        paddingTop: 'max(calc(env(safe-area-inset-top, 20px) + 10px), 20px)',
        paddingBottom: 'max(calc(env(safe-area-inset-bottom, 20px) + 10px), 20px)',
      }}
    >
      {gmBackButton}

      {/* Spacer top */}
      <div className="flex-1" />

      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particlePositions.map((pp, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: `${t.gold}4d`,
              left: `${pp.left}%`,
              top: `${pp.top}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: pp.duration,
              repeat: Infinity,
              delay: pp.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-[300px] rounded-2xl p-6 flex flex-col items-center gap-4 relative z-10 mb-8"
        style={{
          background: `linear-gradient(135deg, ${accentColor}08 0%, #0d1025 50%, ${accentColor}05 100%)`,
          border: `2px solid ${accentColor}30`,
          boxShadow: `0 0 40px ${accentColor}15, inset 0 0 60px rgba(15,10,40,0.3)`,
        }}
      >
        {/* Decorative inner border */}
        <div
          className="absolute inset-3 rounded-xl pointer-events-none"
          style={{ border: `1px solid ${accentColor}15` }}
        />

        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
          style={{
            border: `2px solid ${accentColor}40`,
            boxShadow: `0 0 20px ${accentColor}20`,
          }}
        >
          <PAvatar player={currentPlayer} size="text-4xl" />
        </motion.div>

        {/* Player name */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: t.gold,
            fontSize: '1rem',
            textAlign: 'center',
          }}
        >
          {currentPlayer.name}
        </motion.h2>

        {/* Away notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full rounded-lg px-4 py-3"
          style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.15)',
          }}
        >
          <p style={{ color: '#f59e0b', fontSize: '0.6rem', textAlign: 'center', lineHeight: 1.6 }}>
            La partie a commence pendant votre absence.
            Rejoignez le village pour participer !
          </p>
        </motion.div>
      </motion.div>

      {/* Join button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onJoin}
        className="flex items-center justify-center gap-3 py-4 px-10 rounded-xl shrink-0 relative z-10"
        style={{
          background: `linear-gradient(135deg, ${t.gold}, #b8860b)`,
          color: '#0a0e1a',
          fontFamily: '"Cinzel", serif',
          fontSize: '0.95rem',
          fontWeight: 600,
          boxShadow: `0 4px 20px ${t.gold}4d`,
        }}
      >
        <Users size={18} />
        Rejoindre le village
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-3 relative z-10"
        style={{ color: t.textDim, fontSize: '0.55rem' }}
      >
        Vous serez ajoute aux joueurs actifs
      </motion.p>

      {/* Spacer bottom */}
      <div className="flex-1" />
    </div>
  );
}