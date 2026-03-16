import React from 'react';
import { motion } from 'motion/react';
import { Vote, Skull, Crown, Target, Eye, ChevronDown, Scroll } from 'lucide-react';
import { type Player } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { getRoleById } from '../../../data/roles';
import { GMAvatar } from './GMShared';
import { type VoteData } from './useGMGameLogic';

/* ================================================================
   GMVoteTracking — shared vote tracking display (desktop + mobile).
   Consumes pre-computed VoteData from computeVoteData().
   `compact` prop switches between desktop (full) and mobile (slim).
   ================================================================ */

interface GMVoteTrackingProps {
  voteData: VoteData;
  isNight: boolean;
  t: GameThemeTokens;
  compact?: boolean;
}

export const GMVoteTracking = React.memo(function GMVoteTracking({
  voteData, isNight, t, compact = false,
}: GMVoteTrackingProps) {
  const {
    totalAlive, totalVotes, ranking, voterDetails,
    maireVoteTargetId, maxCount, isVoteResult,
    eliminatedPlayer, eliminatedRole,
    eliminatedPlayers, eliminatedRoles,
  } = voteData;

  if (compact) {
    /* ── MOBILE (compact) ── */
    return (
      <div
        className="rounded-xl p-3"
        style={{
          background: isVoteResult ? 'rgba(196,30,58,0.04)' : 'rgba(212,168,67,0.03)',
          border: `1px solid ${isVoteResult ? 'rgba(196,30,58,0.15)' : 'rgba(212,168,67,0.12)'}`,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Vote size={12} style={{ color: isVoteResult ? '#c41e3a' : t.gold }} />
          <span style={{ fontFamily: '"Cinzel", serif', color: isVoteResult ? '#c41e3a' : t.gold, fontSize: '0.7rem' }}>
            {isVoteResult ? 'Resultat' : 'Vote en cours'}
          </span>
          <span className="ml-auto px-1.5 py-0.5 rounded-full" style={{ background: isVoteResult ? 'rgba(196,30,58,0.1)' : t.goldBg, color: isVoteResult ? '#c41e3a' : t.gold, fontSize: '0.5rem', fontFamily: '"Cinzel", serif' }}>
            {totalVotes}/{totalAlive}
          </span>
        </div>

        {isVoteResult && eliminatedPlayers.length > 0 && (
          <div className="space-y-2 mb-3">
            {eliminatedPlayers.map((ep, idx) => {
              const er = eliminatedRoles[idx];
              if (!ep || !er) return null;
              return (
                <div key={ep.id} className="rounded-lg p-3 text-center" style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.12), rgba(140,20,40,0.08))', border: '1px solid rgba(196,30,58,0.25)' }}>
                  <Skull size={18} style={{ color: '#c41e3a', margin: '0 auto' }} />
                  <p style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.8rem', marginTop: '0.25rem' }}>{ep.name}</p>
                  <span style={{ color: er.color, fontSize: '0.6rem' }}>{er.emoji} {er.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {!isVoteResult && (
          <div className="mb-3">
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}>
              <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #d4a843, #b8860b)' }} initial={{ width: 0 }} animate={{ width: `${totalAlive > 0 ? (totalVotes / totalAlive) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {ranking.length > 0 ? (
          <div className="space-y-1.5">
            {ranking.slice(0, 5).map((entry, idx) => {
              const p = entry.player;
              const isTop = idx === 0 && entry.count > 0;
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: isTop ? 'rgba(196,30,58,0.06)' : `rgba(${t.overlayChannel}, 0.02)`, border: `1px solid ${isTop ? 'rgba(196,30,58,0.15)' : `rgba(${t.overlayChannel}, 0.05)`}` }}>
                  <GMAvatar player={p} size="text-base" />
                  <span className="flex-1 flex items-center gap-1 truncate" style={{ color: isTop ? '#000000' : t.text, fontSize: '0.7rem' }}>
                    {p.name}
                    {maireVoteTargetId === p.id && (
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #d4a843, #b8922e)', boxShadow: '0 0 4px rgba(212,168,67,0.4)' }} title="Vote du Maire">
                        <Crown size={7} style={{ color: '#0a0e1a' }} />
                      </span>
                    )}
                  </span>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: isTop ? 'rgba(196,30,58,0.15)' : t.goldBg, color: isTop ? '#c41e3a' : t.gold, fontFamily: '"Cinzel", serif', fontSize: '0.7rem' }}>
                    {entry.count}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center py-3" style={{ color: t.textDim, fontSize: '0.65rem' }}>Aucun vote</p>
        )}
      </div>
    );
  }

  /* ── DESKTOP (full) ── */
  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: isVoteResult ? 'rgba(196,30,58,0.04)' : 'rgba(212,168,67,0.03)', border: `1px solid ${isVoteResult ? 'rgba(196,30,58,0.45)' : 'rgba(212,168,67,0.4)'}` }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Vote size={14} style={{ color: isVoteResult ? '#c41e3a' : t.gold }} />
        <span style={{ fontFamily: '"Cinzel", serif', color: isVoteResult ? '#c41e3a' : t.gold, fontSize: '0.8rem' }}>{isVoteResult ? 'Resultat du vote' : 'Vote en cours'}</span>
        <span className="ml-auto px-2 py-0.5 rounded-full" style={{ background: isVoteResult ? 'rgba(196,30,58,0.1)' : t.goldBg, border: `1px solid ${isVoteResult ? 'rgba(196,30,58,0.2)' : t.goldBorder}`, color: isVoteResult ? '#c41e3a' : t.gold, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>{totalVotes}/{totalAlive} votes</span>
      </div>

      {/* Eliminated result banner */}
      {isVoteResult && eliminatedPlayers.length > 0 && (
        <div className="space-y-3 mb-4">
          {eliminatedPlayers.map((ep, idx) => {
            const er = eliminatedRoles[idx];
            if (!ep || !er) return null;
            const epVotes = voteData.voteCounts[ep.id] || 0;
            return (
              <motion.div key={ep.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }} className="rounded-xl p-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.12), rgba(140,20,40,0.08))', border: '1px solid rgba(196,30,58,0.25)' }}>
                <Skull size={24} style={{ color: '#c41e3a', margin: '0 auto' }} />
                <p style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '0.95rem', marginTop: '0.5rem' }}>{ep.name} est elimine</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-xl">{er.emoji}</span>
                  <span style={{ color: er.color, fontFamily: '"Cinzel", serif', fontSize: '0.75rem' }}>{er.name}</span>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: er.team === 'werewolf' ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)', border: `1px solid ${er.team === 'werewolf' ? 'rgba(196,30,58,0.3)' : 'rgba(107,142,90,0.3)'}`, color: er.team === 'werewolf' ? '#c41e3a' : '#6b8e5a', fontSize: '0.5rem', fontFamily: '"Cinzel", serif', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
                    {er.team === 'village' ? 'Village' : 'Loup-Garou'}
                  </span>
                </div>
                <p style={{ color: '#8090b0', fontSize: '0.6rem', marginTop: '0.4rem' }}>Elimine avec {epVotes} vote(s)</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Tie — no elimination */}
      {isVoteResult && eliminatedPlayers.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-4 mb-4 text-center" style={{ background: 'rgba(107,123,155,0.06)', border: '1px solid rgba(107,123,155,0.15)' }}>
          <p style={{ fontFamily: '"Cinzel", serif', color: '#6b7b9b', fontSize: '0.85rem' }}>Egalite — aucune elimination</p>
        </motion.div>
      )}

      {/* Progress bar */}
      {!isVoteResult && (
        <div className="mb-4">
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #d4a843, #b8860b)' }} initial={{ width: 0 }} animate={{ width: `${totalAlive > 0 ? (totalVotes / totalAlive) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 ? (
        <div className="space-y-2">
          {ranking.map((entry, idx) => {
            const p = entry.player;
            const isTop = idx === 0 && entry.count > 0;
            const barWidth = maxCount > 0 ? (entry.count / maxCount) * 100 : 0;
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg relative overflow-hidden" style={{ background: isTop ? (isNight ? 'rgba(196,30,58,0.06)' : 'rgba(196,30,58,0.08)') : t.cardBg, border: `1px solid ${isTop ? (isNight ? 'rgba(196,30,58,0.15)' : 'rgba(196,30,58,0.3)') : t.cardBorder}` }}>
                <motion.div className="absolute inset-0 rounded-lg" style={{ background: isTop ? (isNight ? 'linear-gradient(90deg, rgba(196,30,58,0.08), transparent)' : 'linear-gradient(90deg, rgba(196,30,58,0.12), transparent)') : (isNight ? 'linear-gradient(90deg, rgba(212,168,67,0.05), transparent)' : 'linear-gradient(90deg, rgba(160,120,8,0.08), transparent)') }} initial={{ width: 0 }} animate={{ width: `${barWidth}%` }} transition={{ type: 'spring', stiffness: 100, damping: 20 }} />
                <div className="relative w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: isTop ? (isNight ? 'rgba(196,30,58,0.15)' : 'rgba(196,30,58,0.12)') : t.surfaceBg, border: `1px solid ${isTop ? (isNight ? 'rgba(196,30,58,0.3)' : 'rgba(196,30,58,0.35)') : t.surfaceBorder}` }}>
                  {isTop ? <Target size={11} style={{ color: '#c41e3a' }} /> : <span style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>{idx + 1}</span>}
                </div>
                <div className="relative flex items-center gap-2 flex-1 min-w-0">
                  <GMAvatar player={p} size="text-lg" />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1 truncate" style={{ color: isTop ? (isNight ? '#e8c8c8' : '#8b2030') : t.text, fontSize: '0.75rem', fontWeight: isTop ? 600 : undefined }}>
                      {p.name}
                      {maireVoteTargetId === p.id && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #d4a843, #b8922e)', boxShadow: '0 0 4px rgba(212,168,67,0.4)' }} title="Vote du Maire">
                          <Crown size={8} style={{ color: '#0a0e1a' }} />
                        </span>
                      )}
                    </span>
                    {isVoteResult && (() => { const role = getRoleById(p.role); return role ? <span style={{ color: role.color, fontSize: '0.55rem', opacity: 0.7 }}>{role.emoji} {role.name}</span> : null; })()}
                  </div>
                </div>
                <div className="relative px-2.5 py-1 rounded-full shrink-0" style={{ background: isTop ? (isNight ? 'rgba(196,30,58,0.15)' : 'rgba(196,30,58,0.1)') : t.goldBg, border: `1px solid ${isTop ? (isNight ? 'rgba(196,30,58,0.3)' : 'rgba(196,30,58,0.35)') : t.goldBorder}` }}>
                  <span style={{ fontFamily: '"Cinzel", serif', color: isTop ? '#c41e3a' : t.gold, fontSize: '0.75rem' }}>{entry.count}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4">
          <Vote size={20} style={{ color: '#4a5568', margin: '0 auto' }} />
          <p style={{ color: '#4a5568', fontSize: '0.7rem', marginTop: '0.5rem' }}>Aucun vote pour l'instant</p>
        </div>
      )}

      {/* Voter details accordion */}
      {voterDetails.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer flex items-center gap-1.5 py-2" style={{ color: '#6b7b9b', fontSize: '0.6rem', fontFamily: '"Cinzel", serif', listStyle: 'none' }}>
            <Eye size={11} />Detail des votes ({voterDetails.length})<ChevronDown size={11} className="ml-auto" />
          </summary>
          <div className="grid grid-cols-2 gap-1.5 mt-1 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {voterDetails.map(({ voter, target, isRandom, isMaire, isLastWill }) => (
              <div key={voter?.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: isLastWill ? 'rgba(139,92,246,0.08)' : isMaire ? 'rgba(212,168,67,0.08)' : isRandom ? 'rgba(230,126,34,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isLastWill ? 'rgba(139,92,246,0.2)' : isMaire ? 'rgba(212,168,67,0.2)' : isRandom ? 'rgba(230,126,34,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
                {voter ? <GMAvatar player={voter} size="text-xs" className="inline-block" /> : <span style={{ fontSize: '0.75rem' }}>???</span>}
                {isMaire && <Crown size={8} style={{ color: '#d4a843', flexShrink: 0 }} />}
                {isLastWill && <Scroll size={8} style={{ color: '#a78bfa', flexShrink: 0 }} title="Derniere volonte" />}
                {isRandom && <span style={{ fontSize: '0.55rem', lineHeight: 1 }} title="Vote aleatoire">&#127922;</span>}
                <span style={{ color: '#6b7b9b', fontSize: '0.5rem' }}>&rarr;</span>
                {target ? <GMAvatar player={target} size="text-xs" className="inline-block" /> : <span style={{ fontSize: '0.75rem' }}>???</span>}
                <span className="truncate" style={{ color: isLastWill ? '#a78bfa' : isRandom ? '#e67e22' : '#8090b0', fontSize: '0.5rem' }}>{target?.name}{isLastWill ? ' (volonte)' : ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
});