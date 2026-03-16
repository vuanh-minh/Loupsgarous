import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, ChevronUp, ScrollText, ArrowDown, Target, X, Vote,
} from 'lucide-react';
import { type Player, type GameState, type GameEvent } from '../../../context/GameContext';
import { ROLES, type RoleDefinition } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { PlayerAvatar } from '../../PlayerAvatar';
import { PlayerHintSection } from '../../HintComponents';
import { PAvatar } from './PAvatar';

/* ---- Event classification helpers ---- */
type EventType = 'separator' | 'sunrise' | 'nightfall' | 'death' | 'vote' | 'revive' | 'guard' | 'abstention' | 'action' | 'gm-only';

function classifyEvent(message: string): EventType {
  if (message.startsWith('---')) return 'separator';
  if (message.includes('distribuée à') || message.includes('distribue a')) return 'gm-only';
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

function getEventDisplay(type: EventType, phase: string, t: GameThemeTokens): { icon: string; color: string; label: string } {
  switch (type) {
    case 'sunrise':
      return { icon: '\u2600\uFE0F', color: t.daySky, label: 'Lever du jour' };
    case 'nightfall':
      return { icon: '\uD83C\uDF19', color: t.nightSky, label: 'Tombee de la nuit' };
    case 'death':
      return { icon: '\uD83D\uDC80', color: '#c41e3a', label: 'Mort' };
    case 'vote':
      return { icon: '\uD83D\uDDF3\uFE0F', color: t.gold, label: 'Vote du village' };
    case 'revive':
      return { icon: '\u2728', color: '#6b8e5a', label: 'Resurrection' };
    case 'guard':
      return { icon: '\uD83D\uDEE1\uFE0F', color: '#3b82f6', label: 'Protection' };
    case 'abstention':
      return { icon: '\uD83C\uDFB2', color: '#e67e22', label: 'Abstention' };
    case 'action':
      return { icon: phase === 'night' ? '\uD83C\uDF19' : '\u2600\uFE0F', color: t.textSecondary, label: 'Action' };
    default:
      return { icon: '\uD83D\uDCDC', color: t.textMuted, label: '' };
  }
}

/* ---- Vote Detail Card ---- */
function VoteDetailCard({
  voteRecord,
  players,
  t,
  onNavigateToPlayer,
  abstainerIds,
  lastWillUsed,
}: {
  voteRecord: { turn: number; votes: Record<number, number>; eliminated: number | null; nominations?: Record<number, number> };
  players: Player[];
  t: GameThemeTokens;
  onNavigateToPlayer?: (playerId: number) => void;
  abstainerIds?: Set<number>;
  lastWillUsed?: Record<number, boolean>;
}) {
  const getPlayer = (id: number) => players.find((p) => p.id === id);

  // Group votes by target
  const votesByTarget: Record<number, number[]> = {};
  Object.entries(voteRecord.votes).forEach(([voterId, targetId]) => {
    if (!votesByTarget[targetId]) votesByTarget[targetId] = [];
    votesByTarget[targetId].push(parseInt(voterId));
  });

  // Sort targets by vote count (descending)
  const sortedTargets = Object.entries(votesByTarget).sort(
    ([, a], [, b]) => b.length - a.length
  );

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div
        className="mt-1.5 rounded-lg p-2.5 space-y-2"
        style={{
          background: t.goldBg,
          border: `1px solid ${t.goldBorder}`,
        }}
      >
        {sortedTargets.length === 0 ? (
          <p style={{ color: t.textDim, fontSize: '0.6rem', textAlign: 'center' }}>
            Aucun vote enregistre.
          </p>
        ) : (
          sortedTargets.map(([targetIdStr, voterIds]) => {
            const targetId = parseInt(targetIdStr);
            const target = getPlayer(targetId);
            const isEliminated = voteRecord.eliminated === targetId;
            return (
              <div key={targetId}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center">
                    {target ? <PAvatar player={target} size="text-xs" className="inline-block" /> : <span className="text-xs">{'\u2753'}</span>}
                  </span>
                  <span
                    onClick={() => { if (target && onNavigateToPlayer) onNavigateToPlayer(target.id); }}
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.65rem',
                      color: isEliminated ? '#c41e3a' : t.textSecondary,
                      cursor: target && onNavigateToPlayer ? 'pointer' : 'default',
                      borderBottom: target && onNavigateToPlayer ? '1px dashed rgba(212,168,67,0.4)' : 'none',
                    }}
                  >
                    {target?.name || `Joueur ${targetId}`}
                  </span>
                  {/* Show who nominated this target */}
                  {isEliminated && (() => {
                    const nomId = voteRecord.nominations?.[targetId];
                    const nomPlayer = nomId !== undefined ? getPlayer(nomId) : null;
                    return nomPlayer ? (
                      <span
                        className="flex items-center gap-1"
                        style={{ fontSize: '0.5rem', color: t.textMuted, lineHeight: 1.2 }}
                      >
                        <span style={{ opacity: 0.7 }}>Nominé par</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); if (onNavigateToPlayer) onNavigateToPlayer(nomPlayer.id); }}
                          style={{
                            fontWeight: 600,
                            cursor: onNavigateToPlayer ? 'pointer' : 'default',
                            borderBottom: onNavigateToPlayer ? '1px dashed rgba(212,168,67,0.4)' : 'none',
                          }}
                        >
                          {nomPlayer.name}
                        </span>
                      </span>
                    ) : null;
                  })()}
                  <span
                    className="ml-auto px-1.5 py-0.5 rounded-full"
                    style={{
                      fontSize: '0.55rem',
                      background: isEliminated ? 'rgba(196,30,58,0.12)' : `rgba(${t.overlayChannel}, 0.04)`,
                      color: isEliminated ? '#c41e3a' : t.textMuted,
                      border: `1px solid ${isEliminated ? 'rgba(196,30,58,0.2)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                    }}
                  >
                    {voterIds.length} vote{voterIds.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 pl-5">
                  {voterIds.map((vid) => {
                    const voter = getPlayer(vid);
                    const isLastWill = voter && !voter.alive && lastWillUsed?.[vid];
                    return (
                      <span
                        key={vid}
                        onClick={() => { if (!isLastWill && voter && onNavigateToPlayer) onNavigateToPlayer(voter.id); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                        style={{
                          background: isLastWill ? 'rgba(139,92,246,0.08)' : `rgba(${t.overlayChannel}, 0.03)`,
                          border: `1px solid ${isLastWill ? 'rgba(139,92,246,0.2)' : t.surfaceBorder}`,
                          fontSize: '0.55rem',
                          color: isLastWill ? '#a78bfa' : t.textMuted,
                          cursor: !isLastWill && voter && onNavigateToPlayer ? 'pointer' : 'default',
                        }}
                      >
                        {isLastWill ? (
                          <>
                            <span className="text-xs">{'\uD83D\uDCDC'}</span>
                            Derniere volonte
                          </>
                        ) : (
                          <>
                            {abstainerIds?.has(vid) ? <span className="text-xs">{'\uD83C\uDFB2'}</span> : voter ? <PAvatar player={voter} size="text-xs" className="inline-block" /> : <span className="text-xs">{'\u2753'}</span>}
                            {voter?.name || `J${vid}`}
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

/* ---- Day Section Card ---- */
export function DaySection({
  turnNumber,
  events,
  voteRecord,
  players,
  isCurrentTurn,
  t,
  currentPhase,
  onNavigateToPlayer,
  lastWillUsed,
}: {
  turnNumber: number;
  events: GameEvent[];
  voteRecord?: { turn: number; votes: Record<number, number>; eliminated: number | null; nominations?: Record<number, number> };
  players: Player[];
  isCurrentTurn: boolean;
  t: GameThemeTokens;
  currentPhase?: string;
  onNavigateToPlayer?: (playerId: number) => void;
  lastWillUsed?: Record<number, boolean>;
}) {
  const [expandedVote, setExpandedVote] = useState(false);
  const [expandedAbstention, setExpandedAbstention] = useState(false);

  // Build a sorted list of player names (longest first) for tag detection
  const playerNameMap = useMemo(() => {
    return players
      .map((p) => ({ name: p.name, id: p.id }))
      .sort((a, b) => b.name.length - a.name.length);
  }, [players]);

  /** Render a message string with player names as clickable gold tags */
  const renderMessageWithTags = useCallback((message: string, baseColor: string): React.ReactNode => {
    if (!onNavigateToPlayer || playerNameMap.length === 0) return message;
    const escaped = playerNameMap.map((p) => p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'g');
    const parts = message.split(regex);
    if (parts.length <= 1) return message;
    return parts.map((part, i) => {
      const matched = playerNameMap.find((p) => p.name === part);
      if (matched) {
        return (
          <span
            key={i}
            onClick={(e) => { e.stopPropagation(); onNavigateToPlayer(matched.id); }}
            style={{
              color: '#d4a843',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: '1px dashed rgba(212,168,67,0.4)',
              paddingBottom: 1,
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }, [onNavigateToPlayer, playerNameMap]);

  // Filter out separator and gm-only events
  const displayEvents = events.filter((ev) => {
    const evType = classifyEvent(ev.message);
    return evType !== 'separator' && evType !== 'gm-only';
  });

  // Split by phase
  const dayEvents = displayEvents.filter((ev) => ev.phase === 'day');
  const nightEvents = displayEvents.filter((ev) => ev.phase === 'night');

  // Day: separate abstentions
  const dayAbstentions = dayEvents.filter((ev) => classifyEvent(ev.message) === 'abstention');
  const dayRegular = dayEvents.filter((ev) => classifyEvent(ev.message) !== 'abstention').slice().reverse();

  // Extract abstainer player IDs from abstention events
  const abstainerIds = useMemo(() => {
    const ids = new Set<number>();
    for (const ev of dayAbstentions) {
      const match = ev.message.match(/^\[Abstention\]\s*(.+?)\s+n'a pas vote/);
      if (match) {
        const name = match[1];
        const p = players.find((pl) => pl.name === name);
        if (p) ids.add(p.id);
      }
    }
    return ids;
  }, [dayAbstentions, players]);
  const nightRegular = nightEvents.filter((ev) => classifyEvent(ev.message) !== 'abstention').slice().reverse();

  // Early return AFTER all hooks to respect React rules of hooks
  if (displayEvents.length === 0) return null;

  // Render a single event card
  const renderEventCard = (ev: GameEvent, evIdx: number) => {
    const evType = classifyEvent(ev.message);
    const display = getEventDisplay(evType, ev.phase, t);
    const isVote = evType === 'vote';
    const hasVoteData = isVote && voteRecord && Object.keys(voteRecord.votes).length > 0;
    return (
      <div key={`${ev.turn}-${ev.id}-${evIdx}`}>
        <div
          className={`rounded-xl p-2.5 transition-colors ${isVote && hasVoteData ? 'cursor-pointer' : ''}`}
          onClick={() => { if (isVote && hasVoteData) setExpandedVote(!expandedVote); }}
          style={{
            background: evType === 'death' ? 'rgba(196,30,58,0.06)' : evType === 'vote' ? t.goldBg : evType === 'sunrise' ? 'rgba(240,197,91,0.05)' : evType === 'nightfall' ? `${t.nightSky}0f` : `rgba(${t.overlayChannel}, 0.02)`,
            border: `1px solid ${evType === 'death' ? 'rgba(196,30,58,0.12)' : evType === 'vote' ? t.goldBorder : evType === 'sunrise' ? 'rgba(240,197,91,0.08)' : evType === 'nightfall' ? `${t.nightSky}1a` : `rgba(${t.overlayChannel}, 0.04)`}`,
          }}
        >
          <div className="flex items-start gap-2">
            <span className="text-sm shrink-0 mt-0.5">{display.icon}</span>
            <div className="flex-1 min-w-0">
              <p style={{ color: display.color, fontSize: '0.65rem', lineHeight: 1.4 }}>{renderMessageWithTags(ev.message, display.color)}</p>
            </div>
            {isVote && hasVoteData && (
              <div className="shrink-0 ml-1">
                {expandedVote ? <ChevronUp size={12} style={{ color: t.gold }} /> : <ChevronDown size={12} style={{ color: t.gold }} />}
              </div>
            )}
          </div>
        </div>
        <AnimatePresence>
          {isVote && hasVoteData && expandedVote && voteRecord && (
            <VoteDetailCard voteRecord={voteRecord} players={players} t={t} onNavigateToPlayer={onNavigateToPlayer} abstainerIds={abstainerIds} lastWillUsed={lastWillUsed} />
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Abstention collapsible
  const abstentionBlock = dayAbstentions.length > 0 ? (
    <div>
      <div
        className="rounded-xl p-2.5 cursor-pointer transition-colors"
        onClick={() => setExpandedAbstention(!expandedAbstention)}
        style={{ background: 'rgba(230,126,34,0.06)', border: '1px solid rgba(230,126,34,0.1)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0">{'\uD83C\uDFB2'}</span>
          <p style={{ color: '#e67e22', fontSize: '0.65rem', lineHeight: 1.4, flex: 1, fontFamily: '"Cinzel", serif' }}>Abstentions</p>
          <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: '0.6rem', background: 'rgba(230,126,34,0.12)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.2)', fontFamily: '"Cinzel", serif' }}>{dayAbstentions.length}</span>
          <div className="shrink-0 ml-0.5">
            {expandedAbstention ? <ChevronUp size={12} style={{ color: '#e67e22' }} /> : <ChevronDown size={12} style={{ color: '#e67e22' }} />}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {expandedAbstention && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-1.5 rounded-lg p-2.5 space-y-1 ml-5" style={{ background: 'rgba(230,126,34,0.04)', border: '1px solid rgba(230,126,34,0.08)' }}>
              {dayAbstentions.map((ev, idx) => {
                const msg = ev.message.replace('[Abstention] ', '');
                const parts = msg.split(' \u2192 ');
                const voterPart = parts[0]?.replace("n'a pas vote", '').trim();
                const targetPart = parts[1]?.replace('(vote aleatoire)', '').trim();
                return (
                  <div key={`abs-${ev.id}-${idx}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: 'rgba(230,126,34,0.04)', border: '1px solid rgba(230,126,34,0.06)' }}>
                    <span style={{ fontSize: '0.55rem', color: '#e67e22' }}>{'\uD83C\uDFB2'}</span>
                    <span style={{ color: '#e67e22', fontSize: '0.6rem', fontWeight: 600 }}>{renderMessageWithTags(voterPart || '', '#e67e22')}</span>
                    <span style={{ color: t.textDim, fontSize: '0.6rem' }}>{'\u2192'}</span>
                    <span style={{ color: t.textMuted, fontSize: '0.6rem' }}>{renderMessageWithTags(targetPart || '', t.textMuted)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null;

  // Phase header
  const phaseHeader = (emoji: string, label: string, color: string, bgColor: string, borderColor: string, isCurrent: boolean) => (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: isCurrent ? bgColor : `rgba(${t.overlayChannel}, 0.04)`, border: `1px solid ${isCurrent ? borderColor : `rgba(${t.overlayChannel}, 0.06)`}` }}>
        <span style={{ fontSize: '0.6rem' }}>{emoji}</span>
      </div>
      <h3 style={{ fontFamily: '"Cinzel", serif', color: isCurrent ? color : t.textMuted, fontSize: '0.75rem' }}>{label}</h3>
      {isCurrent && <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: '0.6rem', background: bgColor, color, border: `1px solid ${borderColor}` }}>En cours</span>}
      <div className="flex-1 h-px ml-1" style={{ background: `rgba(${t.overlayChannel}, 0.06)` }} />
    </div>
  );

  const hasDayContent = dayRegular.length > 0 || dayAbstentions.length > 0;
  const hasNightContent = nightRegular.length > 0;

  // Split dayRegular: eliminations first, then abstentions, then the rest
  const dayEliminations = dayRegular.filter((ev) => classifyEvent(ev.message) === 'death');
  const dayRest = dayRegular.filter((ev) => classifyEvent(ev.message) !== 'death');

  return (
    <div className="mb-4">
      {/* Day section (more recent - shown first) */}
      {hasDayContent && (
        <div className="mb-3">
          {phaseHeader('\u2600\uFE0F', `Jour ${turnNumber}`, t.gold, t.goldBg, t.goldBorder, isCurrentTurn && currentPhase === 'day')}
          <div className="space-y-1.5 pl-2 mb-1">
            {dayEliminations.map(renderEventCard)}
            {dayRest.filter((ev) => classifyEvent(ev.message) === 'vote').map(renderEventCard)}
            {abstentionBlock}
            {dayRest.filter((ev) => classifyEvent(ev.message) !== 'vote').map(renderEventCard)}
          </div>
        </div>
      )}

      {/* Night section */}
      {hasNightContent && (
        <div className="mb-1">
          {phaseHeader('\uD83C\uDF19', `Nuit ${turnNumber}`, '#7c8db5', 'rgba(124,141,181,0.1)', 'rgba(124,141,181,0.2)', isCurrentTurn && currentPhase === 'night')}
          <div className="space-y-1.5 pl-2">
            {nightRegular.map(renderEventCard)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Quests Panel ---- */
export function QuestsPanel({
  state,
  currentPlayer,
  currentRole,
  t,
  onRevealHint,
  onNavigateToPlayer,
}: {
  state: GameState;
  currentPlayer: Player | null;
  currentRole?: RoleDefinition;
  t: GameThemeTokens;
  onRevealHint?: (hintId: number) => void;
  onNavigateToPlayer?: (playerId: number) => void;
}) {
  const alivePlayers = state.players.filter((p) => p.alive);

  if (!currentPlayer || !currentRole) {
    return (
      <div className="px-4 py-4 pb-6 flex flex-col items-center justify-center h-full">
        <ScrollText size={32} style={{ color: '#d4a843' }} />
        <p style={{ color: '#6b7b9b', fontSize: '0.8rem', marginTop: '1rem' }}>
          Ton journal apparaitra ici.
        </p>
      </div>
    );
  }

  // Group events by turn
  const eventsByTurn: Record<number, GameEvent[]> = {};
  state.events
    .filter((ev) => !ev.message.startsWith('Role de ') || !ev.message.includes(' change en '))
    .forEach((ev) => {
    if (!eventsByTurn[ev.turn]) eventsByTurn[ev.turn] = [];
    eventsByTurn[ev.turn].push(ev);
  });

  const turnNumbers = Object.keys(eventsByTurn)
    .map(Number)
    .sort((a, b) => b - a); // Most recent first

  return (
    <div className="px-4 py-4 pb-6">
      <div className="flex items-center gap-2 mb-1">
        <ScrollText size={16} style={{ color: t.gold }} />
        <h2 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
          Journal
        </h2>
      </div>

      {/* Hints section at top of journal */}
      {currentPlayer && (state.playerHints ?? []).some(ph => ph.playerId === currentPlayer.id) && (
        <div className="mt-3 mb-2">
          <PlayerHintSection
            hints={state.hints ?? []}
            playerHints={state.playerHints ?? []}
            playerId={currentPlayer.id}
            t={t}
            onReveal={(hintId) => onRevealHint?.(hintId)}
            variant="journal"
          />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 mb-4">
        {[
          { label: 'Tour', value: `${state.turn}`, color: t.gold },
          { label: 'Vivants', value: `${alivePlayers.length}`, color: '#6b8e5a' },
          { label: 'Morts', value: `${state.players.length - alivePlayers.length}`, color: '#c41e3a' },
        ].map((s) => (
          <div
            key={s.label}
            className="p-2.5 rounded-xl text-center"
            style={{ background: `${s.color}06`, border: `1px solid ${s.color}15` }}
          >
            <p style={{ fontFamily: '"Cinzel", serif', color: s.color, fontSize: '1.1rem' }}>{s.value}</p>
            <p style={{ color: t.textMuted, fontSize: '0.55rem' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Card-based journal grouped by day */}
      {turnNumbers.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <ArrowDown size={10} style={{ color: t.textDim }} />
          <span style={{ color: t.textDim, fontSize: '0.55rem', fontStyle: 'italic' }}>
            Plus recent {'\u2192'} plus ancien
          </span>
        </div>
      )}
      {turnNumbers.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{
            background: `rgba(${t.overlayChannel}, 0.02)`,
            border: `1px solid rgba(${t.overlayChannel}, 0.05)`,
          }}
        >
          <ScrollText size={20} style={{ color: t.textDim, margin: '0 auto' }} />
          <p style={{ color: t.textDim, fontSize: '0.65rem', marginTop: '0.75rem' }}>
            Aucun evenement pour le moment.
          </p>
        </div>
      ) : (
        turnNumbers.map((turnNum) => (
          <DaySection
            key={turnNum}
            turnNumber={turnNum}
            events={eventsByTurn[turnNum]}
            voteRecord={(state.voteHistory || []).find((v) => v.turn === turnNum)}
            players={state.players}
            isCurrentTurn={turnNum === state.turn}
            t={t}
            currentPhase={state.phase}
            onNavigateToPlayer={onNavigateToPlayer}
            lastWillUsed={state.lastWillUsed}
          />
        ))
      )}
    </div>
  );
}

/* ---- Hunter Shot Modal ---- */
export function HunterShotModal({
  players, hunterId, preTarget, onShoot, t,
}: {
  players: Player[];
  hunterId: number | null;
  preTarget?: number | null;
  onShoot: (targetId: number) => void;
  t: GameThemeTokens;
}) {
  const alive = players.filter((p) => p.alive && p.id !== hunterId);
  // Validate pre-target: must still be alive
  const validPreTarget = preTarget != null && alive.some(p => p.id === preTarget) ? preTarget : null;
  const [target, setTarget] = useState<number | null>(validPreTarget);
  const hunter = hunterId !== null ? players.find((p) => p.id === hunterId) : null;
  const preTargetPlayer = validPreTarget !== null ? players.find(p => p.id === validPreTarget) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      <div className="w-[90%] max-w-sm rounded-2xl p-6 flex flex-col"
        style={{
          background: '#0f1629',
          border: '2px solid rgba(217,119,6,0.4)',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        <div className="text-center flex-shrink-0">
          <span className="text-4xl block mb-2">{'\uD83C\uDFF9'}</span>
          <h2 style={{ fontFamily: '"Cinzel", serif', color: '#d97706', fontSize: '1rem' }}>
            Dernier souffle !
          </h2>
          <p style={{ color: t.textMuted, fontSize: '0.7rem', marginTop: '0.25rem' }}>
            {hunter?.name || 'Le Chasseur'} doit tirer.
          </p>
          {preTargetPlayer && (
            <p style={{ color: '#d97706', fontSize: '0.6rem', marginTop: '0.25rem', opacity: 0.8 }}>
              Cible pre-selectionnee : {preTargetPlayer.name}
            </p>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mt-4 -mx-1 px-1">
          <div className="grid grid-cols-4 gap-3">
            {alive.map((p) => (
              <PlayerAvatar
                key={p.id}
                player={p}
                size="sm"
                selected={target === p.id}
                onClick={() => setTarget(p.id)}
              />
            ))}
          </div>
        </div>
        <button
          onClick={() => { if (target !== null) onShoot(target); }}
          disabled={target === null}
          className="mt-4 w-full py-3 rounded-xl flex-shrink-0"
          style={{
            background: target !== null ? '#d97706' : `rgba(${t.overlayChannel}, 0.04)`,
            color: target !== null ? 'white' : t.textDim,
            fontFamily: '"Cinzel", serif',
            fontSize: '0.8rem',
          }}
        >
          <Target size={14} className="inline mr-2" />
          Tirer !
        </button>
      </div>
    </motion.div>
  );
}

/* ---- Hypothesis Picker Modal ---- */
export function HypothesisPickerModal({
  targetPlayer, currentHypothesis, onSelect, onClear, onClose, t,
  phase, dayStep, currentPlayerAlive,
  onVoteAgainst, onEarlyVote, targetVoteCount = 0,
  isTargetAway = false,
  isMaireElection = false,
}: {
  targetPlayer: Player | null;
  currentHypothesis: string;
  onSelect: (roleId: string) => void;
  onClear: () => void;
  onClose: () => void;
  t: GameThemeTokens;
  phase?: string;
  dayStep?: string;
  currentPlayerAlive?: boolean;
  onVoteAgainst?: (targetPlayerId: number) => void;
  onEarlyVote?: (targetPlayerId: number) => void;
  targetVoteCount?: number;
  isTargetAway?: boolean;
  isMaireElection?: boolean;
}) {
  if (!targetPlayer) return null;

  const isNight = phase === 'night';
  const isVotePhase = !isNight && dayStep === 'vote';
  const showVoteButton = isVotePhase && !isMaireElection && currentPlayerAlive && !!onVoteAgainst && !isTargetAway;
  const showEarlyVoteButton = isNight && currentPlayerAlive && !!onEarlyVote && !isTargetAway;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full rounded-t-2xl p-5 pb-8"
        style={{ background: t.modalBg, border: `1px solid ${t.goldBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-[120px] h-[120px] shrink-0 rounded-full overflow-hidden" style={{ border: `4px solid #D4A843` }}>
              <PAvatar player={targetPlayer} size="text-2xl" style={{ width: 120, height: 120, fontSize: '3.5rem' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
                {targetPlayer.name}
              </h3>
              <p style={{ color: t.textMuted, fontSize: '0.6rem' }}>Selon toi, quel rôle cache cette personne ?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `rgba(${t.overlayChannel}, 0.05)` }}
          >
            <X size={16} style={{ color: t.textMuted }} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {ROLES.map((role) => {
            const isSelected = currentHypothesis === role.id;
            return (
              <motion.button
                key={role.id}
                whileTap={{ scale: 0.9 }}
                onClick={() => onSelect(role.id)}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl"
                style={{
                  background: isSelected ? `${role.color}18` : `rgba(${t.overlayChannel}, 0.03)`,
                  border: `2px solid ${isSelected ? role.color : `rgba(${t.overlayChannel}, 0.06)`}`,
                }}
              >
                <span className="text-2xl">{role.emoji}</span>
                <span
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: isSelected ? role.color : t.textSecondary,
                    fontSize: '0.6rem',
                    textAlign: 'center',
                  }}
                >
                  {role.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {currentHypothesis && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClear}
            className="mt-4 w-full py-2.5 rounded-xl flex items-center justify-center gap-2"
            style={{
              background: 'rgba(196,30,58,0.08)',
              border: '1px solid rgba(196,30,58,0.2)',
              color: '#c41e3a',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.7rem',
            }}
          >
            <X size={13} />
            Retirer l'hypothese
          </motion.button>
        )}

        {/* Day vote phase: vote directly against this player */}
        {showVoteButton && (
          targetVoteCount > 0 ? (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onVoteAgainst!(targetPlayer.id)}
            className="mt-3 w-full py-3 rounded-xl flex items-center justify-center gap-2.5"
            style={{
              background: 'linear-gradient(135deg, rgba(196,30,58,0.15), rgba(196,30,58,0.08))',
              border: '1.5px solid rgba(196,30,58,0.35)',
              color: '#c41e3a',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <Vote size={15} />
            Voter contre {targetPlayer.name}
          </motion.button>
          ) : (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onVoteAgainst!(targetPlayer.id)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] transition-colors"
            style={{
              background: '#3d3424',
              border: '1px solid rgba(212,168,67,0.3)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              color: '#d4a843',
              fontSize: '0.8rem',
              fontFamily: '"Cinzel", serif',
              fontWeight: 600,
            }}
          >
            <Vote size={16} />
            Nominer
          </motion.button>
          )
        )}

        {/* Night phase: set early vote for next day */}
        {showEarlyVoteButton && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onEarlyVote!(targetPlayer.id)}
            className="mt-3 w-full py-3 rounded-xl flex items-center justify-center gap-2.5"
            style={{
              background: 'linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.06))',
              border: '1.5px solid rgba(212,168,67,0.3)',
              color: '#d4a843',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            <Vote size={15} />
            Voter au prochain tour
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
}