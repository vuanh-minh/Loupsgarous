import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Skull, Sun, Crown, Shield, Star, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import type { PlayerScore } from '../data/scoring';
import { getRoleById } from '../data/roles';

/* ================================================================
   EndGameScoreboard — animated leaderboard shown at game end.
   Used by both GM and Player end-game overlays.
   ================================================================ */

const MEDAL_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'] as const; // gold, silver, bronze

interface EndGameScoreboardProps {
  scores: PlayerScore[];
  /** If provided, this player row is visually highlighted (player view) */
  highlightPlayerId?: number | null;
  compact?: boolean;
}

/* ── Bonus detail popover for a single player ── */
const BonusPopover = React.memo(function BonusPopover({
  score,
  open,
  onToggle,
}: {
  score: PlayerScore;
  open: boolean;
  onToggle: () => void;
}) {
  const bonusTotal = score.bonuses.reduce((s, b) => s + b.points, 0);
  return (
    <span className="relative text-center">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="w-full flex items-center justify-center gap-0.5 cursor-pointer"
        style={{ fontSize: '0.7rem', color: bonusTotal > 0 ? '#e0a040' : '#5a6488' }}
      >
        {bonusTotal > 0 ? `+${bonusTotal}` : '-'}
        {score.bonuses.length > 0 && (
          open ? <ChevronUp size={10} /> : <ChevronDown size={10} />
        )}
      </button>
      <AnimatePresence>
        {open && score.bonuses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-30 rounded-lg p-2 flex flex-col gap-1"
            style={{
              background: 'rgba(30,34,60,0.97)',
              border: '1px solid rgba(140,160,220,0.15)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              minWidth: '140px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {score.bonuses.map((b, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span style={{ fontSize: '0.55rem', color: '#9aa5c8' }}>
                  {b.emoji} {b.label}
                </span>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#e0a040' }}>
                  +{b.points}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
});

export const EndGameScoreboard = React.memo(function EndGameScoreboard({
  scores,
  highlightPlayerId,
  compact = false,
}: EndGameScoreboardProps) {
  const [openBonusId, setOpenBonusId] = useState<number | null>(null);

  if (scores.length === 0) return null;

  const gridCols = compact
    ? '1.6rem 1fr auto'
    : '1.6rem 1fr 4rem 3rem 3rem 3rem 3rem 3rem';

  return (
    <div className="w-full flex flex-col gap-1.5" onClick={() => setOpenBonusId(null)}>
      {/* Header row */}
      <div
        className="grid items-center px-3 py-1.5"
        style={{
          gridTemplateColumns: gridCols,
          color: '#7a88b5',
          fontSize: '0.55rem',
          fontFamily: '"Cinzel", serif',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}
      >
        <span>#</span>
        <span>Joueur</span>
        {!compact && (
          <>
            <span className="text-center">Victoire</span>
            <span className="text-center">Survie</span>
            <span className="text-center">Jours</span>
            <span className="text-center">Hypo.</span>
            <span className="text-center">Bonus</span>
          </>
        )}
        <span className="text-right">Total</span>
      </div>

      {/* Divider */}
      <div
        className="h-px mx-2"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,67,0.25), transparent)' }}
      />

      {/* Player rows */}
      {(() => {
        const ranks: number[] = [];
        scores.forEach((s, idx) => {
          ranks[idx] = idx === 0 ? 1 : (s.total === scores[idx - 1].total ? ranks[idx - 1] : ranks[idx - 1] + 1);
        });

        return scores.map((s, idx) => {
          const rank = ranks[idx];
          const isTop3 = rank <= 3;
          const medalColor = isTop3 ? MEDAL_COLORS[rank - 1] : undefined;
          const role = getRoleById(s.role);
          const isHighlighted = highlightPlayerId !== null && s.playerId === highlightPlayerId;

          return (
          <motion.div
            key={s.playerId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx, duration: 0.25 }}
            className="grid items-center px-3 py-2 rounded-lg"
            style={{
              gridTemplateColumns: gridCols,
              background: isHighlighted
                ? 'rgba(212,168,67,0.08)'
                : idx % 2 === 0
                  ? 'rgba(255,255,255,0.015)'
                  : 'transparent',
              border: isHighlighted ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent',
            }}
          >
            {/* Rank */}
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
              style={{
                background: isTop3 ? `${medalColor}15` : 'transparent',
                border: isTop3 ? `1px solid ${medalColor}30` : 'none',
                fontFamily: '"Cinzel", serif',
                fontSize: isTop3 ? '0.7rem' : '0.6rem',
                fontWeight: 700,
                color: isTop3 ? medalColor : '#5a6488',
              }}
            >
              {rank}
            </span>

            {/* Player info */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg shrink-0">{s.avatar}</span>
              <div className="min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: s.alive ? '#d0daf5' : '#6b7b9b',
                  }}
                >
                  {s.name}
                  {!s.alive && <Skull size={10} className="inline ml-1" style={{ color: '#5a6488' }} />}
                </p>
                <p style={{ fontSize: '0.5rem', color: role?.color ?? '#5a6488' }}>
                  {role?.emoji} {role?.name ?? s.role}
                </p>
              </div>
            </div>

            {/* Breakdown (full mode only) */}
            {!compact && (
              <>
                <span className="text-center" style={{ fontSize: '0.7rem', color: s.winnerPoints > 0 ? '#7ac462' : '#5a6488' }}>
                  {s.winnerPoints > 0 ? `+${s.winnerPoints}` : '-'}
                </span>
                <span className="text-center" style={{ fontSize: '0.7rem', color: s.alivePoints > 0 ? '#6bb8e0' : '#5a6488' }}>
                  {s.alivePoints > 0 ? `+${s.alivePoints}` : '-'}
                </span>
                <span className="text-center" style={{ fontSize: '0.7rem', color: s.dayPoints > 0 ? '#d4a843' : '#5a6488' }}>
                  {s.dayPoints > 0 ? `+${s.dayPoints}` : '-'}
                </span>
                {(() => {
                  const targetBonus = s.bonuses.find(b => b.emoji === '🧠');
                  const targetPoints = targetBonus?.points ?? 0;
                  return (
                    <span className="text-center" style={{ fontSize: '0.7rem', color: targetPoints > 0 ? '#a78bfa' : '#5a6488' }}>
                      {targetPoints > 0 ? `+${targetPoints}` : '-'}
                    </span>
                  );
                })()}
                <BonusPopover
                  score={s}
                  open={openBonusId === s.playerId}
                  onToggle={() => setOpenBonusId(prev => prev === s.playerId ? null : s.playerId)}
                />
              </>
            )}

            {/* Total */}
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.08 * idx + 0.2, type: 'spring', stiffness: 400, damping: 20 }}
              className="text-right font-bold"
              style={{
                fontSize: '0.85rem',
                color: isTop3 ? (medalColor ?? '#d0daf5') : '#d0daf5',
                fontFamily: '"Cinzel", serif',
                textShadow: rank === 1 ? '0 0 8px rgba(255,215,0,0.3)' : undefined,
              }}
            >
              {s.total}
            </motion.span>
          </motion.div>
        );
      });
      })()}

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-3 px-3 pt-2 mt-1"
        style={{
          borderTop: '1px solid rgba(140,160,220,0.08)',
          fontSize: '0.5rem',
          color: '#5a6488',
        }}
      >
        <span className="flex items-center gap-1">
          <Trophy size={9} style={{ color: '#d4a843' }} /> Victoire +10
        </span>
        <span className="flex items-center gap-1">
          <Shield size={9} style={{ color: '#6bb8e0' }} /> Survie +5
        </span>
        <span className="flex items-center gap-1">
          <Sun size={9} style={{ color: '#d4a843' }} /> Jour +0.5/j
        </span>
        <span className="flex items-center gap-1">
          <Brain size={9} style={{ color: '#a78bfa' }} /> Hypo. +2/+3
        </span>
        <span className="flex items-center gap-1">
          <Star size={9} style={{ color: '#e0a040' }} /> Bonus
        </span>
      </div>
    </div>
  );
});
