import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Target } from 'lucide-react';
import type { GameState } from '../../../../context/gameTypes';
import { PAvatar } from '../PAvatar';
import { API_BASE, publicAnonKey } from '../../../../context/apiConfig';
import { loadAllPlayersLeaderboard } from './traqueStorage';

interface Props {
  state: GameState;
  onSelect: (playerId: number) => void;
}

export function TraqueSelfPicker({ state, onSelect }: Props) {
  // Regrouper les joueurs par tags
  const groups = useMemo(() => {
    const byTag: Record<string, typeof state.players> = {};
    state.players.forEach((p) => {
      const tags = state.playerTags[p.id];
      const tagList = tags && tags.length > 0 ? tags : ['Sans tag'];
      tagList.forEach((t) => {
        if (!byTag[t]) byTag[t] = [];
        byTag[t].push(p);
      });
    });
    return Object.entries(byTag);
  }, [state.players, state.playerTags]);

  // Scores de tous les joueurs : { [selfPlayerId]: { correct, total } }
  const [playerScores, setPlayerScores] = useState<Record<number, { correct: number; total: number }>>(() => {
    // Initialisation depuis localStorage
    const scores: Record<number, { correct: number; total: number }> = {};
    loadAllPlayersLeaderboard().forEach((s) => {
      scores[s.selfPlayerId] = { correct: s.totalCorrect, total: s.totalPlayers };
    });
    return scores;
  });

  useEffect(() => {
    fetch(`${API_BASE}/gallery/scores`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (!json?.scores) return;
        const scores: Record<number, { correct: number; total: number }> = {};
        (Object.entries(json.scores) as Array<[string, Record<string, { correct: number; total: number }>]>)
          .forEach(([pid, tagScores]) => {
            const id = Number(pid);
            const correct = Object.values(tagScores).reduce((s, v) => s + (v.correct ?? 0), 0);
            const total = Object.values(tagScores).reduce((s, v) => s + (v.total ?? 0), 0);
            scores[id] = { correct, total };
          });
        setPlayerScores(scores);
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <div className="w-full max-w-md px-4 flex flex-col items-center">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.25)' }}
          >
            <Target size={24} style={{ color: '#d4a843' }} />
          </span>
          <h1
            style={{
              fontFamily: '"Cinzel Decorative", "Cinzel", serif',
              color: '#d4a843',
              fontSize: '1.4rem',
              textAlign: 'center',
            }}
          >
            La Traque
          </h1>
          <p style={{ color: '#6b7b9b', fontSize: '0.82rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Qui es-tu dans cette partie ?
          </p>
        </motion.div>

        {/* Groupes de joueurs */}
        {groups.map(([tag, players], gi) => (
          <motion.div
            key={tag}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + gi * 0.06 }}
            className="w-full mb-5"
          >
            <p
              className="mb-2 px-1"
              style={{
                fontFamily: '"Cinzel", serif',
                color: '#7a88b5',
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {tag}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {players.map((player) => {
                const score = playerScores[player.id];
                const hasPlayed = !!score;
                return (
                  <button
                    key={player.id}
                    onClick={() => onSelect(player.id)}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl active:scale-95 transition-transform"
                    style={{
                      background: hasPlayed ? 'rgba(80,180,80,0.07)' : 'rgba(34,38,64,0.7)',
                      border: hasPlayed ? '1px solid rgba(80,180,80,0.3)' : '1px solid rgba(140,160,220,0.12)',
                    }}
                  >
                    {/* Avatar + badge score */}
                    <div className="relative">
                      <div
                        className="rounded-full overflow-hidden"
                        style={{
                          width: 44,
                          height: 44,
                          flexShrink: 0,
                          outline: hasPlayed ? '2px solid #4db84d' : 'none',
                          outlineOffset: 1,
                        }}
                      >
                        <PAvatar player={player} size="text-lg" style={{ width: 44, height: 44 }} />
                      </div>
                      {hasPlayed && (
                        <span
                          className="absolute flex items-center justify-center"
                          style={{
                            top: -4,
                            right: -6,
                            background: '#2a7a2a',
                            border: '1.5px solid #4db84d',
                            borderRadius: 6,
                            color: '#a8f0a8',
                            fontFamily: '"Cinzel", serif',
                            fontSize: '0.5rem',
                            fontWeight: 700,
                            lineHeight: 1,
                            padding: '1px 3px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {score.correct}/{score.total}
                        </span>
                      )}
                    </div>
                    <span
                      className="text-center leading-tight"
                      style={{
                        fontFamily: '"Cinzel", serif',
                        color: hasPlayed ? '#a8f0a8' : '#d0daf5',
                        fontSize: '0.55rem',
                        fontWeight: 600,
                        wordBreak: 'break-word',
                        maxWidth: '100%',
                      }}
                    >
                      {player.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
