import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { computeScores } from '../../../data/scoring';
import { EndGameScoreboard } from '../../EndGameScoreboard';

/* ================================================================
   End Game Overlay
   ================================================================ */
export function EndGameOverlay({ state, navigate, t, onDismiss, onRelaunch }: { state: GameState; navigate: (to: string) => void; t: GameThemeTokens; onDismiss: () => void; onRelaunch?: () => void }) {
  const isWerewolfWin = state.winner === 'werewolf' || state.winner === 'werewolves';
  const isLoversWin = state.winner === 'lovers';
  const bannerColor = isWerewolfWin ? '#c41e3a' : isLoversWin ? '#ec4899' : '#6b8e5a';
  const winnerTitle = isWerewolfWin
    ? 'Les Loups-Garous ont gagne !'
    : isLoversWin
      ? 'Les Amoureux ont gagne !'
      : 'Le Village a gagne !';
  const winnerEmoji = isWerewolfWin ? '\uD83D\uDC3A' : isLoversWin ? '\uD83D\uDC98' : '\uD83C\uDFE0';

  const scores = useMemo(() => computeScores(state), [state]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center px-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <div className="w-full max-w-2xl py-8 flex flex-col items-center">
        <motion.span
          className="text-6xl block mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{
            scale: { delay: 0.2, type: 'spring' },
            rotate: { delay: 0.2, duration: 0.6, ease: 'easeInOut' },
          }}
        >
          {winnerEmoji}
        </motion.span>
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: bannerColor,
            fontSize: '1.5rem',
          }}
        >
          {winnerTitle}
        </motion.h2>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{ color: '#8090b0', fontSize: '0.85rem', marginTop: '1rem' }}
        >
          La partie est terminee apres {state.turn} tour(s).
        </motion.p>

        {/* Scoreboard */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="w-full mt-6 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(34,38,64,0.85) 0%, rgba(23,26,50,0.9) 100%)',
            border: '1px solid rgba(140,160,220,0.12)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(140,160,220,0.08)' }}
          >
            <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.85rem', fontWeight: 700 }}>
              Classement
            </span>
          </div>
          <div className="px-1 py-2">
            <EndGameScoreboard scores={scores} />
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="flex flex-col gap-3 items-center mt-8 w-full"
        >
          {onRelaunch && (
            <button
              onClick={onRelaunch}
              className="flex items-center justify-center gap-2 py-3 px-8 rounded-xl w-full max-w-xs cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #d4a843, #b8860b)',
                color: '#fff',
                fontFamily: '"Cinzel", serif',
                boxShadow: '0 4px 15px rgba(212,168,67,0.35)',
              }}
            >
              <RotateCcw size={16} />
              Relancer la partie
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/master')}
              className="py-3 px-8 rounded-xl cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${bannerColor}, ${bannerColor}cc)`,
                color: '#fff',
                fontFamily: '"Cinzel", serif',
                boxShadow: `0 4px 15px ${bannerColor}40`,
              }}
            >
              Mes Parties
            </button>
            <button
              onClick={onDismiss}
              className="py-3 px-8 rounded-xl cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#6b7b9b',
                fontFamily: '"Cinzel", serif',
              }}
            >
              Retour
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}