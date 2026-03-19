import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Eye, ArrowRight, UserPlus, Sparkles } from 'lucide-react';
import { type Player, type GameEvent, type PhaseDeathRecord } from '../../../context/GameContext';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { getRoleById } from '../../../data/roles';
import { PAvatar } from './PAvatar';

/* ────────────────────────────────────────────────────────
   Death cause classification from event messages
   ──────────────────────────────────────────────────────── */

export type DeathCause =
  | 'wolves'
  | 'witch_poison'
  | 'village'
  | 'hunter'
  | 'heartbreak'
  | 'wolf_devoured'
  | 'unknown';

interface DeathEntry {
  player: Player;
  cause: DeathCause;
}

function causeIcon(c: DeathCause): string {
  switch (c) {
    case 'wolves': return '🩸';
    case 'witch_poison': return '\uD83E\uDDEA';
    case 'village': return '\u2696\uFE0F';
    case 'hunter': return '\uD83C\uDFF9';
    case 'heartbreak': return '\uD83D\uDC94';
    case 'wolf_devoured': return '🩸';
    default: return '\u2753';
  }
}

function causeLabel(c: DeathCause): string {
  switch (c) {
    case 'wolves': return 'Devore par les Loups';
    case 'witch_poison': return 'Empoisonne par la Sorciere';
    case 'village': return 'Elimine par le Village';
    case 'hunter': return 'Abattu par le Chasseur';
    case 'heartbreak': return 'Mort de chagrin';
    case 'wolf_devoured': return 'Devore par les siens';
    default: return 'Cause inconnue';
  }
}

/** Personal cause message for the player who died */
function personalCauseMessage(c: DeathCause): string {
  switch (c) {
    case 'wolves': return 'Vous avez été dévoré(e) par les Loups-Garous pendant votre sommeil\u2026';
    case 'witch_poison': return 'Vous avez été empoisonné(e) par la Sorcière pendant votre sommeil\u2026';
    case 'village': return 'Vous avez été éliminé(e) par le Village.';
    case 'hunter': return 'Le Chasseur vous a abattu(e) dans son dernier souffle\u2026';
    case 'heartbreak': return 'Votre amour a péri\u2026 Vous êtes mort(e) de chagrin.';
    case 'wolf_devoured': return 'Votre meute vous a dévoré(e) pour votre inaction\u2026';
    default: return 'Vous avez été tué(e) dans des circonstances mystérieuses\u2026';
  }
}

/** Personal cause emoji (bigger, more dramatic) */
function personalCauseEmoji(c: DeathCause): string {
  switch (c) {
    case 'wolves': return '🩸';
    case 'witch_poison': return '🧪';
    case 'village': return '🫵💀';
    case 'hunter': return '🏹';
    case 'heartbreak': return '💔';
    case 'wolf_devoured': return '🩸';
    default: return '☠️';
  }
}

function matchCauseFromEvents(player: Player, recentEvents: GameEvent[]): DeathCause {
  // Iterate from most recent event backwards to match the latest death cause
  for (let i = recentEvents.length - 1; i >= 0; i--) {
    const msg = recentEvents[i].message;
    if (!msg.includes(player.name)) continue;
    if (msg.includes('Devore par les siens')) return 'wolf_devoured';
    if (msg.includes('devore')) return 'wolves';
    if (msg.includes('empoisonne')) return 'witch_poison';
    if (msg.includes('elimine par le village')) return 'village';
    if (msg.includes('tire sur')) return 'hunter';
    if (msg.includes('meurt de chagrin')) return 'heartbreak';
  }
  return 'unknown';
}

/* ────────────────────────────────────────────────────────
   Haptic / vibration helpers
   ──────────────────────────────────────────────────────── */

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch { /* not supported */ }
}

/* ────────────────────────────────────────────────────────
   Hook: useDeathAnnouncement  (state-based, multi-phase)
   Compares `phaseDeathHistory` with a per-player "last seen"
   phaseKey stored in localStorage.
   → Shows ALL missed phase deaths (grouped) when a player
     opens the app late or reconnects after several transitions.
   → For a real-time connected player only the latest phase
     is unseen, so it renders exactly like before.
   ──────────────────────────────────────────────────────── */

/** A single phase's worth of deaths */
export interface PhaseDeathGroup {
  transition: 'dawn' | 'dusk';
  turn: number;
  phaseKey: string;
  deaths: DeathEntry[];
  /** Player IDs who joined mid-game during this phase */
  newPlayerJoinIds?: number[];
}

export interface DeathAnnouncementData {
  /** Most recent transition — used for overall theming */
  latestTransition: 'dawn' | 'dusk';
  /** Grouped deaths per missed phase, chronological order */
  phases: PhaseDeathGroup[];
  /** Flat list of all deaths across all phases (for sounds / shake) */
  allDeaths: DeathEntry[];
  /** All new player IDs across all phases */
  allNewPlayerJoinIds: number[];
  /** All revived player IDs across all phases */
  allRevivedPlayerIds: number[];
}

/** Deterministic ordering: dawn-1→2, dusk-1→3, dawn-2→4, dusk-2→5, … */
function phaseOrder(phaseKey: string): number {
  const m = phaseKey.match(/^(dawn|dusk)-(\d+)$/);
  if (!m) return -1;
  const turn = parseInt(m[2]);
  return turn * 2 + (m[1] === 'dusk' ? 1 : 0);
}

