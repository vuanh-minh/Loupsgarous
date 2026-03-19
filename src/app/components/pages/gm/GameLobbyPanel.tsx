/**
 * GameLobbyPanel — Pre-game lobby view for the Game Master.
 *
 * Shows a split layout:
 *  - Left: Player list with codes, manual add, bulk import
 *  - Right: Role config, game settings
 *  - Top: Shareable link, QR code, GM access code
 *  - Bottom: Start game button
 */
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Users, Play, ChevronDown, ChevronUp,
  ClipboardPaste, Link2, Copy, Check,
  QrCode, Trash2, UserPlus,
  Share2, KeyRound, Wifi, Dices, X,
} from 'lucide-react';
import { type GameState } from '../../../context/gameTypes';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { ROLES, getRoleById } from '../../../data/roles';
import { SetupRoleConfig } from '../setup/SetupRoleConfig';
import { GMGameSettingsAccordion } from './GMGameSettingsAccordion';
import { BulkImportModal } from '../setup/SetupModals';
import { ImportFromGalleryModal } from '../setup/ImportFromGalleryModal';
import { PLAYER_AVATARS, type PlayerEntry } from '../setup/setupConstants';
import { type GamePreset, GAME_PRESETS } from '../../../data/gamePresets';

export type { GamePreset };
export { GAME_PRESETS };

interface GameLobbyPanelProps {
  state: GameState;
  gameId: string;
  gameName: string;
  playerEntries: PlayerEntry[];
  setPlayerEntries: (entries: PlayerEntry[] | ((prev: PlayerEntry[]) => PlayerEntry[])) => void;
  playerCount: number;
  totalRoles: number;
  isValid: boolean;
  hasEnoughWerewolves: boolean;
  updateRoleConfig: (roleId: string, count: number) => void;
  handleStartGame: () => void;
  isMobile: boolean;
  onUploadAvatar: (file: File, playerId: number, isPreGame: boolean) => void;
  uploadingPlayerId: number | null;
  t: GameThemeTokens;
  updateState: (fn: (s: GameState) => GameState) => void;
}

