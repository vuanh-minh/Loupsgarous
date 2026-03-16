import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Crown, CircleCheck, Skull, Vote, PenLine, Search, X,
  Sun, Moon, UserX,
} from 'lucide-react';
import { type Player } from '../../../context/GameContext';
import { getRoleById } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';
import { PhaseTimerDisplay } from '../../PhaseTimer';

/* ---- Village List Panel ---- */
export function VillageListPanel({
  alivePlayers, deadPlayers,
  currentPlayerId,
  hypotheses, onOpenHypothesis,
  maireId = null,
  allPlayers = [],
  phase,
  earlyVotes,
  onSetEarlyVote,
  onCancelEarlyVote,
  highlightedPlayerId = null,
  playerTags = {},
  t,
  turn = 1,
  phaseTimerEndAt = null,
  villagePresentIds,
}: {
  alivePlayers: Player[];
  deadPlayers: Player[];
  currentPlayerId: number | null;
  hypotheses: Record<number, string>;
  onOpenHypothesis: (targetId: number) => void;
  maireId?: number | null;
  allPlayers?: Player[];
  phase: 'night' | 'day';
  earlyVotes: Record<number, number>;
  onSetEarlyVote: (voterId: number, targetId: number) => void;
  onCancelEarlyVote: (voterId: number) => void;
  highlightedPlayerId?: number | null;
  playerTags?: Record<number, string[]>;
  t: GameThemeTokens;
  turn?: number;
  phaseTimerEndAt?: string | null;
  villagePresentIds?: number[];
}) {
  const maire = maireId !== null ? allPlayers.find((p) => p.id === maireId) ?? null : null;
  const isMaireMe = currentPlayerId === maireId;

  // Hypothesis filter state
  type HypothesisFilter = 'all' | 'unknown' | 'village' | 'loups' | 'absents' | 'cemetery';
  const [hypothesisFilter, setHypothesisFilter] = useState<HypothesisFilter>('all');

  // Separate away players from present alive players
  const awayPlayers = villagePresentIds
    ? alivePlayers.filter((p) => !villagePresentIds.includes(p.id))
    : [];
  const presentAlivePlayers = villagePresentIds
    ? alivePlayers.filter((p) => villagePresentIds.includes(p.id))
    : alivePlayers;

  const otherAlivePlayers = presentAlivePlayers.filter((p) => p.id !== currentPlayerId);
  const unknownCount = otherAlivePlayers.filter((p) => !hypotheses[p.id]).length;
  const villageCount = otherAlivePlayers.filter((p) => {
    const r = hypotheses[p.id] ? getRoleById(hypotheses[p.id]) : null;
    return r?.team === 'village';
  }).length;
  const loupsCount = otherAlivePlayers.filter((p) => {
    const r = hypotheses[p.id] ? getRoleById(hypotheses[p.id]) : null;
    return r?.team === 'werewolf';
  }).length;

  const filteredAlivePlayers = alivePlayers.filter((p) => {
    if (hypothesisFilter === 'all') return true;
    if (hypothesisFilter === 'cemetery') return false; // hide alive in cemetery view
    if (hypothesisFilter === 'absents') return false; // absents shown in dedicated section
    const isSelf = p.id === currentPlayerId;
    if (isSelf) return true; // always show self
    const hyp = hypotheses[p.id];
    if (hypothesisFilter === 'unknown') return !hyp;
    const role = hyp ? getRoleById(hyp) : null;
    if (hypothesisFilter === 'village') return role?.team === 'village';
    if (hypothesisFilter === 'loups') return role?.team === 'werewolf';
    return true;
  });

  // For non-absents filters, exclude away players from the alive grid (they have their own section)
  const filteredPresentPlayers = hypothesisFilter === 'absents'
    ? [] // absents filter shows only the dedicated section
    : filteredAlivePlayers.filter((p) => !awayPlayers.some((ap) => ap.id === p.id));

  // Early vote state
  const [showEarlyVoteModal, setShowEarlyVoteModal] = useState(false);
  const [earlyVoteSearch, setEarlyVoteSearch] = useState('');
  const isNightPhase = phase === 'night';
  const myEarlyVote = currentPlayerId !== null ? (earlyVotes || {})[currentPlayerId] : undefined;
  const earlyVoteTarget = myEarlyVote !== undefined
    ? alivePlayers.find((p) => p.id === myEarlyVote) ?? null
    : null;
  const earlyVoteTargets = presentAlivePlayers.filter((p) => p.id !== currentPlayerId);
  const filteredEarlyVoteTargets = earlyVoteSearch.trim()
    ? earlyVoteTargets.filter((p) => p.name.toLowerCase().includes(earlyVoteSearch.toLowerCase()))
    : earlyVoteTargets;

  return (
    <div className="px-4 py-4 pb-6">
      {/* Day/Night header with timer */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {phase === 'night' ? (
            <Moon size={18} style={{ color: '#7c8db5' }} />
          ) : (
            <Sun size={18} style={{ color: '#d4a843' }} />
          )}
          <h1
            style={{
              fontFamily: '"Cinzel Decorative", "Cinzel", serif',
              color: phase === 'night' ? '#7c8db5' : '#d4a843',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            {phase === 'night' ? `Nuit ${turn}` : `Jour ${turn}`}
          </h1>
        </div>
        {phaseTimerEndAt && (
          <div className="flex justify-start">
            <PhaseTimerDisplay
              endAt={phaseTimerEndAt}
              isNight={phase === 'night'}
              t={t}
              size="mini"
            />
          </div>
        )}
      </div>

      {/* Maire badge */}
      {maire && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mb-4"
        >
          <div
            className="rounded-xl px-3.5 py-2 flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${t.goldBg}, ${t.goldBg}80)`,
              border: `1px solid ${t.goldBorder}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative"
              style={{
                background: `${t.gold}1e`,
                border: `2px solid ${t.gold}4d`,
              }}
            >
              <PAvatar player={maire} size="text-sm" />
              <div
                className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ background: t.gold, border: `1.5px solid ${t.dotBorderColor}` }}
              >
                <Crown size={7} style={{ color: '#0a0e1a' }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{
                color: t.gold, fontSize: '0.65rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
              }}>
                {isMaireMe ? 'Vous etes le Maire' : `Maire: ${maire.name}`}
              </p>
              <p style={{ color: t.textMuted, fontSize: '0.6rem', marginTop: '0.1rem' }}>
                {isMaireMe ? 'Votre vote compte double et tranche les egalites' : 'Son vote compte double'}
              </p>
            </div>
            <Crown size={14} style={{ color: t.gold }} />
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} style={{ color: t.gold }} />
        <h2 className="flex-1" style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
          Habitants du village
        </h2>
      </div>
      <p style={{ color: t.textMuted, fontSize: '0.6rem', marginBottom: '0.5rem' }}>
        {presentAlivePlayers.length} vivant{presentAlivePlayers.length > 1 ? 's' : ''}
        {awayPlayers.length > 0 && ` · ${awayPlayers.length} absent${awayPlayers.length > 1 ? 's' : ''}`}
        {' · '}{deadPlayers.length} mort{deadPlayers.length > 1 ? 's' : ''}
      </p>

      {/* Hypothesis filter bar */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          { id: 'all' as HypothesisFilter, label: 'Tous', count: presentAlivePlayers.length + deadPlayers.length, color: t.gold },
          { id: 'unknown' as HypothesisFilter, label: 'Inconnus', count: unknownCount, color: t.textMuted },
          { id: 'village' as HypothesisFilter, label: 'Village', count: villageCount, color: '#6b8e5a' },
          { id: 'loups' as HypothesisFilter, label: 'Loups', count: loupsCount, color: '#c41e3a' },
          { id: 'absents' as HypothesisFilter, label: 'Absents', count: awayPlayers.length, color: '#f59e0b' },
          { id: 'cemetery' as HypothesisFilter, label: 'Cimetiere', count: deadPlayers.length, color: t.textMuted },
        ] as const).map((f) => {
          const isActive = hypothesisFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setHypothesisFilter(f.id)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200 shrink-0"
              style={{
                background: isActive ? `${f.color}1e` : `rgba(${t.overlayChannel}, 0.03)`,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isActive ? `${f.color}55` : `rgba(${t.overlayChannel}, 0.08)`,
                color: isActive ? f.color : t.textDim,
                fontSize: '0.6rem',
                fontFamily: '"Cinzel", serif',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
              }}
            >
              {f.label}
              <span
                className="px-1.5 py-0.5 rounded-full"
                style={{
                  background: isActive ? `${f.color}2a` : `rgba(${t.overlayChannel}, 0.06)`,
                  fontSize: '0.5rem',
                  fontWeight: 700,
                  minWidth: '1.1rem',
                  textAlign: 'center',
                  color: isActive ? f.color : t.textMuted,
                }}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vote anticipe button — only during night */}
      {isNightPhase && currentPlayerId !== null && alivePlayers.some((p) => p.id === currentPlayerId) && (
        earlyVoteTarget ? (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setEarlyVoteSearch(''); setShowEarlyVoteModal(true); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-4"
            style={{
              background: 'rgba(212,168,67,0.1)',
              border: '1px solid rgba(212,168,67,0.25)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,168,67,0.15)', border: '2px solid rgba(212,168,67,0.3)' }}
            >
              <PAvatar player={earlyVoteTarget} size="text-sm" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate" style={{ color: '#f5e6b8', fontSize: '0.8rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>
                {earlyVoteTarget.name}
              </p>
              <p style={{ color: 'rgba(212,168,67,0.7)', fontSize: '0.6rem' }}>
                Vote anticipe enregistre
              </p>
            </div>
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg shrink-0"
              style={{
                background: 'rgba(212,168,67,0.15)',
                border: '1px solid rgba(212,168,67,0.25)',
                color: '#d4a843',
                fontSize: '0.55rem',
                fontFamily: '"Cinzel", serif',
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}
            >
              <PenLine size={10} />
              Modifier
            </span>
          </motion.button>
        ) : (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setEarlyVoteSearch(''); setShowEarlyVoteModal(true); }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(212,168,67,0.12), rgba(212,168,67,0.06))',
              border: '1px solid rgba(212,168,67,0.2)',
              color: '#d4a843',
              fontSize: '0.65rem',
              fontFamily: '"Cinzel", serif',
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            <Vote size={14} />
            Voter par anticipation
          </motion.button>
        )
      )}

      {/* Alive players grid — grouped by tag */}
      {(() => {
        // Collect all unique tags
        const allTags = new Set<string>();
        filteredPresentPlayers.forEach((p) => {
          const tags = playerTags?.[p.id];
          if (tags) tags.forEach((t2) => allTags.add(t2));
        });
        // Also collect tags from dead players (in "Tous" and "Cimetiere" filters)
        if (hypothesisFilter === 'all' || hypothesisFilter === 'cemetery') {
          deadPlayers.forEach((p) => {
            const tags = playerTags?.[p.id];
            if (tags) tags.forEach((t2) => allTags.add(t2));
          });
        }
        // Also collect tags from away players (in "Absents" filter)
        if (hypothesisFilter === 'absents' && awayPlayers.length > 0) {
          awayPlayers.forEach((p) => {
            const tags = playerTags?.[p.id];
            if (tags) tags.forEach((t2) => allTags.add(t2));
          });
        }
        const sortedTags = Array.from(allTags).sort();

        // Players with no tag
        const untaggedPlayers = filteredPresentPlayers.filter(
          (p) => !playerTags?.[p.id] || playerTags[p.id].length === 0,
        );

        // Render a player cell (reused across sections)
        const renderPlayerCell = (p: Player) => {
          const isSelf = p.id === currentPlayerId;
          const hypothesisRoleId = hypotheses[p.id];
          const hypothesisRole = hypothesisRoleId ? getRoleById(hypothesisRoleId) : null;
          const isHighlighted = highlightedPlayerId === p.id;
          const isAway = villagePresentIds && !villagePresentIds.includes(p.id);

          return (
            <motion.div
              key={p.id}
              data-player-id={p.id}
              whileTap={{ scale: 0.9 }}
              animate={isHighlighted ? {
                scale: [1, 1.15, 1, 1.1, 1],
                transition: { duration: 1.2, ease: 'easeInOut' },
              } : { scale: 1 }}
              onClick={() => {
                if (!isSelf && currentPlayerId !== null) onOpenHypothesis(p.id);
              }}
              className="flex flex-col items-center gap-1 cursor-pointer"
              style={{ overflow: 'visible', opacity: isAway ? 0.4 : 1 }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center relative transition-all duration-200"
                style={{
                  background: isHighlighted
                    ? `${t.gold}2e`
                    : isSelf
                      ? t.goldBg
                      : `rgba(${t.overlayChannel}, 0.04)`,
                  border: `2px solid ${
                    isHighlighted
                      ? t.gold
                      : isSelf
                        ? t.gold
                        : `rgba(${t.overlayChannel}, 0.1)`
                  }`,
                  overflow: 'visible',
                  boxShadow: isHighlighted ? `0 0 12px ${t.gold}80, 0 0 24px ${t.gold}33` : 'none',
                }}
              >
                <PAvatar player={p} size="text-2xl" style={isAway ? { filter: 'grayscale(0.6)' } : undefined} />
                {isSelf && (
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: t.gold, border: `2px solid ${t.dotBorderColor}` }}
                  >
                    <CircleCheck size={8} style={{ color: t.pageBgSolid }} />
                  </div>
                )}
                {/* Hypothesis badge */}
                {hypothesisRole && !isSelf && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10 overflow-hidden"
                    style={{
                      background: `${hypothesisRole.color}40`,
                      border: `2px solid ${hypothesisRole.color}80`,
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hypothesisRole.emoji}</span>
                  </motion.div>
                )}
              </div>
              <span
                style={{
                  color: isSelf ? t.gold : isAway ? t.textDim : t.text,
                  fontSize: '0.6rem',
                  textAlign: 'center',
                }}
                className="truncate max-w-[3.5rem]"
              >
                {p.name}
              </span>
              {isAway && (
                <span style={{ color: '#f59e0b', fontSize: '0.4rem', lineHeight: 1 }}>absent</span>
              )}
            </motion.div>
          );
        };

        // Render a dead player cell (grayscale, skull badge, revealed role)
        const renderDeadPlayerCell = (p: Player) => {
          const role = getRoleById(p.role);
          const isDeadHighlighted = highlightedPlayerId === p.id;
          const deadHypRoleId = hypotheses[p.id];
          const deadHypRole = deadHypRoleId ? getRoleById(deadHypRoleId) : null;
          const hypMatchesRole = deadHypRole && role && deadHypRole.id === role.id;
          const hasHypothesis = !!deadHypRole;
          return (
            <div
              key={p.id}
              data-player-id={p.id}
              className="flex flex-col items-center gap-1 transition-all duration-300"
              style={{ overflow: 'visible', opacity: 0.7 }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center relative transition-all duration-200"
                style={{
                  background: isDeadHighlighted ? `${t.gold}1a` : `rgba(${t.overlayChannel}, 0.03)`,
                  border: `2px solid ${isDeadHighlighted ? `${t.gold}4d` : `rgba(${t.overlayChannel}, 0.06)`}`,
                  overflow: 'visible',
                  boxShadow: isDeadHighlighted ? `0 0 10px ${t.gold}4d` : 'none',
                }}
              >
                <PAvatar player={p} size="text-2xl" style={{ filter: 'grayscale(1)', opacity: 0.4 }} />
                {/* Skull badge */}
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(120,40,40,0.85)',
                    border: '2px solid rgba(180,60,60,0.5)',
                  }}
                >
                  <Skull size={10} style={{ color: '#e8a0a0' }} />
                </div>
                {/* Hypothesis check/cross badge */}
                {hasHypothesis && (
                  <div
                    className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10"
                    style={{
                      background: hypMatchesRole ? 'rgba(107,142,90,0.3)' : 'rgba(196,30,58,0.25)',
                      border: `2px solid ${hypMatchesRole ? 'rgba(107,142,90,0.6)' : 'rgba(196,30,58,0.5)'}`,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: hypMatchesRole ? '#6b8e5a' : '#c41e3a',
                    }}
                  >
                    {hypMatchesRole ? '✓' : '✗'}
                  </div>
                )}
              </div>
              {/* Name */}
              <span
                style={{
                  color: t.textDim,
                  fontSize: '0.55rem',
                  textAlign: 'center',
                  textDecoration: 'line-through',
                  textDecorationThickness: '1px',
                  textDecorationColor: 'rgba(196,30,58,0.5)',
                }}
                className="truncate max-w-[3.5rem]"
              >
                {p.name}
              </span>
              {/* Revealed role */}
              {role && (
                <span
                  style={{
                    color: role.color,
                    fontSize: '0.45rem',
                    opacity: 0.7,
                    textAlign: 'center',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {role.emoji} {role.name}
                </span>
              )}
            </div>
          );
        };

        // Dead players for inline display (in "Tous" and "Cimetiere" filters)
        const showDeadInline = (hypothesisFilter === 'all' || hypothesisFilter === 'cemetery') && deadPlayers.length > 0;
        const deadUntagged = showDeadInline
          ? deadPlayers.filter((p) => !playerTags?.[p.id] || playerTags[p.id].length === 0)
          : [];

        // Away players for display (only in "Absents" filter)
        const showAwaySection = hypothesisFilter === 'absents' && awayPlayers.length > 0;
        const awayUntagged = showAwaySection
          ? awayPlayers.filter((p) => !playerTags?.[p.id] || playerTags[p.id].length === 0)
          : [];

        return (
          <>
            {/* Untagged players (or all if no tags exist) */}
            {(sortedTags.length === 0 ? filteredPresentPlayers : untaggedPlayers).length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-5 pt-2 pl-2">
                {(sortedTags.length === 0 ? filteredPresentPlayers : untaggedPlayers)
                  .slice()
                  .sort((a, b) => (a.id === currentPlayerId ? -1 : b.id === currentPlayerId ? 1 : 0))
                  .map(renderPlayerCell)}
                {/* Dead untagged players at the end */}
                {(sortedTags.length === 0 ? (showDeadInline ? deadPlayers : []) : deadUntagged).map(renderDeadPlayerCell)}
              </div>
            )}
            {/* If no alive untagged but dead untagged exist, still show them */}
            {(sortedTags.length === 0 ? filteredPresentPlayers : untaggedPlayers).length === 0
              && (sortedTags.length === 0 ? (showDeadInline ? deadPlayers : []) : deadUntagged).length > 0 && (
              <div className="grid grid-cols-4 gap-3 mb-5 pt-2 pl-2">
                {(sortedTags.length === 0 ? deadPlayers : deadUntagged).map(renderDeadPlayerCell)}
              </div>
            )}

            {/* Tag sections */}
            {sortedTags.map((tag) => {
              const tagPlayers = filteredPresentPlayers.filter(
                (p) => playerTags?.[p.id]?.includes(tag),
              );
              const deadTagPlayers = showDeadInline
                ? deadPlayers.filter((p) => playerTags?.[p.id]?.includes(tag))
                : [];
              const awayTagPlayers = showAwaySection
                ? awayPlayers.filter((p) => playerTags?.[p.id]?.includes(tag))
                : [];
              // Count alive players with this tag (regardless of filter)
              const presentWithTag = presentAlivePlayers.filter(
                (p) => playerTags?.[p.id]?.includes(tag),
              ).length;
              const awayWithTag = awayPlayers.filter(
                (p) => playerTags?.[p.id]?.includes(tag),
              ).length;
              const deadWithTag = deadPlayers.filter(
                (p) => playerTags?.[p.id]?.includes(tag),
              ).length;
              const totalWithTag = presentWithTag + awayWithTag + deadWithTag;
              if (tagPlayers.length === 0 && deadTagPlayers.length === 0 && awayTagPlayers.length === 0) return null;
              return (
                <div key={tag} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{
                      fontFamily: '"Cinzel", serif',
                      color: t.textMuted,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}>
                      {tag}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `rgba(${t.overlayChannel}, 0.06)`,
                        fontSize: '0.5rem',
                        fontWeight: 700,
                        color: t.textMuted,
                        minWidth: '1.1rem',
                        textAlign: 'center',
                      }}
                    >
                      {totalWithTag > presentWithTag ? `${presentWithTag}/${totalWithTag}` : presentWithTag}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 pl-2">
                    {tagPlayers.map(renderPlayerCell)}
                    {awayTagPlayers.map(renderPlayerCell)}
                    {deadTagPlayers.map(renderDeadPlayerCell)}
                  </div>
                </div>
              );
            })}

            {/* ── Absents section ── */}
            {showAwaySection && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2 mt-2">
                  <UserX size={14} style={{ color: '#f59e0b' }} />
                  <span style={{
                    fontFamily: '"Cinzel", serif',
                    color: '#f59e0b',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    Absents
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(245,158,11,0.12)',
                      fontSize: '0.5rem',
                      fontWeight: 700,
                      color: '#f59e0b',
                      minWidth: '1.1rem',
                      textAlign: 'center',
                    }}
                  >
                    {awayPlayers.length}
                  </span>
                </div>
                <p style={{ color: t.textMuted, fontSize: '0.5rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                  Ces joueurs n'ont pas encore rejoint le village
                </p>
                {/* Untagged away players */}
                {(sortedTags.length === 0 ? awayPlayers : awayUntagged).length > 0 && (
                  <div className="grid grid-cols-4 gap-3 pl-2 mb-3">
                    {(sortedTags.length === 0 ? awayPlayers : awayUntagged).map(renderPlayerCell)}
                  </div>
                )}
                {/* Tagged away players grouped by tag */}
                {sortedTags.length > 0 && sortedTags.map((tag) => {
                  const awayTagged = awayPlayers.filter((p) => playerTags?.[p.id]?.includes(tag));
                  if (awayTagged.length === 0) return null;
                  return (
                    <div key={`away-${tag}`} className="mb-2">
                      <span style={{
                        fontFamily: '"Cinzel", serif',
                        color: t.textDim,
                        fontSize: '0.6rem',
                        fontWeight: 500,
                      }}>
                        {tag}
                      </span>
                      <div className="grid grid-cols-4 gap-3 pl-2 mt-1">
                        {awayTagged.map(renderPlayerCell)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      {/* Tip */}
      <div
        className="rounded-lg p-3 text-center"
        style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
      >
        <p style={{ color: t.textDim, fontSize: '0.55rem', fontStyle: 'italic' }}>
          Appuyez sur un joueur pour noter votre hypothese sur son role
        </p>
      </div>

      {/* Early Vote Modal (portalled to escape transform containing block) */}
      {createPortal(
      <AnimatePresence>
        {showEarlyVoteModal && currentPlayerId !== null && (
          <motion.div
            key="early-vote-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowEarlyVoteModal(false)}
          >
            <motion.div
              key="early-vote-modal-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
              style={{
                background: 'linear-gradient(180deg, #0f0e1e 0%, #0a0e1a 100%)',
                border: '1px solid rgba(212,168,67,0.15)',
                borderBottomWidth: 0,
                height: '85vh',
                maxHeight: '85vh',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
              </div>

              {/* Modal header */}
              <div className="px-5 pt-2 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vote size={16} style={{ color: '#d4a843' }} />
                  <h3 style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.95rem', fontWeight: 700 }}>
                    Vote anticipe
                  </h3>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowEarlyVoteModal(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: `rgba(${t.overlayChannel}, 0.08)` }}
                >
                  <X size={14} style={{ color: t.textMuted }} />
                </motion.button>
              </div>

              {/* Search bar */}
              <div className="px-5 pb-3">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.05)`,
                    border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                  }}
                >
                  <Search size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Rechercher un joueur..."
                    value={earlyVoteSearch}
                    onChange={(e) => setEarlyVoteSearch(e.target.value)}
                    autoFocus
                    className="flex-1 bg-transparent outline-none"
                    style={{
                      color: t.text,
                      fontSize: '0.7rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                  />
                  {earlyVoteSearch && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setEarlyVoteSearch('')}
                      style={{ color: t.textMuted }}
                    >
                      <X size={12} />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Subtitle */}
              <div className="px-5 pb-2">
                <p style={{ color: t.textMuted, fontSize: '0.5rem', fontStyle: 'italic' }}>
                  Selectionnez un joueur pour voter
                </p>
              </div>

              {/* Player list */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 pb-6">
                <div className="grid grid-cols-4 gap-2">
                  {filteredEarlyVoteTargets.length === 0 ? (
                    <div className="py-8 text-center col-span-4">
                      <p style={{ color: t.textMuted, fontSize: '0.65rem' }}>Aucun joueur trouve</p>
                    </div>
                  ) : (
                    filteredEarlyVoteTargets.map((p) => {
                      const isCurrentVote = earlyVoteTarget?.id === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            if (currentPlayerId !== null) {
                              onSetEarlyVote(currentPlayerId, p.id);
                              setShowEarlyVoteModal(false);
                            }
                          }}
                          className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl w-full text-center transition-all relative"
                          style={{
                            background: isCurrentVote
                              ? 'rgba(212,168,67,0.1)'
                              : `rgba(${t.overlayChannel}, 0.03)`,
                            border: isCurrentVote
                              ? '1px solid rgba(212,168,67,0.25)'
                              : `1px solid rgba(${t.overlayChannel}, 0.06)`,
                          }}
                        >
                          {isCurrentVote && (
                            <div className="absolute top-1 right-1">
                              <CircleCheck size={12} style={{ color: '#d4a843' }} />
                            </div>
                          )}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: isCurrentVote
                                ? 'rgba(212,168,67,0.15)'
                                : `rgba(${t.overlayChannel}, 0.06)`,
                              border: isCurrentVote
                                ? '2px solid rgba(212,168,67,0.4)'
                                : `1px solid rgba(${t.overlayChannel}, 0.1)`,
                            }}
                          >
                            <PAvatar player={p} size="text-base" />
                          </div>
                          <span
                            className="line-clamp-2 break-words w-full"
                            style={{
                              color: isCurrentVote ? '#d4a843' : t.text,
                              fontSize: '0.6rem',
                              fontWeight: isCurrentVote ? 700 : 500,
                              fontFamily: '"Cinzel", serif',
                              lineHeight: 1.2,
                            }}
                          >
                            {p.name}
                          </span>
                          {isCurrentVote && (
                            <span style={{ color: t.textMuted, fontSize: '0.4rem', fontStyle: 'italic' }}>
                              vote actuel
                            </span>
                          )}
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sticky cancel footer — only when a vote exists */}
              {earlyVoteTarget && (
                <div
                  className="px-5 py-4 flex gap-3"
                  style={{
                    borderTop: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                    background: 'linear-gradient(180deg, rgba(15,14,30,0.95) 0%, #0a0e1a 100%)',
                  }}
                >
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (currentPlayerId !== null) onCancelEarlyVote(currentPlayerId);
                      setShowEarlyVoteModal(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                    style={{
                      background: `rgba(${t.overlayChannel}, 0.06)`,
                      border: `1px solid rgba(${t.overlayChannel}, 0.12)`,
                      color: t.textMuted,
                      fontSize: '0.65rem',
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 600,
                    }}
                  >
                    <X size={13} />
                    Retirer le vote
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      , document.body)}
    </div>
  );
}