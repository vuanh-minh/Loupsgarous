import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollText, ChevronDown, ChevronUp, ArrowDown } from 'lucide-react';
import { type Player, type GameState, type GameEvent } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar, SectionHeader } from './GMShared';

/* ================================================================
   GM Event Log — Card-based journal grouped by day
   ================================================================ */
type GMEventType = 'separator' | 'sunrise' | 'nightfall' | 'death' | 'vote' | 'revive' | 'guard' | 'abstention' | 'action';

function classifyGMEvent(message: string): GMEventType {
  if (message.startsWith('---')) return 'separator';
  if (message.includes('Le village se reveille')) return 'sunrise';
  if (message.includes("Le village s'endort") || message.includes('Tous les roles agissent')) return 'nightfall';
  if (message.startsWith('[Abstention]')) return 'abstention';
  if (message.includes('elimine par le village') || message.includes('egalite des votes')) return 'vote';
  if (message.includes('ressuscite')) return 'revive';
  if (message.includes('Quelque chose a interfere')) return 'guard';
  if (
    message.includes('devore') ||
    message.includes('empoisonne') ||
    message.includes('meurt de chagrin') ||
    message.includes('tire sur')
  )
    return 'death';
  return 'action';
}

function getGMEventDisplay(type: GMEventType, phase: string, t: GameThemeTokens) {
  switch (type) {
    case 'sunrise': return { icon: '☀️', color: '#f0c55b' };
    case 'nightfall': return { icon: '🌙', color: '#7c8db5' };
    case 'death': return { icon: '💀', color: '#c41e3a' };
    case 'vote': return { icon: '🗳️', color: t.gold };
    case 'revive': return { icon: '✨', color: '#6b8e5a' };
    case 'guard': return { icon: '🛡️', color: '#3b82f6' };
    case 'abstention': return { icon: '🎲', color: '#e67e22' };
    case 'action': return { icon: phase === 'night' ? '🌙' : '☀️', color: t.textSecondary };
    default: return { icon: '📜', color: t.textMuted };
  }
}

