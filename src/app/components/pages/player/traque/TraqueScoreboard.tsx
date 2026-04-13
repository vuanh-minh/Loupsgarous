import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, Home } from 'lucide-react';
import type { GameState, TraqueProgress } from '../../../../context/gameTypes';
import { getRoleById } from '../../../../data/roles';

interface Props {
  state: GameState;
  progress: TraqueProgress;
  onRestart: () => void;
  onHome: () => void;
}

export function TraqueScoreboard({ state, progress, onRestart, onHome }: Props) {
  const { camps, totalCorrect, totalCount } = useMemo(() => {
    const campMap: Record<string, { found: number; total: number; emoji: string; label: string; roles: string[] }> = {};
    let totalCorrect = 0;
    let totalCount = 0;

    progress.roleOrder.forEach((pid) => {
      const player = state.players.find((p) => p.id === pid);
      if (!player) return;
      const r = getRoleById(player.role);
      if (!r) return;

      const camp = r.team;
      if (!campMap[camp]) {
        campMap[camp] = {
          found: 0,
          total: 0,
          emoji: camp === 'werewolf' ? '🐺' : camp === 'solo' ? '🌟' : '🏘️',
          label: camp === 'werewolf' ? 'Loups-Garous' : camp === 'solo' ? 'Solo' : 'Village',
          roles: [],
        };
      }
      campMap[camp].total += 1;
      totalCount += 1;

      const ans = progress.answers[pid];
      if (ans?.correct) {
        campMap[camp].found += 1;
        totalCorrect += 1;
        if (!campMap[camp].roles.includes(r.emoji)) campMap[camp].roles.push(r.emoji);
      }
    });

    return { camps: Object.entries(campMap), totalCorrect, totalCount };
  }, [progress, state.players]);

  const pct = totalCount > 0 ? Math.round((totalCorrect / totalCount) * 100) : 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <div className="w-full max-w-md px-4 flex flex-col items-center">

        {/* Titre */}
        <motion.span
          className="text-5xl mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          🎉
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: '#d4a843',
            fontSize: '1.3rem',
            textAlign: 'center',
          }}
        >
          Traque terminée !
        </motion.h1>

        {/* Score global */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 280, damping: 20 }}
          className="w-full mt-6 rounded-2xl p-5 flex flex-col items-center"
          style={{
            background: 'linear-gradient(135deg, rgba(34,38,64,0.85) 0%, rgba(23,26,50,0.9) 100%)',
            border: '1px solid rgba(212,168,67,0.2)',
          }}
        >
          <span
            style={{
              fontFamily: '"Cinzel Decorative", "Cinzel", serif',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#d4a843',
              lineHeight: 1,
            }}
          >
            {totalCorrect} / {totalCount}
          </span>
          <span style={{ color: '#7a88b5', fontSize: '0.72rem', marginTop: '0.35rem' }}>
            bonnes réponses ({pct}%)
          </span>
        </motion.div>

        {/* Détail par camp */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full mt-4 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(34,38,64,0.5)',
            border: '1px solid rgba(140,160,220,0.1)',
          }}
        >
          {camps.map(([camp, s], i) => (
            <div
              key={camp}
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid rgba(140,160,220,0.08)' : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.emoji}</span>
                <div>
                  <p style={{ fontFamily: '"Cinzel", serif', color: '#d0daf5', fontSize: '0.8rem', fontWeight: 600 }}>
                    {s.label}
                  </p>
                  {s.roles.length > 0 && (
                    <p style={{ fontSize: '0.85rem', marginTop: 2 }}>{s.roles.join(' ')}</p>
                  )}
                </div>
              </div>
              <span
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: s.found === s.total ? '#7ac462' : s.found > 0 ? '#d4a843' : '#e06060',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                }}
              >
                {s.found} / {s.total}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="w-full flex flex-col gap-3 mt-6"
        >
          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 rounded-xl active:scale-95 transition-transform"
            style={{
              background: 'rgba(212,168,67,0.12)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: '#d4a843',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            <RotateCcw size={15} />
            Recommencer
          </button>

          <button
            onClick={onHome}
            className="flex items-center justify-center gap-2 py-3 rounded-xl active:scale-95 transition-transform"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#6b7b9b',
              fontSize: '0.78rem',
            }}
          >
            <Home size={14} />
            Retour
          </button>
        </motion.div>
      </div>
    </div>
  );
}