/** localStorage key for per-player/per-game "last seen announcement" */
function lsKey(gameId: string, playerId: number) {
  return `lg-death-ann-${gameId}-${playerId}`;
}

export function useDeathAnnouncement(
  players: Player[],
  events: GameEvent[],
  /** Disable for first night / role reveal etc. */
  enabled: boolean,
  /** Full history of phase death records */
  phaseDeathHistory: PhaseDeathRecord[] | undefined,
  gameId: string | undefined,
  playerId: number | undefined,
): {
  announcement: DeathAnnouncementData | null;
  dismiss: () => void;
} {
  const [announcement, setAnnouncement] = useState<DeathAnnouncementData | null>(null);

  // Keep latest values in refs so the main effect can depend on a minimal key
  const playersRef = useRef(players);
  playersRef.current = players;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const historyRef = useRef(phaseDeathHistory);
  historyRef.current = phaseDeathHistory;

  // Trigger re-evaluation when the latest record changes
  const latestPhaseKey = phaseDeathHistory && phaseDeathHistory.length > 0
    ? phaseDeathHistory[phaseDeathHistory.length - 1].phaseKey
    : null;
  const storageKey = gameId && playerId != null ? lsKey(gameId, playerId) : null;

  useEffect(() => {
    const history = historyRef.current;
    if (!enabled || !history || history.length === 0 || !storageKey) {
      console.log('[DeathAnnouncement] skip: enabled=%s, historyLen=%d, storageKey=%s',
        enabled, history?.length ?? 0, storageKey);
      return;
    }

    // Read what this player has already dismissed
    let lastSeen: string | null = null;
    try { lastSeen = localStorage.getItem(storageKey); } catch { /* */ }

    const lastSeenOrder = lastSeen ? phaseOrder(lastSeen) : -1;

    // Find all unseen phases (order > lastSeenOrder)
    const unseen = history
      .filter((r) => phaseOrder(r.phaseKey) > lastSeenOrder)
      .sort((a, b) => phaseOrder(a.phaseKey) - phaseOrder(b.phaseKey));

    if (unseen.length === 0) {
      console.log('[DeathAnnouncement] all seen (lastSeen=%s)', lastSeen);
      return;
    }

    // Build grouped death data
    const curPlayers = playersRef.current;
    const curEvents = eventsRef.current;

    // If the current player has been revived (alive again), skip showing
    // the "you have been eliminated" screen entirely by auto-dismissing.
    const currentPlayerObj = playerId != null ? curPlayers.find((p) => p.id === playerId) : null;
    if (currentPlayerObj && currentPlayerObj.alive) {
      // Player is alive — they may have been revived. Filter them out of deaths
      // so the personal death view doesn't trigger.
      const wasInDeaths = unseen.some((r) => r.deadPlayerIds.includes(playerId!));
      if (wasInDeaths) {
        console.log('[DeathAnnouncement] player %d is alive (revived) — filtering personal death from announcement', playerId);
      }
    }

    const phases: PhaseDeathGroup[] = unseen.map((record) => {
      const deaths: DeathEntry[] = record.deadPlayerIds
        .map((id) => {
          const player = curPlayers.find((p) => p.id === id);
          if (!player) return null;
          return { player, cause: matchCauseFromEvents(player, curEvents) };
        })
        .filter(Boolean) as DeathEntry[];
      return {
        transition: record.transition,
        turn: record.turn,
        phaseKey: record.phaseKey,
        deaths,
        newPlayerJoinIds: record.newPlayerJoinIds,
      };
    });

    // Only keep phases that have actual deaths for display
    const phasesWithDeaths = phases.filter((p) => p.deaths.length > 0);
    const allDeaths = phasesWithDeaths.flatMap((p) => p.deaths);

    // If the current player is alive (revived), remove them from allDeaths
    // so the personal "you have been eliminated" screen doesn't appear.
    const isCurrentPlayerAlive = currentPlayerObj?.alive === true;
    const filteredAllDeaths = isCurrentPlayerAlive
      ? allDeaths.filter((d) => d.player.id !== playerId)
      : allDeaths;

    const allNewPlayerJoinIds = [...new Set(phases.flatMap((p) => p.newPlayerJoinIds ?? []))];
    // Detect revived players from events containing "ressuscite"
    const allRevivedPlayerIds: number[] = [];
    for (const record of unseen) {
      for (const ev of curEvents) {
        if (ev.turn === record.turn && ev.message.includes('ressuscite')) {
          const revived = curPlayers.find((p) => p.alive && ev.message.includes(p.name));
          if (revived && !allRevivedPlayerIds.includes(revived.id)) {
            allRevivedPlayerIds.push(revived.id);
          }
        }
      }
    }
    const latest = unseen[unseen.length - 1];

    console.log('[DeathAnnouncement] SHOWING %d unseen phases (%d with deaths, %d total dead) lastSeen=%s latest=%s',
      unseen.length, phasesWithDeaths.length, allDeaths.length, lastSeen, latest.phaseKey);

    setAnnouncement({
      latestTransition: latest.transition,
      // If no deaths at all, still show the latest phase (for "no deaths" message)
      phases: phasesWithDeaths.length > 0 ? phasesWithDeaths : [phases[phases.length - 1]],
      allDeaths: filteredAllDeaths,
      allNewPlayerJoinIds,
      allRevivedPlayerIds,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, latestPhaseKey, storageKey]);

  const dismiss = useCallback(() => {
    setAnnouncement(null);
    // Persist the latest phaseKey so ALL shown phases are marked as seen
    const history = historyRef.current;
    if (storageKey && history && history.length > 0) {
      const latest = history[history.length - 1];
      try { localStorage.setItem(storageKey, latest.phaseKey); } catch { /* */ }
      console.log('[DeathAnnouncement] dismissed up to %s', latest.phaseKey);
    }
  }, [storageKey]);

  return { announcement, dismiss };
}

/* ────────────────────────────────────────────────────────
   Screen-shake keyframes (injected once)
   ──────────────────────────────────────────────────────── */

const SHAKE_STYLE_ID = 'death-announce-shake-style';

function ensureShakeStyles() {
  if (document.getElementById(SHAKE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHAKE_STYLE_ID;
  style.textContent = `
@keyframes da-shake {
  0%   { transform: translate(0, 0) rotate(0deg); }
  10%  { transform: translate(-3px, 1px) rotate(-0.5deg); }
  20%  { transform: translate(4px, -1px) rotate(0.5deg); }
  30%  { transform: translate(-2px, 2px) rotate(-0.3deg); }
  40%  { transform: translate(3px, 0px) rotate(0.4deg); }
  50%  { transform: translate(-1px, -1px) rotate(-0.2deg); }
  60%  { transform: translate(2px, 1px) rotate(0.3deg); }
  70%  { transform: translate(-3px, 0px) rotate(-0.4deg); }
  80%  { transform: translate(1px, -1px) rotate(0.2deg); }
  90%  { transform: translate(-1px, 1px) rotate(-0.1deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
.da-shaking {
  animation: da-shake 0.5s ease-in-out;
}
`;
  document.head.appendChild(style);
}

/* ────────────────────────────────────────────────────────
   Modal Component
   ──────────────────────────────────────────────────────── */

/** Phase group header label */
function phaseGroupLabel(transition: 'dawn' | 'dusk', turn: number): string {
  return transition === 'dawn'
    ? `\uD83C\uDF19 Nuit ${turn}`
    : `\u2600\uFE0F Jour ${turn}`;
}

export function DeathAnnouncementModal({
  data,
  onDismiss,
  t,
  currentPlayerId,
  voteHistory,
  allPlayers,
  lastWillUsed,
  maireSuccessionPending,
  onChooseSuccessor,
}: {
  data: DeathAnnouncementData;
  onDismiss: () => void;
  t: GameThemeTokens;
  /** If provided, enables personal death view when the player is among the dead */
  currentPlayerId?: number | null;
  /** Vote history to show "who voted for you" on village eliminations */
  voteHistory?: Array<{ turn: number; votes: Record<number, number>; eliminated: number | null }>;
  /** Full player list (for rendering voter avatars/names) */
  allPlayers?: Player[];
  /** Track which dead players have used their one-time last-will vote */
  lastWillUsed?: Record<number, boolean>;
  /** Maire succession: if true, dying Maire must pick a successor */
  maireSuccessionPending?: boolean;
  /** Callback when the dying Maire picks a successor */
  onChooseSuccessor?: (successorId: number) => void;
}) {
  // ── Personal death detection ──
  // Check if the current player is among the announced dead
  const myDeath: DeathEntry | undefined = currentPlayerId != null
    ? data.allDeaths.find((d) => d.player.id === currentPlayerId)
    : undefined;
  const hasPersonalDeath = !!myDeath;

  // Find the phase where the current player died (for turn matching)
  const myDeathPhase = hasPersonalDeath
    ? data.phases.find((p) => p.deaths.some((d) => d.player.id === currentPlayerId))
    : undefined;

  // Who voted for me? (only relevant for village elimination / dusk)
  const votersForMe: Player[] = React.useMemo(() => {
    if (!hasPersonalDeath || !voteHistory || !allPlayers || !myDeathPhase) return [];
    // Only show voters for village-type eliminations
    if (myDeath!.cause !== 'village') return [];
    // Find the vote record matching this turn
    const voteRecord = voteHistory.find((v) => v.turn === myDeathPhase.turn);
    if (!voteRecord) return [];
    // Collect all voter IDs who voted for the current player
    return Object.entries(voteRecord.votes)
      .filter(([, targetId]) => targetId === currentPlayerId)
      .map(([voterId]) => allPlayers.find((p) => p.id === Number(voterId)))
      .filter(Boolean) as Player[];
  }, [hasPersonalDeath, voteHistory, allPlayers, myDeathPhase, myDeath, currentPlayerId]);

  // View mode: personal first, then classic
  const [viewMode, setViewMode] = useState<'personal' | 'classic' | 'succession'>(hasPersonalDeath ? 'personal' : 'classic');

  // Reset viewMode when data changes (new announcement)
  useEffect(() => {
    setViewMode(hasPersonalDeath ? 'personal' : 'classic');
  }, [data, hasPersonalDeath]);

  // Succession state
  const isMaireAndPending = !!maireSuccessionPending && !!onChooseSuccessor && hasPersonalDeath;
  const [successionTarget, setSuccessionTarget] = useState<number | null>(null);
  const aliveCandidates = (allPlayers ?? []).filter((p) => p.alive && p.id !== currentPlayerId);

  const contentRef = useRef<HTMLDivElement>(null);
  const soundPlayedRef = useRef(false);

  const isDawn = data.latestTransition === 'dawn';
  const noDeath = data.allDeaths.length === 0;
  const isMultiPhase = data.phases.length > 1;

  // ── Role reveal state ──
  // Uses a 2-phase fold/unfold animation instead of CSS 3D flip
  // because overflow:auto on the scroll container flattens preserve-3d.
  type CardPhase = 'front' | 'folding-out' | 'folding-in' | 'back';
  const [cardPhases, setCardPhases] = useState<Map<number, CardPhase>>(new Map());
  const [isRevealing, setIsRevealing] = useState(false);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const allRevealed = !noDeath && [...cardPhases.values()].filter(v => v === 'back').length >= data.allDeaths.length;

  const getCardPhase = (idx: number): CardPhase => cardPhases.get(idx) ?? 'front';

  // Clean up reveal timers on unmount
  useEffect(() => {
    return () => { revealTimers.current.forEach(clearTimeout); };
  }, []);

  const flipCard = useCallback((idx: number) => {
    // Phase 1: fold out (scaleY → 0)
    setCardPhases(prev => { const m = new Map(prev); m.set(idx, 'folding-out'); return m; });
    // Phase 2: at midpoint, swap content & fold in (scaleY → 1)
    const mid = setTimeout(() => {
      setCardPhases(prev => { const m = new Map(prev); m.set(idx, 'folding-in'); return m; });
      // Phase 3: mark as fully revealed after unfold completes
      const end = setTimeout(() => {
        setCardPhases(prev => { const m = new Map(prev); m.set(idx, 'back'); return m; });
      }, 320);
      revealTimers.current.push(end);
    }, 300);
    revealTimers.current.push(mid);
  }, []);

  const startReveal = useCallback(() => {
    if (isRevealing || allRevealed) return;
    setIsRevealing(true);
    revealTimers.current.forEach(clearTimeout);
    revealTimers.current = [];

    const total = data.allDeaths.length;
    for (let i = 0; i < total; i++) {
      const timer = setTimeout(() => {
        vibrate([30]);
        flipCard(i);
        if (i === total - 1) {
          // Wait for last card animation to finish
          const done = setTimeout(() => setIsRevealing(false), 650);
          revealTimers.current.push(done);
        }
      }, i * 550);
      revealTimers.current.push(timer);
    }
  }, [isRevealing, allRevealed, data.allDeaths.length, flipCard]);

  // Reset sound flag on new data
  useEffect(() => {
    soundPlayedRef.current = false;
  }, [data]);

  // Sound + vibration + shake on mount
  useEffect(() => {
    if (soundPlayedRef.current) return;
    soundPlayedRef.current = true;

    const hasDeath = data.allDeaths.length > 0;

    // Play phase transition sound based on latest transition
    if (data.latestTransition === 'dawn') {
      vibrate(hasDeath ? [80, 60, 120, 60, 80] : [60, 40, 60]);
    } else {
      vibrate(hasDeath ? [120, 80, 200, 80, 300] : [80, 50, 80]);
    }

    // Screen shake if there are deaths
    if (hasDeath) {
      ensureShakeStyles();
      const shakeDelay = setTimeout(() => {
        contentRef.current?.classList.add('da-shaking');
        vibrate([50, 30, 50]);
        const cleanup = setTimeout(() => {
          contentRef.current?.classList.remove('da-shaking');
        }, 500);
        return () => clearTimeout(cleanup);
      }, 650);
      return () => clearTimeout(shakeDelay);
    }
  }, [data]);

  // ── Intense personal death vibration sequence ──
  // Multi-phase haptic pattern when the player is the one who died
  const personalVibrationFired = useRef(false);
  useEffect(() => {
    if (viewMode !== 'personal' || !hasPersonalDeath || personalVibrationFired.current) return;
    personalVibrationFired.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1 (0ms): Heavy heartbeat — "THUMP... THUMP"
    vibrate([200, 100, 300]);

    // Phase 2 (500ms): Staccato death realization
    timers.push(setTimeout(() => vibrate([100, 50, 100, 50, 150]), 500));

    // Phase 3 (1000ms): Long dread vibration
    timers.push(setTimeout(() => vibrate([400]), 1000));

    // Phase 4 (1600ms): Final slam
    timers.push(setTimeout(() => vibrate([80, 40, 80, 40, 200]), 1600));

    // Phase 5 (village kill only): staggered pulses for each voter chip
    if (myDeath?.cause === 'village' && votersForMe.length > 0) {
      votersForMe.forEach((_, i) => {
        timers.push(setTimeout(() => vibrate([60, 30, 60]), 2200 + i * 120));
      });
    }

    return () => { timers.forEach(clearTimeout); };
  }, [viewMode, hasPersonalDeath, myDeath?.cause, votersForMe]);

  // Reset personal vibration flag when data changes (new announcement)
  useEffect(() => {
    personalVibrationFired.current = false;
  }, [data]);

  // Per-death reveal: play impact sound + micro-vibration for each death card
  const deathSoundTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    deathSoundTimers.current.forEach(clearTimeout);
    deathSoundTimers.current = [];

    if (data.allDeaths.length === 0) return;

    // Compute cumulative index offsets for stagger timing across groups
    let globalIdx = 0;
    for (const phase of data.phases) {
      for (let i = 0; i < phase.deaths.length; i++) {
        const delay = (0.7 + globalIdx * 0.18) * 1000;
        const timer = setTimeout(() => {
          vibrate([40]);
        }, delay);
        deathSoundTimers.current.push(timer);
        globalIdx++;
      }
    }

    return () => {
      deathSoundTimers.current.forEach(clearTimeout);
      deathSoundTimers.current = [];
    };
  }, [data]);

  // Gradient colours: dawn = warm gold/amber,  dusk = blue-violet
  const overlayGradient = isDawn
    ? 'radial-gradient(ellipse at 50% 20%, rgba(212,168,67,0.18) 0%, rgba(0,0,0,0.85) 70%)'
    : 'radial-gradient(ellipse at 50% 20%, rgba(90,100,160,0.2) 0%, rgba(0,0,0,0.88) 70%)';

  const accentColor = isDawn ? '#d4a843' : '#7c8db5';
  const accentBg = isDawn ? 'rgba(212,168,67,0.1)' : 'rgba(124,141,181,0.1)';
  const accentBorder = isDawn ? 'rgba(212,168,67,0.25)' : 'rgba(124,141,181,0.25)';

  // ── Personal death overlay gradient — more dramatic red ──
  const personalOverlayGradient = myDeath?.cause === 'village'
    ? 'radial-gradient(ellipse at 50% 20%, rgba(160,50,80,0.25) 0%, rgba(0,0,0,0.90) 70%)'
    : 'radial-gradient(ellipse at 50% 20%, rgba(196,30,58,0.22) 0%, rgba(0,0,0,0.88) 70%)';

  /* ═══════════════════════════════════════════
     PERSONAL DEATH VIEW
     ═══════════════════════════════════════════ */
  if (viewMode === 'personal' && myDeath) {
    const isVillageKill = myDeath.cause === 'village';
    const personalAccent = isVillageKill ? '#a0324f' : '#c41e3a';
    const personalAccentBorder = isVillageKill ? 'rgba(160,50,80,0.35)' : 'rgba(196,30,58,0.35)';

    return createPortal(
      <AnimatePresence>
        <motion.div
          key="personal-death-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: personalOverlayGradient, backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            ref={contentRef}
            key="personal-death-content"
            initial={{ opacity: 0, scale: 0.88, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 40 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(180deg, rgba(25,10,15,0.97) 0%, rgba(8,6,12,0.99) 100%)',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: personalAccentBorder,
              boxShadow: `0 0 100px rgba(196,30,58,0.2), 0 0 40px rgba(196,30,58,0.1), 0 20px 60px rgba(0,0,0,0.7)`,
              maxHeight: '90vh',
            }}
          >
            {/* ── Header ── */}
            <div
              className="relative px-6 pt-10 pb-5 text-center shrink-0"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(196,30,58,0.15) 0%, transparent 70%)',
              }}
            >
              {/* Dramatic emoji */}
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.3 }}
                className="text-5xl mb-4"
              >
                {personalCauseEmoji(myDeath.cause)}
              </motion.div>

              {/* Phase context line */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: 'rgba(192,200,216,0.45)',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '0.6rem',
                }}
              >
                {isVillageKill ? 'Le village s\u2019endort\u2026' : 'Le village se réveille\u2026'}
              </motion.p>

              {/* Personal death message */}
              <motion.h2
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: '#e8dcc8',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  lineHeight: 1.5,
                  letterSpacing: '0.02em',
                }}
              >
                {personalCauseMessage(myDeath.cause)}
              </motion.h2>
            </div>

            {/* ── Voters list (only for village elimination) ── */}
            {isVillageKill && votersForMe.length > 0 && (
              <div className="px-5 pb-3 min-h-0 flex-1 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                >
                  {/* Section label */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex-1 h-px"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(160,50,80,0.25))' }}
                    />
                    <span
                      style={{
                        fontFamily: '"Cinzel", serif',
                        color: 'rgba(192,200,216,0.5)',
                        fontSize: '0.55rem',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Qui a voté contre vous
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: 'linear-gradient(90deg, rgba(160,50,80,0.25), transparent)' }}
                    />
                  </div>

                  {/* Voter chips */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {votersForMe.map((voter, vIdx) => {
                      const isLastWill = !voter.alive && lastWillUsed?.[voter.id];
                      return (
                      <motion.div
                        key={voter.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.85 + vIdx * 0.08 }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: isLastWill ? 'rgba(139,92,246,0.1)' : 'rgba(196,30,58,0.08)',
                          borderWidth: 1,
                          borderStyle: 'solid',
                          borderColor: isLastWill ? 'rgba(139,92,246,0.25)' : 'rgba(196,30,58,0.2)',
                        }}
                      >
                        {isLastWill ? (
                          <>
                            <span style={{ fontSize: '1rem' }}>{'\uD83D\uDCDC'}</span>
                            <span
                              style={{
                                color: '#a78bfa',
                                fontSize: '0.7rem',
                                fontFamily: '"Cinzel", serif',
                                fontWeight: 600,
                              }}
                            >
                              Derniere volonte
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                              <PAvatar player={voter} size="text-xs" />
                            </div>
                            <span
                              style={{
                                color: '#e8dcc8',
                                fontSize: '0.7rem',
                                fontFamily: '"Cinzel", serif',
                                fontWeight: 600,
                              }}
                            >
                              {voter.name}
                            </span>
                          </>
                        )}
                      </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            )}

            {/* ── "Suivant" button ── */}
            <div className="px-5 pt-3 pb-6 flex flex-col gap-2 shrink-0">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => isMaireAndPending ? setViewMode('succession') : setViewMode('classic')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer"
                style={{
                  background: isMaireAndPending
                    ? 'linear-gradient(135deg, #d4a843, #b8922e)'
                    : 'linear-gradient(135deg, rgba(196,30,58,0.18), rgba(196,30,58,0.08))',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: isMaireAndPending ? 'rgba(212,168,67,0.6)' : personalAccentBorder,
                  color: isMaireAndPending ? 'white' : '#e8dcc8',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                {isMaireAndPending ? (<><span>👑</span> Choisir un successeur</>) : (<>Suivant <ArrowRight size={14} /></>)}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );
  }

  /* ═══════════════════════════════════════════
     MAIRE SUCCESSION PICKER VIEW
     ═══════════════════════════════════════════ */
  if (viewMode === 'succession' && isMaireAndPending) {
    return createPortal(
      <AnimatePresence>
        <motion.div
          key="succession-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            key="succession-content"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[90%] max-w-sm rounded-2xl p-6 flex flex-col"
            style={{
              background: '#0f1629',
              border: '2px solid rgba(212,168,67,0.4)',
              maxHeight: 'calc(100dvh - 2rem)',
            }}
          >
            <div className="text-center flex-shrink-0">
              <span className="text-4xl block mb-2">👑</span>
              <h2 style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1rem' }}>
                Designez votre successeur
              </h2>
              <p style={{ color: t.textMuted, fontSize: '0.7rem', marginTop: '0.25rem' }}>
                Choisissez le prochain Maire du village
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mt-4 -mx-1 px-1">
              <div className="grid grid-cols-3 gap-3">
                {aliveCandidates.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSuccessionTarget(p.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: successionTarget === p.id
                        ? 'rgba(212,168,67,0.15)'
                        : 'rgba(192,200,216,0.05)',
                      border: successionTarget === p.id
                        ? '2px solid rgba(212,168,67,0.5)'
                        : '1px solid rgba(192,200,216,0.1)',
                    }}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <PAvatar player={p} size="text-lg" />
                    </div>
                    <span style={{
                      fontFamily: '"Cinzel", serif',
                      color: successionTarget === p.id ? '#d4a843' : '#e8dcc8',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      textAlign: 'center',
                      lineHeight: 1.2,
                      wordBreak: 'break-word',
                    }}>
                      {p.name}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4 flex-shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={successionTarget === null}
                onClick={() => {
                  if (successionTarget !== null && onChooseSuccessor) {
                    onChooseSuccessor(successionTarget);
                    onDismiss();
                  }
                }}
                className="w-full py-3 rounded-xl cursor-pointer"
                style={{
                  background: successionTarget !== null
                    ? 'linear-gradient(135deg, #d4a843, #b8922e)'
                    : 'rgba(192,200,216,0.1)',
                  color: successionTarget !== null ? 'white' : 'rgba(192,200,216,0.4)',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  opacity: successionTarget !== null ? 1 : 0.5,
                }}
              >
                Nommer Maire
              </motion.button>
              <button
                onClick={() => setViewMode('classic')}
                className="w-full py-2 rounded-xl cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'rgba(192,200,216,0.4)',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.6rem',
                  fontWeight: 600,
                }}
              >
                Passer (le GM choisira)
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );
  }

  /* ═══════════════════════════════════════════
     CLASSIC DEATH ANNOUNCEMENT VIEW
     ══════════════════════════════════════════ */

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="death-announcement-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: overlayGradient, backdropFilter: 'blur(8px)' }}
        onClick={() => onDismiss()}
      >
        <motion.div
          ref={contentRef}
          key="death-announcement-content"
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, rgba(15,14,30,0.97) 0%, rgba(8,10,20,0.99) 100%)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: accentBorder,
            boxShadow: `0 0 80px ${isDawn ? 'rgba(212,168,67,0.15)' : 'rgba(90,100,160,0.15)'}, 0 20px 60px rgba(0,0,0,0.6)`,
            maxHeight: '90vh',
          }}
        >
          {/* ── Header glow ── */}
          <div
            className="relative px-6 pt-8 pb-4 text-center shrink-0"
            style={{
              background: isDawn
                ? 'radial-gradient(ellipse at 50% 0%, rgba(212,168,67,0.12) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at 50% 0%, rgba(124,141,181,0.12) 0%, transparent 70%)',
            }}
          >
            {/* Phase emoji */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
              className="text-4xl mb-3"
            >
              {isDawn ? (noDeath ? '☀️' : '🩸') : '🌕'}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              style={{
                fontFamily: '"Cinzel", serif',
                color: accentColor,
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              {isDawn ? 'Le village se reveille\u2026' : 'Le village s\u2019endort\u2026'}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{
                color: 'rgba(192,200,216,0.6)',
                fontSize: '0.65rem',
                marginTop: '0.35rem',
              }}
            >
              {noDeath
                ? (isMultiPhase ? 'Personne n\u2019est mort en votre absence.' : (isDawn
                  ? 'La nuit s\u2019est achevée sans victimes.'
                  : 'La journée s\u2019est passée sans victimes.'))
                : (() => {
                    const count = data.allDeaths.length;
                    if (count === 1) {
                      return isDawn
                        ? 'Cette nuit, 1 villageois a péri\u2026'
                        : 'Aujourd\u2019hui, 1 villageois est tombé\u2026';
                    }
                    return isDawn
                      ? `Cette nuit, ${count} villageois ont péri\u2026`
                      : `Aujourd\u2019hui, ${count} villageois sont tombés\u2026`;
                  })()
              }
            </motion.p>
          </div>

          {/* ── Death list ── */}
          <div
            className="px-5 pb-2 min-h-0 flex-1 overflow-y-auto"
          >
            {noDeath ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center py-6"
              >
                <p className="text-2xl mb-2">{isDawn ? '\u2728' : '\uD83C\uDF43'}</p>
                <p
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: 'rgba(192,200,216,0.7)',
                    fontSize: '0.75rem',
                    fontStyle: 'italic',
                  }}
                >
                  {isMultiPhase
                    ? 'Le village fut etrangement paisible\u2026'
                    : isDawn
                      ? 'La nuit fut etrangement silencieuse\u2026'
                      : 'Le jour s\u2019est passé sans effusion de sang\u2026'
                  }
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-2">
                {(() => {
                  let globalIdx = 0;
                  return data.phases.map((phase) => {
                    if (phase.deaths.length === 0) return null;
                    const groupStartIdx = globalIdx;
                    const elements = (
                      <div key={phase.phaseKey} className="flex flex-col gap-2">
                        {/* Phase group header — only when multiple phases */}
                        {isMultiPhase && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.65 + groupStartIdx * 0.18 }}
                            className="flex items-center gap-2 mt-1"
                          >
                            <div
                              className="flex-1 h-px"
                              style={{ background: `linear-gradient(90deg, transparent, ${accentBorder})` }}
                            />
                            <span
                              style={{
                                fontFamily: '"Cinzel", serif',
                                color: 'rgba(192,200,216,0.45)',
                                fontSize: '0.55rem',
                                fontWeight: 600,
                                letterSpacing: '0.06em',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {phaseGroupLabel(phase.transition, phase.turn)}
                            </span>
                            <div
                              className="flex-1 h-px"
                              style={{ background: `linear-gradient(90deg, ${accentBorder}, transparent)` }}
                            />
                          </motion.div>
                        )}
                        {phase.deaths.map((d) => {
                          const idx = globalIdx++;
                          const cPhase = getCardPhase(idx);
                          const role = getRoleById(d.player.role);
                          const showBack = cPhase === 'folding-in' || cPhase === 'back';
                          const isFolded = cPhase === 'folding-out' || cPhase === 'folding-in';
                          return (
                            <motion.div
                              key={`${phase.phaseKey}-${d.player.id}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.7 + idx * 0.18, duration: 0.4 }}
                            >
                              <div
                                style={{
                                  transform: isFolded ? 'scaleY(0)' : 'scaleY(1)',
                                  transition: 'transform 0.3s ease-in-out',
                                  transformOrigin: 'center center',
                                }}
                              >
                                {showBack ? (
                                  /* ── Role reveal face ── */
                                  <div
                                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                                    style={{
                                      background: role
                                        ? `linear-gradient(135deg, ${role.color}18, ${role.color}08)`
                                        : accentBg,
                                      borderWidth: 1,
                                      borderStyle: 'solid',
                                      borderColor: role ? `${role.color}40` : accentBorder,
                                    }}
                                  >
                                    <div
                                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                      style={{
                                        background: role ? `${role.color}20` : 'rgba(192,200,216,0.1)',
                                        borderWidth: 2,
                                        borderStyle: 'solid',
                                        borderColor: role ? `${role.color}50` : 'rgba(192,200,216,0.2)',
                                      }}
                                    >
                                      <span className="text-xl">{role?.emoji || '?'}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className="truncate"
                                        style={{
                                          fontFamily: '"Cinzel", serif',
                                          color: role?.color || '#e8dcc8',
                                          fontSize: '0.8rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {d.player.name}
                                      </p>
                                      <p
                                        className="flex items-center gap-1.5 mt-0.5"
                                        style={{
                                          fontSize: '0.65rem',
                                          color: role?.color || 'rgba(192,200,216,0.55)',
                                          fontFamily: '"Cinzel", serif',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <span>{role?.emoji}</span>
                                        <span>{role?.name || 'Role inconnu'}</span>
                                      </p>
                                    </div>
                                    <span
                                      className="shrink-0 px-2 py-0.5 rounded-full"
                                      style={{
                                        fontSize: '0.5rem',
                                        fontFamily: '"Cinzel", serif',
                                        fontWeight: 600,
                                        background: role?.team === 'werewolf'
                                          ? 'rgba(196,30,58,0.15)'
                                          : role?.team === 'solo'
                                            ? 'rgba(160,120,8,0.15)'
                                            : 'rgba(107,142,90,0.15)',
                                        color: role?.team === 'werewolf'
                                          ? '#c41e3a'
                                          : role?.team === 'solo'
                                            ? '#d4a843'
                                            : '#6b8e5a',
                                        borderWidth: 1,
                                        borderStyle: 'solid',
                                        borderColor: role?.team === 'werewolf'
                                          ? 'rgba(196,30,58,0.3)'
                                          : role?.team === 'solo'
                                            ? 'rgba(160,120,8,0.3)'
                                            : 'rgba(107,142,90,0.3)',
                                      }}
                                    >
                                      {role?.team === 'werewolf' ? 'Loup' : role?.team === 'solo' ? 'Solo' : 'Village'}
                                    </span>
                                  </div>
                                ) : (
                                  /* ── Death info face ── */
                                  <div
                                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
                                    style={{
                                      background: accentBg,
                                      borderWidth: 1,
                                      borderStyle: 'solid',
                                      borderColor: accentBorder,
                                    }}
                                  >
                                    <div
                                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                      style={{
                                        background: 'rgba(196,30,58,0.12)',
                                        borderWidth: 2,
                                        borderStyle: 'solid',
                                        borderColor: 'rgba(196,30,58,0.3)',
                                      }}
                                    >
                                      <PAvatar player={d.player} size="text-sm" style={{ filter: 'grayscale(0.6)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className="truncate"
                                        style={{
                                          fontFamily: '"Cinzel", serif',
                                          color: '#e8dcc8',
                                          fontSize: '0.8rem',
                                          fontWeight: 700,
                                        }}
                                      >
                                        {d.player.name}
                                      </p>
                                      <p
                                        className="flex items-center gap-1.5 mt-0.5"
                                        style={{
                                          fontSize: '0.6rem',
                                          color: 'rgba(192,200,216,0.55)',
                                        }}
                                      >
                                        <span>{causeIcon(d.cause)}</span>
                                        <span>{causeLabel(d.cause)}</span>
                                      </p>
                                    </div>
                                    <Skull size={16} style={{ color: 'rgba(196,30,58,0.5)', flexShrink: 0 }} />
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                    return elements;
                  });
                })()}
              </div>
            )}

            {/* ── New player join banner ── */}
            {data.allNewPlayerJoinIds.length > 0 && (() => {
              const joinedPlayers = data.allNewPlayerJoinIds
                .map((id) => (allPlayers ?? []).find((p) => p.id === id))
                .filter(Boolean) as Player[];
              if (joinedPlayers.length === 0) return null;
              return (
                <div className="mt-2">
                  {joinedPlayers.map((jp, jpIdx) => (
                    <motion.div
                      key={`join-${jp.id}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + jpIdx * 0.15, duration: 0.4 }}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl mb-2"
                      style={{
                        background: 'rgba(212,168,67,0.08)',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: 'rgba(212,168,67,0.2)',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(212,168,67,0.15)',
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderColor: 'rgba(212,168,67,0.3)',
                        }}
                      >
                        <PAvatar player={jp} size="text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontFamily: '"Cinzel", serif',
                            color: '#d4a843',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {jp.name}
                        </p>
                        <p
                          className="flex items-center gap-1.5 mt-0.5"
                          style={{
                            fontSize: '0.6rem',
                            color: 'rgba(212,168,67,0.6)',
                          }}
                        >
                          {jp.name} a rejoint le village
                        </p>
                      </div>
                      <UserPlus size={16} style={{ color: 'rgba(212,168,67,0.5)', flexShrink: 0 }} />
                    </motion.div>
                  ))}
                </div>
              );
            })()}

            {/* ── Revived players ── */}
            {data.allRevivedPlayerIds.length > 0 && (() => {
              const revivedPlayers = data.allRevivedPlayerIds
                .map((id) => (allPlayers ?? []).find((p) => p.id === id))
                .filter(Boolean) as Player[];
              if (revivedPlayers.length === 0) return null;
              return (
                <div className="mt-2">
                  {revivedPlayers.map((rp, rpIdx) => (
                    <motion.div
                      key={`revive-${rp.id}`}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + rpIdx * 0.15, duration: 0.4 }}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-xl mb-2"
                      style={{
                        background: 'rgba(107,142,90,0.08)',
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: 'rgba(107,142,90,0.2)',
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(107,142,90,0.15)',
                          borderWidth: 2,
                          borderStyle: 'solid',
                          borderColor: 'rgba(107,142,90,0.3)',
                        }}
                      >
                        <PAvatar player={rp} size="text-sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{
                            fontFamily: '"Cinzel", serif',
                            color: '#8bc470',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {rp.name}
                        </p>
                        <p
                          className="flex items-center gap-1.5 mt-0.5"
                          style={{
                            fontSize: '0.6rem',
                            color: 'rgba(139,196,112,0.6)',
                          }}
                        >
                          De retour parmi les vivants
                        </p>
                      </div>
                      <Sparkles size={16} style={{ color: 'rgba(107,142,90,0.5)', flexShrink: 0 }} />
                    </motion.div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── Footer / dismiss ── */}
          <div className="px-5 pt-3 pb-6 flex flex-col gap-2 shrink-0">
            {/* Reveal roles button — only when there are deaths */}
            {!noDeath && !allRevealed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.96 }}
                onClick={startReveal}
                disabled={isRevealing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer"
                style={{
                  background: `linear-gradient(135deg, rgba(192,200,216,0.08), rgba(192,200,216,0.04))`,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(192,200,216,0.15)',
                  color: isRevealing ? 'rgba(192,200,216,0.4)' : 'rgba(192,200,216,0.7)',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  transition: 'all 0.3s ease',
                }}
              >
                <Eye size={14} />
                {isRevealing ? 'Révélation en cours\u2026' : 'Révéler les rôles'}
              </motion.button>
            )}

            {/* Dismiss / close button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onDismiss()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${isDawn ? 'rgba(212,168,67,0.15)' : 'rgba(124,141,181,0.15)'}, ${isDawn ? 'rgba(212,168,67,0.08)' : 'rgba(124,141,181,0.08)'})`,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: accentBorder,
                color: accentColor,
                fontFamily: '"Cinzel", serif',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              Fermer
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}