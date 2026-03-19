import React, { useState, type CSSProperties } from 'react';
import { type Player } from '../../../context/gameTypes';
import { resolveAvatarUrl } from '../../../data/avatarResolver';

export const GMAvatar = React.memo(function GMAvatar({ player, size = 'text-lg', className = '', style }: {
  player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'> & { alive?: boolean };
  size?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  const [imgError, setImgError] = useState(false);
  // Reset error state when avatarUrl changes
  const [prevUrl, setPrevUrl] = useState(resolvedUrl);
  if (resolvedUrl !== prevUrl) {
    setPrevUrl(resolvedUrl);
    setImgError(false);
  }

  const sizeMap: Record<string, string> = {
    'text-xs': 'w-4 h-4', 'text-sm': 'w-5 h-5', 'text-base': 'w-6 h-6',
    'text-lg': 'w-7 h-7', 'text-xl': 'w-8 h-8', 'text-2xl': 'w-9 h-9', 'text-3xl': 'w-10 h-10',
  };
  if (resolvedUrl && !imgError) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className={`${sizeMap[size] || 'w-7 h-7'} rounded-full object-cover inline-block ${className}`}
        style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}
        onError={() => setImgError(true)}
      />
    );
  }
  return <span className={`${size} ${className}`} style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}>{player.avatar}</span>;
});