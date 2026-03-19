import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Player } from '../../../context/GameContext';
import { resolveAvatarUrl } from '../../../data/avatarResolver';

/** Hook: is screen < 640px? */
function useIsMobile(breakpoint = 640) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    setMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return mobile;
}

/** Avatar renderer (mirrors SAvatar from SpectatorPage) */
function MarqueeAvatar({ player, size = 72, dead }: {
  player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'>;
  size?: number;
  dead?: boolean;
}) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className="rounded-full object-cover inline-block"
        style={{
          width: size, height: size,
          filter: dead ? 'grayscale(1) brightness(0.5)' : 'none',
        }}
      />
    );
  }
  return (
    <span style={{
      fontSize: size * 0.55,
      filter: dead ? 'grayscale(1) brightness(0.5)' : 'none',
      lineHeight: 1,
    }}>
      {player.avatar}
    </span>
  );
}

interface PlayerMarqueeProps {
  players: Player[];
  isNight: boolean;
  voteCounts: Record<number, number>;
  topVotedId: number | null;
  isVotePhase: boolean;
  isVoteResult: boolean;
  totalVotes: number;
  totalAlive: number;
  isMaireElection: boolean;
  maireCandidates: number[];
  nominations: Record<number, number>;
  maireId?: number | null;
}

const SCROLL_SPEED = 60; // px per second
const ITEM_GAP = 48; // gap between player cards in px

