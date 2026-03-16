import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Trophy, X as XIcon } from 'lucide-react';
import type { GameState } from '../../../context/gameTypes';
import { getRoleById } from '../../../data/roles';
import { computeScores } from '../../../data/scoring';
import { EndGameScoreboard } from '../../EndGameScoreboard';

/* ================================================================
   Player End Game Overlay — shown when state.winner is set.
   Full-screen overlay with winner announcement + scoreboard.
   Rendered via portal to escape parent transforms.
   ================================================================ */

interface PlayerEndGameOverlayProps {
  state: GameState;
  currentPlayerId: number | null;
  onDismiss: () => void;
  navigate: (to: string) => void;
}

export const PlayerEndGameOverlay = React.memo(function PlayerEndGameOverlay({
  state,
  currentPlayerId,
  onDismiss,
  navigate,
}: PlayerEndGameOverlayProps) {
  const [dismissed, setDismissed] = useState(false);
  const scores = useMemo(() => computeScores(state), [state]);

  const isWerewolfWin = state.winner === 'werewolves' || state.winner === 'werewolf';
  const isLoversWin = state.winner === 'lovers';
  const bannerColor = isWerewolfWin ? '#c41e3a' : isLoversWin ? '#ec4899' : '#6b8e5a';

  const winnerTitle = isWerewolfWin
    ? 'Les Loups-Garous ont gagne !'
    : isLoversWin
      ? 'Les Amoureux ont gagne !'
      : 'Le Village a gagne !';
  const winnerEmoji = isWerewolfWin ? '\uD83D\uDC3A' : isLoversWin ? '\uD83D\uDC98' : '\uD83C\uDFE0';

  // Current player score
  const myScore = scores.find(s => s.playerId === currentPlayerId);
  const myRank = (() => {
    const ranks: number[] = [];
    scores.forEach((s, idx) => {
      ranks[idx] = idx === 0 ? 1 : (s.total === scores[idx - 1].total ? ranks[idx - 1] : ranks[idx - 1] + 1);
    });
    const idx = scores.findIndex(s => s.playerId === currentPlayerId);
    return idx >= 0 ? ranks[idx] : scores.length;
  })();

  if (dismissed) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,12,30,0.98) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform z-10"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#8090b0',
        }}
      >
        <XIcon size={16} />
      </button>

      <div className="w-full max-w-md px-4 pb-10 flex flex-col items-center" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)' }}>

        {/* Winner announcement */}
        <motion.span
          className="text-5xl block mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{
            scale: { delay: 0.15, type: 'spring', stiffness: 300, damping: 15 },
            rotate: { delay: 0.15, duration: 0.6 },
          }}
        >
          {winnerEmoji}
        </motion.span>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-center"
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: bannerColor,
            fontSize: '1.25rem',
            lineHeight: 1.3,
          }}
        >
          {winnerTitle}
        </motion.h2>

        <motion.p
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ color: '#6b7b9b', fontSize: '0.78rem', marginTop: '0.6rem' }}
        >
          Partie terminee apres {state.turn} tour(s)
        </motion.p>

        {/* Personal score card */}
        {myScore && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.65, type: 'spring', stiffness: 300, damping: 22 }}
            className="w-full mt-5 rounded-2xl p-4"
            style={{
              background: myScore.isWinner
                ? 'linear-gradient(135deg, rgba(107,142,90,0.15) 0%, rgba(107,142,90,0.05) 100%)'
                : 'linear-gradient(135deg, rgba(196,30,58,0.1) 0%, rgba(196,30,58,0.03) 100%)',
              border: `1px solid ${myScore.isWinner ? 'rgba(107,142,90,0.25)' : 'rgba(196,30,58,0.2)'}`,
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center shrink-0">
                <span className="text-3xl leading-none">{myScore.avatar}</span>
                <span
                  className="mt-1 px-2 py-0.5 rounded-full"
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    fontFamily: '"Cinzel", serif',
                    color: myScore.isWinner ? '#7ac462' : '#e06060',
                    background: myScore.isWinner ? 'rgba(122,196,98,0.12)' : 'rgba(224,96,96,0.12)',
                  }}
                >
                  {myScore.isWinner ? 'Victoire' : 'Defaite'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: '#d0daf5',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                  }}
                >
                  {myScore.name}
                </p>
                <p style={{ color: getRoleById(myScore.role)?.color ?? '#7a88b5', fontSize: '0.68rem', marginTop: 2 }}>
                  {getRoleById(myScore.role)?.emoji} {getRoleById(myScore.role)?.name ?? myScore.role}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span style={{ color: '#7ac462', fontSize: '0.62rem' }}>
                    Victoire {myScore.winnerPoints > 0 ? `+${myScore.winnerPoints}` : '-'}
                  </span>
                  <span style={{ color: '#6bb8e0', fontSize: '0.62rem' }}>
                    Survie {myScore.alivePoints > 0 ? `+${myScore.alivePoints}` : '-'}
                  </span>
                  <span style={{ color: '#d4a843', fontSize: '0.62rem' }}>
                    Jours +{myScore.dayPoints}
                  </span>
                  {myScore.bonusPoints > 0 && (
                    <span style={{ color: '#e0a040', fontSize: '0.62rem' }}>
                      Bonus +{myScore.bonusPoints}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <span
                  style={{
                    fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#d4a843',
                    lineHeight: 1,
                    textShadow: '0 0 12px rgba(212,168,67,0.3)',
                  }}
                >
                  {myScore.total}
                </span>
                <span style={{ fontSize: '0.5rem', color: '#7a88b5', fontFamily: '"Cinzel", serif', marginTop: 2 }}>
                  #{myRank} / {scores.length}
                </span>
              </div>
            </div>

            {/* Bonus detail chips */}
            {myScore.bonuses.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 mt-3 pt-3"
                style={{ borderTop: '1px solid rgba(140,160,220,0.1)' }}
              >
                {myScore.bonuses.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      fontSize: '0.55rem',
                      background: 'rgba(224,160,64,0.1)',
                      border: '1px solid rgba(224,160,64,0.2)',
                      color: '#e0a040',
                    }}
                  >
                    <span>{b.emoji}</span>
                    <span>{b.label}</span>
                    <span style={{ fontWeight: 700 }}>+{b.points}</span>
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Full scoreboard */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="w-full mt-5 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(34,38,64,0.8) 0%, rgba(23,26,50,0.85) 100%)',
            border: '1px solid rgba(140,160,220,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: '1px solid rgba(140,160,220,0.08)' }}
          >
            <Trophy size={14} style={{ color: '#d4a843' }} />
            <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.8rem', fontWeight: 700 }}>
              Classement
            </span>
          </div>
          <div className="px-1 py-2">
            <EndGameScoreboard scores={scores} highlightPlayerId={currentPlayerId} compact />
          </div>
        </motion.div>

        {/* Home button */}
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.0 }}
          onClick={() => navigate('/')}
          className="mt-6 py-3 px-8 rounded-xl active:scale-95 transition-transform"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8090b0',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.82rem',
          }}
        >
          Retour a l'accueil
        </motion.button>
      </div>
    </motion.div>,
    document.body
  );
});