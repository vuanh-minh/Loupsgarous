// PlayerPage — v12 rebuild 2026-03-14 (lastWillUsed fix + cache-bust)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Skull,
  Swords,
  Users,
  ArrowLeft,
  X as XIcon,
  ScrollText,
  Map,
} from 'lucide-react';
import { useGame, type GameState } from '../../context/GameContext';
import { getRoleById, type RoleDefinition } from '../../data/roles';
import { useServerActions } from '../../context/useServerAction';
import { useRealtimeSync } from '../../context/useRealtimeSync';
import { gameTheme, gameThemeDead } from '../../context/gameTheme';
import { QuestsPanel, HunterShotModal, MaireSuccessionModal, HypothesisPickerModal } from './player/JournalComponents';
import { PhaseTimerDisplay } from '../PhaseTimer';
import { useNotifications, sendPushNotifications } from '../../context/useNotifications';
import { API_BASE, publicAnonKey } from '../../context/apiConfig';
import { usePWAContext } from '../layout/RootLayout';
import { PWAInstallBanner } from '../PWAInstallBanner';
import { useDeathAnnouncement, DeathAnnouncementModal } from './player/DeathAnnouncementModal';
import { VillageListPanel } from './player/VillageListPanel';
import { DiscoveryRecapPanel, VillagerSleepingPanel, GuardSleepingPanel, EmpoisonneurSleepingPanel } from './player/SleepingPanels';
import { RoleActionsPanel } from './player/RoleActionsPanel';
import { GamePanel } from './player/GamePanel';
import { RoleRevealScreen } from './player/RoleRevealScreen';
import { RevivedScreen } from './player/RevivedScreen';
import { PlayerHeader } from './player/PlayerHeader';
import { useSwipeNavigation, type PanelId } from './player/useSwipeNavigation';
import { usePlayerSync } from './player/usePlayerSync';
import { LastWillSection } from './player/LastWillSection';
import { MaireElectionSuccessScreen } from './player/MaireElectionSuccessScreen';
import { PlayerQuestsPanel } from './player/PlayerQuestsPanel';
import { PlayerQuestTasksPage } from './player/PlayerQuestTasksPage';
import { PlayerCollabQuestPage } from './player/PlayerCollabQuestPage';
import { useInAppNotifications, InAppNotificationToasts } from './player/InAppNotifications';
import { PlayerEndGameOverlay } from './player/PlayerEndGameOverlay';
import { RoleRevealVillagePanel } from './player/RoleRevealVillagePanel';
import { JoinVillageScreen } from './player/JoinVillageScreen';
const nightVillageBg = '/assets/backgrounds/night-village-player.png';
const dayVoteBg = '/assets/backgrounds/day-village-player.png';

