import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { GameState } from '../../../../context/gameTypes';
import { loadPlayerTagScores } from './traqueStorage';

const TAG_ICONS: Record<string, string> = {
  'COLLÈGE / LYCÉE': '🏫',
  'ESIEE': '💻',
  'FAMILY & CO': '🏠',
  'THIGA & YOUSIGN': '🧳',
};

interface Props {
  state: GameState;
  selfPlayerId: number;
  onSelect: (tags: string[]) => void;
}

export function TraqueDifficultyPicker({ state, selfPlayerId, onSelect }: Props) {
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    state.players.forEach((p) => {
      (state.playerTags[p.id] ?? []).forEach((t) => tags.add(t));
    });
    return [...tags].sort();
  }, [state]);

  // Nombre total de joueurs éligibles (avec rôle, hors soi) par tag
  const tagTotals = useMemo(() => {
    const counts: Record<string, number> = {};
    state.players.forEach((p) => {
      if (p.id === selfPlayerId || !p.role) return;
      (state.playerTags[p.id] ?? []).forEach((t) => {
        counts[t] = (counts[t] ?? 0) + 1;
      });
    });
    return counts;
  }, [state, selfPlayerId]);

  // Scores de première tentative par tag (verrouillés)
  const tagScores = useMemo(
    () => loadPlayerTagScores(selfPlayerId),
    [selfPlayerId],
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{
        background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
      }}
    >
      <div className="w-full max-w-sm px-4 flex flex-col gap-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <p
            style={{
              fontFamily: '"Cinzel", serif',
              color: '#7a88b5',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '0.5rem',
            }}
          >
            Groupes
          </p>
          <h1
            style={{
              fontFamily: '"Cinzel Decorative", "Cinzel", serif',
              color: '#d0daf5',
              fontSize: '1.3rem',
              textAlign: 'center',
            }}
          >
            Qui veux-tu deviner ?
          </h1>
          <p style={{ color: '#4a5570', fontSize: '0.72rem', marginTop: '0.4rem', textAlign: 'center' }}>
            Choisis un groupe pour commencer
          </p>
        </motion.div>

        {/* Tags */}
        <div className="flex flex-col gap-3">
          {availableTags.map((tag, i) => {
            const total = tagTotals[tag] ?? 0;
            return (
              <motion.button
                key={tag}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.07 }}
                onClick={() => onSelect([tag])}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl active:scale-95 transition-transform"
                style={{
                  background: tagScores[tag] ? 'rgba(212,168,67,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${tagScores[tag] ? 'rgba(212,168,67,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 4,
                      height: 28,
                      borderRadius: 2,
                      background: tagScores[tag] ? '#d4a843' : 'rgba(212,168,67,0.3)',
                      flexShrink: 0,
                    }}
                  />
                  {TAG_ICONS[tag] && (
                    <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>{TAG_ICONS[tag]}</span>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span
                      style={{
                        fontFamily: '"Cinzel", serif',
                        color: tagScores[tag] ? '#d0daf5' : '#c8d2f0',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                    {tagScores[tag] && (
                      <span style={{ color: '#4a5570', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Complété
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      style={{
                        fontFamily: '"Cinzel", serif',
                        color: tagScores[tag] ? '#d4a843' : '#3a4870',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                      }}
                    >
                      {tagScores[tag]?.correct ?? 0}
                      <span style={{ color: tagScores[tag] ? 'rgba(212,168,67,0.4)' : '#2a3050', fontWeight: 400 }}>
                        /{total}
                      </span>
                    </span>
                    <span style={{ color: '#2a3050', fontSize: '0.56rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      trouvés
                    </span>
                  </div>
                  <ChevronRight size={15} style={{ color: '#3a4870', flexShrink: 0 }} />
                </div>
              </motion.button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
