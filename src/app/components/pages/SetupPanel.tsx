import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Play, ChevronDown, ChevronUp,
  ClipboardPaste, UserPlus,
} from 'lucide-react';
import { type Player } from '../../context/GameContext';
import { type GameState } from '../../context/gameTypes';
import { type HeartbeatMap } from '../../context/useRealtimeSync';
import { type GameThemeTokens } from '../../context/gameTheme';
import { SetupMidGameView } from './setup/SetupMidGameView';
import { SetupRoleConfig } from './setup/SetupRoleConfig';
import { SetupPlayerGrid } from './setup/SetupPlayerGrid';
import { ReduceConfirmModal, BulkImportModal } from './setup/SetupModals';
import { ImportFromGalleryModal } from './setup/ImportFromGalleryModal';
import { GMGameSettingsAccordion } from './gm/GMGameSettingsAccordion';

import { PLAYER_AVATARS, type PlayerEntry } from './setup/setupConstants';
// Re-export for backward compatibility (GameMasterPage imports from here)
export { PLAYER_AVATARS, type PlayerEntry };

export function SetupPanel({
  state,
  playerEntries,
  setPlayerEntries,
  playerCount,
  totalRoles,
  isValid,
  hasEnoughWerewolves,
  updateRoleConfig,
  handleStartGame,
  isMobile,
  gameStarted,
  addPlayerMidGame,
  gamePlayers,
  playerHeartbeats,
  onUploadAvatar,
  uploadingPlayerId,
  t,
  updateState,
  onResetGame,
  onEndGame,
}: {
  state: GameState;
  playerEntries: PlayerEntry[];
  setPlayerEntries: (entries: PlayerEntry[] | ((prev: PlayerEntry[]) => PlayerEntry[])) => void;
  playerCount: number;
  totalRoles: number;
  isValid: boolean;
  hasEnoughWerewolves: boolean;
  updateRoleConfig: (roleId: string, count: number) => void;
  handleStartGame: () => void;
  isMobile: boolean;
  gameStarted: boolean;
  addPlayerMidGame: (name: string, roleId?: string) => void;
  gamePlayers: Player[];
  playerHeartbeats: HeartbeatMap;
  onUploadAvatar: (file: File, playerId: number, isPreGame: boolean) => void;
  uploadingPlayerId: number | null;
  t: GameThemeTokens;
  updateState: (fn: (s: GameState) => GameState) => void;
  onResetGame?: () => void;
  onEndGame?: (winner: 'village' | 'werewolf' | 'lovers') => void;
}) {
  const MAX_PLAYERS = 60;
  const MIN_PLAYERS = 6;

  const [showReduceConfirm, setShowReduceConfirm] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pasteTargetId, setPasteTargetId] = useState<number | null>(null);
  const [pasteTargetIsPreGame, setPasteTargetIsPreGame] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showPlayers, setShowPlayers] = useState(true);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showGalleryImport, setShowGalleryImport] = useState(false);

  const handleGalleryImport = (entries: Array<{ name: string; avatarUrl: string }>) => {
    const clamped = entries.slice(0, MAX_PLAYERS);
    const newEntries: PlayerEntry[] = clamped.map((e, i) => ({
      id: i,
      name: e.name,
      avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length],
      avatarUrl: e.avatarUrl,
    }));
    // Pad to minimum
    while (newEntries.length < MIN_PLAYERS) {
      const idx = newEntries.length;
      newEntries.push({
        id: idx,
        name: `Joueur ${idx + 1}`,
        avatar: PLAYER_AVATARS[idx % PLAYER_AVATARS.length],
      });
    }
    setPlayerEntries(newEntries);
  };

  const handleBulkImport = () => {
    const names = bulkText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    const clamped = names.slice(0, MAX_PLAYERS);
    const entries: PlayerEntry[] = clamped.map((name, i) => ({
      id: i,
      name,
      avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length],
    }));
    while (entries.length < MIN_PLAYERS) {
      const idx = entries.length;
      entries.push({
        id: idx,
        name: `Joueur ${idx + 1}`,
        avatar: PLAYER_AVATARS[idx % PLAYER_AVATARS.length],
      });
    }
    setPlayerEntries(entries);
    setShowBulkImport(false);
    setBulkText('');
  };

  // Listen for paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (pasteTargetId === null) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onUploadAvatar(file, pasteTargetId, pasteTargetIsPreGame);
            setPasteTargetId(null);
          }
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [pasteTargetId, pasteTargetIsPreGame, onUploadAvatar]);

  useEffect(() => {
    if (pasteTargetId === null) return;
    const timer = setTimeout(() => setPasteTargetId(null), 10000);
    return () => clearTimeout(timer);
  }, [pasteTargetId]);

  const selectPasteTarget = (id: number, isPreGame: boolean) => {
    setPasteTargetId((prev) => (prev === id ? null : id));
    setPasteTargetIsPreGame(isPreGame);
  };

  const autoDistribute = () => {
    const wolves = Math.max(1, Math.round(playerCount * 0.2));
    updateRoleConfig('loup-garou', wolves);
    updateRoleConfig('voyante', 1);
    updateRoleConfig('sorciere', 1);
    updateRoleConfig('villageois', Math.max(0, playerCount - wolves - 2));
    updateRoleConfig('chasseur', 0);
    updateRoleConfig('cupidon', 0);
    updateRoleConfig('petite-fille', 0);
  };

  const handleRoleChange = (roleId: string, newCount: number) => {
    const oldCount = state.roleConfig[roleId] || 0;
    const diff = newCount - oldCount;
    if (diff > 0) {
      const newTotal = totalRoles + diff;
      if (newTotal > playerCount && playerCount + diff <= MAX_PLAYERS) {
        changePlayerCount(playerCount + diff);
      }
    }
    updateRoleConfig(roleId, newCount);
  };

  const changePlayerCount = (newCount: number) => {
    if (newCount < MIN_PLAYERS || newCount > MAX_PLAYERS) return;
    if (newCount > playerCount) {
      setPlayerEntries((prev) => {
        const newEntries = [...prev];
        const toAdd = newCount - prev.length;
        for (let i = 0; i < toAdd; i++) {
          const newId = newEntries.length > 0 ? Math.max(...newEntries.map((p) => p.id)) + 1 : 0;
          newEntries.push({
            id: newId,
            name: `Joueur ${newEntries.length + 1}`,
            avatar: PLAYER_AVATARS[newEntries.length % PLAYER_AVATARS.length],
          });
        }
        return newEntries;
      });
    } else if (newCount < playerCount) {
      const entriesToRemove = playerEntries.slice(newCount);
      const hasCustomized = entriesToRemove.some((e, i) => {
        const defaultName = `Joueur ${newCount + i + 1}`;
        return e.name !== defaultName || e.avatarUrl;
      });
      if (hasCustomized) {
        setPendingCount(newCount);
        setShowReduceConfirm(true);
      } else {
        setPlayerEntries((prev) => prev.slice(0, newCount));
      }
    }
  };

  const confirmReduce = () => {
    if (pendingCount !== null) {
      setPlayerEntries((prev) => prev.slice(0, pendingCount));
    }
    setShowReduceConfirm(false);
    setPendingCount(null);
  };

  const cancelReduce = () => {
    setShowReduceConfirm(false);
    setPendingCount(null);
  };

  // ════════════════════════════════════════════════════
  // Mid-game view
  // ════════════════════════════════════════════════════
  if (gameStarted) {
    return (
      <SetupMidGameView
        gamePlayers={gamePlayers}
        playerHeartbeats={playerHeartbeats}
        isMobile={isMobile}
        t={t}
        addPlayerMidGame={addPlayerMidGame}
        setPlayerEntries={setPlayerEntries}
        onUploadAvatar={onUploadAvatar}
        uploadingPlayerId={uploadingPlayerId}
        pasteTargetId={pasteTargetId}
        selectPasteTarget={selectPasteTarget}
        state={state}
        updateState={updateState}
        onResetGame={onResetGame}
        onEndGame={onEndGame}
      />
    );
  }

  // ════════════════════════════════════════════════════
  // Pre-game setup view
  // ════════════════════════════════════════════════════
  return (
    <div className={`max-w-4xl mx-auto h-full flex flex-col ${isMobile ? 'px-3 py-2' : 'px-6 py-4'}`}>
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-scroll" style={{ scrollbarGutter: 'stable' }}>
        {/* ── Section 1+2: Players (collapsible) ── */}
        <div className="mb-3">
          <div
            onClick={() => setShowPlayers((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlayers((v) => !v); } }}
            className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors cursor-pointer"
            style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `rgba(${t.overlayChannel}, 0.06)`, border: `1px solid ${t.goldBorder}` }}
              >
                <Users size={15} style={{ color: t.gold }} />
              </div>
              <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.8rem' }}>
                Joueurs
              </span>
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(212,168,67,0.1)',
                  border: '1px solid rgba(212,168,67,0.2)',
                  color: t.gold,
                  fontSize: '0.6rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                {playerCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => changePlayerCount(playerCount - 1)}
                  disabled={playerCount <= MIN_PLAYERS}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.06)`,
                    border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                    opacity: playerCount <= MIN_PLAYERS ? 0.3 : 1,
                    cursor: playerCount <= MIN_PLAYERS ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronDown size={14} style={{ color: t.text }} />
                </button>
                <span
                  className="w-8 text-center"
                  style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1.1rem', fontWeight: 700 }}
                >
                  {playerCount}
                </span>
                <button
                  onClick={() => changePlayerCount(playerCount + 1)}
                  disabled={playerCount >= MAX_PLAYERS}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.06)`,
                    border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                    opacity: playerCount >= MAX_PLAYERS ? 0.3 : 1,
                    cursor: playerCount >= MAX_PLAYERS ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronUp size={14} style={{ color: t.text }} />
                </button>
              </div>
              <motion.div animate={{ rotate: showPlayers ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} style={{ color: t.textMuted }} />
              </motion.div>
            </div>
          </div>

          <AnimatePresence>
            {showPlayers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(50vh, 420px)', WebkitOverflowScrolling: 'touch' }}>
                  <SetupPlayerGrid
                    playerEntries={playerEntries}
                    setPlayerEntries={setPlayerEntries}
                    onUploadAvatar={onUploadAvatar}
                    uploadingPlayerId={uploadingPlayerId}
                    pasteTargetId={pasteTargetId}
                    selectPasteTarget={selectPasteTarget}
                    isMobile={isMobile}
                    t={t}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Import buttons row ── */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setShowBulkImport(true); setBulkText(''); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-colors hover:brightness-110"
            style={{
              background: `rgba(${t.overlayChannel}, 0.03)`,
              border: `1px dashed rgba(${t.overlayChannel}, 0.12)`,
              color: t.textMuted,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            <ClipboardPaste size={13} /> Liste de noms
          </button>
          <button
            onClick={() => setShowGalleryImport(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-colors hover:brightness-110"
            style={{
              background: `rgba(${t.overlayChannel}, 0.03)`,
              border: `1px dashed rgba(${t.overlayChannel}, 0.12)`,
              color: t.textMuted,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.65rem',
              cursor: 'pointer',
            }}
          >
            <UserPlus size={13} /> Galerie d'avatars
          </button>
        </div>

        {/* ── Section 3: Role distribution ── */}
        <SetupRoleConfig
          roleConfig={state.roleConfig}
          handleRoleChange={handleRoleChange}
          autoDistribute={autoDistribute}
          isValid={isValid}
          hasEnoughWerewolves={hasEnoughWerewolves}
          playerCount={playerCount}
          totalRoles={totalRoles}
          showRoles={showRoles}
          setShowRoles={setShowRoles}
          isMobile={isMobile}
          t={t}
        />

        {/* ── Section 4: Game Settings (accordion) ── */}
        <GMGameSettingsAccordion
          state={state}
          updateState={updateState}
          t={t}
          className="mb-3"
        />
      </div>

      {/* ── Start button (sticky bottom) ── */}
      <div className="flex-shrink-0 pt-2 pb-1 flex justify-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}>
        <button
          onClick={handleStartGame}
          disabled={!isValid || !hasEnoughWerewolves}
          className={`flex items-center justify-center gap-2.5 ${isMobile ? 'py-2.5 px-6 w-full' : 'py-3 px-10'} rounded-xl transition-all hover:shadow-lg active:scale-95`}
          style={{
            background: isValid && hasEnoughWerewolves ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)' : 'rgba(255,255,255,0.04)',
            color: isValid && hasEnoughWerewolves ? '#0a0e1a' : '#4a5568',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.8rem',
            boxShadow: isValid && hasEnoughWerewolves ? '0 4px 20px rgba(212,168,67,0.3)' : 'none',
            cursor: isValid && hasEnoughWerewolves ? 'pointer' : 'not-allowed',
          }}
        >
          <Play size={16} />
          Lancer la Partie
        </button>
      </div>

      {/* ── Modals ── */}
      <ReduceConfirmModal
        show={showReduceConfirm}
        pendingCount={pendingCount}
        playerCount={playerCount}
        onConfirm={confirmReduce}
        onCancel={cancelReduce}
        t={t}
      />
      <BulkImportModal
        show={showBulkImport}
        bulkText={bulkText}
        setBulkText={setBulkText}
        onImport={handleBulkImport}
        onClose={() => setShowBulkImport(false)}
        t={t}
      />
      <ImportFromGalleryModal
        open={showGalleryImport}
        onClose={() => setShowGalleryImport(false)}
        onImport={handleGalleryImport}
        existingEntries={playerEntries}
        t={t}
      />
    </div>
  );
}