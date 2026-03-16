import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Player } from '../../../context/GameContext';
import { resolveAvatarUrl } from '../../../data/avatarResolver';

/** Renders a player's avatar — image if uploaded, emoji otherwise */
export const PAvatar = React.memo(function PAvatar({ player, size = 'text-lg', className = '', style }: {
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

  if (resolvedUrl && !imgError) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className={`w-full h-full rounded-full object-cover inline-block ${className}`}
        style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}
        onError={() => setImgError(true)}
      />
    );
  }
  return <span className={`${size} ${className} flex items-center justify-center w-full h-full`} style={{ filter: player.alive === false ? 'grayscale(1)' : 'none', ...style }}>{player.avatar}</span>;
});