export function GMEventLog({ state, isMobile, t }: { state: GameState; isMobile: boolean; t: GameThemeTokens }) {
  const [expandedVoteTurn, setExpandedVoteTurn] = useState<number | null>(null);
  const [expandedAbstentionTurn, setExpandedAbstentionTurn] = useState<number | null>(null);

  // Group events by turn
  const eventsByTurn: Record<number, GameEvent[]> = {};
  state.events.forEach((ev: GameEvent) => {
    if (!eventsByTurn[ev.turn]) eventsByTurn[ev.turn] = [];
    eventsByTurn[ev.turn].push(ev);
  });

  const turnNumbers = Object.keys(eventsByTurn)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className={isMobile ? 'px-3 py-3' : 'p-4'}>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader icon={<ScrollText size={14} />} title="Journal" t={t} />
        <span style={{ color: t.textDim, fontSize: '0.65rem' }}>
          {state.events.length} evt.
        </span>
      </div>

      {turnNumbers.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <ArrowDown size={9} style={{ color: t.textDim }} />
          <span style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic' }}>
            Plus recent → plus ancien
          </span>
        </div>
      )}
      {turnNumbers.length === 0 ? (
        <p style={{ color: t.textDim, fontSize: '0.7rem', textAlign: 'center', padding: '2rem 0' }}>
          Aucun evenement.
        </p>
      ) : (
        turnNumbers.map((turnNum) => {
          const turnEvents = eventsByTurn[turnNum].filter(
            (ev: GameEvent) => classifyGMEvent(ev.message) !== 'separator'
          );
          if (turnEvents.length === 0) return null;

          const isCurrentTurn = turnNum === state.turn;
          const voteRecord = state.voteHistory?.find((v: { turn: number }) => v.turn === turnNum);
          const isVoteExpanded = expandedVoteTurn === turnNum;
          const isAbstentionExpanded = expandedAbstentionTurn === turnNum;

          // Split by phase
          const dayEvents = turnEvents.filter((ev: GameEvent) => ev.phase === 'day');
          const nightEvents = turnEvents.filter((ev: GameEvent) => ev.phase === 'night');

          // Day: separate abstentions from regular
          const dayAbstentions = dayEvents.filter((ev: GameEvent) => classifyGMEvent(ev.message) === 'abstention');
          const dayRegular = dayEvents.filter((ev: GameEvent) => classifyGMEvent(ev.message) !== 'abstention').slice().reverse();
          const nightRegular = nightEvents.filter((ev: GameEvent) => classifyGMEvent(ev.message) !== 'abstention').slice().reverse();

          // Render a single event card
          const renderEventCard = (ev: GameEvent, evIdx: number) => {
            const evType = classifyGMEvent(ev.message);
            const display = getGMEventDisplay(evType, ev.phase, t);
            const isVote = evType === 'vote';
            const hasVoteData = isVote && voteRecord && Object.keys(voteRecord.votes).length > 0;
            return (
              <div key={`${ev.turn}-${ev.id}-${evIdx}`}>
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg ${isVote && hasVoteData ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (isVote && hasVoteData) setExpandedVoteTurn(isVoteExpanded ? null : turnNum); }}
                  style={{
                    background: evType === 'death' ? 'rgba(196,30,58,0.05)' : evType === 'vote' ? 'rgba(212,168,67,0.05)' : evType === 'revive' ? 'rgba(107,142,90,0.06)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${evType === 'death' ? 'rgba(196,30,58,0.1)' : evType === 'vote' ? 'rgba(212,168,67,0.1)' : evType === 'revive' ? 'rgba(107,142,90,0.12)' : 'transparent'}`,
                  }}
                >
                  <span style={{ fontSize: '0.6rem', flexShrink: 0, marginTop: '0.15rem' }}>{display.icon}</span>
                  <p style={{ color: display.color, fontSize: '0.65rem', lineHeight: 1.4, flex: 1 }}>{ev.message}</p>
                  {isVote && hasVoteData && (
                    <span className="shrink-0 ml-1">
                      {isVoteExpanded ? <ChevronUp size={12} style={{ color: t.gold }} /> : <ChevronDown size={12} style={{ color: t.gold }} />}
                    </span>
                  )}
                </div>
                <AnimatePresence>
                  {isVote && hasVoteData && isVoteExpanded && voteRecord && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="mt-1 rounded-lg p-2 space-y-1.5 ml-5" style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.1)' }}>
                        {(() => {
                          const votesByTarget: Record<number, number[]> = {};
                          Object.entries(voteRecord.votes).forEach(([voterId, targetId]: [string, number]) => { if (!votesByTarget[targetId]) votesByTarget[targetId] = []; votesByTarget[targetId].push(parseInt(voterId)); });
                          const turnAbstainerIds = new Set(
                            state.events
                              .filter((ev: GameEvent) => ev.turn === turnNum && ev.phase === 'day' && ev.message.startsWith('[Abstention]'))
                              .map((ev: GameEvent) => {
                                const match = ev.message.match(/\[Abstention\] (.+?) n'a pas vote/);
                                if (!match) return null;
                                const player = state.players.find((p: Player) => p.name === match[1]);
                                return player?.id ?? null;
                              })
                              .filter((id: number | null) => id !== null),
                          );
                          return Object.entries(votesByTarget).sort(([, a], [, b]) => b.length - a.length).map(([targetIdStr, voterIds]) => {
                            const targetId = parseInt(targetIdStr);
                            const target = state.players.find((p: Player) => p.id === targetId);
                            const isElim = voteRecord.eliminated === targetId;
                            return (
                              <div key={targetId}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {target ? <GMAvatar player={target} size="text-xs" className="inline-block" /> : <span className="text-xs">❓</span>}
                                  <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.6rem', color: isElim ? '#c41e3a' : '#8090b0' }}>{target?.name || `Joueur ${targetId}`}</span>
                                  <span className="ml-auto px-1 py-0.5 rounded-full" style={{ fontSize: '0.5rem', background: isElim ? 'rgba(196,30,58,0.12)' : 'rgba(255,255,255,0.04)', color: isElim ? '#c41e3a' : '#6b7b9b' }}>{voterIds.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-0.5 pl-4">
                                  {voterIds.map((vid) => { const voter = state.players.find((p: Player) => p.id === vid); const isRandom = turnAbstainerIds.has(vid); return (<span key={vid} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded" style={{ background: isRandom ? 'rgba(230,126,34,0.08)' : 'rgba(255,255,255,0.03)', border: isRandom ? '1px solid rgba(230,126,34,0.15)' : '1px solid transparent', fontSize: '0.5rem', color: isRandom ? '#e67e22' : '#6b7b9b' }}>{voter ? <GMAvatar player={voter} size="text-xs" className="inline-block align-middle mr-0.5" /> : <span style={{ fontSize: '0.75rem' }}>❓</span>}{isRandom && <span style={{ fontSize: '0.5rem' }} title="Vote aléatoire">🎲</span>}{voter?.name || `J${vid}`}</span>); })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          };

          // Abstention collapsible
          const abstentionBlock = dayAbstentions.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" onClick={() => setExpandedAbstentionTurn(isAbstentionExpanded ? null : turnNum)} style={{ background: 'rgba(230,126,34,0.05)', border: '1px solid rgba(230,126,34,0.1)' }}>
                <span style={{ fontSize: '0.6rem', flexShrink: 0 }}>🎲</span>
                <p style={{ color: '#e67e22', fontSize: '0.65rem', lineHeight: 1.4, flex: 1, fontFamily: '"Cinzel", serif' }}>Abstentions</p>
                <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: '0.5rem', background: 'rgba(230,126,34,0.12)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.2)', fontFamily: '"Cinzel", serif' }}>{dayAbstentions.length}</span>
                <span className="shrink-0 ml-0.5">{isAbstentionExpanded ? <ChevronUp size={12} style={{ color: '#e67e22' }} /> : <ChevronDown size={12} style={{ color: '#e67e22' }} />}</span>
              </div>
              <AnimatePresence>
                {isAbstentionExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="mt-1 rounded-lg p-2 space-y-1 ml-5" style={{ background: 'rgba(230,126,34,0.04)', border: '1px solid rgba(230,126,34,0.08)' }}>
                      {dayAbstentions.map((ev: GameEvent, idx: number) => {
                        const msg = ev.message.replace('[Abstention] ', '');
                        const parts = msg.split(' → ');
                        const voterPart = parts[0]?.replace("n'a pas vote", '').trim();
                        const targetPart = parts[1]?.replace('(vote aleatoire)', '').trim();
                        return (
                          <div key={`abs-${ev.id}-${idx}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: 'rgba(230,126,34,0.04)', border: '1px solid rgba(230,126,34,0.06)' }}>
                            <span style={{ fontSize: '0.55rem', color: '#e67e22' }}>🎲</span>
                            <span style={{ color: '#e67e22', fontSize: '0.6rem', fontWeight: 600 }}>{voterPart}</span>
                            <span style={{ color: t.textDim, fontSize: '0.5rem' }}>→</span>
                            <span style={{ color: t.textMuted, fontSize: '0.6rem' }}>{targetPart}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null;

          // Phase section header
          const phaseHeader = (emoji: string, label: string, color: string, bgColor: string, borderColor: string, isCurrent: boolean) => (
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: '0.55rem' }}>{emoji}</span>
              <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.7rem', color: isCurrent ? color : t.textMuted }}>{label}</span>
              {isCurrent && <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: '0.45rem', background: bgColor, color, border: `1px solid ${borderColor}` }}>En cours</span>}
              <div className="flex-1 h-px" style={{ background: `rgba(${t.overlayChannel}, 0.06)` }} />
            </div>
          );

          const hasDayContent = dayRegular.length > 0 || dayAbstentions.length > 0;
          const hasNightContent = nightRegular.length > 0;

          const dayEliminations = dayRegular.filter((ev: GameEvent) => classifyGMEvent(ev.message) === 'death');
          const dayRest = dayRegular.filter((ev: GameEvent) => classifyGMEvent(ev.message) !== 'death');

          return (
            <div key={turnNum} className="mb-4">
              {hasDayContent && (
                <div className="mb-3">
                  {phaseHeader('☀️', `Jour ${turnNum}`, t.gold, t.goldBg, t.goldBorder, isCurrentTurn && state.phase === 'day')}
                  <div className="space-y-1 pl-1 mb-1">
                    {dayEliminations.map(renderEventCard)}
                    {abstentionBlock}
                    {dayRest.map(renderEventCard)}
                  </div>
                </div>
              )}
              {hasNightContent && (
                <div className="mb-1">
                  {phaseHeader('🌙', `Nuit ${turnNum}`, '#7c8db5', 'rgba(124,141,181,0.1)', 'rgba(124,141,181,0.2)', isCurrentTurn && state.phase === 'night')}
                  <div className="space-y-1 pl-1">
                    {nightRegular.map(renderEventCard)}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}