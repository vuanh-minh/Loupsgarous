import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Users, ScrollText, Moon, Crown } from 'lucide-react';
import { type Player, type GameState, type NightStep, type DayStep } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { type HeartbeatMap } from '../../../context/useRealtimeSync';
import { SectionHeader, type MobileGameView } from './GMShared';
import { GMEventLog } from './GMEventLog';
import { NightActionPlayerPickerModal, ReviveConfirmModal } from './GMModals';
import { MobileControlsView } from './GMMobileControlsView';
import { GMPhaseOutcome } from './GMPhaseOutcome';
import { GMPlayerList } from './GMPlayerList';
import { GMPlayerDetail } from './GMPlayerDetail';
import { GMGameControls } from './GMGameControls';
import { GamePanelProvider, type GamePanelContextValue } from './GamePanelContext';
import { getPlayerStatuses } from './useGMGameLogic';
import { GMPhaseActions } from './GMPhaseActions';

/* ================================================================
   Game Panel — 3-column desktop layout (orchestrator)
   Sub-components consume shared state via GamePanelContext
   instead of receiving 30+ individual props.
   ================================================================ */

interface GamePanelProps {
  state: GameState;
  alivePlayers: Player[];
  deadPlayers: Player[];
  isNight: boolean;
  hasRole: (id: string) => boolean;
  leverLeSoleil: () => void;
  handleAdvanceTurn: () => void;
  handleStartNight1: () => void;
  eliminatePlayer: (id: number) => void;
  revivePlayer: (id: number, newRole?: string) => void;
  addEvent: (msg: string) => void;
  showEventLog: boolean;
  setShowEventLog: (v: boolean) => void;
  navigate: (to: string) => void;
  setNightStep: (s: NightStep) => void;
  confirmHunterShot: (id: number) => void;
  setDayStep: (s: DayStep) => void;
  resolveVote: () => void;
  setGuardTarget: (guardId: number, targetId: number | null) => void;
  isMobile: boolean;
  playerHeartbeats: HeartbeatMap;
  t: GameThemeTokens;
  resultDismissed?: boolean;
  onShowResult?: () => void;
  updateState: (updater: (s: GameState) => GameState) => void;
  onSendHintToPlayer?: (playerId: number) => void;
  broadcastTestNotification?: (shortCode: string) => void;
  handleResolveMaireElection?: () => void;
  externalSelectedPlayer?: number | null;
  onClearExternalSelectedPlayer?: () => void;
  /** When set on mobile, forces a specific view and hides the sub-navigation */
  forceMobileView?: MobileGameView;
  /** Mobile: navigate to the external "Joueurs" tab with a player pre-selected */
  onNavigateToPlayersTab?: (playerId: number) => void;
}

