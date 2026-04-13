import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { GameState } from '../../../../context/gameTypes';
import { loadPlayerTagScores } from './traqueStorage';
import { API_BASE, publicAnonKey } from '../../../../context/apiConfig';
import { AVATAR_GALLERY } from '../../../../data/avatarGallery';
import { PAvatar } from '../PAvatar';

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

  // Scores de première tentative du joueur courant par tag (localStorage)
  const localTagScores = useMemo(
    () => loadPlayerTagScores(selfPlayerId),
    [selfPlayerId],
  );

  // Scores de tous les joueurs par tag depuis le serveur
  // Structure: { [playerId]: { [tag]: { correct, total } } }
  const [allScores, setAllScores] = useState<Record<string, Record<string, { correct: number; total: number }>>>({});

  useEffect(() => {
    fetch(`${API_BASE}/gallery/scores`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.scores) setAllScores(json.scores);
      })
      .catch(() => {});
  }, []);

  // Scores du joueur courant : localStorage en priorité, serveur en fallback
  const tagScores = useMemo(() => {
    const serverMine = allScores[String(selfPlayerId)] ?? {};
    return { ...serverMine, ...localTagScores };
  }, [localTagScores, allScores, selfPlayerId]);

  // Par tag : liste des joueurs ayant un score, triée par correct desc
  const tagPlayers = useMemo(() => {
    const result: Record<string, Array<{ id: number; name: string; avatarUrl: string; correct: number; total: number }>> = {};
    for (const [pid, tagMap] of Object.entries(allScores)) {
      const ga = AVATAR_GALLERY.find((g) => g.id === Number(pid));
      for (const [tag, score] of Object.entries(tagMap)) {
        if (!result[tag]) result[tag] = [];
        result[tag].push({
          id: Number(pid),
          name: ga?.name ?? `#${pid}`,
          avatarUrl: ga?.url ?? '',
          correct: score.correct,
          total: score.total,
        });
      }
    }
    // Trier par score décroissant
    for (const tag of Object.keys(result)) {
      result[tag].sort((a, b) => b.correct - a.correct);
    }
    return result;
  }, [allScores]);

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
            const myScore = tagScores[tag];
            const players = tagPlayers[tag] ?? [];
            return (
              <motion.button
                key={tag}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.07 }}
                onClick={() => onSelect([tag])}
                className="w-full flex flex-col px-4 py-4 rounded-2xl active:scale-95 transition-transform"
                style={{
                  background: myScore ? 'rgba(212,168,67,0.05)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${myScore ? 'rgba(212,168,67,0.25)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                {/* Ligne principale */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: 4,
                        height: 28,
                        borderRadius: 2,
                        background: myScore ? '#d4a843' : 'rgba(212,168,67,0.3)',
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
                          color: myScore ? '#d0daf5' : '#c8d2f0',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </span>
                      {myScore && (
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
                          color: myScore ? '#d4a843' : '#3a4870',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                        }}
                      >
                        {myScore?.correct ?? 0}
                        <span style={{ color: myScore ? 'rgba(212,168,67,0.4)' : '#2a3050', fontWeight: 400 }}>
                          /{total}
                        </span>
                      </span>
                      <span style={{ color: '#2a3050', fontSize: '0.56rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        trouvés
                      </span>
                    </div>
                    <ChevronRight size={15} style={{ color: '#3a4870', flexShrink: 0 }} />
                  </div>
                </div>

                {/* Mini-leaderboard des autres joueurs */}
                {players.length > 0 && (
                  <div
                    className="flex flex-col gap-1 mt-3 pt-3 w-full"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {players.map((p, rank) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span style={{ fontFamily: '"Cinzel", serif', color: rank === 0 ? '#d4a843' : '#2a3050', fontSize: '0.6rem', fontWeight: 700, width: 10, flexShrink: 0 }}>
                          {rank + 1}
                        </span>
                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0" style={{ border: `1px solid ${p.id === selfPlayerId ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                          <PAvatar
                            player={{ id: p.id, name: p.name, avatar: '', avatarUrl: p.avatarUrl, shortCode: '', role: '', alive: true, votesReceived: 0 }}
                            size="text-xs"
                            style={{ width: 20, height: 20 }}
                          />
                        </div>
                        <span style={{ fontFamily: '"Cinzel", serif', color: p.id === selfPlayerId ? '#c8d2f0' : '#5a6888', fontSize: '0.7rem', fontWeight: p.id === selfPlayerId ? 600 : 400, flex: 1, textAlign: 'left' }}>
                          {p.name.split(' ')[0]}
                        </span>
                        <span style={{ fontFamily: '"Cinzel", serif', color: rank === 0 ? '#d4a843' : '#3a4870', fontSize: '0.7rem', fontWeight: 700 }}>
                          {p.correct}
                          <span style={{ color: '#2a3050', fontWeight: 400 }}>/{p.total}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
