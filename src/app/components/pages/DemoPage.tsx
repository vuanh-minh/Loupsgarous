/**
 * DemoPage.tsx — Simulated first-person game experience.
 *
 * Step 1: User picks a role from a selection screen.
 * Step 2: A 43-player game is instantly created (42 AI + user).
 * Step 3: The exact same player UI renders with local state.
 * Step 4: AI auto-progresses phases; user interacts as in a real game.
 *
 * IMPORTANT: All hooks are declared unconditionally at the top.
 * Conditional rendering uses `{step === 'x' && (...)}` — NO early returns.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Skull, Swords, Users, ArrowLeft,
  Map, Play, Sparkles, ScrollText, Moon, LogIn,
} from 'lucide-react';
import { ROLES, getRoleById } from '../../data/roles';
import { gameTheme, gameThemeDead } from '../../context/gameTheme';
import type { GameState } from '../../context/gameTypes';
import { type PanelId } from './player/useSwipeNavigation';
import { useSwipeNavigation } from './player/useSwipeNavigation';
import { useDemoEngine } from './demo/useDemoEngine';
import { useDeathAnnouncement, DeathAnnouncementModal } from './player/DeathAnnouncementModal';

// Sub-components reused from the player view
import { GamePanel } from './player/GamePanel';
import { VillageListPanel } from './player/VillageListPanel';
import { RoleActionsPanel } from './player/RoleActionsPanel';
import { PlayerHeader } from './player/PlayerHeader';
import { VillagerSleepingPanel } from './player/SleepingPanels';
import { PlayerEndGameOverlay } from './player/PlayerEndGameOverlay';
import { HypothesisPickerModal, QuestsPanel, HunterShotModal } from './player/JournalComponents';
import { PlayerQuestsPanel } from './player/PlayerQuestsPanel';
import { PlayerQuestTasksPage } from './player/PlayerQuestTasksPage';
import { PlayerCollabQuestPage } from './player/PlayerCollabQuestPage';
import wolfIcon from 'figma:asset/f25450638f641bf3950904ddd9c219ce09dc887b.png';
import nightVillageBg from 'figma:asset/84278791540a165392bcf00d39375de8f2ef593f.png';
import dayVoteBg from 'figma:asset/a82839620a1569fcbf0c2b77dd03b73637aa89ad.png';

// ── Selectable roles for the demo ──
const DEMO_ROLES = ROLES.filter(r => r.id !== 'villageois');

export function DemoPage() {
  const navigate = useNavigate();

  // ── Step management ──
  const [step, setStep] = useState<'home' | 'pick' | 'game'>('home');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // ── Demo engine (hook is always called, but only activates when role is selected) ──
  const { state, userPlayerId, userShortCode, updateState, started, gameOver } = useDemoEngine(
    step === 'game' ? selectedRole : null,
  );

  // ── Player-side state (mirrors PlayerPage) ──
  const [activePanel, setActivePanel] = useState<PanelId>('game');
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [hypothesisTarget, setHypothesisTarget] = useState<number | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<number | null>(null);
  const villagePanelRef = useRef<HTMLDivElement>(null);
  const questsScrollRef = useRef<HTMLDivElement>(null);
  const [revealPending, setRevealPending] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Quest state ──
  const [openQuestId, setOpenQuestId] = useState<number | null>(null);
  const [readQuestIds, setReadQuestIds] = useState<Set<number>>(new Set());

  // ── Derived player data ──
  const currentPlayer = useMemo(
    () => state.players.find(p => p.id === userPlayerId) ?? null,
    [state.players, userPlayerId],
  );
  const currentRole = useMemo(
    () => (currentPlayer ? getRoleById(currentPlayer.role) ?? null : null),
    [currentPlayer],
  );
  const isCurrentPlayerDead = currentPlayer?.alive === false;
  const t = isCurrentPlayerDead ? gameThemeDead() : gameTheme(state.phase);
  const isNight = state.phase === 'night';
  const alivePlayers = useMemo(() => state.players.filter(p => p.alive), [state.players]);
  const deadPlayers = useMemo(() => state.players.filter(p => !p.alive), [state.players]);

  // Role action booleans
  const isWerewolf = currentPlayer?.role === 'loup-garou';
  const isSeer = currentPlayer?.role === 'voyante';
  const wolfHasVoted = isWerewolf && currentPlayer && state.werewolfVotes[currentPlayer.id] !== undefined;
  const seerHasActed = isSeer && currentPlayer && state.seerTargets?.[currentPlayer.id] !== undefined;
  const guardHasActed = currentPlayer?.role === 'garde' && currentPlayer && state.guardTargets?.[currentPlayer.id] !== undefined;
  const cupidHasActed = currentPlayer?.role === 'cupidon' && (state.cupidLinkedBy || []).includes(currentPlayer?.id ?? -1);
  const witchHasActed = currentPlayer?.role === 'sorciere' && (() => {
    const pid = currentPlayer?.id ?? -1;
    const healDone = !!((state.witchHealedThisNight || {})[pid]) || (state.witchHealUsedBy || []).includes(pid);
    const killDone = (state.witchKillTargets?.[pid] !== undefined) || (state.witchKillUsedBy || []).includes(pid);
    return healDone && killDone;
  })();
  const foxHasActed = currentPlayer?.role === 'renard' && currentPlayer && (state.foxTargets ?? {})[currentPlayer.id] !== undefined;
  const conciergeHasActed = currentPlayer?.role === 'concierge' && currentPlayer && (state.conciergeTargets ?? {})[currentPlayer.id] !== undefined;
  const corbeauHasActed = currentPlayer?.role === 'corbeau' && currentPlayer && (state.corbeauTargets ?? {})[currentPlayer.id] !== undefined;
  const roleHasActed = wolfHasVoted || seerHasActed || cupidHasActed || witchHasActed || guardHasActed || corbeauHasActed || foxHasActed || conciergeHasActed;
  const isVillageois = currentPlayer?.role === 'villageois';
  const canFlip = state.phase === 'night' && currentPlayer?.alive === true;
  const hasRole = useCallback((roleId: string) => state.players.some(p => p.role === roleId && p.alive), [state.players]);

  // ── Swipe navigation ──
  const panels: PanelId[] = ['game', 'village', 'quests'];
  const { containerRef, isDragging, dragOffset, containerWidth } = useSwipeNavigation({
    panels,
    activePanel,
    setActivePanel,
    isFlipped,
    deps: [currentPlayer, started],
  });

  const panelCount = panels.length;
  const panelIndex = panels.indexOf(activePanel) === -1 ? 0 : panels.indexOf(activePanel);

  // ── Tabs ──
  const visibleTabs: { id: PanelId; icon: React.ReactNode; label: string }[] = [
    { id: 'game', icon: <Swords size={18} />, label: 'Jeu' },
    { id: 'village', icon: <Users size={18} />, label: 'Village' },
    { id: 'quests', icon: <Map size={18} />, label: 'Quetes' },
  ];

  // ── Navigation helper ──
  const navigateToPlayer = useCallback((playerId: number) => {
    setActivePanel('village');
    setHighlightedPlayerId(null);
    setTimeout(() => {
      const container = villagePanelRef.current;
      if (!container) return;
      const el = container.querySelector(`[data-player-id="${playerId}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedPlayerId(playerId);
      setTimeout(() => setHighlightedPlayerId(null), 2000);
    }, 350);
  }, []);

  // ── Reset flip on phase change ──
  useEffect(() => {
    if (state.phase !== 'night') {
      setIsFlipped(false);
    }
  }, [state.phase]);

  useEffect(() => {
    if (activePanel !== 'game') {
      setIsFlipped(false);
    }
  }, [activePanel]);

  // ── Scale root font-size for mobile (match PlayerPage) ──
  useEffect(() => {
    if (step !== 'game') return;
    const html = document.documentElement;
    const original = html.style.fontSize;
    html.style.fontSize = '20px';
    return () => { html.style.fontSize = original; };
  }, [step]);

  // ── Callbacks for player actions (local state only, no server) ──
  const handleVote = useCallback((voterId: number, targetId: number) => {
    updateState(s => ({ ...s, votes: { ...s.votes, [voterId]: targetId } }));
  }, [updateState]);

  const handleCancelVote = useCallback((voterId: number) => {
    updateState(s => {
      const { [voterId]: _, ...rest } = s.votes;
      return { ...s, votes: rest };
    });
  }, [updateState]);

  const handleWerewolfVote = useCallback((wolfId: number, targetId: number) => {
    updateState(s => ({
      ...s,
      werewolfVotes: { ...s.werewolfVotes, [wolfId]: targetId },
    }));
  }, [updateState]);

  const handleSeerTarget = useCallback((targetId: number) => {
    if (!currentPlayer) return;
    const target = state.players.find(p => p.id === targetId);
    // Keep the RoleActionsPanel mounted during the 5s reveal countdown
    setRevealPending(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setRevealPending(false), 6000);
    updateState(s => ({
      ...s,
      seerTargets: { ...s.seerTargets, [currentPlayer.id]: targetId },
      seerResults: { ...s.seerResults, [currentPlayer.id]: target ? getRoleById(target.role) ?? null : null },
    }));
  }, [currentPlayer, state.players, updateState]);

  const handleWitchHeal = useCallback(() => {
    if (!currentPlayer) return;
    updateState(s => ({
      ...s,
      witchHealUsedBy: [...(s.witchHealUsedBy || []), currentPlayer.id],
      witchHealedThisNight: { ...(s.witchHealedThisNight || {}), [currentPlayer.id]: true },
    }));
  }, [currentPlayer, updateState]);

  const handleWitchKill = useCallback((targetId: number) => {
    if (!currentPlayer) return;
    updateState(s => ({
      ...s,
      witchKillUsedBy: [...(s.witchKillUsedBy || []), currentPlayer.id],
      witchKillTargets: { ...(s.witchKillTargets || {}), [currentPlayer.id]: targetId },
    }));
  }, [currentPlayer, updateState]);

  const handleCancelWitchKill = useCallback(() => {
    if (!currentPlayer) return;
    updateState(s => {
      const { [currentPlayer.id]: _, ...rest } = s.witchKillTargets || {};
      return {
        ...s,
        witchKillUsedBy: (s.witchKillUsedBy || []).filter(id => id !== currentPlayer.id),
        witchKillTargets: rest,
      };
    });
  }, [currentPlayer, updateState]);

  const handleCupidLink = useCallback((id1: number, id2: number) => {
    if (!currentPlayer) return;
    updateState(s => ({
      ...s,
      cupidLinkedBy: [...(s.cupidLinkedBy || []), currentPlayer.id],
      loverPairs: [...(s.loverPairs || []), [id1, id2] as [number, number]],
    }));
  }, [currentPlayer, updateState]);

  const handleGuardTarget = useCallback((targetId: number) => {
    if (!currentPlayer) return;
    updateState(s => ({
      ...s,
      guardTargets: { ...(s.guardTargets || {}), [currentPlayer.id]: targetId },
    }));
  }, [currentPlayer, updateState]);

  const handleCorbeauTarget = useCallback((targetId: number, message: string) => {
    if (!currentPlayer) return;
    const hintId = Date.now() + Math.floor(Math.random() * 10000);
    updateState(s => ({
      ...s,
      corbeauTargets: { ...(s.corbeauTargets ?? {}), [currentPlayer.id]: targetId },
      corbeauMessages: { ...(s.corbeauMessages ?? {}), [currentPlayer.id]: message },
      hints: [...(s.hints ?? []), { id: hintId, text: message, createdAt: new Date().toISOString() }],
      playerHints: [...(s.playerHints ?? []), { hintId, playerId: targetId, sentAt: new Date().toISOString(), revealed: false }],
    }));
  }, [currentPlayer, updateState]);

  const handleFoxTarget = useCallback((playerIds: number[]) => {
    if (!currentPlayer) return;
    const hasWolf = playerIds.some(pid => {
      const p = state.players.find(pl => pl.id === pid);
      return p && getRoleById(p.role)?.team === 'werewolf';
    });
    // Keep the RoleActionsPanel mounted during the 5s reveal countdown
    setRevealPending(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setRevealPending(false), 6000);
    updateState(s => ({
      ...s,
      foxTargets: { ...(s.foxTargets ?? {}), [currentPlayer.id]: playerIds },
      foxResults: { ...(s.foxResults ?? {}), [currentPlayer.id]: hasWolf },
    }));
  }, [currentPlayer, state.players, updateState]);

  const handleConciergeTarget = useCallback((targetId: number) => {
    if (!currentPlayer) return;
    // Keep the RoleActionsPanel mounted during the 10s reveal countdown
    setRevealPending(true);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setRevealPending(false), 11000);
    updateState(s => ({
      ...s,
      conciergeTargets: { ...(s.conciergeTargets ?? {}), [currentPlayer.id]: targetId },
    }));
  }, [currentPlayer, updateState]);

  const handleSetEarlyVote = useCallback((voterId: number, targetId: number) => {
    updateState(s => ({
      ...s,
      earlyVotes: { ...(s.earlyVotes || {}), [voterId]: targetId },
    }));
  }, [updateState]);

  const handleCancelEarlyVote = useCallback((voterId: number) => {
    updateState(s => {
      const { [voterId]: _, ...rest } = s.earlyVotes || {};
      return { ...s, earlyVotes: rest };
    });
  }, [updateState]);

  const handleHypothesis = useCallback((viewerId: number, targetId: number, roleId: string | null) => {
    updateState(s => {
      const prev = s.hypotheses[viewerId] || {};
      const next = { ...prev };
      if (roleId === null) {
        delete next[targetId];
      } else {
        next[targetId] = roleId;
      }
      return { ...s, hypotheses: { ...s.hypotheses, [viewerId]: next } };
    });
  }, [updateState]);

  // Noop handlers for features not simulated in demo
  const noop = useCallback(() => {}, []);

  // ── Hunter pre-target & confirm shot (demo local state) ──
  const handleHunterPreTarget = useCallback((targetId: number | null) => {
    if (!currentPlayer) return;
    updateState(s => ({
      ...s,
      hunterPreTargets: targetId !== null
        ? { ...s.hunterPreTargets, [currentPlayer.id]: targetId }
        : (() => { const { [currentPlayer.id]: _, ...rest } = s.hunterPreTargets; return rest; })(),
    }));
  }, [currentPlayer, updateState]);

  const handleConfirmHunterShot = useCallback((targetId: number) => {
    updateState(s => {
      const target = s.players.find(p => p.id === targetId);
      const hunter = s.hunterShooterId !== null ? s.players.find(p => p.id === s.hunterShooterId) : null;
      let newPlayers = s.players.map(p =>
        p.id === targetId ? { ...p, alive: false } : p
      );
      const events = [
        ...s.events,
        {
          id: Date.now(),
          turn: s.turn,
          phase: s.phase,
          message: `🏹 ${hunter?.name || 'Le Chasseur'} tire sur ${target?.name || 'un joueur'} dans son dernier souffle !`,
          timestamp: new Date().toISOString(),
        },
      ];
      // Handle lover deaths
      if (s.loverPairs) {
        for (const [l1, l2] of s.loverPairs) {
          let loverId: number | null = null;
          if (targetId === l1) loverId = l2;
          if (targetId === l2) loverId = l1;
          if (loverId !== null) {
            const lover = newPlayers.find(p => p.id === loverId);
            if (lover && lover.alive) {
              newPlayers = newPlayers.map(p =>
                p.id === loverId ? { ...p, alive: false } : p
              );
              events.push({
                id: Date.now() + 1,
                turn: s.turn,
                phase: s.phase,
                message: `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
      return { ...s, players: newPlayers, hunterPending: false, hunterShooterId: null, events };
    });
  }, [updateState]);

  // ── Quest action handlers (local state, no server) ──

  /** Reveal the reward hint for a quest if the player succeeded */
  const revealQuestRewardHint = useCallback((s: GameState, quest: { rewardHintIds?: Record<number, number> }, playerId: number): GameState => {
    const rewardHintId = quest.rewardHintIds?.[playerId];
    if (!rewardHintId) return s;
    // Check if already added (avoid duplicates)
    const already = (s.playerHints ?? []).some(ph => ph.hintId === rewardHintId && ph.playerId === playerId);
    if (already) return s;
    // Inject a new revealed PlayerHint entry
    const now = new Date().toISOString();
    const newPlayerHint = { hintId: rewardHintId, playerId, sentAt: now, revealed: true, revealedAt: now };
    return { ...s, playerHints: [...(s.playerHints ?? []), newPlayerHint] };
  }, []);

  const handleAnswerTask = useCallback((questId: number, taskId: number, answer: string) => {
    updateState(s => {
      const quests = (s.quests || []).map(q => {
        if (q.id !== questId) return q;
        const updatedTasks = q.tasks.map(tk => {
          if (tk.id !== taskId) return tk;
          return {
            ...tk,
            playerAnswers: { ...tk.playerAnswers, [userPlayerId]: answer },
            playerResults: { ...tk.playerResults, [userPlayerId]: answer.toLowerCase().trim() === tk.correctAnswer.toLowerCase().trim() },
          };
        });
        const allAnswered = updatedTasks.every(tk => {
          const a = tk.playerAnswers?.[userPlayerId];
          return a !== undefined && a !== '';
        });
        let newStatus: string = q.playerStatuses?.[userPlayerId] || 'active';
        if (allAnswered) {
          const allCorrect = updatedTasks.every(tk => tk.playerResults?.[userPlayerId] === true);
          newStatus = allCorrect ? 'success' : 'fail';
        } else {
          newStatus = 'active';
        }
        return {
          ...q,
          tasks: updatedTasks,
          playerStatuses: { ...q.playerStatuses, [userPlayerId]: newStatus as any },
        };
      });
      let next = { ...s, quests };
      // Reveal reward hint if quest succeeded
      const resolvedQuest = quests.find(q => q.id === questId);
      if (resolvedQuest && resolvedQuest.playerStatuses?.[userPlayerId] === 'success') {
        next = revealQuestRewardHint(next, resolvedQuest, userPlayerId);
      }
      return next;
    });
  }, [updateState, userPlayerId, revealQuestRewardHint]);

  const handleCollabVote = useCallback((questId: number, vote: boolean) => {
    updateState(s => {
      const quests = (s.quests || []).map(q => {
        if (q.id !== questId) return q;
        const updatedVotes = { ...(q.collaborativeVotes || {}), [userPlayerId]: vote };
        const group = (q.collaborativeGroups || [])[0] || [];
        const aiMembers = group.filter((id: number) => id !== userPlayerId);
        for (const aiId of aiMembers) {
          if (updatedVotes[aiId] === undefined) {
            updatedVotes[aiId] = Math.random() < 0.7 ? vote : !vote;
          }
        }
        const allVoted = group.every((id: number) => updatedVotes[id] !== undefined);
        let newStatuses = { ...q.playerStatuses };
        if (allVoted) {
          const yesCount = group.filter((id: number) => updatedVotes[id] === true).length;
          const majorityYes = yesCount > group.length / 2;
          const correctAnswer = q.tasks[0]?.correctAnswer;
          const majorityAnswer = majorityYes
            ? (q.tasks[0]?.choices?.[0] || 'Oui')
            : (q.tasks[0]?.choices?.[1] || 'Non');
          const isSuccess = majorityAnswer === correctAnswer;
          for (const id of group) {
            newStatuses[id] = isSuccess ? 'success' : 'fail';
          }
        }
        return {
          ...q,
          collaborativeVotes: updatedVotes,
          playerStatuses: newStatuses,
        };
      });
      let next = { ...s, quests };
      // Reveal reward hint if quest succeeded for the human player
      const resolvedQuest = quests.find(q => q.id === questId);
      if (resolvedQuest && resolvedQuest.playerStatuses?.[userPlayerId] === 'success') {
        next = revealQuestRewardHint(next, resolvedQuest, userPlayerId);
      }
      return next;
    });
  }, [updateState, userPlayerId, revealQuestRewardHint]);

  const handleCancelCollabVote = useCallback((questId: number) => {
    updateState(s => {
      const quests = (s.quests || []).map(q => {
        if (q.id !== questId) return q;
        const votes = { ...(q.collaborativeVotes || {}) };
        delete votes[userPlayerId];
        return { ...q, collaborativeVotes: votes };
      });
      return { ...s, quests };
    });
  }, [updateState, userPlayerId]);

  const handleOpenQuest = useCallback((questId: number) => {
    setOpenQuestId(questId);
    setReadQuestIds(prev => {
      if (prev.has(questId)) return prev;
      const next = new Set(prev);
      next.add(questId);
      return next;
    });
  }, []);

  // ── Death Announcement (same as normal game, portalled to body) ──
  const deathAnnouncementEnabled = started && state.roleRevealDone && state.players.length > 0 && state.turn >= 1;
  const { announcement: deathAnnouncement, dismiss: dismissDeathAnnouncement } = useDeathAnnouncement(
    state.players,
    state.events,
    deathAnnouncementEnabled,
    state.phaseDeathHistory,
    state.gameId,
    userPlayerId,
  );

  // Auto-dismiss death announcement after 6s in demo mode (user can also tap to dismiss)
  useEffect(() => {
    if (!deathAnnouncement) return;
    const timer = setTimeout(() => {
      dismissDeathAnnouncement();
    }, 6000);
    return () => clearTimeout(timer);
  }, [deathAnnouncement, dismissDeathAnnouncement]);

  // ── Role selection handler ──
  const handlePickRole = useCallback((roleId: string) => {
    setSelectedRole(roleId);
    setStep('game');
  }, []);

  // ── Back button ──
  const demoBanner = useMemo(() => (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setStep('pick')}
      className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer shrink-0"
      style={{
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.4)',
        color: '#a78bfa',
        fontSize: '0.6rem',
        fontFamily: '"Cinzel", serif',
      }}
    >
      <ArrowLeft size={12} />
      Demo
    </motion.button>
  ), []);

  // ── End game: navigate back to demo home ──
  const handleEndGameNavigate = useCallback((_to: string) => {
    setStep('home');
    setSelectedRole(null);
    setActivePanel('game');
    setIsFlipped(false);
    setSelectedTarget(null);
    setHypothesisTarget(null);
    setJournalOpen(false);
    setHighlightedPlayerId(null);
  }, []);

  // ──────────────────── RENDER ────────────────────

  return (
    <>
      {/* ── STEP 0: Demo Home (mirrors HomePage layout) ── */}
      {step === 'home' && (
        <div
          className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 30%, #1a1040 60%, #0d0f20 100%)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          {/* Stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() * 3 + 1,
                  height: Math.random() * 3 + 1,
                  top: `${Math.random() * 70}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.7 + 0.3,
                }}
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                }}
              />
            ))}
          </div>

          {/* Moon */}
          <motion.div
            className="absolute top-12 right-8 lg:right-24"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          >
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #f0e68c 0%, #daa520 50%, #b8860b 100%)',
                  boxShadow: '0 0 40px rgba(218,165,32,0.4), 0 0 80px rgba(218,165,32,0.2)',
                }}
              />
              <div
                className="absolute top-2 left-4 w-16 h-16 rounded-full"
                style={{ background: 'radial-gradient(circle at 30% 40%, transparent 50%, rgba(0,0,0,0.15) 100%)' }}
              />
            </div>
          </motion.div>

          {/* Village silhouette */}
          <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none">
            <svg viewBox="0 0 400 120" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0,120 L0,80 L20,80 L20,60 L30,45 L40,60 L40,80 L60,80 L60,50 L65,30 L70,50 L70,80 L100,80 L100,70 L110,55 L115,40 L120,55 L120,70 L130,70 L130,60 L140,45 L145,25 L150,45 L150,60 L170,60 L170,50 L175,30 L180,50 L180,80 L200,80 L200,65 L210,50 L215,20 L220,50 L220,65 L240,65 L240,75 L250,60 L255,35 L260,60 L260,75 L280,75 L280,55 L290,40 L295,25 L300,40 L300,55 L320,55 L320,70 L330,55 L335,30 L340,55 L340,70 L360,70 L360,80 L370,65 L375,45 L380,65 L380,80 L400,80 L400,120 Z"
                fill="#0a0e1a"
              />
              <rect x="25" y="65" width="3" height="4" fill="#d4a843" opacity="0.7" rx="0.5" />
              <rect x="105" y="62" width="3" height="4" fill="#d4a843" opacity="0.8" rx="0.5" />
              <rect x="205" y="58" width="3" height="4" fill="#d4a843" opacity="0.7" rx="0.5" />
              <rect x="325" y="60" width="3" height="4" fill="#d4a843" opacity="0.8" rx="0.5" />
              <rect x="375" y="70" width="3" height="4" fill="#d4a843" opacity="0.6" rx="0.5" />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-6 pb-52">
            {/* Wolf icon */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-4"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: 'radial-gradient(circle, rgba(218,165,32,0.15) 0%, transparent 70%)',
                  border: '2px solid rgba(218,165,32,0.3)',
                }}
              >
                <img src={wolfIcon} alt="Loup-Garou" className="w-full h-full object-cover cursor-pointer" onClick={() => navigate('/')} />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="text-center mb-2"
            >
              <h1
                className="text-3xl tracking-wider mb-1"
                style={{
                  fontFamily: '"Cinzel Decorative", serif',
                  color: '#d4a843',
                  textShadow: '0 0 20px rgba(212,168,67,0.3)',
                }}
              >
                Les Loups-Garous
              </h1>
              <p
                className="tracking-widest uppercase opacity-70"
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: '#b8a070',
                  fontSize: '0.7rem',
                  letterSpacing: '0.25em',
                }}
              >
                de Thiercelieux
              </p>
            </motion.div>

            {/* Demo badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.3)',
              }}
            >
              <Sparkles size={14} style={{ color: '#a78bfa' }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: '#a78bfa', fontSize: '0.7rem', fontWeight: 700 }}>Mode Demo</span>
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex items-center gap-3 my-6"
            >
              <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, transparent, #d4a843)' }} />
              <Moon size={14} style={{ color: '#d4a843' }} />
              <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, #d4a843, transparent)' }} />
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="text-center mb-10 px-4 max-w-md"
              style={{ color: '#8090b0', fontFamily: '"Cinzel", serif', fontSize: '0.85rem' }}
            >
              Quand la nuit tombe sur le village, les loups rodent parmi vous...
            </motion.p>

            {/* Main button */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              className="flex flex-col gap-4 w-full max-w-sm"
            >
              <button
                onClick={() => setStep('pick')}
                className="flex items-center justify-center gap-3 py-4 px-8 rounded-xl transition-all duration-300 active:scale-95 hover:shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)',
                  color: '#0a0e1a',
                  fontFamily: '"Cinzel", serif',
                  fontSize: '1rem',
                  boxShadow: '0 4px 20px rgba(212,168,67,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <LogIn size={20} />
                Tester les rôles
              </button>
            </motion.div>
          </div>
        </div>
      )}

      {/* ── STEP 1: Role Selection ── */}
      {step === 'pick' && (
        <div
          className="min-h-screen flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 50%, #15102a 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Header */}
          <div className="flex items-center px-4 py-4 gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
            <button
              onClick={() => setStep('home')}
              className="flex items-center gap-1 py-1 pr-2 transition-colors active:scale-95"
              aria-label="Retour"
            >
              <ArrowLeft size={18} style={{ color: '#8090b0' }} />
            </button>
            <div className="flex-1">
              <h1 style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: '#d4a843', fontSize: '1.1rem', fontWeight: 700 }}>
                Mode Demo
              </h1>
              <p style={{ color: '#6b7b9b', fontSize: '0.7rem', marginTop: '2px' }}>
                Choisissez un role pour vivre une partie simulee
              </p>
            </div>
            <Sparkles size={20} style={{ color: '#a78bfa' }} />
          </div>

          {/* Role grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <div className="grid grid-cols-2 gap-3">
              {DEMO_ROLES.map((role) => {
                const teamColor = role.team === 'werewolf' ? '#c41e3a' : role.team === 'village' ? '#6b8e5a' : '#d4a843';
                return (
                  <motion.button
                    key={role.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handlePickRole(role.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${teamColor}55`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    <span className="text-3xl">{role.emoji}</span>
                    <span style={{ fontFamily: '"Cinzel", serif', color: '#c0c8d8', fontSize: '0.8rem', fontWeight: 700 }}>
                      {role.name}
                    </span>
                    <span
                      className="text-[0.55rem] px-2 py-0.5 rounded-full"
                      style={{
                        background: `${teamColor}20`,
                        color: teamColor,
                        fontWeight: 600,
                      }}
                    >
                      {role.team === 'werewolf' ? 'Loups' : 'Village'}
                    </span>
                    <p style={{ color: '#6b7b9b', fontSize: '0.55rem', lineHeight: 1.3 }} className="line-clamp-2">
                      {role.power}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            {/* Villageois option */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePickRole('villageois')}
              className="w-full mt-4 flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
              style={{
                background: 'rgba(107,142,90,0.08)',
                border: '1px solid rgba(107,142,90,0.2)',
              }}
            >
              <span className="text-2xl">🧑‍🌾</span>
              <div className="text-left flex-1">
                <span style={{ fontFamily: '"Cinzel", serif', color: '#c0c8d8', fontSize: '0.8rem', fontWeight: 700 }}>
                  Villageois
                </span>
                <p style={{ color: '#6b7b9b', fontSize: '0.55rem', marginTop: '2px' }}>
                  Pas de pouvoir special — enquetez et votez pour eliminer les loups.
                </p>
              </div>
              <Play size={16} style={{ color: '#6b8e5a' }} />
            </motion.button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Game View (identical to PlayerPage) ── */}
      {step === 'game' && started && currentPlayer && (
        <div
          className="h-dvh max-w-md mx-auto flex flex-col overflow-hidden relative"
          style={{
            background: activePanel === 'game' && !isCurrentPlayerDead
              ? (isNight ? '#050810' : '#1a1a1a')
              : isCurrentPlayerDead
                ? t.pageBg
                : isNight
                  ? 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)'
                  : t.pageBg,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Full-screen background image */}
          {activePanel === 'game' && !isCurrentPlayerDead && (
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                key={isNight ? 'night' : 'day'}
                alt=""
                className="absolute w-full h-full object-cover"
                src={isNight ? nightVillageBg : dayVoteBg}
                style={{ objectPosition: 'center top' }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: isNight
                    ? 'linear-gradient(180deg, rgba(12,13,21,0.45) 0%, rgba(12,13,21,0.75) 50%, rgb(12,13,21) 100%)'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.6) 100%)',
                }}
              />
            </div>
          )}

          {/* Header */}
          <PlayerHeader
            state={state}
            currentPlayer={currentPlayer}
            currentPlayerId={userPlayerId}
            t={t}
            isNight={isNight}
            isPracticeMode={false}
            isSimulationMode={false}
            isDiscoveryRealMode={false}
            isCurrentPlayerDead={isCurrentPlayerDead}
            isGMPreview={false}
            gmBackButton={demoBanner}
            alivePlayers={alivePlayers}
            deadPlayers={deadPlayers}
            isResyncing={false}
            onResync={noop}
            onOpenJournal={() => setJournalOpen(true)}
            activePanel={activePanel}
          />

          {/* Death banner */}
          {currentPlayer && !currentPlayer.alive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex-shrink-0 px-4 py-2.5 relative z-[1]"
              style={{
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                borderBottomWidth: 1, borderBottomStyle: 'solid' as const,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <Skull size={14} style={{ color: '#888888' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: '"Cinzel", serif', color: '#999999', fontSize: '0.7rem' }}>
                    Tu as ete elimine
                  </p>
                  <p style={{ color: t.textSecondary, fontSize: '0.55rem' }}>
                    Tu etais {currentRole?.emoji} {currentRole?.name}. Partie demo terminee pour toi.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Swipeable panels */}
          <div className="flex-1 overflow-hidden relative z-[1]">
            <div
              ref={containerRef}
              className="absolute inset-0 overflow-hidden"
              style={{ touchAction: 'pan-y', userSelect: isDragging ? 'none' : 'auto' }}
            >
              <motion.div
                className="flex h-full"
                animate={{ x: -panelIndex * containerWidth + (isDragging ? dragOffset : 0) }}
                transition={isDragging ? { duration: 0 } : { type: 'tween', duration: 0.28, ease: [0.25, 0.1, 0.25, 1.0] }}
                style={{ width: containerWidth > 0 ? panelCount * containerWidth : `${panelCount * 100}%` }}
              >
                {/* Panel 1 — Game */}
                <div style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%` }} className="h-full overflow-y-auto">
                  {(currentPlayer?.alive ?? false) && (
                    <GamePanel
                      alivePlayers={alivePlayers}
                      phase={state.phase}
                      dayStep={state.dayStep}
                      currentPlayerId={userPlayerId}
                      votes={state.votes}
                      onVote={handleVote}
                      onCancelVote={handleCancelVote}
                      currentPlayerAlive={currentPlayer?.alive ?? false}
                      canFlip={canFlip}
                      onFlip={() => setIsFlipped(true)}
                      currentRole={currentRole ?? undefined}
                      hypotheses={state.hypotheses[userPlayerId] || {}}
                      isDemoMode={true}
                      t={t}
                      deadPlayers={deadPlayers}
                      events={state.events}
                      turn={state.turn}
                      hints={state.hints ?? []}
                      playerHints={state.playerHints ?? []}
                      phaseTimerEndAt={state.phaseTimerEndAt}
                      loverPairs={state.loverPairs ?? []}
                      allPlayers={state.players}
                      maireId={state.maireId ?? null}
                      maireElectionDone={state.maireElectionDone ?? false}
                      maireCandidates={state.maireCandidates ?? []}
                      maireCampaignMessages={state.maireCampaignMessages ?? {}}
                      nominations={state.nominations || {}}
                      isFlipped={isFlipped}
                      onFlipBack={() => setIsFlipped(false)}
                      roleBackContent={
                        (isVillageois || (roleHasActed && !revealPending)) ? (
                          <VillagerSleepingPanel
                            onFlipBack={() => setIsFlipped(false)}
                            onInvestigate={() => setActivePanel('village')}
                            onQuests={() => { setIsFlipped(false); setActivePanel('quests'); }}
                            t={t}
                          />
                        ) : (
                          <RoleActionsPanel
                            state={state}
                            alivePlayers={alivePlayers}
                            currentPlayer={currentPlayer}
                            currentRole={currentRole ?? undefined}
                            hasRole={hasRole}
                            selectedTarget={selectedTarget}
                            setSelectedTarget={setSelectedTarget}
                            allPlayers={state.players}
                            onFlipBack={() => setIsFlipped(false)}
                            onWerewolfVote={handleWerewolfVote}
                            onSeerTarget={handleSeerTarget}
                            onWitchHeal={handleWitchHeal}
                            onWitchKill={handleWitchKill}
                            onCancelWitchKill={handleCancelWitchKill}
                            onCupidLink={handleCupidLink}
                            onGuardTarget={handleGuardTarget}
                            onCorbeauTarget={handleCorbeauTarget}
                            onHunterPreTarget={handleHunterPreTarget}
                            onFoxTarget={handleFoxTarget}
                            onConciergeTarget={handleConciergeTarget}
                            t={t}
                          />
                        )
                      }
                    />
                  )}
                  {!(currentPlayer?.alive ?? false) && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
                      <Skull size={48} style={{ color: '#555' }} />
                      <p style={{ fontFamily: '"Cinzel", serif', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>
                        Tu as ete elimine de la partie.
                      </p>
                      <p style={{ color: '#666', fontSize: '0.7rem', textAlign: 'center' }}>
                        Observe le village depuis l'onglet Village.
                      </p>
                    </div>
                  )}
                </div>

                {/* Panel 2 — Village */}
                <div ref={villagePanelRef} style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%` }} className="h-full overflow-y-auto">
                  <VillageListPanel
                    alivePlayers={alivePlayers}
                    deadPlayers={deadPlayers}
                    currentPlayerId={userPlayerId}
                    hypotheses={state.hypotheses[userPlayerId] || {}}
                    onOpenHypothesis={(targetId) => setHypothesisTarget(targetId)}
                    maireId={state.maireId ?? null}
                    allPlayers={state.players}
                    phase={state.phase}
                    earlyVotes={state.earlyVotes ?? {}}
                    onSetEarlyVote={handleSetEarlyVote}
                    onCancelEarlyVote={handleCancelEarlyVote}
                    highlightedPlayerId={highlightedPlayerId}
                    playerTags={state.playerTags || {}}
                    t={t}
                  />
                </div>

                {/* Panel 3 — Quetes */}
                <div ref={questsScrollRef} style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%` }} className="h-full overflow-y-auto">
                  <PlayerQuestsPanel
                    state={state}
                    currentPlayerId={userPlayerId}
                    onAnswerTask={handleAnswerTask}
                    onCollabVote={handleCollabVote}
                    onCancelCollabVote={handleCancelCollabVote}
                    onOpenQuest={handleOpenQuest}
                    readQuestIds={readQuestIds}
                    isActive={activePanel === 'quests'}
                    onNavigateToPlayer={navigateToPlayer}
                    t={t}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Tab Bar */}
          <div
            className="flex-shrink-0 flex items-stretch relative z-[2]"
            style={{
              background: activePanel === 'game' && !isCurrentPlayerDead
                ? (isNight ? 'rgba(5,8,16,0.82)' : 'rgba(20,18,15,0.82)')
                : isCurrentPlayerDead ? t.headerBg : isNight ? 'rgba(5,8,16,0.95)' : t.headerBg,
              borderTop: `1px solid ${isCurrentPlayerDead ? t.headerBorder : isNight ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'}`,
              backdropFilter: 'blur(12px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            }}
          >
            {visibleTabs.map((tab) => {
              const isActive = activePanel === tab.id;
              const tabColor = isActive ? t.gold : t.textDim;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'game' && activePanel === 'game' && isFlipped) {
                      setIsFlipped(false);
                    } else {
                      setActivePanel(tab.id);
                    }
                  }}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors"
                  style={{ perspective: '600px' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="demo-tab-indicator"
                      className="absolute top-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: t.gold }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span style={{ color: tabColor }}>{tab.icon}</span>
                  <span
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.55rem',
                      color: tabColor,
                    }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Journal overlay (slides in from right) */}
          <AnimatePresence>
            {journalOpen && (
              <motion.div
                key="journal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-[60]"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={() => setJournalOpen(false)}
              >
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-y-0 right-0 w-full max-w-md flex flex-col overflow-hidden"
                  style={{
                    background: isCurrentPlayerDead
                      ? t.pageBg
                      : isNight
                        ? 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)'
                        : t.pageBg,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Journal header */}
                  <div
                    className="flex items-center px-4 py-3 flex-shrink-0 gap-2"
                    style={{
                      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
                      background: isCurrentPlayerDead ? t.headerBg : isNight ? 'rgba(5,8,16,0.8)' : t.headerBg,
                      borderBottomWidth: 1,
                      borderBottomStyle: 'solid' as const,
                      borderBottomColor: isCurrentPlayerDead ? t.headerBorder : isNight ? 'rgba(255,255,255,0.05)' : t.headerBorder,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <button
                      onClick={() => setJournalOpen(false)}
                      className="flex items-center gap-1 py-1 pr-1 transition-colors active:scale-95"
                      aria-label="Fermer le journal"
                    >
                      <ArrowLeft size={16} style={{ color: t.textMuted }} />
                    </button>
                    <ScrollText size={16} style={{ color: t.gold }} />
                    <h2 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem', fontWeight: 700 }}>
                      Journal
                    </h2>
                  </div>

                  {/* Journal content */}
                  <div className="flex-1 overflow-y-auto">
                    <QuestsPanel
                      state={state}
                      currentPlayer={currentPlayer}
                      currentRole={currentRole ?? undefined}
                      t={t}
                      onNavigateToPlayer={(playerId) => {
                        setJournalOpen(false);
                        navigateToPlayer(playerId);
                      }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Hypothesis Picker Modal ── */}
          <AnimatePresence>
            {hypothesisTarget !== null && userPlayerId !== null && (
              <HypothesisPickerModal
                targetPlayer={state.players.find((p) => p.id === hypothesisTarget) || null}
                currentHypothesis={(state.hypotheses[userPlayerId] || {})[hypothesisTarget] || ''}
                targetVoteCount={hypothesisTarget !== null ? Object.values(state.votes).filter((v) => v === hypothesisTarget).length : 0}
                onSelect={(roleId) => {
                  handleHypothesis(userPlayerId, hypothesisTarget!, roleId);
                  setHypothesisTarget(null);
                }}
                onClear={() => {
                  handleHypothesis(userPlayerId, hypothesisTarget!, null);
                  setHypothesisTarget(null);
                }}
                onClose={() => setHypothesisTarget(null)}
                t={t}
                phase={state.phase}
                dayStep={state.dayStep}
                currentPlayerAlive={currentPlayer?.alive ?? false}
                isMaireElection={state.phase === 'day' && !state.maireElectionDone && state.turn === 1 && !!state.roleRevealDone}
                onVoteAgainst={(targetId) => {
                  handleVote(userPlayerId, targetId);
                  setHypothesisTarget(null);
                  setActivePanel('game');
                }}
                onEarlyVote={(targetId) => {
                  handleSetEarlyVote(userPlayerId, targetId);
                  setHypothesisTarget(null);
                }}
              />
            )}
          </AnimatePresence>

          {/* ── Quest Tasks Overlay ── */}
          <AnimatePresence mode="wait">
            {openQuestId !== null && (() => {
              const quest = (state.quests || []).find(q => q.id === openQuestId);
              if (!quest) return null;
              const isCollab = (quest.questType || 'individual') === 'collaborative';
              return (
                <motion.div
                  key={`quest-overlay-${openQuestId}`}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-0 z-[65] flex flex-col overflow-hidden"
                  style={{
                    background: isCurrentPlayerDead
                      ? t.pageBg
                      : isNight
                        ? 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)'
                        : t.pageBg,
                    paddingTop: 'env(safe-area-inset-top, 0px)',
                  }}
                >
                  {isCollab ? (
                    <PlayerCollabQuestPage
                      quest={quest}
                      state={state}
                      currentPlayerId={userPlayerId}
                      onBack={() => setOpenQuestId(null)}
                      onCollabVote={handleCollabVote}
                      onCancelCollabVote={handleCancelCollabVote}
                      onNavigateToPlayer={navigateToPlayer}
                      t={t}
                    />
                  ) : (
                    <PlayerQuestTasksPage
                      quest={quest}
                      state={state}
                      currentPlayerId={userPlayerId}
                      onBack={() => setOpenQuestId(null)}
                      onAnswerTask={handleAnswerTask}
                      t={t}
                    />
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* ── Hunter Shot Modal — shown when the Chasseur is killed ── */}
          <AnimatePresence>
            {state.hunterPending && userPlayerId !== null && userPlayerId === state.hunterShooterId && (
              <HunterShotModal
                players={state.players}
                hunterId={state.hunterShooterId}
                preTarget={state.hunterShooterId !== null ? (state.hunterPreTargets || {})[state.hunterShooterId] ?? null : null}
                onShoot={(targetId) => handleConfirmHunterShot(targetId)}
                t={t}
              />
            )}
          </AnimatePresence>

          {/* ── Death Announcement Modal (same as normal game, portalled to body) ── */}
          {deathAnnouncement && (
            <DeathAnnouncementModal
              data={deathAnnouncement}
              onDismiss={dismissDeathAnnouncement}
              t={t}
              currentPlayerId={userPlayerId}
              voteHistory={state.voteHistory}
              allPlayers={state.players}
              lastWillUsed={state.lastWillUsed}
            />
          )}

          {/* End Game Overlay */}
          {state.winner && (
            <PlayerEndGameOverlay
              state={state}
              currentPlayerId={userPlayerId}
              onDismiss={noop}
              navigate={handleEndGameNavigate}
            />
          )}
        </div>
      )}

      {/* Loading state between pick and game start */}
      {step === 'game' && !started && (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4"
          style={{ background: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)' }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full"
            style={{
              border: '3px solid rgba(212,168,67,0.15)',
              borderTopColor: '#d4a843',
            }}
          />
          <p style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.85rem' }}>
            Preparation de la partie...
          </p>
        </div>
      )}
    </>
  );
}