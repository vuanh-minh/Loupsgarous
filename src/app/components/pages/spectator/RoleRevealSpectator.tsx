/**
 * RoleRevealSpectator.tsx
 * Fullscreen spectator view during the "Découverte des rôles" phase.
 * Continuously rotating 3D card cycling through all roles, title, reveal count,
 * and a scrolling player marquee.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import type { Player } from '../../../context/GameContext';
import { ROLES, type RoleDefinition } from '../../../data/roles';
const nightVillageBg = '/assets/backgrounds/night-village.png';
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

/* ── Tiny avatar helper ── */
function RAvatar({ player, size = 56 }: { player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'>; size?: number }) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt={player.name}
        className="rounded-full object-cover inline-block"
        style={{ width: size, height: size }}
      />
    );
  }
  return <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{player.avatar}</span>;
}

/* ══════════════════════════════════════════════════════
   Scrolling player strip
   ══════════════════════════════════════════════════════ */
const SCROLL_SPEED = 50;
const ITEM_WIDTH = 130;
const ITEM_GAP = 32;

const RevealMarquee = React.memo(function RevealMarquee({
  players,
  revealedIds,
}: {
  players: Player[];
  revealedIds: number[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);

  const measure = useCallback(() => {
    if (!trackRef.current || !containerRef.current) return;
    const children = trackRef.current.children;
    if (children.length >= 1) {
      setTrackWidth((children[0] as HTMLElement).offsetWidth);
    }
    setContainerWidth(containerRef.current.offsetWidth);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure, players.length]);

  const shouldScroll = trackWidth > 0 && containerWidth > 0 && trackWidth > containerWidth;

  useEffect(() => {
    if (!shouldScroll) {
      if (trackRef.current) trackRef.current.style.transform = 'translateX(0px)';
      offsetRef.current = 0;
      return;
    }
    let lastTime: number | null = null;
    const animate = (time: number) => {
      if (lastTime !== null) {
        const dt = (time - lastTime) / 1000;
        offsetRef.current -= SCROLL_SPEED * dt;
        if (offsetRef.current <= -trackWidth) offsetRef.current += trackWidth;
        if (trackRef.current) trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
      }
      lastTime = time;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [shouldScroll, trackWidth]);

  const renderPlayer = (p: Player, prefix: string) => {
    const seen = revealedIds.includes(p.id);
    return (
      <div
        key={`${prefix}-${p.id}`}
        className="flex flex-col items-center shrink-0"
        style={{ width: `${ITEM_WIDTH}px`, gap: '8px' }}
      >
        <div className="relative">
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              background: seen ? 'rgba(107,142,90,0.15)' : 'rgba(139,92,246,0.08)',
              border: seen ? '3px solid rgba(107,142,90,0.5)' : '3px solid rgba(139,92,246,0.2)',
              boxShadow: seen ? '0 0 20px rgba(107,142,90,0.2)' : '0 3px 10px rgba(0,0,0,0.3)',
              transition: 'border-color 0.5s, background 0.5s, box-shadow 0.5s',
            }}
          >
            <RAvatar player={p} size={64} />
          </div>
          <div
            className="absolute -top-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              background: seen ? 'rgba(107,142,90,0.9)' : 'rgba(60,60,80,0.8)',
              border: seen ? '2px solid rgba(140,196,112,0.6)' : '2px solid rgba(139,92,246,0.3)',
              fontSize: '0.85rem',
              transition: 'background 0.5s, border-color 0.5s',
            }}
          >
            {seen ? '✓' : '…'}
          </div>
        </div>
        <p
          className="text-center leading-tight truncate w-full"
          style={{
            color: seen ? 'rgba(140,196,112,0.9)' : 'rgba(255,255,255,0.5)',
            fontSize: '1.05rem',
            fontWeight: seen ? 600 : 400,
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
            transition: 'color 0.5s',
          }}
        >
          {p.name}
        </p>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="w-full overflow-hidden" style={{ paddingBottom: '1.5rem', paddingTop: '1rem' }}>
      <div
        ref={trackRef}
        className={`flex items-center ${shouldScroll ? '' : 'justify-center'}`}
        style={{ willChange: shouldScroll ? 'transform' : 'auto' }}
      >
        <div className="flex items-center shrink-0" style={{ gap: `${ITEM_GAP}px`, paddingRight: shouldScroll ? `${ITEM_GAP}px` : '0' }}>
          {players.map((p) => renderPlayer(p, 'a'))}
        </div>
        {shouldScroll && (
          <div className="flex items-center shrink-0" style={{ gap: `${ITEM_GAP}px`, paddingRight: `${ITEM_GAP}px` }}>
            {players.map((p) => renderPlayer(p, 'b'))}
          </div>
        )}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   Card face renderer
   ══════════════════════════════════════════════════════ */
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
      className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3"
      style={{
        backfaceVisibility: 'hidden',
        background: bg,
        border: `3px solid ${borderColor}`,
        boxShadow: `0 0 60px ${glowColor}, 0 8px 32px rgba(0,0,0,0.5)`,
        padding: '1.5rem',
      }}
    >
      <span
        className="px-3 py-1 rounded-full"
        style={{
          fontSize: '0.75rem',
          fontFamily: '"Cinzel", serif',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          background: badgeBg,
          color: badgeColor,
          border: `1px solid ${badgeBorder}`,
        }}
      >
        {teamLabel}
      </span>
      <span style={{ fontSize: '5rem', lineHeight: 1 }}>{role.emoji}</span>
      <span
        style={{
          fontFamily: '"Cinzel Decorative", serif',
          color: role.color,
          fontSize: '1.15rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textAlign: 'center',
          textShadow: `0 0 20px ${glowColor}`,
        }}
      >
        {role.name}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════ */
export interface RoleRevealSpectatorProps {
  players: Player[];
  roleRevealedBy: number[];
}

export const RoleRevealSpectator = React.memo(function RoleRevealSpectator({
  players,
  roleRevealedBy,
}: RoleRevealSpectatorProps) {
  const totalPlayers = players.length;
  const revealedCount = roleRevealedBy.length;
  const allRevealed = revealedCount === totalPlayers && totalPlayers > 0;

  /*
   * Single 3D card with front & back face, continuously rotating around Y.
   * Each face has backfaceVisibility:hidden — no mirrored text.
   * Every 180° the visible face changes, and we swap the now-hidden face's
   * content to the next role so a new role appears each half-turn.
   *
   * Sequence: role0(front) → role1(back) → role2(front) → role3(back) → …
   * Loops infinitely through all 11 roles.
   *
   * Rotation + swaps are both driven by one rAF loop from the same clock,
   * so they can never drift apart.
   */
  const HALF_ROTATION_MS = 2500; // 2.5s per 180° flip
  const cardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // How many 180° half-turns we've completed so far
  const prevHalfCountRef = useRef(0);
  // Role index for each face (refs for rAF, state for React render)
  const fIdxRef = useRef(0);
  const bIdxRef = useRef(1);
  const [frontRoleIdx, setFrontRoleIdx] = useState(0);
  const [backRoleIdx, setBackRoleIdx] = useState(1);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;

      // Continuous angle — never resets, so the card spins smoothly forever
      const angle = (elapsed / HALF_ROTATION_MS) * 180;

      // Apply transform directly to DOM — no React re-render needed
      if (cardRef.current) {
        cardRef.current.style.transform = `rotateY(${angle}deg)`;
      }

      // Count completed half-turns (edge-on crossings at 90°, 270°, 450°, …)
      // A half-turn boundary is at every 180° offset by 90°: 90, 270, 450, …
      // i.e. Math.floor((angle + 90) / 180)
      const halfCount = Math.floor((angle + 90) / 180);

      if (halfCount > prevHalfCountRef.current) {
        prevHalfCountRef.current = halfCount;

        // halfCount odd → front just went behind → swap front to next role
        // halfCount even → back just went behind → swap back to next role
        if (halfCount % 2 === 1) {
          // Front hidden, back now showing — prep front for its next appearance
          // Next role index: the card shows roles 0,1,2,3,… in order.
          // Front showed role at halfCount-1 (=0,2,4,…), next front = halfCount+1
          fIdxRef.current = (halfCount + 1) % ROLES.length;
          setFrontRoleIdx(fIdxRef.current);
        } else {
          // Back hidden, front now showing — prep back for its next appearance
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

  const isMobile = useIsMobile();

  return (
    <div
      className="h-full w-full relative overflow-hidden select-none flex flex-col"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* ═══ Background ═══ */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${nightVillageBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          imageRendering: 'pixelated',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 40%, rgba(10,14,26,0.5) 70%, rgba(10,14,26,0.7) 100%)',
          }}
        />
      </div>

      {/* ═══ Ambient particles ═══ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 3 + (i % 3) * 2,
              height: 3 + (i % 3) * 2,
              background: `rgba(139,92,246,${0.15 + (i % 4) * 0.05})`,
              left: `${(i * 8.3) % 100}%`,
              top: `${20 + (i * 7.1) % 60}%`,
            }}
            animate={{
              y: [0, -30 - i * 5, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4 + i * 0.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.4,
            }}
          />
        ))}
      </div>

      {/* ═══ Center content ═══ */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center">
        {/* Continuously rotating 3D card with two faces */}
        <div style={{ perspective: '1200px', marginBottom: isMobile ? '1.2rem' : '2.5rem' }}>
          <div
            ref={cardRef}
            style={{
              width: isMobile ? '140px' : '220px',
              height: isMobile ? '190px' : '300px',
              transformStyle: 'preserve-3d',
              position: 'relative',
              willChange: 'transform',
            }}
          >
            {/* Front face */}
            <CardFace role={frontRole} />
            {/* Back face (rotated 180°) */}
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

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontFamily: '"Cinzel Decorative", serif',
            color: '#a78bfa',
            fontSize: isMobile ? '1.4rem' : '3.5rem',
            fontWeight: 700,
            textShadow: '0 0 60px rgba(139,92,246,0.3), 0 4px 16px rgba(0,0,0,0.6)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            margin: isMobile ? '0 0 0.6rem 0' : '0 0 1.2rem 0',
          }}
        >
          Découverte des Rôles
        </motion.h1>

        {/* Counter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className={`flex items-center ${isMobile ? 'gap-2 px-4 py-2 rounded-xl' : 'gap-4 px-8 py-4 rounded-2xl'}`}
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            border: `2px solid ${allRevealed ? 'rgba(107,142,90,0.4)' : 'rgba(139,92,246,0.25)'}`,
            transition: 'border-color 0.5s',
          }}
        >
          <span
            style={{
              fontFamily: '"Cinzel", serif',
              fontSize: isMobile ? '1.4rem' : '2.8rem',
              fontWeight: 900,
              color: allRevealed ? '#8bc470' : '#d4a843',
              textShadow: allRevealed
                ? '0 0 30px rgba(107,142,90,0.4)'
                : '0 0 30px rgba(212,168,67,0.3)',
              transition: 'color 0.5s',
            }}
          >
            {revealedCount}
          </span>
          <span
            style={{
              fontFamily: '"Cinzel", serif',
              color: 'rgba(180,195,230,0.5)',
              fontSize: isMobile ? '1rem' : '2rem',
            }}
          >
            /
          </span>
          <span
            style={{
              fontFamily: '"Cinzel", serif',
              fontSize: isMobile ? '1.4rem' : '2.8rem',
              fontWeight: 900,
              color: 'rgba(180,195,230,0.9)',
            }}
          >
            {totalPlayers}
          </span>
          <span
            style={{
              fontFamily: '"Cinzel", serif',
              color: 'rgba(180,195,230,0.7)',
              fontSize: isMobile ? '0.75rem' : '1.6rem',
              marginLeft: '0.5rem',
            }}
          >
            ont vu leur rôle
          </span>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-6"
          style={{ width: isMobile ? '260px' : '400px', maxWidth: '80vw' }}
        >
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: isMobile ? '5px' : '8px', background: 'rgba(255,255,255,0.08)' }}
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
      </div>

      {/* ═══ Bottom player strip ═══ */}
      <div
        className="relative z-10"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)',
          paddingTop: '3.5rem',
        }}
      >
        <RevealMarquee players={players} revealedIds={roleRevealedBy} />
      </div>
    </div>
  );
});