export function PlayerPage() {
  const { shortCode: shortCodeParam } = useParams();
  const navigate = useNavigate();
  const [isGMPreview] = useState(() => {
    const flag = sessionStorage.getItem('__gm_preview');
    if (flag === '1') {
      sessionStorage.removeItem('__gm_preview');
      return true;
    }
    return false;
  });
  // shortCode is the 4-char code in the URL
  const shortCode = shortCodeParam || null;

  const {
    state,
    setSeerTarget, useWitchHeal, useWitchKill, cancelWitchKill,
    checkWinCondition, endGame,
    setCupidLink, confirmHunterShot, setHunterPreTarget, castWerewolfVote,
    setHypothesis, castVote, cancelVote,
    loadFromServer, setFullState, applyStateDelta, clearJustRevived,
    setGuardTarget, updateState, localMode, setDiscoveryWolfTarget,
    isDeltaRecoveryNeeded, clearDeltaRecovery,
  } = useGame();

  // Determine if current player is dead early for theme selection
  const isCurrentPlayerDead = shortCode
    ? state.players.find((p) => p.shortCode === shortCode)?.alive === false
    : false;
  const t = isCurrentPlayerDead ? gameThemeDead() : gameTheme(state.phase);
  const pwa = usePWAContext();
  // In browser (non-standalone) mode, the background extends under the browser chrome
  // for an immersive full-bleed effect. Content stays within h-dvh (visible viewport).
  const isBrowserMode = !pwa.isStandalone;

  // Scale up root font-size for mobile readability (all rem values scale proportionally)
  useEffect(() => {
    const html = document.documentElement;
    const original = html.style.fontSize;
    html.style.fontSize = '20px'; // 25% larger than default 16px — ensures min ~11px for secondary text
    return () => { html.style.fontSize = original; };
  }, []);

  const {
    serverCastVote, serverCancelVote, serverCastWerewolfVote,
    serverSetSeerTarget, serverWitchHeal, serverWitchKill, serverCancelWitchKill,
    serverCupidLink, serverMarkRoleRevealed, serverSetGuardTarget,
    serverSetCorbeauTarget, serverRevealHint,
    serverDeclareCandidacy, serverWithdrawCandidacy,
    serverSetHunterPreTarget, serverConfirmHunterShot, serverSetEarlyVote,
    serverSetFoxTarget,
    serverSetConciergeTarget,
    serverOracleUse,
    serverSetLastWillUsed,
    serverSetEmpoisonneurTarget,
    serverAnswerQuestTask,
    serverCollabVote,
    serverCancelCollabVote,
    serverJoinVillage,
    serverSetDiscoveryWolfTarget,
  } = useServerActions();

  // Realtime channel: receive GM state broadcasts instantly
  const handleStateReceived = useCallback((gs: any) => {
    setFullState(gs);
  }, [setFullState]);

  // Handle GM delta broadcasts (optimized — only changed fields)
  const handleDeltaReceived = useCallback((delta: any) => {
    applyStateDelta(delta);
  }, [applyStateDelta]);

  // Handle GM test notification: show a browser notification if targeted at this player
  const handleTestNotification = useCallback((targetShortCode: string) => {
    if (!shortCode || targetShortCode !== shortCode) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification('Loup-Garou — Test MJ', {
        body: '🐺 Le Maitre du Jeu vous envoie une notification de test !',
        tag: 'gm-test-notif-' + Date.now(),
        silent: false,
      });
    } catch { /* ignore */ }
  }, [shortCode]);

  const { isConnected: realtimeConnected, broadcastActionNotify, broadcastHeartbeat, broadcastResyncRequest } = useRealtimeSync({
    isGM: false,
    onStateReceived: handleStateReceived,
    onDeltaReceived: handleDeltaReceived,
    onTestNotification: handleTestNotification,
    gameId: state.gameId || null,
    disabled: localMode,
  });

  // Lookup player by shortCode
  const currentPlayerId = shortCode
    ? (state.players.find((p) => p.shortCode === shortCode)?.id ?? null)
    : null;

  // ---- Push Notifications ----
  const { permission: notifPermission, requestPermission: requestNotifPermission, sendTestNotification } = useNotifications({
    enabled: !isGMPreview && currentPlayerId !== null,
    phase: state.phase,
    phaseTimerEndAt: state.phaseTimerEndAt,
    phaseTimerDuration: state.phaseTimerDuration,
    playerHints: state.playerHints ?? [],
    playerId: currentPlayerId,
    shortCode: shortCode,
    gameId: state.gameId || null,
    quests: state.quests ?? [],
    questAssignments: state.questAssignments ?? {},
    nominations: state.nominations || {},
    players: state.players ?? [],
    gmAlerts: state.gmAlerts || {},
    gmAlertMessages: state.gmAlertMessages || {},
  });

  // ---- In-App Toast Notifications ----
  const { toasts, dismissToast } = useInAppNotifications({
    state,
    currentPlayerId,
    enabled: !isGMPreview && currentPlayerId !== null,
    shortCode: shortCode || null,
  });

  // Ask for notification permission once the player has loaded into a game
  const notifRequestedRef = useRef(false);
  useEffect(() => {
    if (notifRequestedRef.current) return;
    if (currentPlayerId !== null && state.players.length > 0 && !isGMPreview) {
      notifRequestedRef.current = true;
      // Small delay so the UI settles before the browser prompt appears
      const timer = setTimeout(() => requestNotifPermission(), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentPlayerId, state.players.length, isGMPreview, requestNotifPermission]);

  // ---- Sync: polling, heartbeat, hypothesis persistence, resync ----
  const fallbackGameId = (() => {
    try { return sessionStorage.getItem('loup-garou-player-gameId'); } catch { return null; }
  })();

  const { isResyncing, handleResync, initialLoading, markActionSent, triggerImmediateRefresh } = usePlayerSync({
    shortCode,
    fallbackGameId,
    state,
    isGMPreview,
    currentPlayerId,
    loadFromServer,
    setFullState,
    setHypothesis,
    realtimeConnected,
    broadcastHeartbeat,
    localMode,
    isDeltaRecoveryNeeded,
    clearDeltaRecovery,
    broadcastResyncRequest,
  });

  // Unified post-action handler: broadcast notification to GM + schedule immediate refresh
  const handlePostAction = useCallback(() => {
    broadcastActionNotify();
    triggerImmediateRefresh();
  }, [broadcastActionNotify, triggerImmediateRefresh]);

  // GM preview: reusable back button
  const gmBackButton = isGMPreview ? (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/master')}
      className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer shrink-0"
      style={{
        background: 'rgba(212,168,67,0.15)',
        border: '1px solid rgba(212,168,67,0.4)',
        color: '#d4a843',
        fontSize: '0.6rem',
        fontFamily: '"Cinzel", serif',
      }}
    >
      <ArrowLeft size={12} />
      GM
    </motion.button>
  ) : null;

  const [activePanel, setActivePanel] = useState<PanelId>('game');
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [seerRevealing, setSeerRevealing] = useState(false);
  const [foxRevealing, setFoxRevealing] = useState(false);
  const [oracleDismissed, setOracleDismissed] = useState(false);
  const [conciergeRevealing, setConciergeRevealing] = useState(false);
  const [hypothesisTarget, setHypothesisTarget] = useState<number | null>(null);
  const [hasSeenNight1Recap, setHasSeenNight1Recap] = useState(false);
  const villagePanelRef = useRef<HTMLDivElement>(null);
  const questsScrollRef = useRef<HTMLDivElement>(null);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState<number | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [maireSuccessDismissed, setMaireSuccessDismissed] = useState(false);
  const [openQuestId, setOpenQuestId] = useState<number | null>(null);

  // Persist readQuestIds to localStorage so they survive page refresh / phone sleep
  const readQuestStorageKey = shortCode ? `lg-readQuests-${shortCode}` : null;
  const [readQuestIds, setReadQuestIds] = useState<Set<number>>(() => {
    if (!readQuestStorageKey) return new Set();
    try {
      const raw = localStorage.getItem(readQuestStorageKey);
      if (raw) return new Set(JSON.parse(raw) as number[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Mark quest as read when opening detail
  const handleOpenQuest = useCallback((questId: number) => {
    setOpenQuestId(questId);
    setReadQuestIds(prev => {
      if (prev.has(questId)) return prev;
      const next = new Set(prev);
      next.add(questId);
      if (readQuestStorageKey) {
        try { localStorage.setItem(readQuestStorageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      }
      return next;
    });
  }, [readQuestStorageKey]);

  // Compute unread quest count for tab badge
  const myAssignedQuestIds = currentPlayerId !== null
    ? (state.questAssignments || {})[currentPlayerId] || []
    : [];
  const myVisibleQuests = (state.quests || []).filter(q => {
    if (!myAssignedQuestIds.includes(q.id)) return false;
    if ((q.questType || 'individual') === 'collaborative') {
      const myGroup = (q.collaborativeGroups || []).find(g => g.includes(currentPlayerId!));
      if (!myGroup || myGroup.length < 2) return false;
    }
    return true;
  });
  const unreadQuestCount = myVisibleQuests.filter(q => !readQuestIds.has(q.id)).length;

  // Close quest detail overlay when switching tabs
  useEffect(() => {
    setOpenQuestId(null);
  }, [activePanel]);

  const navigateToPlayer = useCallback((playerId: number) => {
    setOpenQuestId(null);
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

  const [roleRevealed, setRoleRevealed] = useState(false);
  const [revealAnimStep, setRevealAnimStep] = useState<'idle' | 'flipping' | 'done'>('idle');
  const [revealAcknowledged, setRevealAcknowledged] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0); // 0=initial, 1=flipped-once, 2=flipped-back

  // ── Late-joiner role reveal (mid-game joins after roleRevealDone) ──
  const lateRevealKey = state.gameId && currentPlayerId != null
    ? `lg-late-reveal-${state.gameId}-${currentPlayerId}` : null;
  const [lateJoinRevealed, setLateJoinRevealed] = useState(() => {
    if (!lateRevealKey) return true;
    try { return localStorage.getItem(lateRevealKey) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!lateRevealKey) { setLateJoinRevealed(true); return; }
    try { setLateJoinRevealed(localStorage.getItem(lateRevealKey) === '1'); } catch { /* */ }
  }, [lateRevealKey]);

  // Revive detection state
  const [revivedPending, setRevivedPending] = useState(false);
  const [revivedAnimStep, setRevivedAnimStep] = useState<'waiting' | 'flipping' | 'done'>('waiting');
  const wasAliveRef = useRef<boolean | null>(null);
  const revivedAckedRef = useRef(false); // tracks if we already showed revive screen for current justRevived flag

  // Practice simulation local state (no server interaction)
  const [pWolfVote, setPWolfVote] = useState<number | null>(null);
  const [pSeerTarget, setPSeerTarget] = useState<number | null>(null);
  const [pSeerResult, setPSeerResult] = useState<RoleDefinition | null>(null);
  const [pWitchHealed, setPWitchHealed] = useState(false);
  const [pWitchKilled, setPWitchKilled] = useState<number | null>(null);
  const [pCupidLinked, setPCupidLinked] = useState(false);
  const [pLovers, setPLovers] = useState<[number, number] | null>(null);
  const [pGuardTarget, setPGuardTarget] = useState<number | null>(null);
  const [pHunterPreTarget, setPHunterPreTarget] = useState<number | null>(null);

  // Stable particle positions for role reveal screen
  const particlePositions = React.useMemo(() =>
    Array.from({ length: 12 }, () => ({
      left: 10 + Math.random() * 80,
      top: 10 + Math.random() * 80,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 2,
    })),
  []);

  // Reliable timer for role reveal flip animation (onAnimationComplete unreliable in this env)
  useEffect(() => {
    if (revealAnimStep === 'flipping') {
      const timer = setTimeout(() => setRevealAnimStep('done'), 900);
      return () => clearTimeout(timer);
    }
  }, [revealAnimStep]);

  // Reliable timer for revive flip animation
  useEffect(() => {
    if (revivedAnimStep === 'flipping') {
      const timer = setTimeout(() => setRevivedAnimStep('done'), 900);
      return () => clearTimeout(timer);
    }
  }, [revivedAnimStep]);

  // Swipe navigation (extracted hook)
  const panels: PanelId[] = ['game', 'quests', 'village'];
  const { containerRef, isDragging, dragOffset, containerWidth } = useSwipeNavigation({
    panels,
    activePanel,
    setActivePanel,
    isFlipped,
    deps: [currentPlayerId, revealAcknowledged, state.roleRevealDone, state.villagePresentIds],
  });

  const currentPlayer =
    currentPlayerId !== null
      ? state.players.find((p) => p.id === currentPlayerId) || null
      : null;
  const currentRole = currentPlayer ? getRoleById(currentPlayer.role) : null;

  // Persist player session for quick reconnect on HomePage
  useEffect(() => {
    if (currentPlayer && shortCode && state.gameId) {
      try {
        localStorage.setItem('loup-garou-player-session', JSON.stringify({
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          playerAvatar: currentPlayer.avatar,
          playerAvatarUrl: currentPlayer.avatarUrl,
          gameId: state.gameId,
          shortCode,
        }));
      } catch { /* ignore */ }
    }
  }, [currentPlayer?.id, currentPlayer?.name, currentPlayer?.avatar, currentPlayer?.avatarUrl, state.gameId, shortCode]);

  // Detect revive — dual strategy:
  // 1. Ref-based: detect dead→alive transition in real time
  // 2. Flag-based: use justRevived from server state (catches page refresh, timing edge cases)
  useEffect(() => {
    if (!currentPlayer) return;
    if (wasAliveRef.current === null) {
      // First render: record current status
      wasAliveRef.current = currentPlayer.alive;
      // If already flagged as justRevived on first load (e.g. page refresh after revive)
      if (currentPlayer.justRevived && currentPlayer.alive && !revivedAckedRef.current) {
        setRevivedPending(true);
        setRevivedAnimStep('waiting');
      }
      return;
    }
    // Real-time transition detection: dead → alive
    if (wasAliveRef.current === false && currentPlayer.alive === true) {
      setRevivedPending(true);
      setRevivedAnimStep('waiting');
      revivedAckedRef.current = false; // new revive, allow showing
    }
    wasAliveRef.current = currentPlayer.alive;
  }, [currentPlayer?.alive]);

  // Flag-based fallback: if the server state has justRevived but we missed the transition
  useEffect(() => {
    if (!currentPlayer) return;
    if (currentPlayer.justRevived && currentPlayer.alive && !revivedPending && !revivedAckedRef.current) {
      setRevivedPending(true);
      setRevivedAnimStep('waiting');
    }
  }, [currentPlayer?.justRevived, currentPlayer?.alive, revivedPending]);

  const isVillageois = currentPlayer?.role === 'villageois';
  const isWerewolf = currentPlayer?.role === 'loup-garou';
  const isSeer = currentPlayer?.role === 'voyante';
  const wolfHasVoted = isWerewolf && currentPlayer && state.werewolfVotes[currentPlayer.id] !== undefined;
  const seerHasActed = isSeer && currentPlayer && state.seerTargets?.[currentPlayer.id] !== undefined;
  const cupidHasActed = currentPlayer?.role === 'cupidon' && (state.cupidLinkedBy || []).includes(currentPlayer?.id ?? -1);
  const witchHasActed = currentPlayer?.role === 'sorciere' && (() => {
    const pid = currentPlayer?.id ?? -1;
    const healDone = !!((state.witchHealedThisNight || {})[pid]) || (state.witchHealUsedBy || []).includes(pid);
    const killDone = (state.witchKillTargets?.[pid] !== undefined) || (state.witchKillUsedBy || []).includes(pid);
    return healDone && killDone;
  })();
  const guardHasActed = currentPlayer?.role === 'garde' && currentPlayer && state.guardTargets?.[currentPlayer.id] !== undefined;
  const corbeauHasActed = currentPlayer?.role === 'corbeau' && currentPlayer && (state.corbeauTargets ?? {})[currentPlayer.id] !== undefined;
  const foxHasActed = currentPlayer?.role === 'renard' && currentPlayer && (state.foxTargets ?? {})[currentPlayer.id] !== undefined;
  const conciergeHasActed = currentPlayer?.role === 'concierge' && currentPlayer && (state.conciergeTargets ?? {})[currentPlayer.id] !== undefined;
  const oracleHasActed = currentPlayer?.role === 'oracle' && currentPlayer && !!(state.oracleUsed ?? {})[currentPlayer.id] && oracleDismissed;
  const empoisonneurHasActed = currentPlayer?.role === 'empoisonneur' && currentPlayer && (state.empoisonneurTargets ?? {})[currentPlayer.id] !== undefined;
  const roleHasActed = wolfHasVoted || seerHasActed || cupidHasActed || witchHasActed || guardHasActed || corbeauHasActed || foxHasActed || conciergeHasActed || oracleHasActed || empoisonneurHasActed;

  // Discovery phase mode split: simulation-only roles vs real-action roles
  const SIMULATION_ONLY_ROLES = ['chasseur', 'sorciere'];
  const DISCOVERY_REAL_ACTION_ROLES = ['loup-garou', 'voyante', 'garde', 'cupidon', 'corbeau', 'renard', 'concierge'];
  const isDiscoveryPhase = state.roleRevealDone === false && revealAcknowledged;
  const isSimulationMode = isDiscoveryPhase && SIMULATION_ONLY_ROLES.includes(currentPlayer?.role ?? '');
  const isDiscoveryRealMode = isDiscoveryPhase && DISCOVERY_REAL_ACTION_ROLES.includes(currentPlayer?.role ?? '');
  // Backward compat alias — used for styling / header checks that apply to all discovery
  const isPracticeMode = isDiscoveryPhase;

  const canFlip = (state.phase === 'night' && currentPlayer?.alive === true)
    || ((isSimulationMode || isDiscoveryRealMode) && currentPlayer?.alive === true);

  // Night 1 recap: show discovery action summary on first flip, then sleep
  // For wolves: only show recap if they actually voted during discovery
  const showNight1Recap = isDiscoveryRealMode && state.turn === 1 && state.phase === 'night'
    && roleHasActed && !hasSeenNight1Recap
    && DISCOVERY_REAL_ACTION_ROLES.includes(currentPlayer?.role ?? '')
    && !(isWerewolf && !wolfHasVoted);

  // Build a discovery-real-mode state override (phase = night for RoleActionsPanel)
  const discoveryRealState: GameState = isDiscoveryRealMode ? {
    ...state,
    phase: 'night',
    nightStep: 'active',
  } : state;

  // Build a practice-overlay state for RoleActionsPanel during simulation
  const practiceGameState: GameState = isSimulationMode ? {
    ...state,
    phase: 'night',
    nightStep: 'active',
    werewolfVotes: pWolfVote !== null && currentPlayerId !== null ? { [currentPlayerId]: pWolfVote } : {},
    werewolfTarget: null,
    seerTargets: pSeerTarget !== null && currentPlayerId !== null ? { [currentPlayerId]: pSeerTarget } : {},
    seerResults: pSeerResult !== null && currentPlayerId !== null ? { [currentPlayerId]: pSeerResult } : {},
    witchHealUsedBy: pWitchHealed && currentPlayerId !== null ? [currentPlayerId] : [],
    witchKillUsedBy: pWitchKilled !== null && currentPlayerId !== null ? [currentPlayerId] : [],
    witchKillTargets: pWitchKilled !== null && currentPlayerId !== null ? { [currentPlayerId]: pWitchKilled } : {},
    witchHealedThisNight: pWitchHealed && currentPlayerId !== null ? { [currentPlayerId]: true } : {},
    cupidLinkedBy: pCupidLinked && currentPlayerId !== null ? [currentPlayerId] : [],
    loverPairs: pLovers ? [pLovers] : [],
    guardTargets: pGuardTarget !== null && currentPlayerId !== null ? { [currentPlayerId]: pGuardTarget } : {},
    hunterPreTargets: pHunterPreTarget !== null && currentPlayerId !== null ? { [currentPlayerId]: pHunterPreTarget } : {},
    corbeauTargets: {},
    corbeauMessages: {},
    corbeauLastTargets: {},
  } : state;

  // Reset practice state helper
  const resetPractice = useCallback(() => {
    setPWolfVote(null);
    setPSeerTarget(null);
    setPSeerResult(null);
    setPWitchHealed(false);
    setPWitchKilled(null);
    setPCupidLinked(false);
    setPLovers(null);
    setPGuardTarget(null);
    setPHunterPreTarget(null);
  }, []);

  // Tutorial step progression in simulation mode only
  useEffect(() => {
    if (!isSimulationMode || isVillageois) return;
    if (isFlipped && tutorialStep === 0) setTutorialStep(1);
    if (!isFlipped && tutorialStep === 1) setTutorialStep(2);
  }, [isFlipped, isSimulationMode, isVillageois, tutorialStep]);

  // Reset flip when roleRevealDone transitions to true (practice → real game)
  useEffect(() => {
    if (state.roleRevealDone !== false) {
      setIsFlipped(false);
      setSeerRevealing(false);
      setFoxRevealing(false);
      setConciergeRevealing(false);
      resetPractice();
    }
  }, [state.roleRevealDone, resetPractice]);
  const visibleTabs: { id: PanelId; icon: React.ReactNode; iconActive: React.ReactNode; label: string }[] = [
    { id: 'game',   icon: <Swords size={18} />, iconActive: <Swords size={18} fill="currentColor" strokeWidth={1} />, label: 'Jeu' },
    { id: 'quests', icon: <Map    size={18} />, iconActive: <Map    size={18} />, label: 'Quêtes' },
    { id: 'village',icon: <Users  size={18} />, iconActive: <Users  size={18} fill="currentColor" strokeWidth={1} />, label: 'Village' },
  ];
  const panelCount = panels.length;
  const panelIndex = panels.indexOf(activePanel) === -1 ? 0 : panels.indexOf(activePanel);

  // Win check
  useEffect(() => {
    const winner = checkWinCondition();
    if (winner) {
      setTimeout(() => endGame(winner), 1500);
    }
  }, [state.players, checkWinCondition, endGame]);

  // Reset flip when leaving night or switching panels (but not during discovery phase)
  useEffect(() => {
    if (state.phase !== 'night' && !isDiscoveryPhase) {
      setIsFlipped(false);
      setSeerRevealing(false);
      setFoxRevealing(false);
      setConciergeRevealing(false);
      setOracleDismissed(false);
    }
  }, [state.phase, isDiscoveryPhase]);
  useEffect(() => {
    if (activePanel !== 'game') {
      setIsFlipped(false);
      setSeerRevealing(false);
      setFoxRevealing(false);
      setConciergeRevealing(false);
      if (isSimulationMode) resetPractice();
    }
  }, [activePanel, isSimulationMode, resetPractice]);

  const alivePlayers = state.players.filter((p) => p.alive);
  const deadPlayers = state.players.filter((p) => !p.alive);

  // ── Away detection: players not in villagePresentIds are "away" ──
  const isCurrentPlayerAway = React.useMemo(() => {
    if (!state.roleRevealDone) return false;
    if (!state.villagePresentIds) return false;
    if (currentPlayerId === null) return false;
    return !state.villagePresentIds.includes(currentPlayerId);
  }, [state.roleRevealDone, state.villagePresentIds, currentPlayerId]);

  // Present alive players: exclude away players from interactive targets
  const presentAlivePlayers = React.useMemo(() => {
    if (!state.villagePresentIds) return alivePlayers;
    const presentSet = new Set(state.villagePresentIds);
    return alivePlayers.filter((p) => presentSet.has(p.id));
  }, [alivePlayers, state.villagePresentIds]);

  // Discovery pre-target: for Night 1, check if the wolf's discovery pre-selection is present or away
  const discoveryPreTarget = React.useMemo(() => {
    if (!currentPlayerId || state.turn !== 1 || state.phase !== 'night') return null;
    const preSelectedId = state.discoveryWolfTargets?.[currentPlayerId];
    if (!preSelectedId) return null;
    const targetPlayer = state.players.find((p) => p.id === preSelectedId);
    if (!targetPlayer) return null;
    const isPresent = state.villagePresentIds
      ? state.villagePresentIds.includes(preSelectedId)
      : true;
    return { id: preSelectedId, name: targetPlayer.name, isPresent };
  }, [currentPlayerId, state.turn, state.phase, state.discoveryWolfTargets, state.villagePresentIds, state.players]);

  const hasRole = (roleId: string) =>
    state.players.some((p) => p.role === roleId && p.alive);

  const isNight = state.phase === 'night';

  // Dynamically tint the browser chrome (address bar + toolbar) based on phase & tab
  // NOTE: must be placed after isNight, isPracticeMode, and activePanel are declared
  useEffect(() => {
    if (!isBrowserMode) return;

    let addressBarColor: string;
    let toolbarColor: string;

    addressBarColor = '#867251';

    if (isNight || isPracticeMode) {
      toolbarColor = '#060811';
    } else if (activePanel === 'game') {
      toolbarColor = '#302B22';
    } else {
      toolbarColor = '#F4EFE3';
    }

    // Remove and re-create the meta tag to force Safari to re-read it
    // (Safari ignores setAttribute changes on theme-color in some cases)
    const existing = document.querySelector('meta[name="theme-color"]');
    if (existing) existing.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = addressBarColor;
    document.head.appendChild(meta);

    document.body.style.backgroundColor = toolbarColor;

    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [isBrowserMode, isNight, isPracticeMode, activePanel]);

  // ---- Unrevealed hints count (for "Jeu" tab badge) ----
  const unrevealedHintCount = React.useMemo(() => {
    if (currentPlayerId === null) return 0;
    const hints = state.hints ?? [];
    const pHints = state.playerHints ?? [];
    const hintIdSet = new Set(hints.map(h => h.id));
    return pHints.filter(ph => ph.playerId === currentPlayerId && !ph.revealed && hintIdSet.has(ph.hintId)).length;
  }, [state.hints, state.playerHints, currentPlayerId]);

  // ---- Death Announcement ----
  const deathAnnouncementEnabled = state.roleRevealDone && state.players.length > 0 && state.turn >= 1;
  console.log('[PlayerPage] DeathAnnouncement: enabled=%s historyLen=%d',
    deathAnnouncementEnabled, state.phaseDeathHistory?.length ?? 0);
  const { announcement: deathAnnouncement, dismiss: dismissDeathAnnouncement } = useDeathAnnouncement(
    state.players,
    state.events,
    deathAnnouncementEnabled,
    state.phaseDeathHistory,
    state.gameId,
    currentPlayerId ?? undefined,
  );

  // No game in progress
  if (state.players.length === 0) {
    if (initialLoading) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4"
          style={{ background: t.pageBg }}
        >
          {gmBackButton}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full"
            style={{
              border: '3px solid rgba(212,168,67,0.15)',
              borderTopColor: t.gold,
            }}
          />
          <p style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.85rem' }}>
            Connexion en cours...
          </p>
        </div>
      );
    }
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: t.pageBg }}
      >
        {gmBackButton}
        <span className="text-5xl mb-4">🐺</span>
        <h1 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1.2rem' }}>
          Aucune partie en cours
        </h1>
        <p style={{ color: t.textMuted, fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Demandez au Maitre du Jeu de lancer une partie.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl"
          style={{
            background: t.goldBg,
            border: `1px solid ${t.goldBorder}`,
            color: t.gold,
            fontFamily: '"Cinzel", serif',
          }}
        >
          <ArrowLeft size={16} />
          Retour
        </button>
      </div>
    );
  }

  // Invalid player ID
  if (!currentPlayer) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: t.pageBg }}
      >
        {gmBackButton}
        <span className="text-5xl mb-4">❓</span>
        <h1 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1.2rem' }}>
          Joueur introuvable
        </h1>
        <p style={{ color: t.textMuted, fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Ce joueur n'existe pas dans la partie.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl"
          style={{
            background: t.goldBg,
            border: `1px solid ${t.goldBorder}`,
            color: t.gold,
            fontFamily: '"Cinzel", serif',
          }}
        >
          <ArrowLeft size={16} />
          Retour
        </button>
      </div>
    );
  }

  /* ---- Role Reveal Phase ---- */
  if (state.roleRevealDone === false && !revealAcknowledged && currentPlayer) {
    return (
      <RoleRevealScreen
        currentPlayer={currentPlayer}
        currentRole={currentRole}
        revealAnimStep={revealAnimStep}
        onReveal={() => {
          setRevealAnimStep('flipping');
          setRoleRevealed(true);
          if (currentPlayer) serverMarkRoleRevealed(currentPlayer.id);
        }}
        onContinue={() => {
          setRevealAcknowledged(true);
          // Auto-join the village after role reveal
          if (currentPlayer) {
            updateState((s) => {
              const existing = Array.isArray(s.villagePresentIds)
                ? [...s.villagePresentIds]
                : [];
              if (!existing.includes(currentPlayer.id)) existing.push(currentPlayer.id);
              const joinIds = Array.isArray(s.midGameJoinIds) ? [...s.midGameJoinIds] : [];
              if (!joinIds.includes(currentPlayer.id)) joinIds.push(currentPlayer.id);
              return { ...s, villagePresentIds: existing, midGameJoinIds: joinIds };
            });
            serverJoinVillage(currentPlayer.id);
          }
        }}
        particlePositions={particlePositions}
        t={t}
        isVillageois={isVillageois}
        gmBackButton={gmBackButton}
        allPlayers={state.players}
      />
    );
  }

  /* ---- Away Player: needs to join the village ---- */
  if (state.roleRevealDone !== false && isCurrentPlayerAway && currentPlayer) {
    const hasSeenRole = (state.roleRevealedBy || []).includes(currentPlayer.id);

    const handleJoinVillage = () => {
      if (!hasSeenRole) {
        serverMarkRoleRevealed(currentPlayer.id);
      }
      updateState((s) => {
        const existing = Array.isArray(s.villagePresentIds)
          ? [...s.villagePresentIds]
          : s.players.map((p) => p.id);
        if (!existing.includes(currentPlayer.id)) existing.push(currentPlayer.id);
        const joinIds = Array.isArray(s.midGameJoinIds) ? [...s.midGameJoinIds] : [];
        if (!joinIds.includes(currentPlayer.id)) joinIds.push(currentPlayer.id);
        return { ...s, villagePresentIds: existing, midGameJoinIds: joinIds };
      });
      serverJoinVillage(currentPlayer.id).then(handlePostAction);
    };

    if (!hasSeenRole || revealAnimStep !== 'idle') {
      // Scenario A: hasn't seen role (or reveal animation still in progress) → show RoleRevealScreen
      return (
        <RoleRevealScreen
          currentPlayer={currentPlayer}
          currentRole={currentRole}
          revealAnimStep={revealAnimStep}
          onReveal={() => {
            setRevealAnimStep('flipping');
            setRoleRevealed(true);
            if (currentPlayer) serverMarkRoleRevealed(currentPlayer.id);
          }}
          onContinue={handleJoinVillage}
          continueLabel="Rejoindre le village"
          continueHint="La partie a deja commence"
          particlePositions={particlePositions}
          t={t}
          isVillageois={isVillageois}
          gmBackButton={gmBackButton}
          allPlayers={state.players}
        />
      );
    } else {
      // Scenario B: has seen role → show JoinVillageScreen
      return (
        <JoinVillageScreen
          currentPlayer={currentPlayer}
          onJoin={handleJoinVillage}
          t={t}
          gmBackButton={gmBackButton}
          particlePositions={particlePositions}
        />
      );
    }
  }

  /* ---- Late-Joiner Role Reveal (mid-game join) ---- */
  if (
    state.roleRevealDone !== false &&
    currentPlayer?.joinedMidGame &&
    !lateJoinRevealed &&
    currentPlayer
  ) {
    return (
      <RoleRevealScreen
        currentPlayer={currentPlayer}
        currentRole={currentRole}
        revealAnimStep={revealAnimStep}
        onReveal={() => {
          setRevealAnimStep('flipping');
          setRoleRevealed(true);
        }}
        onContinue={() => {
          setLateJoinRevealed(true);
          if (lateRevealKey) {
            try { localStorage.setItem(lateRevealKey, '1'); } catch { /* */ }
          }
        }}
        particlePositions={particlePositions}
        t={t}
        isVillageois={isVillageois}
        gmBackButton={gmBackButton}
        allPlayers={state.players}
      />
    );
  }

  /* ---- Revived Screen ---- */
  if (revivedPending && currentPlayer) {
    return (
      <RevivedScreen
        currentPlayer={currentPlayer}
        revivedAnimStep={revivedAnimStep}
        onStartFlip={() => setRevivedAnimStep('flipping')}
        onDismiss={() => {
          setRevivedPending(false);
          setRevivedAnimStep('waiting');
          revivedAckedRef.current = true;
          // Clear justRevived flag so it won't re-trigger on next poll/refresh
          if (currentPlayerId !== null) clearJustRevived(currentPlayerId);
        }}
        particlePositions={particlePositions}
        t={t}
        gmBackButton={gmBackButton}
      />
    );
  }

  if (deathAnnouncement) {
    console.log('[PlayerPage] deathAnnouncement READY TO RENDER:', deathAnnouncement.latestTransition, deathAnnouncement.phases.length, 'phases', deathAnnouncement.allDeaths.length, 'deaths');
  }

  const pageBgColor = activePanel === 'game' && !isCurrentPlayerDead
    ? (isNight || isPracticeMode ? '#050810' : '#F5F0E4')
    : isCurrentPlayerDead
      ? t.pageBg
      : (isNight || isPracticeMode)
        ? 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)'
        : '#F5F0E4';

  return (
    <>
      {/* In browser mode: fixed full-bleed background that extends under browser chrome */}
      {isBrowserMode && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: pageBgColor, zIndex: -1 }}
        />
      )}
      {isBrowserMode && activePanel === 'game' && !isCurrentPlayerDead && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
          <img
            key={isNight || isPracticeMode ? 'night' : 'day'}
            alt=""
            className="absolute w-full h-full object-cover"
            src={isNight || isPracticeMode ? nightVillageBg : dayVoteBg}
            style={{ objectPosition: 'center top' }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: isNight || isPracticeMode
                ? 'none'
                : 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.35) 100%)',
            }}
          />
        </div>
      )}
      {/* Gradient above header — fades from background color at top to transparent, blending browser chrome into the header */}
      <div
        className="fixed left-0 right-0 top-0 pointer-events-none"
        style={{
          height: 80,
          zIndex: 59,
          background: isCurrentPlayerDead
            ? `linear-gradient(180deg, ${t.pageBg} 0%, transparent 100%)`
            : (!isNight && !isPracticeMode)
              ? 'transparent'
              : `linear-gradient(180deg, #050810 0%, transparent 100%)`,
        }}
      />
    <div
      className="h-dvh max-w-md mx-auto flex flex-col overflow-hidden relative"
      style={{
        background: isBrowserMode ? 'transparent' : pageBgColor,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Full-screen background image — standalone mode only (browser mode uses fixed layer above) */}
      {!isBrowserMode && activePanel === 'game' && !isCurrentPlayerDead && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            key={isNight || isPracticeMode ? 'night' : 'day'}
            alt=""
            className="absolute w-full h-full object-cover"
            src={isNight || isPracticeMode ? nightVillageBg : dayVoteBg}
            style={{ objectPosition: 'center top' }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: isNight || isPracticeMode
                ? 'linear-gradient(180deg, rgba(12,13,21,0.45) 0%, rgba(12,13,21,0.75) 50%, rgb(12,13,21) 100%)'
                : 'none',
            }}
          />
        </div>
      )}

      {/* Header */}
      <PlayerHeader
        state={state}
        currentPlayer={currentPlayer}
        currentPlayerId={currentPlayerId}
        t={t}
        isNight={isNight}
        isPracticeMode={isPracticeMode}
        isSimulationMode={isSimulationMode}
        isDiscoveryRealMode={isDiscoveryRealMode}
        isCurrentPlayerDead={isCurrentPlayerDead}
        isGMPreview={isGMPreview}
        gmBackButton={gmBackButton}
        alivePlayers={alivePlayers}
        deadPlayers={deadPlayers}
        isResyncing={isResyncing}
        onResync={handleResync}
        onOpenJournal={() => setJournalOpen(true)}
        activePanel={activePanel}
      />

      {/* Death feedback banner */}
      {currentPlayer && !currentPlayer.alive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex-shrink-0 px-4 py-2.5 relative z-[1]"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
            borderBottomWidth: 1,
            borderBottomStyle: 'solid' as const,
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
                Tu etais {currentRole?.emoji} {currentRole?.name}. Tu peux continuer à enquêter.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Swipeable panels + quest overlay wrapper */}
      <div className="flex-1 overflow-hidden relative z-[1]">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ touchAction: 'pan-y', userSelect: isDragging ? 'none' : 'auto' }}
        >
        {/* Floating night timer — visible when card is flipped during night */}
        <AnimatePresence>
          {isFlipped && state.phase === 'night' && state.phaseTimerEndAt && panelIndex === 0 && (
            <motion.div
              key="night-floating-timer"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute top-3 left-0 right-0 z-30 flex justify-center pointer-events-none"
            >
              <div className="pointer-events-auto">
                <PhaseTimerDisplay endAt={state.phaseTimerEndAt} isNight={true} t={t} size="compact" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          className="flex h-full"
          animate={{ x: -panelIndex * containerWidth + (isDragging ? dragOffset : 0) }}
          transition={isDragging ? { duration: 0 } : { type: 'tween', duration: 0.28, ease: [0.25, 0.1, 0.25, 1.0] }}
          style={{ width: containerWidth > 0 ? panelCount * containerWidth : `${panelCount * 100}%` }}
        >
          {/* Panel 1 — Game (card flip is inside GamePanel) */}
          <div style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%`, WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }} className="h-full overflow-y-auto">
                  {(currentPlayer?.alive ?? false) && <GamePanel
                    alivePlayers={presentAlivePlayers}
                    phase={isPracticeMode ? 'night' : state.phase}
                    dayStep={state.dayStep}
                    currentPlayerId={currentPlayerId}
                    votes={state.votes}
                    onVote={(voterId, targetId) => {
                      markActionSent();
                      castVote(voterId, targetId);
                      serverCastVote(voterId, targetId).then(handlePostAction);
                    }}
                    onCancelVote={(voterId) => {
                      markActionSent();
                      cancelVote(voterId);
                      serverCancelVote(voterId).then(handlePostAction);
                    }}
                    currentPlayerAlive={currentPlayer?.alive ?? false}
                    canFlip={canFlip}
                    onFlip={() => setIsFlipped(true)}
                    currentRole={currentRole ?? undefined}
                    hypotheses={currentPlayerId !== null ? state.hypotheses[currentPlayerId] || {} : {}}
                    isPracticeMode={isDiscoveryPhase}
                    isSimulationMode={isSimulationMode}
                    tutorialStep={tutorialStep}
                    isVillageois={isVillageois}
                    t={t}
                    deadPlayers={deadPlayers}
                    events={state.events}
                    turn={state.turn}
                    hints={state.hints ?? []}
                    playerHints={state.playerHints ?? []}
                    onRevealHint={(hintId) => {
                      if (currentPlayerId !== null) {
                        markActionSent();
                        serverRevealHint(currentPlayerId, hintId).then(handlePostAction);
                      }
                    }}
                    phaseTimerEndAt={state.phaseTimerEndAt}
                    loverPairs={state.loverPairs ?? []}
                    allPlayers={state.players}
                    maireId={state.maireId ?? null}
                    maireElectionDone={state.maireElectionDone ?? false}
                    maireCandidates={state.maireCandidates ?? []}
                    maireCampaignMessages={state.maireCampaignMessages ?? {}}
                    nominations={state.nominations || {}}
                    lastWillUsed={state.lastWillUsed ?? {}}
                    dayEliminationsCount={state.dayEliminationsCount || 1}
                    onDeclareCandidacy={(playerId, message) => {
                      markActionSent();
                      serverDeclareCandidacy(playerId, message).then(handlePostAction);
                      // Push notification to all alive players
                      if (state.gameId) {
                        const playerName = state.players.find((p) => p.id === playerId)?.name || 'Un joueur';
                        const targets = state.players.filter((p) => p.alive).map((p) => p.shortCode);
                        sendPushNotifications(state.gameId, targets, 'Loup-Garou', `${playerName} s'est porté candidat en tant que Maire !`, 'maire-candidacy');
                      }
                    }}
                    onWithdrawCandidacy={(playerId) => {
                      markActionSent();
                      serverWithdrawCandidacy(playerId).then(handlePostAction);
                    }}
                    onSetHypothesis={(targetPlayerId, roleId) => {
                      if (currentPlayerId !== null) {
                        setHypothesis(currentPlayerId, targetPlayerId, roleId);
                      }
                    }}
                    gameId={state.gameId || undefined}
                    isFlipped={isFlipped}
                    onFlipBack={() => {
                      setIsFlipped(false);
                      setSeerRevealing(false);
                      setFoxRevealing(false);
                      setConciergeRevealing(false);
                      if (isSimulationMode) resetPractice();
                    }}
                    roleBackContent={
                      showNight1Recap ? (
                        <DiscoveryRecapPanel
                          currentPlayer={currentPlayer}
                          state={state}
                          allPlayers={state.players}
                          alivePlayers={presentAlivePlayers}
                          onDismiss={() => {
                            setHasSeenNight1Recap(true);
                            setIsFlipped(false);
                          }}
                          onWerewolfVote={(wolfId, targetId, message) => {
                            markActionSent();
                            castWerewolfVote(wolfId, targetId, message);
                            serverCastWerewolfVote(wolfId, targetId, message).then(handlePostAction);
                          }}
                          t={t}
                        />
                      ) : (isVillageois || roleHasActed) && !isSimulationMode && !isDiscoveryRealMode && !seerRevealing && !foxRevealing && !conciergeRevealing ? (
                        guardHasActed ? (
                          <GuardSleepingPanel
                            guardTargetName={
                              (() => {
                                const tId = state.guardTargets?.[currentPlayer.id];
                                const tgt = state.players.find(p => p.id === tId);
                                return tgt?.name ?? '???';
                              })()
                            }
                            onFlipBack={() => setIsFlipped(false)}
                            t={t}
                          />
                        ) : (
                          <VillagerSleepingPanel
                            onFlipBack={() => setIsFlipped(false)}
                            onInvestigate={() => setActivePanel('village')}
                            onQuests={() => { setIsFlipped(false); setActivePanel('quests'); }}
                            t={t}
                          />
                        )
                      ) : (
                        <RoleActionsPanel
                          state={isSimulationMode ? practiceGameState : isDiscoveryRealMode ? discoveryRealState : state}
                          alivePlayers={presentAlivePlayers}
                          currentPlayer={currentPlayer}
                          currentRole={currentRole ?? undefined}
                          hasRole={hasRole}
                          selectedTarget={selectedTarget}
                          setSelectedTarget={setSelectedTarget}
                          allPlayers={state.players}
                          practiceMode={isSimulationMode}
                          isDiscoveryPhase={isDiscoveryRealMode && currentPlayer?.role === 'loup-garou'}
                          onDiscoveryTarget={(wolfId, targetId) => {
                            setDiscoveryWolfTarget(wolfId, targetId);
                            serverSetDiscoveryWolfTarget(wolfId, targetId);
                          }}
                          discoveryPreTarget={isDiscoveryRealMode ? undefined : discoveryPreTarget}
                          onFlipBack={() => {
                            setIsFlipped(false);
                            setSeerRevealing(false);
                            setFoxRevealing(false);
                            setConciergeRevealing(false);
                            if (isSimulationMode) {
                              resetPractice();
                            }
                          }}
                          onWerewolfVote={isSimulationMode
                            ? (_wolfId, targetId) => { setPWolfVote(targetId); }
                            : (wolfId, targetId, message) => {
                              markActionSent();
                              castWerewolfVote(wolfId, targetId, message);
                              serverCastWerewolfVote(wolfId, targetId, message).then(handlePostAction);
                              if (state.turn === 1 && !isDiscoveryRealMode) {
                                setHasSeenNight1Recap(true);
                              }
                            }
                          }
                          onSeerTarget={isSimulationMode
                            ? (targetId) => {
                              setPSeerTarget(targetId);
                              const target = alivePlayers.find(p => p.id === targetId);
                              if (target) setPSeerResult(getRoleById(target.role) ?? null);
                            }
                            : (targetId) => {
                              markActionSent();
                              setSeerTarget(currentPlayer.id, targetId);
                              setSeerRevealing(true);
                              serverSetSeerTarget(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          onWitchHeal={isSimulationMode
                            ? () => { setPWitchHealed(true); }
                            : () => {
                              markActionSent();
                              useWitchHeal(currentPlayer.id);
                              serverWitchHeal(currentPlayer.id).then(handlePostAction);
                            }
                          }
                          onWitchKill={isSimulationMode
                            ? (targetId) => { setPWitchKilled(targetId); }
                            : (targetId) => {
                              markActionSent();
                              useWitchKill(currentPlayer.id, targetId);
                              serverWitchKill(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          onCancelWitchKill={isSimulationMode
                            ? () => { setPWitchKilled(null); }
                            : () => {
                              markActionSent();
                              cancelWitchKill(currentPlayer.id);
                              serverCancelWitchKill(currentPlayer.id).then(handlePostAction);
                            }
                          }
                          onCupidLink={isSimulationMode
                            ? (id1, id2) => { setPCupidLinked(true); setPLovers([id1, id2]); }
                            : (id1, id2) => {
                              markActionSent();
                              setCupidLink(currentPlayer.id, id1, id2);
                              serverCupidLink(currentPlayer.id, id1, id2).then(handlePostAction);
                            }
                          }
                          onGuardTarget={isSimulationMode
                            ? (targetId) => { setPGuardTarget(targetId); }
                            : (targetId) => {
                              markActionSent();
                              setGuardTarget(currentPlayer.id, targetId);
                              serverSetGuardTarget(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          onCorbeauTarget={isSimulationMode
                            ? (_targetId, _msg, _img) => { /* practice — no-op */ }
                            : (targetId, message, imageUrl) => {
                              markActionSent();
                              if (!localMode) {
                                const hintId = Date.now() + Math.floor(Math.random() * 100000);
                                updateState((s) => ({
                                  ...s,
                                  corbeauTargets: { ...(s.corbeauTargets ?? {}), [currentPlayer.id]: targetId },
                                  corbeauMessages: { ...(s.corbeauMessages ?? {}), [currentPlayer.id]: message },
                                  hints: [...(s.hints ?? []), { id: hintId, text: message, imageUrl, createdAt: new Date().toISOString() }],
                                  playerHints: [...(s.playerHints ?? []), { hintId, playerId: targetId, sentAt: new Date().toISOString(), revealed: false }],
                                }));
                              }
                              serverSetCorbeauTarget(currentPlayer.id, targetId, message, imageUrl).then(handlePostAction);
                            }
                          }
                          onHunterPreTarget={isSimulationMode
                            ? (targetId) => { setPHunterPreTarget(targetId); }
                            : (targetId) => {
                              markActionSent();
                              setHunterPreTarget(currentPlayer.id, targetId);
                              serverSetHunterPreTarget(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          onFoxTarget={isSimulationMode
                            ? (_playerIds) => { /* practice — no-op */ }
                            : (playerIds) => {
                              markActionSent();
                              const hasWolf = playerIds.some((pid: number) => {
                                const p = state.players.find((pl) => pl.id === pid);
                                return p?.role === 'loup-garou';
                              });
                              setFoxRevealing(true);
                              updateState((s) => ({
                                ...s,
                                foxTargets: { ...(s.foxTargets ?? {}), [currentPlayer.id]: playerIds },
                                foxResults: { ...(s.foxResults ?? {}), [currentPlayer.id]: hasWolf },
                              }));
                              serverSetFoxTarget(currentPlayer.id, playerIds).then(handlePostAction);
                            }
                          }
                          onConciergeTarget={isSimulationMode
                            ? (_targetId) => { /* practice — no-op */ }
                            : (targetId) => {
                              markActionSent();
                              setConciergeRevealing(true);
                              updateState((s) => ({
                                ...s,
                                conciergeTargets: { ...(s.conciergeTargets ?? {}), [currentPlayer.id]: targetId },
                              }));
                              serverSetConciergeTarget(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          onOracleUse={isSimulationMode
                            ? () => { /* practice — no-op */ }
                            : () => {
                              markActionSent();
                              updateState((s) => ({
                                ...s,
                                oracleUsed: { ...(s.oracleUsed ?? {}), [currentPlayer.id]: true },
                              }));
                              serverOracleUse(currentPlayer.id).then(handlePostAction);
                            }
                          }
                          onOracleDismiss={() => setOracleDismissed(true)}
                          onEmpoisonneurTarget={isSimulationMode
                            ? (_targetId) => { /* practice — no-op */ }
                            : (targetId) => {
                              markActionSent();
                              updateState((s) => ({
                                ...s,
                                empoisonneurTargets: { ...(s.empoisonneurTargets ?? {}), [currentPlayer.id]: targetId },
                              }));
                              serverSetEmpoisonneurTarget(currentPlayer.id, targetId).then(handlePostAction);
                            }
                          }
                          t={t}
                        />
                      )
                    }
                  />}
                  {!(currentPlayer?.alive ?? false) && (
                    <LastWillSection
                      phase={state.phase as 'night' | 'day'}
                      dayStep={state.dayStep}
                      alivePlayers={presentAlivePlayers}
                      currentPlayerId={currentPlayerId!}
                      votes={state.votes}
                      maireId={state.maireId ?? null}
                      hypotheses={currentPlayerId !== null ? state.hypotheses[currentPlayerId] || {} : {}}
                      lastWillUsed={!!(state.lastWillUsed ?? {})[currentPlayerId!]}
                      allLastWillUsed={state.lastWillUsed ?? {}}
                      onLastWillVote={(targetId) => {
                        const isNightNow = state.phase === 'night';
                        markActionSent();
                        if (isNightNow) {
                          updateState((s) => ({
                            ...s,
                            earlyVotes: { ...(s.earlyVotes || {}), [currentPlayerId!]: targetId },
                            lastWillUsed: { ...(s.lastWillUsed || {}), [currentPlayerId!]: true },
                          }));
                          serverSetEarlyVote(currentPlayerId!, targetId).then(handlePostAction);
                          serverSetLastWillUsed(currentPlayerId!);
                        } else {
                          castVote(currentPlayerId!, targetId);
                          serverCastVote(currentPlayerId!, targetId).then(handlePostAction);
                          updateState((s) => ({
                            ...s,
                            lastWillUsed: { ...(s.lastWillUsed || {}), [currentPlayerId!]: true },
                          }));
                          serverSetLastWillUsed(currentPlayerId!);
                        }
                      }}
                      onNavigateToVillage={() => setActivePanel('village')}
                      t={t}
                    />
                  )}
          </div>

          {/* Panel 2 — Quêtes */}
          <div ref={questsScrollRef} style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%`, WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', paddingBottom: '16px' }} className="h-full overflow-y-auto">
            <PlayerQuestsPanel
              state={state}
              currentPlayerId={currentPlayerId}
              onAnswerTask={(questId, taskId, answer) => {
                if (currentPlayerId !== null) {
                  markActionSent();
                  serverAnswerQuestTask(questId, taskId, answer, currentPlayerId).then(handlePostAction);
                }
              }}
              onCollabVote={(questId, vote) => {
                if (currentPlayerId !== null) {
                  markActionSent();
                  serverCollabVote(questId, currentPlayerId, vote).then(handlePostAction);
                  setReadQuestIds(prev => {
                    if (prev.has(questId)) return prev;
                    const next = new Set(prev);
                    next.add(questId);
                    return next;
                  });
                }
              }}
              onCancelCollabVote={(questId) => {
                if (currentPlayerId !== null) {
                  markActionSent();
                  serverCancelCollabVote(questId, currentPlayerId).then(handlePostAction);
                }
              }}
              onOpenQuest={handleOpenQuest}
              readQuestIds={readQuestIds}
              isActive={activePanel === 'quests'}
              onNavigateToPlayer={navigateToPlayer}
              t={t}
            />
          </div>

          {/* Panel 3 — Village (player list / role reveal) */}
          <div ref={villagePanelRef} style={{ width: containerWidth > 0 ? containerWidth : `${100 / panelCount}%`, WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', paddingBottom: '16px' }} className="h-full overflow-y-auto">
            {state.roleRevealDone === false ? (
              <RoleRevealVillagePanel
                players={state.players}
                roleRevealedBy={state.roleRevealedBy ?? []}
                t={t}
                playerTags={state.playerTags || {}}
              />
            ) : (
              <VillageListPanel
                alivePlayers={alivePlayers}
                deadPlayers={deadPlayers}
                currentPlayerId={currentPlayerId}
                hypotheses={currentPlayerId !== null ? state.hypotheses[currentPlayerId] || {} : {}}
                onOpenHypothesis={(targetId) => setHypothesisTarget(targetId)}
                maireId={state.maireId ?? null}
                allPlayers={state.players}
                phase={state.phase}
                earlyVotes={state.earlyVotes ?? {}}
                highlightedPlayerId={highlightedPlayerId}
                onSetEarlyVote={(voterId, targetId) => {
                  updateState((s) => ({
                    ...s,
                    earlyVotes: { ...(s.earlyVotes || {}), [voterId]: targetId },
                  }));
                  serverSetEarlyVote(voterId, targetId);
                }}
                onCancelEarlyVote={(voterId) => {
                  updateState((s) => {
                    const { [voterId]: _, ..._rest } = (s.earlyVotes || {});
                    return { ...s, earlyVotes: _rest };
                  });
                  serverSetEarlyVote(voterId, null);
                }}
                playerTags={state.playerTags || {}}
                t={t}
                turn={state.turn}
                phaseTimerEndAt={state.phaseTimerEndAt ?? null}
                villagePresentIds={state.villagePresentIds}
              />
            )}
          </div>

        </motion.div>

        </div>

        {/* Quest Tasks overlay — isolated from swipeable panels, positioned in outer wrapper */}
        <AnimatePresence mode="wait">
          {openQuestId !== null && currentPlayerId !== null && (() => {
            const quest = (state.quests || []).find(q => q.id === openQuestId);
            if (!quest) return null;
            return (
              <motion.div
                key={`quest-tasks-overlay-${openQuestId}`}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="absolute inset-0 z-[55] flex flex-col overflow-hidden"
                style={{
                  background: isCurrentPlayerDead
                    ? t.pageBg
                    : (isNight || isPracticeMode)
                      ? 'linear-gradient(180deg, #050810 0%, #0a1025 50%, #15102a 100%)'
                      : t.pageBg,
                }}
              >
                {(quest.questType || 'individual') === 'collaborative' ? (
                  <PlayerCollabQuestPage
                    quest={quest}
                    state={state}
                    currentPlayerId={currentPlayerId}
                    onBack={() => setOpenQuestId(null)}
                    onCollabVote={(questId, vote) => {
                      markActionSent();
                      serverCollabVote(questId, currentPlayerId, vote).then(handlePostAction);
                      setReadQuestIds(prev => {
                        if (prev.has(questId)) return prev;
                        const next = new Set(prev);
                        next.add(questId);
                        return next;
                      });
                    }}
                    onCancelCollabVote={(questId) => {
                      markActionSent();
                      serverCancelCollabVote(questId, currentPlayerId).then(handlePostAction);
                    }}
                    onNavigateToPlayer={(playerId) => {
                      setOpenQuestId(null);
                      setTimeout(() => navigateToPlayer(playerId), 50);
                    }}
                    onSetHypothesis={(targetPlayerId, roleId) => {
                      if (currentPlayerId !== null) {
                        setHypothesis(currentPlayerId, targetPlayerId, roleId);
                      }
                    }}
                    t={t}
                  />
                ) : (
                  <PlayerQuestTasksPage
                    quest={quest}
                    state={state}
                    currentPlayerId={currentPlayerId}
                    onBack={() => setOpenQuestId(null)}
                    onAnswerTask={(questId, taskId, answer) => {
                      markActionSent();
                      serverAnswerQuestTask(questId, taskId, answer, currentPlayerId).then(handlePostAction);
                    }}
                    onSetHypothesis={(targetPlayerId, roleId) => {
                      if (currentPlayerId !== null) {
                        setHypothesis(currentPlayerId, targetPlayerId, roleId);
                      }
                    }}
                    t={t}
                  />
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>

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
                  : (isNight || isPracticeMode)
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
                  background: isCurrentPlayerDead ? t.headerBg : (isNight || isPracticeMode) ? 'rgba(5,8,16,0.8)' : t.headerBg,
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid' as const,
                  borderBottomColor: isCurrentPlayerDead ? t.headerBorder : (isNight || isPracticeMode) ? 'rgba(255,255,255,0.05)' : t.headerBorder,
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
                  onRevealHint={(hintId) => {
                    if (currentPlayerId !== null) {
                      markActionSent();
                      serverRevealHint(currentPlayerId, hintId).then(handlePostAction);
                    }
                  }}
                  onNavigateToPlayer={(playerId) => {
                    setJournalOpen(false);
                    navigateToPlayer(playerId);
                  }}
                  onSetHypothesis={(targetPlayerId, roleId) => {
                    if (currentPlayerId !== null) {
                      setHypothesis(currentPlayerId, targetPlayerId, roleId);
                    }
                  }}
                  gameId={state.gameId || undefined}
                />
              </div>

              {/* Floating close button */}
              <div
                className="flex-shrink-0 px-4"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 12px)', paddingTop: '10px' }}
              >
                <button
                  onClick={() => setJournalOpen(false)}
                  className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors active:opacity-80"
                  style={{
                    background: isCurrentPlayerDead ? t.headerBg : (isNight || isPracticeMode) ? 'rgba(255,255,255,0.06)' : t.headerBg,
                    border: `1px solid ${isCurrentPlayerDead ? t.headerBorder : (isNight || isPracticeMode) ? 'rgba(255,255,255,0.1)' : t.headerBorder}`,
                    color: t.textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <XIcon size={14} />
                  Fermer le journal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Bar — Floating Bottom Navigation */}
      {(() => {
        const isNightGlass = (isNight || isPracticeMode) && !isCurrentPlayerDead;
        const isDayGame = !isNight && !isPracticeMode && !isCurrentPlayerDead && activePanel === 'game';
        const isDayOther = !isNight && !isPracticeMode && !isCurrentPlayerDead && activePanel !== 'game';
        return (
      <div
        className="flex-shrink-0 flex items-stretch relative z-[2] fixed bottom-0 left-0 right-0 pointer-events-none"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 12px) + 12px)',
          pointerEvents: 'auto',
          paddingLeft: '12px',
          paddingRight: '12px',
        }}
      >
        <div
          className="flex items-stretch w-full rounded-2xl overflow-hidden relative"
          style={{
            background: isNightGlass
              ? 'linear-gradient(160deg, rgba(30,24,12,0.35) 0%, rgba(12,10,5,0.58) 40%, rgba(6,5,2,0.68) 100%)'
              : isDayGame
                ? 'linear-gradient(160deg, rgba(38,28,16,0.30) 0%, rgba(20,15,8,0.52) 40%, rgba(13,10,5,0.62) 100%)'
                : isCurrentPlayerDead
                  ? t.headerBg
                  : 'linear-gradient(160deg, rgba(245,240,228,0.30) 0%, rgba(235,228,210,0.50) 40%, rgba(227,218,198,0.62) 100%)',
            border: `1px solid ${
              isNightGlass
                ? 'rgba(212,168,67,0.12)'
                : isDayGame
                  ? 'rgba(120,90,50,0.22)'
                  : isCurrentPlayerDead
                    ? t.headerBorder
                    : 'rgba(180,165,130,0.28)'
            }`,
            backdropFilter: 'blur(28px) saturate(120%)',
            WebkitBackdropFilter: 'blur(28px) saturate(120%)',
            boxShadow: isNightGlass
              ? '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1.5px 0 rgba(212,168,67,0.12), inset 0 -1px 0 rgba(0,0,0,0.30)'
              : isDayGame
                ? '0 8px 40px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.25), inset 0 1.5px 0 rgba(160,120,60,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)'
                : isCurrentPlayerDead
                  ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : '0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.06)',
            padding: '0',
          }}
        >
          {/* Specular highlight — light refracting through the glass top edge */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none z-10"
            style={{
              background: isNightGlass
                ? 'linear-gradient(90deg, transparent 4%, rgba(212,168,67,0.20) 30%, rgba(212,168,67,0.30) 50%, rgba(212,168,67,0.20) 70%, transparent 96%)'
                : isDayGame
                  ? 'linear-gradient(90deg, transparent 4%, rgba(180,140,80,0.35) 30%, rgba(210,170,100,0.45) 50%, rgba(180,140,80,0.35) 70%, transparent 96%)'
                  : 'linear-gradient(90deg, transparent 4%, rgba(255,255,255,0.60) 30%, rgba(255,255,255,0.80) 50%, rgba(255,255,255,0.60) 70%, transparent 96%)',
            }}
          />
          {/* Glass sheen — upper half light film */}
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl z-0"
            style={{
              background: isNightGlass
                ? 'linear-gradient(180deg, rgba(212,168,67,0.05) 0%, transparent 52%)'
                : isDayGame
                  ? 'linear-gradient(180deg, rgba(160,120,60,0.06) 0%, transparent 52%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 52%)',
            }}
          />
        {visibleTabs.map((tab, tabIdx) => {
          const isActive = activePanel === tab.id;
          const isGameTab = tabIdx === 0;
          const tabColor = isActive ? t.gold : (isNightGlass ? 'rgba(212,168,67,0.45)' : t.textDim);
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isGameTab && activePanel === 'game' && isFlipped) {
                  setIsFlipped(false);
                  setSeerRevealing(false);
                  setFoxRevealing(false);
                  setConciergeRevealing(false);
                  if (isSimulationMode) resetPractice();
                } else if (tab.id === 'quests' && activePanel === 'quests') {
                  if (openQuestId !== null) {
                    setOpenQuestId(null);
                  } else {
                    questsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                } else {
                  setActivePanel(tab.id);
                }
              }}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 relative transition-colors"
              style={{ perspective: '600px' }}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: t.gold }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab.id}
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="relative" style={{ color: tabColor }}>
                    {isActive ? tab.iconActive : tab.icon}
                    {tab.id === 'game' && unrevealedHintCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2.5 flex items-center justify-center rounded-full"
                        style={{
                          minWidth: '15px',
                          height: '15px',
                          padding: '0 4px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#fff',
                          fontSize: '0.5rem',
                          fontWeight: 800,
                          boxShadow: '0 1px 4px rgba(245,158,11,0.5)',
                          lineHeight: 1,
                        }}
                      >
                        {unrevealedHintCount}
                      </span>
                    )}
                    {tab.id === 'quests' && unreadQuestCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2.5 flex items-center justify-center rounded-full"
                        style={{
                          minWidth: '15px',
                          height: '15px',
                          padding: '0 4px',
                          background: 'linear-gradient(135deg, #e53e3e, #c53030)',
                          color: '#fff',
                          fontSize: '0.5rem',
                          fontWeight: 800,
                          boxShadow: '0 1px 4px rgba(229,62,62,0.5)',
                          lineHeight: 1,
                        }}
                      >
                        {unreadQuestCount}
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.55rem',
                      color: tabColor,
                    }}
                  >
                    {tab.label}
                  </span>
                </motion.div>
              </AnimatePresence>
            </button>
          );
        })}
        </div>
      </div>
        );
      })()}

      {/* Hunter Shot Modal — only shown to the Chasseur */}
      <AnimatePresence>
        {state.hunterPending && currentPlayerId !== null && currentPlayerId === state.hunterShooterId && (
          <HunterShotModal
            players={state.players}
            hunterId={state.hunterShooterId}
            preTarget={state.hunterShooterId !== null ? (state.hunterPreTargets || {})[state.hunterShooterId] ?? null : null}
            onShoot={(targetId) => {
              confirmHunterShot(targetId);
              if (!isSimulationMode && currentPlayerId !== null) {
                serverConfirmHunterShot(currentPlayerId, targetId).catch((err: any) =>
                  console.log('Hunter shot server error:', err)
                );
              }
            }}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Maire Succession Modal — only shown to the dying Maire */}
      <AnimatePresence>
        {state.maireSuccessionPending && currentPlayerId !== null && currentPlayerId === state.maireSuccessionFromId && (
          <MaireSuccessionModal
            players={state.players}
            dyingMaireId={state.maireSuccessionFromId}
            onChooseSuccessor={(successorId) => {
              const successor = state.players.find(p => p.id === successorId);
              updateState(s => ({
                ...s,
                maireId: successorId,
                maireSuccessionPending: false,
                maireSuccessionFromId: null,
                maireSuccessionPhase: null,
                events: [...s.events, {
                  id: Date.now() + Math.floor(Math.random() * 100000),
                  turn: s.turn, phase: s.phase,
                  message: `👑 ${successor?.name || 'Un joueur'} a ete designe(e) nouveau Maire.`,
                  timestamp: new Date().toISOString(),
                }],
              }));
              if (state.gameId) {
                const targets = state.players.filter(p => p.alive).map(p => p.shortCode);
                sendPushNotifications(state.gameId, targets, 'Loup-Garou', `👑 ${successor?.name || 'Un joueur'} est le nouveau Maire !`, 'maire-succession');
              }
            }}
            t={t}
          />
        )}
      </AnimatePresence>

      {/* Hypothesis picker modal */}
      <AnimatePresence>
        {hypothesisTarget !== null && currentPlayerId !== null && (
          <HypothesisPickerModal
            targetPlayer={state.players.find((p) => p.id === hypothesisTarget) || null}
            currentHypothesis={(state.hypotheses[currentPlayerId] || {})[hypothesisTarget] || ''}
            targetVoteCount={hypothesisTarget !== null ? Object.values(state.votes).filter((v) => v === hypothesisTarget).length : 0}
            onSelect={(roleId) => {
              setHypothesis(currentPlayerId!, hypothesisTarget!, roleId);
              setHypothesisTarget(null);
            }}
            onClear={() => {
              setHypothesis(currentPlayerId!, hypothesisTarget!, null);
              setHypothesisTarget(null);
            }}
            onClose={() => setHypothesisTarget(null)}
            t={t}
            phase={state.phase}
            dayStep={state.dayStep}
            currentPlayerAlive={currentPlayer?.alive ?? false}
            isTargetAway={!!(state.villagePresentIds && hypothesisTarget !== null && !state.villagePresentIds.includes(hypothesisTarget))}
            isMaireElection={state.phase === 'day' && !state.maireElectionDone && state.turn === 1 && !!state.roleRevealDone}
            onVoteAgainst={(targetId) => {
              markActionSent();
              // Server vote endpoint replaces existing vote, no cancel needed
              castVote(currentPlayerId!, targetId);
              serverCastVote(currentPlayerId!, targetId).then(handlePostAction);
              setHypothesisTarget(null);
              setActivePanel('game');
            }}
            onEarlyVote={(targetId) => {
              // Set or replace early vote
              updateState((s) => ({
                ...s,
                earlyVotes: { ...(s.earlyVotes || {}), [currentPlayerId!]: targetId },
              }));
              serverSetEarlyVote(currentPlayerId!, targetId);
              setHypothesisTarget(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Death Announcement Modal (portalled to body) */}
      {deathAnnouncement && (
        <DeathAnnouncementModal
          data={deathAnnouncement}
          onDismiss={dismissDeathAnnouncement}
          t={t}
          currentPlayerId={currentPlayerId}
          voteHistory={state.voteHistory}
          allPlayers={state.players}
          lastWillUsed={state.lastWillUsed}
          maireSuccessionPending={state.maireSuccessionPending && currentPlayerId === state.maireSuccessionFromId}
          onChooseSuccessor={(successorId) => {
            const successor = state.players.find(p => p.id === successorId);
            updateState(s => ({
              ...s,
              maireId: successorId,
              maireSuccessionPending: false,
              maireSuccessionFromId: null,
              maireSuccessionPhase: null,
              events: [...s.events, {
                id: Date.now() + Math.floor(Math.random() * 100000),
                turn: s.turn, phase: s.phase,
                message: `👑 ${successor?.name || 'Un joueur'} a ete designe(e) nouveau Maire.`,
                timestamp: new Date().toISOString(),
              }],
            }));
            if (state.gameId) {
              const targets = state.players.filter(p => p.alive).map(p => p.shortCode);
              sendPushNotifications(state.gameId, targets, 'Loup-Garou', `👑 ${successor?.name || 'Un joueur'} est le nouveau Maire !`, 'maire-succession');
            }
          }}
        />
      )}

      {/* Maire Election Success Screen (portalled to body) — shown at start of Night 1, dismissed by player */}
      {state.maireSuccessScreen && state.phase === 'night' && state.turn === 1 && !maireSuccessDismissed && (
        <MaireElectionSuccessScreen
          maireId={state.maireId ?? null}
          players={state.players}
          currentPlayerId={currentPlayerId}
          onDismiss={() => setMaireSuccessDismissed(true)}
        />
      )}

      {/* End Game Overlay (player) */}
      {state.winner && (
        <PlayerEndGameOverlay
          state={state}
          currentPlayerId={currentPlayerId}
          onDismiss={() => {/* stay on page */}}
          navigate={navigate}
        />
      )}

      {/* PWA Install Banner */}
      <PWAInstallBanner pwa={pwa} variant={isNight ? 'dark' : 'dark'} />

      {/* In-App Toast Notifications */}
      <InAppNotificationToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onTapQuest={(questId) => {
          setActivePanel('quests');
          handleOpenQuest(questId);
        }}
      />
    </div>
    </>
  );
}