export function GamePanel(props: GamePanelProps) {
  const {
    state, alivePlayers, deadPlayers, isNight, hasRole,
    leverLeSoleil, handleAdvanceTurn, handleStartNight1,
    eliminatePlayer, revivePlayer, addEvent,
    showEventLog, setShowEventLog,
    navigate, setNightStep, confirmHunterShot, setDayStep,
    resolveVote, setGuardTarget,
    isMobile, playerHeartbeats, t,
    resultDismissed, onShowResult,
    updateState, onSendHintToPlayer, broadcastTestNotification,
    handleResolveMaireElection,
    externalSelectedPlayer, onClearExternalSelectedPlayer,
    forceMobileView,
    onNavigateToPlayersTab,
  } = props;

  /* ---- Panel-local UI state ---- */
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<MobileGameView>('controls');
  const [revivePendingId, setRevivePendingId] = useState<number | null>(null);
  const [nightActionsTab, setNightActionsTab] = useState<'pending' | 'done'>('pending');
  const [nightActionPickerPlayers, setNightActionPickerPlayers] = useState<{
    players: Player[];
    actionLabel: string;
    actionEmoji: string;
    actionColor: string;
    playerStatuses: Record<number, { done: boolean; detail: string }>;
  } | null>(null);

  const isControlsView = selectedPlayer === null;
  const revivePendingPlayer = revivePendingId !== null
    ? state.players.find((p: Player) => p.id === revivePendingId)
    : null;

  /* ---- Auto-select player from external navigation (e.g. from Quests tab) ---- */
  useEffect(() => {
    if (externalSelectedPlayer != null) {
      setSelectedPlayer(externalSelectedPlayer);
      if (isMobile) setMobileView('players');
      onClearExternalSelectedPlayer?.();
    }
  }, [externalSelectedPlayer, onClearExternalSelectedPlayer, isMobile]);

  /** Navigate to a player's page with GM preview flag */
  const navigateToPlayerPreview = useCallback((player: Player) => {
    sessionStorage.setItem('__gm_preview', '1');
    navigate(`/player/${player.shortCode}`);
  }, [navigate]);

  /** Wrapped getPlayerStatuses that closes over current state */
  const getPlayerStatusesFn = useCallback(
    (actionId: string, actionPlayers: Player[]) => getPlayerStatuses(state, actionId, actionPlayers),
    [state],
  );

  /** Handle clicking a night action card — navigate directly or open picker */
  const handleNightActionClick = useCallback((actionPlayers: Player[], actionLabel: string, actionEmoji: string, actionColor: string, actionId: string) => {
    if (actionPlayers.length === 0) return;
    if (actionPlayers.length === 1) {
      navigateToPlayerPreview(actionPlayers[0]);
    } else {
      const playerStatuses = getPlayerStatusesFn(actionId, actionPlayers);
      setNightActionPickerPlayers({ players: actionPlayers, actionLabel, actionEmoji, actionColor, playerStatuses });
    }
  }, [navigateToPlayerPreview, getPlayerStatusesFn]);

  /* ---- Build context value (before early returns so hooks order is stable) ---- */
  const ctxValue: GamePanelContextValue = useMemo(() => ({
    state, alivePlayers, deadPlayers, isNight, isMobile, playerHeartbeats, t,
    hasRole, leverLeSoleil, handleAdvanceTurn, handleStartNight1,
    eliminatePlayer, revivePlayer, addEvent,
    navigate, setNightStep, confirmHunterShot, setDayStep,
    resolveVote, setGuardTarget, updateState,
    onSendHintToPlayer, broadcastTestNotification, handleResolveMaireElection,
    showEventLog, setShowEventLog, resultDismissed, onShowResult,
    selectedPlayer, setSelectedPlayer,
    mobileView, setMobileView,
    revivePendingId, setRevivePendingId,
    nightActionsTab, setNightActionsTab,
    nightActionPickerPlayers, setNightActionPickerPlayers,
    navigateToPlayerPreview, getPlayerStatuses: getPlayerStatusesFn, handleNightActionClick,
    onNavigateToPlayersTab,
  }), [
    state, alivePlayers, deadPlayers, isNight, isMobile, playerHeartbeats, t,
    hasRole, leverLeSoleil, handleAdvanceTurn, handleStartNight1,
    eliminatePlayer, revivePlayer, addEvent,
    navigate, setNightStep, confirmHunterShot, setDayStep,
    resolveVote, setGuardTarget, updateState,
    onSendHintToPlayer, broadcastTestNotification, handleResolveMaireElection,
    showEventLog, setShowEventLog, resultDismissed, onShowResult,
    selectedPlayer, mobileView, revivePendingId,
    nightActionsTab, nightActionPickerPlayers,
    navigateToPlayerPreview, getPlayerStatusesFn, handleNightActionClick,
    onNavigateToPlayersTab,
  ]);

  /* ---- Empty state ---- */
  if (state.players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <span className="text-5xl">🐺</span>
        <p style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1.1rem' }}>
          Aucune partie en cours
        </p>
        <p style={{ color: '#6b7b9b', fontSize: '0.8rem' }}>
          Configurez une partie dans l'onglet Configuration.
        </p>
      </div>
    );
  }

  /* ---- Phase Outcome Preview (shared node) ---- */
  const phaseOutcomePreview = (
    <GMPhaseOutcome state={state} isNight={isNight} alivePlayers={alivePlayers} t={t} />
  );

  /* ---- Event log content ---- */
  const eventLogContent = (
    <GMEventLog state={state} isMobile={isMobile} t={t} />
  );

  /* ---- Mobile sub-navigation (footer) ---- */
  const mobileSubNav = isMobile ? (
    <div
      className="flex-shrink-0 flex border-t m-[0px]"
      style={{
        background: t.headerBg,
        borderColor: t.headerBorder,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {([
        { id: 'controls' as MobileGameView, label: 'Controles', icon: <Zap size={13} /> },
        { id: 'players' as MobileGameView, label: 'Joueurs', icon: <Users size={13} />, badge: alivePlayers.length },
        { id: 'journal' as MobileGameView, label: 'Journal', icon: <ScrollText size={13} />, badge: state.events.length },
      ] as const).map((tab) => (
        <button
          key={tab.id}
          onClick={() => setMobileView(tab.id)}
          className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors relative border-t-2"
          style={{
            color: mobileView === tab.id ? t.gold : t.textMuted,
            borderTopColor: mobileView === tab.id ? t.gold : 'transparent',
          }}
        >
          <div className="relative">
            {tab.icon}
            {'badge' in tab && tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center"
                style={{
                  background: mobileView === tab.id ? t.gold : `rgba(${t.overlayChannel}, 0.15)`,
                  color: mobileView === tab.id ? t.pageBgSolid : t.textSecondary,
                  fontSize: '0.45rem',
                  padding: '0 2px',
                }}
              >
                {tab.badge}
              </span>
            )}
          </div>
          <span style={{ fontFamily: '"Cinzel", serif', fontSize: '0.55rem' }}>
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  ) : null;

  /* ---- Modals shared between mobile and desktop ---- */
  const sharedModals = (
    <>
      <AnimatePresence>
        {revivePendingPlayer && (
          <ReviveConfirmModal
            player={revivePendingPlayer}
            onConfirm={(roleId) => {
              revivePlayer(revivePendingPlayer.id, roleId !== revivePendingPlayer.role ? roleId : undefined);
              addEvent(`${revivePendingPlayer.name} a ete ressuscite !`);
              setRevivePendingId(null);
            }}
            onCancel={() => setRevivePendingId(null)}
            t={t}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {nightActionPickerPlayers && (
          <NightActionPlayerPickerModal
            actionLabel={nightActionPickerPlayers.actionLabel}
            actionEmoji={nightActionPickerPlayers.actionEmoji}
            actionColor={nightActionPickerPlayers.actionColor}
            players={nightActionPickerPlayers.players}
            playerStatuses={nightActionPickerPlayers.playerStatuses}
            onSelect={(player) => { setNightActionPickerPlayers(null); navigateToPlayerPreview(player); }}
            onClose={() => setNightActionPickerPlayers(null)}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );

  // Resolve which mobile view to show (forced or local)
  const effectiveMobileView = forceMobileView ?? mobileView;
  const showMobileSubNav = isMobile && !forceMobileView;

  /* ---- MOBILE LAYOUT ---- */
  if (isMobile) {
    return (
      <GamePanelProvider value={ctxValue}>
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ paddingBottom: '16px' }}>
            <AnimatePresence mode="wait">
              {effectiveMobileView === 'controls' && (
                <motion.div key="mobile-controls" className="flex flex-col flex-1 min-h-0 overflow-y-auto" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <MobileControlsView phaseOutcomePreview={phaseOutcomePreview} />
                </motion.div>
              )}
              {effectiveMobileView === 'players' && (
                <motion.div key="mobile-players" className="flex-1 min-h-0 overflow-y-auto" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <GMPlayerList />
                </motion.div>
              )}
              {effectiveMobileView === 'journal' && (
                <motion.div key="mobile-journal" className="flex-1 min-h-0 overflow-y-auto" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  {eventLogContent}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {effectiveMobileView === 'controls' && (
            <div className="flex-shrink-0 px-3 pt-2 pb-4" style={{ background: t.pageBgSolid, borderTop: `1px solid rgba(${t.overlayChannel}, 0.06)`, boxShadow: '0 -2px 8px rgba(0,0,0,0.1)' }}>
              {state.roleRevealDone === false ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartNight1}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #d4a843, #b8860b)',
                    color: '#0a0e1a',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 20px rgba(212,168,67,0.3)',
                  }}
                >
                  {state.maireElectionDone ? <Moon size={18} /> : <Crown size={18} />}
                  {state.maireElectionDone ? 'Lancer la Nuit 1' : "Lancer l'Election du Maire"}
                </motion.button>
              ) : (
                <>
                  <SectionHeader icon={<Zap size={14} />} title="Actions" t={t} />
                  <GMPhaseActions
                    compact
                    className="mt-2"
                    state={state}
                    leverLeSoleil={leverLeSoleil}
                    handleAdvanceTurn={handleAdvanceTurn}
                    resolveVote={resolveVote}
                    addEvent={addEvent}
                    handleResolveMaireElection={handleResolveMaireElection}
                    t={t}
                  />
                </>
              )}
            </div>
          )}
          {showMobileSubNav && mobileSubNav}
          {sharedModals}
        </div>
      </GamePanelProvider>
    );
  }

  /* ---- DESKTOP LAYOUT ---- */
  return (
    <GamePanelProvider value={ctxValue}>
      <div className="h-full flex">
        {/* Left sidebar — player list */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto" style={{ borderColor: t.cardBorder }}>
          <div className="p-4 pb-2">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="w-full flex items-center gap-3 p-3 rounded-lg transition-all"
              style={{
                background: isControlsView ? `linear-gradient(135deg, ${t.goldBg}, ${t.goldBg})` : t.cardBg,
                border: isControlsView ? `1px solid ${t.goldBorder}` : `1px solid ${t.cardBorder}`,
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: isControlsView ? t.goldBg : t.surfaceBg, border: `1.5px solid ${isControlsView ? t.goldBorder : `rgba(${t.overlayChannel}, 0.08)`}` }}>
                <Zap size={16} style={{ color: isControlsView ? t.gold : t.textMuted }} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p style={{ color: isControlsView ? t.gold : t.text, fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>Controle du Jeu</p>
                <p style={{ color: t.textMuted, fontSize: '0.55rem' }}>{isNight ? `Nuit ${state.turn}` : `Jour ${state.turn}`} · {alivePlayers.length} vivants</p>
              </div>
              {isControlsView && <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.gold, boxShadow: `0 0 6px ${t.goldBorder}` }} />}
            </button>
          </div>
          <div className="mx-4 my-1 h-px" style={{ background: `rgba(${t.overlayChannel}, 0.06)` }} />
          <GMPlayerList />
        </div>

        {/* Center — game controls or player detail */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {state.winner && resultDismissed && (() => {
            const isLoversWin = state.winner === 'lovers';
            const isVillageWin = state.winner === 'village';
            const bannerColor = isLoversWin ? '#ec4899' : isVillageWin ? '#d4a843' : '#c41e3a';
            const bannerEmoji = isLoversWin ? '💘' : isVillageWin ? '👑' : '🐺';
            const bannerLabel = isLoversWin ? "L'Amour Triomphe !" : isVillageWin ? 'Le Village Triomphe !' : 'Les Loups Triomphent !';
            return (
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onShowResult}
                className="mx-4 mt-3 mb-1 rounded-xl flex items-center justify-between px-5 py-3 cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${bannerColor}22, ${bannerColor}11)`, border: `1px solid ${bannerColor}44` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{bannerEmoji}</span>
                  <span style={{ fontFamily: '"Cinzel", serif', color: bannerColor, fontSize: '0.85rem', fontWeight: 600 }}>{bannerLabel}</span>
                </div>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: `${bannerColor}22`, color: bannerColor, border: `1px solid ${bannerColor}33`, fontFamily: '"Cinzel", serif' }}>Voir les resultats</span>
              </motion.button>
            );
          })()}
          <AnimatePresence mode="wait">
            {isControlsView ? (
              <motion.div key="controls-view" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
                <GMGameControls phaseOutcomePreview={phaseOutcomePreview} />
              </motion.div>
            ) : selectedPlayer !== null ? (
              <motion.div key={`player-${selectedPlayer}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                <GMPlayerDetail />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Right sidebar — event log */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l overflow-y-auto" style={{ borderColor: t.cardBorder }}>
          {eventLogContent}
        </div>

        {sharedModals}
      </div>
    </GamePanelProvider>
  );
}