const PlayerMarquee = React.memo(function PlayerMarquee({
  players, isNight, voteCounts, topVotedId, isVotePhase, isVoteResult, totalVotes, totalAlive,
  isMaireElection, maireCandidates, nominations, maireId,
}: PlayerMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  // Responsive sizes
  const isMobile = useIsMobile();
  const avatarOuter = isMobile ? 44 : 80;
  const avatarInner = isMobile ? 38 : 72;
  const cardWidth = isMobile ? 60 : 120;
  const badgeSize = isMobile ? 20 : 32;
  const badgeSizeTop = isMobile ? 24 : 38;
  const gap = isMobile ? 16 : ITEM_GAP;

  // Determine which players to display based on phase
  const displayPlayers = useMemo(() => {
    const deadPlayers = players.filter((p) => !p.alive);
    const alivePlayers = players.filter((p) => p.alive);

    if (isMaireElection) {
      // Maire election: only show candidates
      return alivePlayers.filter((p) => maireCandidates.includes(p.id));
    }

    if (isNight) {
      // Night: show only dead players
      return deadPlayers;
    }

    // Day: show only players who currently have votes
    const visibleIds = new Set<number>();
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > 0) visibleIds.add(Number(targetId));
    }
    const visibleAlive = alivePlayers.filter((p) => visibleIds.has(p.id));

    return visibleAlive;
  }, [players, isNight, isMaireElection, maireCandidates, voteCounts]);

  // Should we scroll? Only if content overflows the container
  const shouldScroll = trackWidth > 0 && containerWidth > 0 && trackWidth > containerWidth;

  // Measure a single set width + container width
  const measure = useCallback(() => {
    if (!trackRef.current || !containerRef.current) return;
    const children = trackRef.current.children;
    if (children.length >= 1) {
      const first = children[0] as HTMLElement;
      setTrackWidth(first.offsetWidth);
    }
    setContainerWidth(containerRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure, displayPlayers.length]);

  // Reset scroll offset when display players change
  useEffect(() => {
    offsetRef.current = 0;
    if (trackRef.current) {
      trackRef.current.style.transform = 'translateX(0px)';
    }
  }, [displayPlayers.length, isMaireElection, isNight]);

  // Animation loop via requestAnimationFrame for buttery smooth scroll
  useEffect(() => {
    if (!shouldScroll) {
      // Reset position when not scrolling
      if (trackRef.current) {
        trackRef.current.style.transform = 'translateX(0px)';
      }
      offsetRef.current = 0;
      return;
    }
    let lastTime: number | null = null;
    const animate = (time: number) => {
      if (lastTime !== null) {
        const dt = (time - lastTime) / 1000;
        offsetRef.current -= SCROLL_SPEED * dt;
        if (offsetRef.current <= -trackWidth) {
          offsetRef.current += trackWidth;
        }
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
        }
      }
      lastTime = time;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [shouldScroll, trackWidth]);

  const renderPlayer = (player: Player, keyPrefix: string) => {
    const dead = !player.alive;
    const voteCount = voteCounts[player.id] || 0;
    const isTop = topVotedId === player.id;
    const hasVotes = voteCount > 0;
    const isMaire = maireId != null && player.id === maireId;
    const isTopMaireElection = isTop && isMaireElection;

    return (
      <div
        key={`${keyPrefix}-${player.id}`}
        className="flex flex-col items-center shrink-0"
        style={{ width: `${cardWidth}px`, gap: isMobile ? '4px' : '8px' }}
      >
        <div className="relative">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: avatarOuter, height: avatarOuter,
              background: dead
                ? 'rgba(80,80,80,0.25)'
                : isTopMaireElection
                  ? 'rgba(212,168,67,0.2)'
                  : isTop
                    ? 'rgba(196,30,58,0.2)'
                    : isNight
                      ? 'rgba(139,92,246,0.1)'
                      : 'rgba(255,255,255,0.12)',
              border: dead
                ? '3px solid rgba(120,120,120,0.3)'
                : isTopMaireElection
                  ? '3px solid rgba(212,168,67,0.6)'
                  : isTop
                    ? '3px solid rgba(196,30,58,0.6)'
                    : isNight
                      ? '3px solid rgba(139,92,246,0.25)'
                      : '3px solid rgba(255,255,255,0.2)',
              boxShadow: isTopMaireElection
                ? '0 0 24px rgba(212,168,67,0.35)'
                : isTop
                  ? '0 0 24px rgba(196,30,58,0.3)'
                  : '0 3px 10px rgba(0,0,0,0.3)',
            }}
          >
            <MarqueeAvatar player={player} size={avatarInner} dead={dead} />
          </div>

          {/* Dead indicator */}
          {dead && (
            <div
              className="absolute -top-1 -right-1 rounded-full flex items-center justify-center"
              style={{
                width: badgeSize, height: badgeSize,
                background: 'rgba(0,0,0,0.7)',
                border: '2px solid rgba(196,30,58,0.5)',
                fontSize: isMobile ? '0.6rem' : '1rem',
              }}
            >
              💀
            </div>
          )}

          {/* Vote count badge */}
          {hasVotes && !dead && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 rounded-full flex items-center justify-center"
              style={{
                width: isTop ? badgeSizeTop : badgeSize,
                height: isTop ? badgeSizeTop : badgeSize,
                background: isTopMaireElection ? '#d4a843' : isTop ? '#c41e3a' : 'rgba(139,115,85,0.9)',
                color: '#fff',
                fontSize: isTop ? (isMobile ? '0.7rem' : '1.3rem') : (isMobile ? '0.6rem' : '1.1rem'),
                fontWeight: 800,
                boxShadow: isTopMaireElection ? '0 2px 10px rgba(212,168,67,0.4)' : '0 2px 8px rgba(0,0,0,0.4)',
                border: '2px solid rgba(255,255,255,0.2)',
              }}
            >
              {voteCount}
            </motion.div>
          )}

          {/* Maire crown badge */}
          {isMaire && (
            <div
              className="absolute -bottom-1 -left-1 rounded-full flex items-center justify-center"
              style={{
                width: isMobile ? 18 : 30,
                height: isMobile ? 18 : 30,
                background: 'rgba(0,0,0,0.75)',
                border: '2px solid rgba(212,168,67,0.5)',
                fontSize: isMobile ? '0.55rem' : '0.95rem',
                boxShadow: '0 0 8px rgba(212,168,67,0.25)',
              }}
            >
              👑
            </div>
          )}
        </div>

        {/* Name */}
        <p
          className="text-center leading-tight truncate w-full"
          style={{
            color: dead ? 'rgba(255,255,255,0.35)' : isTopMaireElection ? '#f0c55b' : isTop ? '#ff8a95' : '#fff',
            fontSize: isMobile ? '0.6rem' : '1.15rem',
            fontWeight: dead ? 400 : isTop ? 700 : 500,
            textShadow: isTopMaireElection ? '0 2px 8px rgba(212,168,67,0.4)' : '0 2px 6px rgba(0,0,0,0.7)',
            textDecoration: dead ? 'line-through' : 'none',
            textDecorationColor: dead ? 'rgba(196,30,58,0.4)' : undefined,
          }}
        >
          {player.name}
        </p>

        {/* Status label for dead */}
        {dead && (
          <span style={{
            color: 'rgba(196,30,58,0.7)',
            fontSize: isMobile ? '0.45rem' : '0.85rem',
            fontFamily: '"Cinzel", serif',
            letterSpacing: '0.06em',
            marginTop: '-4px',
          }}>
            Mort
          </span>
        )}
      </div>
    );
  };

  // Empty state
  if (displayPlayers.length === 0) {
    const emptyLabel = isMaireElection
      ? 'Aucun candidat pour le moment'
      : 'En attente...';
    return (
      <div className="w-full" style={{ paddingBottom: '1.5rem', paddingTop: '1rem' }}>
        {/* Vote progress bar */}
        {isVotePhase && !isVoteResult && (
          <div className="mx-auto mb-4" style={{ maxWidth: '800px', padding: '0 2.5rem' }}>
            <div className="w-full rounded-full overflow-hidden" style={{ height: '10px', background: 'rgba(255,255,255,0.12)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #d4a843, #f0c55b)' }}
                initial={{ width: 0 }}
                animate={{ width: `${totalAlive > 0 ? (totalVotes / totalAlive) * 100 : 0}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        )}
        <p className="text-center" style={{
          fontFamily: '"Cinzel", serif',
          color: 'rgba(255,255,255,0.4)',
          fontSize: isMobile ? '0.8rem' : '1.3rem',
          paddingBottom: '1rem',
        }}>
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ paddingBottom: '1.5rem', paddingTop: '1rem' }}>
      {/* Vote progress bar */}
      {isVotePhase && !isVoteResult && (
        <div className="mx-auto mb-4" style={{ maxWidth: '800px', padding: '0 2.5rem' }}>
          <div className="w-full rounded-full overflow-hidden" style={{ height: '10px', background: 'rgba(255,255,255,0.12)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #d4a843, #f0c55b)' }}
              initial={{ width: 0 }}
              animate={{ width: `${totalAlive > 0 ? (totalVotes / totalAlive) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      )}

      {/* Scrolling track: two copies for seamless loop, or single centered if fits */}
      <div
        ref={trackRef}
        className={`flex items-center ${shouldScroll ? '' : 'justify-center'}`}
        style={{ willChange: shouldScroll ? 'transform' : 'auto' }}
      >
        <div className="flex items-center shrink-0" style={{ gap: `${gap}px`, paddingRight: shouldScroll ? `${gap}px` : '0' }}>
          {displayPlayers.map((p) => renderPlayer(p, 'a'))}
        </div>
        {shouldScroll && (
          <div className="flex items-center shrink-0" style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}>
            {displayPlayers.map((p) => renderPlayer(p, 'b'))}
          </div>
        )}
      </div>
    </div>
  );
});

export { PlayerMarquee };