import React from 'react';
import { Users, Crown, Tag } from 'lucide-react';
import { type Player } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { getRoleById } from '../../../data/roles';
import { GMAvatar, SectionHeader, getConnectionStatus } from './GMShared';

/* ================================================================
   GMVillageGrid — shared village player grid (desktop + mobile).
   Desktop: responsive columns, sorted alive-first, connection dots,
            role emoji, larger avatars.
   Mobile (compact): 4-col fixed, unsorted, smaller avatars,
            no connection dot, no role emoji.
   Supports optional grouping by playerTags with section headers.
   ================================================================ */

interface GMVillageGridProps {
  players: Player[];
  selectedPlayer: number | null;
  maireId: number | null;
  onPlayerClick: (playerId: number) => void;
  t: GameThemeTokens;
  compact?: boolean;
  /** Desktop only: heartbeat map for connection status dots. */
  playerHeartbeats?: Record<string, number>;
  /** Optional tag map for grouping players by tag. */
  playerTags?: Record<number, string[]>;
}

export const GMVillageGrid = React.memo(function GMVillageGrid({
  players, selectedPlayer, maireId, onPlayerClick, t,
  compact = false, playerHeartbeats, playerTags,
}: GMVillageGridProps) {
  const sortedPlayers = compact
    ? players
    : [...players].sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1));

  // ── Tag grouping logic ──
  const hasTags = playerTags && Object.values(playerTags).some((tags) => tags.length > 0);

  const { tagGroups, untaggedPlayers } = React.useMemo(() => {
    if (!hasTags || !playerTags) return { tagGroups: [] as { tag: string; players: Player[] }[], untaggedPlayers: sortedPlayers };

    const allTags = new Set<string>();
    sortedPlayers.forEach((p) => {
      const tags = playerTags[p.id];
      if (tags) tags.forEach((tag) => allTags.add(tag));
    });
    const sortedTags = Array.from(allTags).sort();

    const groups = sortedTags.map((tag) => ({
      tag,
      players: sortedPlayers.filter((p) => playerTags[p.id]?.includes(tag)),
    })).filter((g) => g.players.length > 0);

    const untagged = sortedPlayers.filter(
      (p) => !playerTags[p.id] || playerTags[p.id].length === 0,
    );

    return { tagGroups: groups, untaggedPlayers: untagged };
  }, [sortedPlayers, playerTags, hasTags]);

  // ── Render a player grid ──
  const renderPlayerGrid = (gridPlayers: Player[]) => {
    const sorted = [...gridPlayers].sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1));
    return (
    <div className={compact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3'}>
      {sorted.map((p) => (
        <PlayerCell
          key={p.id}
          player={p}
          compact={compact}
          selectedPlayer={selectedPlayer}
          maireId={maireId}
          onPlayerClick={onPlayerClick}
          playerHeartbeats={playerHeartbeats}
          t={t}
        />
      ))}
    </div>
    );
  };

  // ── Tag section header ──
  const renderTagHeader = (tag: string, count: number) => (
    <div
      className="flex items-center gap-1.5 mt-3 mb-1.5"
      style={{ color: t.textDim }}
    >
      <Tag size={compact ? 10 : 12} style={{ opacity: 0.6 }} />
      <span
        style={{
          fontSize: compact ? '0.6rem' : '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {tag}
      </span>
      <span
        style={{
          fontSize: compact ? '0.55rem' : '0.6rem',
          opacity: 0.5,
        }}
      >
        ({count})
      </span>
    </div>
  );

  return (
    <div
      className={compact ? 'rounded-xl p-3' : 'rounded-xl p-5'}
      style={{
        background: compact ? `rgba(${t.overlayChannel}, 0.02)` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${compact ? `rgba(${t.overlayChannel}, 0.06)` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <SectionHeader icon={<Users size={14} />} title="Le Village" t={t} />

      {hasTags ? (
        <div className="mt-2">
          {tagGroups.map((group) => (
            <div key={group.tag}>
              {renderTagHeader(group.tag, group.players.length)}
              {renderPlayerGrid(group.players)}
            </div>
          ))}
          {untaggedPlayers.length > 0 && (
            <div>
              {renderTagHeader('Sans tag', untaggedPlayers.length)}
              {renderPlayerGrid(untaggedPlayers)}
            </div>
          )}
        </div>
      ) : (
        <div className={compact ? 'mt-2' : 'mt-3'}>
          {renderPlayerGrid(sortedPlayers)}
        </div>
      )}
    </div>
  );
});

/* ── Individual player cell (extracted for clarity) ── */

const PlayerCell = React.memo(function PlayerCell({
  player: p, compact, selectedPlayer, maireId, onPlayerClick, playerHeartbeats, t,
}: {
  player: Player;
  compact: boolean;
  selectedPlayer: number | null;
  maireId: number | null;
  onPlayerClick: (id: number) => void;
  playerHeartbeats?: Record<string, number>;
  t: GameThemeTokens;
}) {
  const role = getRoleById(p.role);
  const isSelected = selectedPlayer === p.id;
  const gridConn = !compact && playerHeartbeats
    ? getConnectionStatus(p.shortCode, playerHeartbeats)
    : null;

  return (
    <button
      onClick={() => onPlayerClick(p.id)}
      className={
        compact
          ? 'flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all'
          : 'flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all hover:bg-white/[0.02]'
      }
      style={{
        background: isSelected
          ? (compact ? t.goldBg : 'rgba(212,168,67,0.08)')
          : 'transparent',
        border: isSelected
          ? `1px solid ${compact ? t.goldBorder : 'rgba(212,168,67,0.2)'}`
          : '1px solid transparent',
        opacity: p.alive ? 1 : 0.35,
      }}
    >
      {/* Avatar circle */}
      <div
        className={
          compact
            ? 'w-10 h-10 rounded-full flex items-center justify-center relative'
            : 'w-12 h-12 rounded-full flex items-center justify-center relative'
        }
        style={{
          background: p.alive ? `${role?.color || '#666'}10` : 'rgba(255,255,255,0.02)',
          border: `${compact ? '1.5px' : '2px'} solid ${
            p.alive ? (role?.color || '#666') + '30' : 'rgba(255,255,255,0.06)'
          }`,
        }}
      >
        <GMAvatar player={p} size={compact ? 'text-lg' : 'text-xl'} />

        {/* Dead overlay */}
        {!p.alive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={compact ? 'text-xs opacity-60' : 'text-sm opacity-60'}>💀</span>
          </div>
        )}

        {/* Connection status dot — desktop only */}
        {!compact && p.alive && gridConn && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: gridConn.color, borderColor: '#0a1020' }}
            title={gridConn.label}
          />
        )}

        {/* Maire badge */}
        {maireId === p.id && (
          <div
            className={
              compact
                ? 'absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center'
                : 'absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center'
            }
            style={{
              background: '#d4a843',
              border: `${compact ? '1.5px' : '2px'} solid #0a1020`,
            }}
            title="Maire"
          >
            <Crown size={compact ? 8 : 10} style={{ color: '#0a0e1a' }} />
          </div>
        )}
      </div>

      {/* Player name */}
      <span
        className={compact ? 'truncate max-w-[3rem]' : 'truncate max-w-[3.5rem]'}
        style={{
          color: p.alive ? t.text : t.textDim,
          fontSize: compact ? '0.5rem' : '0.6rem',
          textAlign: 'center',
        }}
      >
        {p.name}
      </span>

      {/* Role emoji — desktop only */}
      {!compact && (
        <span style={{ fontSize: '0.55rem', color: role?.color || '#6b7b9b' }}>
          {role?.emoji}
        </span>
      )}
    </button>
  );
});