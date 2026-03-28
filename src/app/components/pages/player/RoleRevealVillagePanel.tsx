/**
 * RoleRevealVillagePanel.tsx
 * Replaces the Village tab content during "Découverte des rôles" phase.
 * Shows the same rotating 3D card animation as the spectator view,
 * "Découverte des rôles" title, reveal counter, and a 4-column village grid
 * grouped by player tags.
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Eye, Check, Users } from 'lucide-react';
import type { Player } from '../../../context/GameContext';
import { ROLES, type RoleDefinition } from '../../../data/roles';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';

/* ── Tag color palette ── */
const TAG_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'THIGA': { bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.30)', text: '#818cf8' },
  'ESIEE': { bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.30)', text: '#facc15' },
  'MLK': { bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.30)', text: '#fb7185' },
  'FAMILY & CO': { bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.30)', text: '#6ee7b7' },
};
const DEFAULT_TAG_COLOR = { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.7)' };

function getTagColor(tag: string) {
  return TAG_COLORS[tag] || DEFAULT_TAG_COLOR;
}

/* ── Card face renderer (same design as spectator) ── */
function CardFace({ role }: { role: RoleDefinition }) {
  const team = role.team;
  const bg =
    team === 'werewolf'
      ? 'linear-gradient(135deg, rgba(50,20,30,0.95) 0%, rgba(30,10,18,0.98) 100%)'
      : team === 'solo'
        ? 'linear-gradient(135deg, rgba(50,40,20,0.95) 0%, rgba(30,25,10,0.98) 100%)'
        : 'linear-gradient(135deg, rgba(30,40,70,0.95) 0%, rgba(15,22,41,0.98) 100%)';
  const borderColor = `${role.color}66`;
  const glowColor = `${role.color}26`;
  const teamLabel = team === 'village' ? 'Village' : team === 'werewolf' ? 'Loup' : 'Solo';
  const badgeBg =
    team === 'werewolf' ? 'rgba(196,30,58,0.15)' : team === 'solo' ? 'rgba(212,168,67,0.15)' : 'rgba(107,142,90,0.15)';
  const badgeColor = team === 'werewolf' ? '#ff6b7d' : team === 'solo' ? '#d4a843' : '#8bc470';
  const badgeBorder =
    team === 'werewolf' ? 'rgba(196,30,58,0.3)' : team === 'solo' ? 'rgba(212,168,67,0.3)' : 'rgba(107,142,90,0.3)';

  return (
    <div
      className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2"
      style={{
        backfaceVisibility: 'hidden',
        background: bg,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 40px ${glowColor}, 0 6px 24px rgba(0,0,0,0.5)`,
        padding: '1rem',
      }}
    >
      <span
        className="px-2 py-0.5 rounded-full"
        style={{
          fontSize: '0.5rem',
          fontFamily: '"Cinzel", serif',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          background: badgeBg,
          color: badgeColor,
          border: `1px solid ${badgeBorder}`,
        }}
      >
        {teamLabel}
      </span>
      <span style={{ fontSize: '2.8rem', lineHeight: 1 }}>{role.emoji}</span>
      <span
        style={{
          fontFamily: '"Cinzel Decorative", serif',
          color: role.color,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textAlign: 'center',
          textShadow: `0 0 14px ${glowColor}`,
        }}
      >
        {role.name}
      </span>
    </div>
  );
}

/* ── Player cell ── */
const PlayerCell = React.memo(function PlayerCell({
  p, idx, hasSeen,
}: { p: Player; idx: number; hasSeen: boolean }) {
  return (
    <motion.div
      key={p.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: idx * 0.03 }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center relative"
        style={{
          background: hasSeen ? 'rgba(107,142,90,0.12)' : 'rgba(139,92,246,0.06)',
          border: `2px solid ${hasSeen ? 'rgba(107,142,90,0.4)' : 'rgba(139,92,246,0.15)'}`,
          transition: 'border-color 0.4s, background 0.4s',
        }}
      >
        <PAvatar player={p} size="text-lg" />
        {/* Status badge */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{
            background: hasSeen ? 'rgba(107,142,90,0.9)' : 'rgba(60,60,80,0.8)',
            border: `2px solid ${hasSeen ? 'rgba(140,196,112,0.5)' : 'rgba(139,92,246,0.2)'}`,
            transition: 'background 0.4s, border-color 0.4s',
          }}
        >
          {hasSeen ? (
            <Check size={8} style={{ color: '#fff' }} />
          ) : (
            <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)' }}>...</span>
          )}
        </div>
      </div>
      <span
        className="truncate w-full text-center"
        style={{
          color: hasSeen ? 'rgba(140,196,112,0.9)' : 'rgba(255,255,255,0.45)',
          fontSize: '0.5rem',
          fontWeight: hasSeen ? 600 : 400,
          maxWidth: '3.5rem',
          margin: '0 auto',
          transition: 'color 0.4s',
        }}
      >
        {p.name}
      </span>
    </motion.div>
  );
});

/* ── Main component ── */
interface RoleRevealVillagePanelProps {
  players: Player[];
  roleRevealedBy: number[];
  t: GameThemeTokens;
  playerTags?: Record<number, string[]>;
}

export const RoleRevealVillagePanel = React.memo(function RoleRevealVillagePanel({
  players,
  roleRevealedBy,
  t,
  playerTags = {},
}: RoleRevealVillagePanelProps) {
  const totalPlayers = players.length;
  const revealedCount = roleRevealedBy.length;
  const allRevealed = revealedCount === totalPlayers && totalPlayers > 0;

  /* ── Group players by tags ── */
  const { tagGroups, untaggedPlayers } = useMemo(() => {
    const hasTags = Object.values(playerTags).some((tags) => tags.length > 0);
    if (!hasTags) return { tagGroups: [] as { tag: string; players: Player[] }[], untaggedPlayers: players };

    // Collect all unique tags in stable order
    const allTags = new Set<string>();
    players.forEach((p) => {
      const tags = playerTags[p.id];
      if (tags) tags.forEach((tag) => allTags.add(tag));
    });

    // Include player in every group they belong to (multi-tag support)
    const taggedPlayerIds = new Set<number>();
    const groups: { tag: string; players: Player[] }[] = [];
    for (const tag of allTags) {
      const tagPlayers = players.filter((p) => (playerTags[p.id] || []).includes(tag));
      if (tagPlayers.length > 0) {
        tagPlayers.forEach((p) => taggedPlayerIds.add(p.id));
        groups.push({ tag, players: tagPlayers });
      }
    }

    const untagged = players.filter((p) => !taggedPlayerIds.has(p.id));
    return { tagGroups: groups, untaggedPlayers: untagged };
  }, [players, playerTags]);

  const hasGroups = tagGroups.length > 0;

  /* ── Rotating 3D card (same logic as spectator) ── */
  const HALF_ROTATION_MS = 2500;
  const cardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const prevHalfCountRef = useRef(0);
  const fIdxRef = useRef(0);
  const bIdxRef = useRef(1);
  const [frontRoleIdx, setFrontRoleIdx] = useState(0);
  const [backRoleIdx, setBackRoleIdx] = useState(1);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const angle = (elapsed / HALF_ROTATION_MS) * 180;

      if (cardRef.current) {
        cardRef.current.style.transform = `rotateY(${angle}deg)`;
      }

      const halfCount = Math.floor((angle + 90) / 180);
      if (halfCount > prevHalfCountRef.current) {
        prevHalfCountRef.current = halfCount;
        if (halfCount % 2 === 1) {
          fIdxRef.current = (halfCount + 1) % ROLES.length;
          setFrontRoleIdx(fIdxRef.current);
        } else {
          bIdxRef.current = (halfCount + 1) % ROLES.length;
          setBackRoleIdx(bIdxRef.current);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const frontRole = ROLES[frontRoleIdx];
  const backRole = ROLES[backRoleIdx];

  /* ── Render a grid section ── */
  const renderGrid = (sectionPlayers: Player[], baseIdx: number) => (
    <div className="grid grid-cols-4 gap-2.5">
      {sectionPlayers.map((p, idx) => {
        const hasSeen = roleRevealedBy.includes(p.id);
        return <PlayerCell key={p.id} p={p} idx={baseIdx + idx} hasSeen={hasSeen} />;
      })}
    </div>
  );

  /* ── Compute running index for stagger animation ── */
  let runningIdx = 0;

  return (
    <div className="px-4 py-5 flex flex-col items-center">
      {/* ── Rotating 3D card ── */}
      <div style={{ perspective: '1000px', marginBottom: '1rem' }}>
        <div
          ref={cardRef}
          style={{
            width: '110px',
            height: '150px',
            transformStyle: 'preserve-3d',
            position: 'relative',
            willChange: 'transform',
          }}
        >
          <CardFace role={frontRole} />
          <div
            className="absolute inset-0"
            style={{
              transform: 'rotateY(180deg)',
              backfaceVisibility: 'hidden',
              transformStyle: 'preserve-3d',
            }}
          >
            <CardFace role={backRole} />
          </div>
        </div>
      </div>

      {/* ── Title ── */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          fontFamily: '"Cinzel Decorative", serif',
          color: '#a78bfa',
          fontSize: '1.05rem',
          fontWeight: 700,
          textShadow: '0 0 30px rgba(139,92,246,0.25)',
          letterSpacing: '0.04em',
          textAlign: 'center',
          marginBottom: '0.5rem',
        }}
      >
        Decouverte des Roles
      </motion.h2>

      {/* ── Counter pill ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex items-center gap-2 px-4 py-1.5 rounded-xl mb-1"
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)',
          border: `1.5px solid ${allRevealed ? 'rgba(107,142,90,0.35)' : 'rgba(139,92,246,0.2)'}`,
        }}
      >
        <Eye size={14} style={{ color: allRevealed ? '#8bc470' : '#a78bfa', opacity: 0.8 }} />
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            fontSize: '0.95rem',
            fontWeight: 800,
            color: allRevealed ? '#8bc470' : '#d4a843',
          }}
        >
          {revealedCount}
        </span>
        <span style={{ fontFamily: '"Cinzel", serif', color: 'rgba(180,195,230,0.4)', fontSize: '0.8rem' }}>
          /
        </span>
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            fontSize: '0.95rem',
            fontWeight: 800,
            color: 'rgba(180,195,230,0.85)',
          }}
        >
          {totalPlayers}
        </span>
        <span
          style={{
            fontFamily: '"Cinzel", serif',
            color: 'rgba(180,195,230,0.6)',
            fontSize: '0.6rem',
            marginLeft: '0.15rem',
          }}
        >
          ont vu leur role
        </span>
        {allRevealed && <Check size={14} style={{ color: '#8bc470' }} />}
      </motion.div>

      {/* ── Progress bar ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-4 mt-1"
        style={{ width: '220px', maxWidth: '80%' }}
      >
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: '4px', background: 'rgba(255,255,255,0.06)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: allRevealed
                ? 'linear-gradient(90deg, #6b8e5a, #8bc470)'
                : 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            }}
            animate={{ width: `${totalPlayers > 0 ? (revealedCount / totalPlayers) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          />
        </div>
      </motion.div>

      {/* ── Village grid (grouped by tags or flat) ── */}
      {hasGroups ? (
        <div className="w-full flex flex-col gap-3">
          {tagGroups.map((group) => {
            const tc = getTagColor(group.tag);
            const groupRevealedCount = group.players.filter((p) => roleRevealedBy.includes(p.id)).length;
            const baseIdx = runningIdx;
            runningIdx += group.players.length;
            return (
              <div
                key={group.tag}
                className="w-full rounded-xl p-3"
                style={{
                  background: tc.bg,
                  border: `1px solid ${tc.border}`,
                }}
              >
                {/* Tag header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <Users size={12} style={{ color: tc.text, opacity: 0.7 }} />
                  <span
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: tc.text,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {group.tag}
                  </span>
                  <span
                    style={{
                      fontSize: '0.55rem',
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    {groupRevealedCount}/{group.players.length}
                  </span>
                </div>
                {renderGrid(group.players, baseIdx)}
              </div>
            );
          })}

          {/* Untagged players */}
          {untaggedPlayers.length > 0 && (
            <div
              className="w-full rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <Users size={12} style={{ color: 'rgba(255,255,255,0.4)', opacity: 0.7 }} />
                <span
                  style={{
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Autres
                </span>
                <span
                  style={{
                    fontSize: '0.55rem',
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  {untaggedPlayers.filter((p) => roleRevealedBy.includes(p.id)).length}/{untaggedPlayers.length}
                </span>
              </div>
              {renderGrid(untaggedPlayers, runningIdx)}
            </div>
          )}
        </div>
      ) : (
        /* ── Flat grid (no tags) ── */
        <div
          className="w-full rounded-xl p-3"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {renderGrid(players, 0)}
        </div>
      )}
    </div>
  );
});
