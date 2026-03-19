import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Player } from '../context/GameContext';
import { resolveAvatarUrl } from '../data/avatarResolver';

interface PlayerAvatarProps {
  player: Player;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  onClick?: () => void;
  showVotes?: boolean;
  showRole?: boolean;
  roleName?: string;
  roleColor?: string;
}

export const PlayerAvatar = React.memo(function PlayerAvatar({
  player,
  size = 'md',
  selected = false,
  onClick,
  showVotes = false,
  showRole = false,
  roleName,
  roleColor,
}: PlayerAvatarProps) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  const [imgError, setImgError] = useState(false);
  const [prevUrl, setPrevUrl] = useState(resolvedUrl);
  if (resolvedUrl !== prevUrl) {
    setPrevUrl(resolvedUrl);
    setImgError(false);
  }

  const sizes = {
    sm: { container: 'w-12 h-12', emoji: 'text-xl', name: '0.55rem', img: 'w-10 h-10' },
    md: { container: 'w-16 h-16', emoji: 'text-2xl', name: '0.65rem', img: 'w-14 h-14' },
    lg: { container: 'w-20 h-20', emoji: 'text-3xl', name: '0.75rem', img: 'w-18 h-18' },
  };

  const s = sizes[size];

  return (
    <motion.button
      whileTap={onClick ? { scale: 0.9 } : undefined}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      disabled={!onClick}
    >
      <div
        className={`${s.container} rounded-full flex items-center justify-center relative transition-all duration-300 overflow-hidden`}
        style={{
          background: !player.alive
            ? 'rgba(255,255,255,0.03)'
            : selected
              ? 'rgba(212,168,67,0.15)'
              : 'rgba(255,255,255,0.05)',
          border: `2px solid ${
            !player.alive
              ? 'rgba(255,255,255,0.05)'
              : selected
                ? '#d4a843'
                : 'rgba(255,255,255,0.1)'
          }`,
          opacity: player.alive ? 1 : 0.4,
          boxShadow: selected ? '0 0 15px rgba(212,168,67,0.2)' : 'none',
        }}
      >
        {resolvedUrl && !imgError ? (
          <img
            src={resolvedUrl}
            alt={player.name}
            className="w-full h-full object-cover rounded-full"
            style={{ filter: player.alive ? 'none' : 'grayscale(1)' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={s.emoji} style={{ filter: player.alive ? 'none' : 'grayscale(1)' }}>
            {player.avatar}
          </span>
        )}

        {/* Dead marker */}
        {!player.alive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl opacity-60">&#x1F480;</span>
          </div>
        )}

        {/* Vote count badge */}
        {showVotes && player.votesReceived > 0 && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: '#c41e3a', fontSize: '0.6rem', color: 'white' }}
          >
            {player.votesReceived}
          </div>
        )}
      </div>

      <span
        className="text-center truncate max-w-[4.5rem]"
        style={{
          color: !player.alive ? '#4a5568' : selected ? '#d4a843' : '#8090b0',
          fontSize: s.name,
        }}
      >
        {player.name}
      </span>

      {showRole && roleName && (
        <span
          className="px-2 py-0.5 rounded-full"
          style={{
            fontSize: '0.5rem',
            color: roleColor || '#8090b0',
            background: `${roleColor || '#8090b0'}15`,
            border: `1px solid ${roleColor || '#8090b0'}30`,
          }}
        >
          {roleName}
        </span>
      )}
    </motion.button>
  );
});