export const GameLobbyPanel = React.memo(function GameLobbyPanel({
  state,
  gameId,
  gameName,
  playerEntries,
  setPlayerEntries,
  playerCount,
  totalRoles,
  isValid,
  hasEnoughWerewolves,
  updateRoleConfig,
  handleStartGame,
  isMobile,
  t,
  updateState,
}: GameLobbyPanelProps) {
  const MAX_PLAYERS = 60;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGMCode, setCopiedGMCode] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showGalleryImport, setShowGalleryImport] = useState(false);
  const [showRoles, setShowRoles] = useState(true);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  /** Player id whose role picker is currently open */
  const [rolePickerForId, setRolePickerForId] = useState<number | null>(null);
  /** Position for the portal-based role picker dropdown */
  const [rolePickerPos, setRolePickerPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const rolePickerBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const openRolePicker = useCallback((entryId: number) => {
    if (rolePickerForId === entryId) {
      setRolePickerForId(null);
      setRolePickerPos(null);
      return;
    }
    const btn = rolePickerBtnRefs.current[entryId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setRolePickerPos({
        top: rect.bottom + 4,
        left: rect.left,
        right: window.innerWidth - rect.right,
      });
    }
    setRolePickerForId(entryId);
  }, [rolePickerForId]);

  const closeRolePicker = useCallback(() => {
    setRolePickerForId(null);
    setRolePickerPos(null);
  }, []);

  // Lobby players
  const lobbyPlayers = state.lobbyPlayers || [];

  // Compute how many of each role are still available for pre-assignment
  const roleAvailability = useMemo(() => {
    const used: Record<string, number> = {};
    for (const pe of playerEntries) {
      if (pe.assignedRole) {
        used[pe.assignedRole] = (used[pe.assignedRole] || 0) + 1;
      }
    }
    const avail: Record<string, number> = {};
    for (const [roleId, count] of Object.entries(state.roleConfig)) {
      if (count > 0) {
        avail[roleId] = count - (used[roleId] || 0);
      }
    }
    return avail;
  }, [state.roleConfig, playerEntries]);

  // Remove a lobby player (also remove matching playerEntry)
  const removeLobbyPlayer = (lobbyId: string, name: string) => {
    updateState((s) => ({
      ...s,
      lobbyPlayers: (s.lobbyPlayers || []).filter((p) => p.id !== lobbyId),
    }));
    // Also remove from playerEntries by name
    setPlayerEntries((prev: PlayerEntry[]) => prev.filter((p) => p.name !== name));
  };

  // Generate join URL
  const joinUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/join/${gameId}`;
  }, [gameId]);

  // Generate GM URL
  const gmUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/master`;
  }, []);

  // Generate a readable GM access code from gameId
  const gmAccessCode = useMemo(() => {
    // Take first 4 chars of gameId, uppercase
    if (!gameId) return '----';
    return gameId.replace(/-/g, '').slice(0, 4).toUpperCase();
  }, [gameId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* ignore */ }
  };

  const copyGMCode = async () => {
    try {
      await navigator.clipboard.writeText(gmAccessCode);
      setCopiedGMCode(true);
      setTimeout(() => setCopiedGMCode(false), 2000);
    } catch { /* ignore */ }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Loup-Garou: ${gameName}`,
          text: `Rejoins la partie "${gameName}" sur Loup-Garou !`,
          url: joinUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  // Player management
  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    if (playerCount >= MAX_PLAYERS) return;
    const newId = playerEntries.length > 0 ? Math.max(...playerEntries.map((p) => p.id)) + 1 : 0;
    setPlayerEntries((prev: PlayerEntry[]) => [
      ...prev,
      {
        id: newId,
        name,
        avatar: PLAYER_AVATARS[prev.length % PLAYER_AVATARS.length],
      },
    ]);
    setNewPlayerName('');
  };

  const removePlayer = (id: number) => {
    setPlayerEntries((prev: PlayerEntry[]) => prev.filter((p) => p.id !== id));
  };

  const changePlayerCount = (newCount: number) => {
    if (newCount < 0 || newCount > MAX_PLAYERS) return;
    if (newCount > playerCount) {
      setPlayerEntries((prev: PlayerEntry[]) => {
        const entries = [...prev];
        const toAdd = newCount - prev.length;
        for (let i = 0; i < toAdd; i++) {
          const newId = entries.length > 0 ? Math.max(...entries.map((p) => p.id)) + 1 : 0;
          entries.push({
            id: newId,
            name: `Joueur ${entries.length + 1}`,
            avatar: PLAYER_AVATARS[entries.length % PLAYER_AVATARS.length],
          });
        }
        return entries;
      });
    } else if (newCount < playerCount) {
      setPlayerEntries((prev: PlayerEntry[]) => prev.slice(0, newCount));
    }
  };

  // Determine which preset is recommended for current player count
  const recommendedPresetId = useMemo(() => {
    const match = GAME_PRESETS.find(p => playerCount >= p.minPlayers && playerCount <= p.maxPlayers);
    return match?.id || (playerCount > 60 ? 'metropole' : 'hameau');
  }, [playerCount]);

  // Apply a specific preset (sets roles + wolfKillsPerNight)
  const applyPreset = (presetId: string) => {
    const preset = GAME_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const roleMap = preset.roles(playerCount);
    for (const [roleId, count] of Object.entries(roleMap)) {
      updateRoleConfig(roleId, count);
    }
    // Also update wolfKillsPerNight in game state
    updateState((s) => ({ ...s, wolfKillsPerNight: preset.wolfKillsPerNight }));
    // Apply extra settings if any
    if (preset.extraSettings) {
      updateState((s) => ({ ...s, ...preset.extraSettings }));
    }
  };

  // Legacy autoDistribute uses the recommended preset
  const autoDistribute = () => {
    applyPreset(recommendedPresetId);
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
    setPlayerEntries(entries);
    setShowBulkImport(false);
    setBulkText('');
  };

  const handleGalleryImport = (entries: Array<{ name: string; avatarUrl: string }>) => {
    const clamped = entries.slice(0, MAX_PLAYERS);
    const newEntries: PlayerEntry[] = clamped.map((e, i) => ({
      id: i,
      name: e.name,
      avatar: PLAYER_AVATARS[i % PLAYER_AVATARS.length],
      avatarUrl: e.avatarUrl,
    }));
    setPlayerEntries(newEntries);
  };

  return (
    <div className={`h-full flex flex-col ${isMobile ? '' : 'max-w-6xl mx-auto'}`}>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4">

        {/* ── Top: Sharing & Info Section ── */}
        <div
          className="rounded-2xl p-4 sm:p-5 mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(212,168,67,0.06) 0%, rgba(184,134,11,0.03) 100%)',
            border: `1px solid ${t.goldBorder}`,
          }}
        >
          {/* Game name + player count */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: t.goldBg,
                  border: `1.5px solid ${t.goldBorder}`,
                }}
              >
                <span className="text-xl">🐺</span>
              </div>
              <div>
                <h2
                  style={{
                    fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                    color: t.gold,
                    fontSize: isMobile ? '0.95rem' : '1.1rem',
                    fontWeight: 700,
                  }}
                >
                  {gameName || 'Partie sans nom'}
                </h2>
                <p style={{ color: t.textMuted, fontSize: '0.68rem' }}>
                  {playerCount} joueurs configures
                </p>
              </div>
            </div>
          </div>

          {/* Share row */}
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3`}>
            {/* Join link */}
            <div
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
              }}
            >
              <Link2 size={14} style={{ color: t.textMuted, flexShrink: 0 }} />
              <span
                className="flex-1 truncate"
                style={{ color: t.inputText, fontSize: '0.75rem', fontFamily: 'monospace' }}
              >
                {joinUrl}
              </span>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all active:scale-95"
                style={{
                  background: copiedLink ? 'rgba(74,222,128,0.1)' : t.goldBg,
                  border: `1px solid ${copiedLink ? 'rgba(74,222,128,0.3)' : t.goldBorder}`,
                  color: copiedLink ? '#4ade80' : t.gold,
                  fontSize: '0.65rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink ? 'Copie' : 'Copier'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={shareLink}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.05))',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: '#a78bfa',
                  fontSize: '0.72rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                <Share2 size={14} />
                Partager
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowQR((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl"
                style={{
                  background: showQR ? t.goldBg : `rgba(${t.overlayChannel}, 0.03)`,
                  border: `1px solid ${showQR ? t.goldBorder : t.inputBorder}`,
                  color: showQR ? t.gold : t.textMuted,
                  fontSize: '0.72rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                <QrCode size={14} />
                QR
              </motion.button>
            </div>
          </div>

          {/* QR Code */}
          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="flex justify-center pt-4">
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: '#ffffff',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                    }}
                  >
                    <QRCodeSVG
                      value={joinUrl}
                      size={isMobile ? 160 : 200}
                      level="M"
                      fgColor="#1a1040"
                      bgColor="#ffffff"
                    />
                    <p
                      className="text-center mt-2"
                      style={{
                        color: '#1a1040',
                        fontSize: '0.65rem',
                        fontFamily: '"Cinzel", serif',
                        fontWeight: 600,
                      }}
                    >
                      Scannez pour rejoindre
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* GM Access Code */}
          <div
            className="flex items-center gap-3 mt-4 px-3 py-2.5 rounded-xl"
            style={{
              background: `rgba(${t.overlayChannel}, 0.02)`,
              border: `1px solid ${t.inputBorder}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)' }}
            >
              <KeyRound size={14} style={{ color: t.gold }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: t.textMuted, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>
                Acces Maitre du Jeu
              </p>
              <p
                className="truncate"
                style={{
                  color: t.gold,
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                }}
              >
                {gmAccessCode}
              </p>
            </div>
            <button
              onClick={copyGMCode}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
              style={{
                background: copiedGMCode ? 'rgba(74,222,128,0.1)' : t.goldBg,
                border: `1px solid ${copiedGMCode ? 'rgba(74,222,128,0.3)' : t.goldBorder}`,
                color: copiedGMCode ? '#4ade80' : t.gold,
                fontSize: '0.6rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              {copiedGMCode ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* ── Main content: Split layout ── */}
        <div className={`${isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-2 gap-5'}`}>

          {/* ═══ LEFT: Player List ═══ */}
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: t.gold }} />
                <span style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.85rem', fontWeight: 700 }}>
                  Joueurs
                </span>
                <span
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    background: t.goldBg,
                    border: `1px solid ${t.goldBorder}`,
                    color: t.gold,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                  }}
                >
                  {playerCount}
                </span>
                {playerEntries.filter((e) => e.assignedRole).length > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{
                      background: 'rgba(139,92,246,0.08)',
                      border: '1px solid rgba(139,92,246,0.2)',
                      color: '#a78bfa',
                      fontSize: '0.55rem',
                      fontWeight: 600,
                    }}
                  >
                    <Dices size={9} />
                    {playerEntries.filter((e) => e.assignedRole).length} pre-assigne{playerEntries.filter((e) => e.assignedRole).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => changePlayerCount(playerCount - 1)}
                  disabled={playerCount <= 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid ${t.inputBorder}`,
                    opacity: playerCount <= 0 ? 0.3 : 1,
                    cursor: playerCount <= 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ color: t.text, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1 }}>−</span>
                </button>
                <button
                  onClick={() => changePlayerCount(playerCount + 1)}
                  disabled={playerCount >= MAX_PLAYERS}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.04)`,
                    border: `1px solid ${t.inputBorder}`,
                    opacity: playerCount >= MAX_PLAYERS ? 0.3 : 1,
                    cursor: playerCount >= MAX_PLAYERS ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ color: t.text, fontSize: '0.85rem', fontWeight: 700, lineHeight: 1 }}>+</span>
                </button>
              </div>
            </div>

            {/* Player list */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: `1px solid ${t.cardBorder}`,
                background: t.cardBg,
              }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: isMobile ? '280px' : '400px' }}>
                {playerEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2.5 px-3 py-2 transition-colors"
                    style={{
                      borderBottom: idx < playerEntries.length - 1 ? `1px solid ${t.cardBorder}` : 'none',
                    }}
                  >
                    {/* Avatar */}
                    <span style={{ fontSize: '1.2rem' }}>{entry.avatar}</span>

                    {/* Connected indicator (green dot for lobby-joined players) */}
                    {lobbyPlayers.some((lp) => lp.name === entry.name) && (
                      <span
                        className="block w-2 h-2 rounded-full shrink-0"
                        title="Connecte"
                        style={{
                          background: '#4ade80',
                          boxShadow: '0 0 6px rgba(74,222,128,0.5)',
                        }}
                      />
                    )}

                    {/* Name (editable) */}
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setPlayerEntries((prev: PlayerEntry[]) =>
                          prev.map((p) => (p.id === entry.id ? { ...p, name: newName } : p))
                        );
                      }}
                      className="flex-1 bg-transparent outline-none min-w-0"
                      style={{
                        color: t.text,
                        fontSize: '0.8rem',
                        fontFamily: 'system-ui, sans-serif',
                      }}
                    />

                    {/* Assigned role badge / picker toggle */}
                    <div className="relative">
                      {entry.assignedRole ? (
                        <button
                          ref={(el) => { rolePickerBtnRefs.current[entry.id] = el; }}
                          onClick={() => openRolePicker(entry.id)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all active:scale-95"
                          style={{
                            background: `${getRoleById(entry.assignedRole)?.color || t.gold}18`,
                            border: `1px solid ${getRoleById(entry.assignedRole)?.color || t.gold}40`,
                            fontSize: '0.6rem',
                            color: getRoleById(entry.assignedRole)?.color || t.gold,
                            fontWeight: 600,
                          }}
                          title={`Role assigne : ${getRoleById(entry.assignedRole)?.name}`}
                        >
                          <span>{getRoleById(entry.assignedRole)?.emoji}</span>
                          <span className="hidden sm:inline max-w-[60px] truncate">{getRoleById(entry.assignedRole)?.name}</span>
                        </button>
                      ) : (
                        <button
                          ref={(el) => { rolePickerBtnRefs.current[entry.id] = el; }}
                          onClick={() => openRolePicker(entry.id)}
                          className="w-6 h-6 rounded flex items-center justify-center transition-all active:scale-90"
                          style={{ color: t.textDim }}
                          title="Assigner un role"
                        >
                          <Dices size={12} />
                        </button>
                      )}
                    </div>

                    {/* Player number */}
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{
                        background: `rgba(${t.overlayChannel}, 0.04)`,
                        color: t.textDim,
                        fontSize: '0.55rem',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      #{idx + 1}
                    </span>

                    {/* Remove button — always available */}
                    <button
                      onClick={() => {
                        // If this is a lobby player, also remove from lobbyPlayers
                        const lp = lobbyPlayers.find((l) => l.name === entry.name);
                        if (lp) {
                          removeLobbyPlayer(lp.id, lp.name);
                        } else {
                          removePlayer(entry.id);
                        }
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center transition-all active:scale-90 hover:bg-red-500/10"
                      style={{ color: t.textDim }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add player */}
            <div className="mt-2.5 flex flex-col gap-2">
              <AnimatePresence>
                {showAddPlayer && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPlayerName.trim()) addPlayer();
                          if (e.key === 'Escape') { setShowAddPlayer(false); setNewPlayerName(''); }
                        }}
                        placeholder="Nom du joueur..."
                        autoFocus
                        className="flex-1 px-3 py-2 rounded-lg bg-transparent outline-none"
                        style={{
                          border: `1px solid ${t.goldBorder}`,
                          color: t.inputText,
                          fontSize: '0.78rem',
                          background: t.inputBg,
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={addPlayer}
                        disabled={!newPlayerName.trim()}
                        className="px-3 py-2 rounded-lg flex items-center gap-1.5"
                        style={{
                          background: newPlayerName.trim()
                            ? 'linear-gradient(135deg, #b8860b, #d4a843)'
                            : `rgba(${t.overlayChannel}, 0.03)`,
                          color: newPlayerName.trim() ? '#0a0e1a' : t.textDim,
                          fontSize: '0.72rem',
                          fontFamily: '"Cinzel", serif',
                          cursor: newPlayerName.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <Check size={14} />
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowAddPlayer((v) => !v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-colors"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.03)`,
                    border: `1px dashed ${t.goldBorder}`,
                    color: t.gold,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                >
                  <UserPlus size={13} />
                  Ajouter un joueur
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setShowBulkImport(true); setBulkText(''); }}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-colors"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.03)`,
                    border: `1px dashed ${t.inputBorder}`,
                    color: t.textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                  }}
                >
                  <ClipboardPaste size={12} />
                  Import
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowGalleryImport(true)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-colors"
                  style={{
                    background: `rgba(${t.overlayChannel}, 0.03)`,
                    border: `1px dashed ${t.inputBorder}`,
                    color: t.textMuted,
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                  }}
                >
                  <UserPlus size={12} />
                  Galerie
                </motion.button>
              </div>
            </div>

            {/* Empty state — waiting for players */}
            {playerEntries.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-8 mt-3 rounded-xl"
                style={{
                  background: `rgba(${t.overlayChannel}, 0.02)`,
                  border: `1px dashed ${t.inputBorder}`,
                }}
              >
                <Wifi size={24} style={{ color: t.textDim, marginBottom: '0.5rem' }} />
                <p style={{ color: t.textMuted, fontSize: '0.75rem', fontFamily: '"Cinzel", serif', textAlign: 'center' }}>
                  En attente de joueurs...
                </p>
                <p style={{ color: t.textDim, fontSize: '0.6rem', textAlign: 'center', marginTop: '0.25rem' }}>
                  Partagez le lien ou le QR code
                </p>
              </div>
            )}
          </div>

          {/* ═══ RIGHT: Role Config & Settings ═══ */}
          <div>
            {/* Role distribution */}
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
              presets={GAME_PRESETS}
              recommendedPresetId={recommendedPresetId}
              applyPreset={applyPreset}
            />

            {/* Game Settings */}
            <GMGameSettingsAccordion
              state={state}
              updateState={updateState}
              t={t}
              className="mb-3"
            />
          </div>
        </div>
      </div>

      {/* ── Start button (sticky bottom) ── */}
      <div
        className="flex-shrink-0 px-3 sm:px-6 pt-3 pb-3 flex justify-center"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
          background: t.headerBg,
          borderTop: `1px solid ${t.headerBorder}`,
          backdropFilter: 'blur(10px)',
        }}
      >
        <button
          onClick={handleStartGame}
          disabled={!isValid || !hasEnoughWerewolves}
          className={`flex items-center justify-center gap-2.5 ${isMobile ? 'py-3 px-6 w-full' : 'py-3.5 px-12'} rounded-xl transition-all hover:shadow-lg active:scale-95`}
          style={{
            background: isValid && hasEnoughWerewolves
              ? 'linear-gradient(135deg, #b8860b 0%, #d4a843 50%, #b8860b 100%)'
              : 'rgba(255,255,255,0.04)',
            color: isValid && hasEnoughWerewolves ? '#0a0e1a' : '#4a5568',
            fontFamily: '"Cinzel", serif',
            fontSize: '0.9rem',
            fontWeight: 700,
            boxShadow: isValid && hasEnoughWerewolves
              ? '0 4px 24px rgba(212,168,67,0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
              : 'none',
            cursor: isValid && hasEnoughWerewolves ? 'pointer' : 'not-allowed',
          }}
        >
          <Play size={18} />
          Lancer la Partie
        </button>
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        show={showBulkImport}
        bulkText={bulkText}
        setBulkText={setBulkText}
        onImport={handleBulkImport}
        onClose={() => setShowBulkImport(false)}
        t={t}
      />
      {/* Gallery Import Modal */}
      <ImportFromGalleryModal
        open={showGalleryImport}
        onImport={handleGalleryImport}
        onClose={() => setShowGalleryImport(false)}
        existingEntries={playerEntries}
        t={t}
      />

      {/* Role picker dropdown — rendered via portal to escape overflow:hidden */}
      {rolePickerForId !== null && rolePickerPos && createPortal(
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[9998]" onClick={closeRolePicker} />
          {/* Dropdown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[9999] rounded-xl overflow-hidden shadow-xl"
            style={{
              top: rolePickerPos.top,
              right: rolePickerPos.right,
              background: t.cardBg,
              border: `1px solid ${t.goldBorder}`,
              width: '200px',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {(() => {
              const entry = playerEntries.find((e) => e.id === rolePickerForId);
              if (!entry) return null;
              return (
                <>
                  {/* Clear option */}
                  {entry.assignedRole && (
                    <button
                      onClick={() => {
                        setPlayerEntries((prev: PlayerEntry[]) =>
                          prev.map((p) => (p.id === entry.id ? { ...p, assignedRole: undefined } : p))
                        );
                        closeRolePicker();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-red-500/10"
                      style={{ borderBottom: `1px solid ${t.cardBorder}` }}
                    >
                      <X size={12} style={{ color: '#ef4444' }} />
                      <span style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 600 }}>
                        Aleatoire
                      </span>
                    </button>
                  )}
                  {/* Role options */}
                  {ROLES.filter((r) => (state.roleConfig[r.id] || 0) > 0).map((role) => {
                    const remaining = roleAvailability[role.id] ?? 0;
                    const isCurrentRole = entry.assignedRole === role.id;
                    const disabled = remaining <= 0 && !isCurrentRole;
                    return (
                      <button
                        key={role.id}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setPlayerEntries((prev: PlayerEntry[]) =>
                            prev.map((p) => (p.id === entry.id ? { ...p, assignedRole: role.id } : p))
                          );
                          closeRolePicker();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                        style={{
                          borderBottom: `1px solid ${t.cardBorder}`,
                          opacity: disabled ? 0.35 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: isCurrentRole ? `${role.color}15` : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${role.color}12`; }}
                        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = isCurrentRole ? `${role.color}15` : 'transparent'; }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>{role.emoji}</span>
                        <span style={{ color: t.text, fontSize: '0.7rem', fontWeight: 500, flex: 1 }}>
                          {role.name}
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded-full"
                          style={{
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: disabled ? t.textDim : role.color,
                            background: disabled ? 'transparent' : `${role.color}15`,
                          }}
                        >
                          {isCurrentRole ? '✓' : remaining}
                        </span>
                      </button>
                    );
                  })}
                </>
              );
            })()}
          </motion.div>
        </>,
        document.body
      )}
    </div>
  );
});