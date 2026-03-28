import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Swords, Eye, Camera, ClipboardPaste, Copy, CheckCheck,
  UserPlus, Check, X, Sparkles, ChevronDown, RotateCcw, AlertTriangle,
  HeartPulse, Flag,
} from 'lucide-react';
import { type Player } from '../../../context/GameContext';
import { type GameState } from '../../../context/gameTypes';
import { ROLES, getRoleById } from '../../../data/roles';
import { type HeartbeatMap } from '../../../context/useRealtimeSync';
import { type GameThemeTokens } from '../../../context/gameTheme';
import { GMAvatar } from '../gm/GMAvatar';
import { getConnectionStatus } from '../gm/gmUtilFunctions';
import { type PlayerEntry, PLAYER_AVATARS } from './setupConstants';
import { GMGameSettingsAccordion } from '../gm/GMGameSettingsAccordion';

const MAX_PLAYERS = 60;

export function SetupMidGameView({
  gamePlayers,
  playerHeartbeats,
  isMobile,
  t,
  addPlayerMidGame,
  setPlayerEntries,
  onUploadAvatar,
  uploadingPlayerId,
  pasteTargetId,
  selectPasteTarget,
  state,
  updateState,
  onResetGame,
  onEndGame,
}: {
  gamePlayers: Player[];
  playerHeartbeats: HeartbeatMap;
  isMobile: boolean;
  t: GameThemeTokens;
  addPlayerMidGame: (name: string, roleId?: string) => void;
  setPlayerEntries: (entries: PlayerEntry[] | ((prev: PlayerEntry[]) => PlayerEntry[])) => void;
  onUploadAvatar: (file: File, playerId: number, isPreGame: boolean) => void;
  uploadingPlayerId: number | null;
  pasteTargetId: number | null;
  selectPasteTarget: (id: number, isPreGame: boolean) => void;
  state: GameState;
  updateState: (fn: (s: GameState) => GameState) => void;
  onResetGame?: () => void;
  onEndGame?: (winner: 'village' | 'werewolf' | 'lovers') => void;
}) {
  const [newMidGameName, setNewMidGameName] = useState('');
  const [showMidGameInput, setShowMidGameInput] = useState(false);
  const [midGameRole, setMidGameRole] = useState<string>('random');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<'village' | 'werewolf' | 'lovers' | null>(null);

  const midGameFormRef = useRef<HTMLDivElement>(null);

  // When the mid-game input form appears, scroll it into view after a short
  // delay so the mobile virtual keyboard has time to open first.
  useEffect(() => {
    if (!showMidGameInput) return;
    const timer = setTimeout(() => {
      midGameFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(timer);
  }, [showMidGameInput]);

  const copyCode = (code: string, id: number) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Code du joueur :', code);
    }
  };

  const handleAddMidGame = () => {
    const trimmed = newMidGameName.trim();
    if (!trimmed) return;
    addPlayerMidGame(trimmed, midGameRole === 'random' ? undefined : midGameRole);
    setPlayerEntries((prev) => [
      ...prev,
      {
        id: prev.length > 0 ? Math.max(...prev.map((p) => p.id)) + 1 : 0,
        name: trimmed,
        avatar: PLAYER_AVATARS[prev.length % PLAYER_AVATARS.length],
      },
    ]);
    setNewMidGameName('');
    setMidGameRole('random');
    setShowMidGameInput(false);
  };

  return (
    <div className={`h-full flex flex-col ${isMobile ? 'px-3 py-2' : 'px-6 py-4'}`}>
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {/* Status bar */}
        <div
          className="rounded-lg mb-3 overflow-hidden"
          style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }}
        >
          {/* Header — clickable */}
          <button
            type="button"
            onClick={() => setShowPlayerDropdown((v) => !v)}
            className="w-full p-3 flex items-center gap-2 cursor-pointer"
          >
            <Swords size={14} style={{ color: t.gold }} />
            <span style={{ color: t.gold, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
              Partie en cours — {gamePlayers.filter((p) => p.alive).length} vivants, {gamePlayers.filter((p) => !p.alive).length} morts
            </span>
            {(() => {
              const now = Date.now();
              const onlineCount = gamePlayers.filter((p) => {
                const hb = playerHeartbeats[p.shortCode || ''];
                return hb && (now - hb) < 20000;
              }).length;
              return (
                <span
                  className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{
                    background: onlineCount > 0 ? 'rgba(107,142,90,0.12)' : 'rgba(74,85,104,0.1)',
                    border: `1px solid ${onlineCount > 0 ? 'rgba(107,142,90,0.2)' : 'rgba(74,85,104,0.15)'}`,
                    fontSize: '0.6rem',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: onlineCount > 0 ? '#6b8e5a' : '#4a5568' }} />
                  <span style={{ color: onlineCount > 0 ? '#6b8e5a' : '#4a5568' }}>{onlineCount} en ligne</span>
                </span>
              );
            })()}
            <motion.span
              animate={{ rotate: showPlayerDropdown ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-1 flex items-center"
            >
              <ChevronDown size={14} style={{ color: t.gold }} />
            </motion.span>
          </button>

          {/* Dropdown player list */}
          {showPlayerDropdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="px-3 pb-3 pt-0"
                style={{ borderTop: `1px solid ${t.goldBorder}` }}
              >
                <div className={`mt-2 grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 xl:grid-cols-3'}`}>
                  {gamePlayers.map((player) => {
                    const role = getRoleById(player.role);
                    const connStatus = getConnectionStatus(player.shortCode, playerHeartbeats);
                    return (
                      <div
                        key={player.id}
                        className="rounded-xl p-3 flex items-center gap-3"
                        style={{
                          background: player.alive ? `rgba(${t.overlayChannel}, 0.02)` : `rgba(${t.overlayChannel}, 0.01)`,
                          border: `1px solid ${player.alive ? `rgba(${t.overlayChannel}, 0.06)` : `rgba(${t.overlayChannel}, 0.03)`}`,
                          opacity: player.alive ? 1 : 0.45,
                        }}
                      >
                        <div className="relative shrink-0 group/avatar" onClick={() => selectPasteTarget(player.id, false)}>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden transition-all"
                            style={{
                              background: player.alive ? `${role?.color || '#666'}12` : 'rgba(255,255,255,0.04)',
                              border: pasteTargetId === player.id ? '2px solid #d4a843' : `1px solid ${player.alive ? (role?.color || '#666') + '25' : 'rgba(255,255,255,0.06)'}`,
                              boxShadow: pasteTargetId === player.id ? '0 0 8px rgba(212,168,67,0.4)' : 'none',
                            }}
                          >
                            {uploadingPlayerId === player.id ? (
                              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <GMAvatar player={player} size="text-lg" />
                            )}
                          </div>
                          {/* Desktop hover overlay */}
                          <label className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer max-md:hidden" style={{ background: 'rgba(0,0,0,0.55)' }}>
                            <Camera size={14} style={{ color: '#d4a843' }} />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadAvatar(f, player.id, false); selectPasteTarget(player.id, false); } e.target.value = ''; }} />
                          </label>
                          {/* Mobile tap badge */}
                          <label
                            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer md:hidden"
                            style={{ background: 'rgba(212,168,67,0.9)', border: '2px solid #0a1020', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
                          >
                            <Camera size={9} style={{ color: '#0a1020' }} />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUploadAvatar(f, player.id, false); selectPasteTarget(player.id, false); } e.target.value = ''; }} />
                          </label>
                          {pasteTargetId === player.id && (
                            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded text-center flex items-center gap-1" style={{ background: 'rgba(212,168,67,0.2)', border: '1px solid rgba(212,168,67,0.3)', fontSize: '0.45rem', color: '#d4a843', zIndex: 10 }}>
                              <ClipboardPaste size={8} />
                              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}+V
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate" style={{ color: player.alive ? t.text : t.textDim, fontSize: '0.8rem' }}>{player.name}</span>
                            <span style={{ color: t.textDim, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', letterSpacing: '0.04em' }}>({player.shortCode})</span>
                            <span style={{ fontSize: '0.7rem' }}>{role?.emoji}</span>
                            {!player.alive && <span style={{ color: '#c41e3a', fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>MORT</span>}
                          </div>
                          <div className="flex items-center gap-1.5" style={{ marginTop: '0.1rem' }}>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: connStatus.bg, fontSize: '0.45rem' }}>
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: connStatus.color }} />
                              <span style={{ color: connStatus.color }}>{connStatus.label}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { sessionStorage.setItem('__gm_preview', '1'); window.location.href = `/player/${player.shortCode}`; }} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ background: t.goldBg, border: `1px solid ${t.goldBorder}` }} title="Voir comme ce joueur">
                            <Eye size={14} style={{ color: t.gold }} />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => copyCode(`${window.location.origin}/player/${player.shortCode}`, player.id)} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors" style={{ background: copiedId === player.id ? 'rgba(107,142,90,0.12)' : t.goldBg, border: `1px solid ${copiedId === player.id ? 'rgba(107,142,90,0.25)' : t.goldBorder}` }} title="Copier le lien du joueur">
                            {copiedId === player.id ? <CheckCheck size={14} style={{ color: '#6b8e5a' }} /> : <Copy size={14} style={{ color: t.gold }} />}
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Add player mid-game */}
        {gamePlayers.length < MAX_PLAYERS && (
          <>
            {showMidGameInput ? (
              <motion.div ref={midGameFormRef} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-4" style={{ background: 'rgba(212,168,67,0.04)', border: '1px solid rgba(212,168,67,0.15)' }}>
                <p style={{ color: '#d4a843', fontSize: '0.7rem', fontFamily: '"Cinzel", serif', marginBottom: '0.5rem' }}>Nouveau joueur (rejoint en cours de partie)</p>
                <div className="flex flex-col gap-2.5">
                  <input autoFocus value={newMidGameName} onChange={(e) => setNewMidGameName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddMidGame(); if (e.key === 'Escape') { setShowMidGameInput(false); setNewMidGameName(''); setMidGameRole('random'); } }} placeholder="Nom du joueur..." className="bg-transparent outline-none px-3 py-2 rounded-lg" style={{ color: t.text, fontSize: '0.8rem', border: `1px solid ${t.goldBorder}`, background: t.inputBg }} />
                  {/* Role selector */}
                  <div>
                    <p style={{ color: '#6b7b9b', fontSize: '0.55rem', marginBottom: '0.4rem' }}>Role attribue :</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setMidGameRole('random')}
                        className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                        style={{
                          background: midGameRole === 'random' ? 'rgba(212,168,67,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                          border: `1px solid ${midGameRole === 'random' ? 'rgba(212,168,67,0.4)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                          color: midGameRole === 'random' ? '#d4a843' : t.textMuted,
                          fontSize: '0.62rem', fontFamily: '"Cinzel", serif',
                        }}
                      >
                        <Sparkles size={10} /> Aleatoire
                      </button>
                      {ROLES.map((role) => {
                        const isSelected = midGameRole === role.id;
                        return (
                          <button
                            key={role.id}
                            onClick={() => setMidGameRole(role.id)}
                            className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                            style={{
                              background: isSelected ? `${role.color}18` : `rgba(${t.overlayChannel}, 0.04)`,
                              border: `1px solid ${isSelected ? role.color + '50' : `rgba(${t.overlayChannel}, 0.08)`}`,
                              color: isSelected ? role.color : t.textMuted,
                              fontSize: '0.62rem', fontFamily: '"Cinzel", serif',
                            }}
                          >
                            <span style={{ fontSize: '0.7rem' }}>{role.emoji}</span> {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddMidGame}
                      disabled={!newMidGameName.trim()}
                      className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                      style={{
                        background: newMidGameName.trim() ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${newMidGameName.trim() ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        color: newMidGameName.trim() ? '#d4a843' : '#4a5568',
                        fontFamily: '"Cinzel", serif',
                        fontSize: '0.7rem',
                        cursor: newMidGameName.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <Check size={14} /> Ajouter{midGameRole !== 'random' ? ` (${getRoleById(midGameRole)?.emoji || ''} ${getRoleById(midGameRole)?.name || ''})` : ''}
                    </button>
                    <button onClick={() => { setShowMidGameInput(false); setNewMidGameName(''); setMidGameRole('random'); }} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors shrink-0">
                      <X size={14} style={{ color: '#6b7b9b' }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowMidGameInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-colors"
                style={{
                  background: t.goldBg,
                  border: `1px dashed ${t.goldBorder}`,
                  color: t.gold,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                <UserPlus size={16} /> Ajouter un joueur en cours de partie
              </motion.button>
            )}
          </>
        )}

        {/* Game Settings — editable mid-game */}
        <GMGameSettingsAccordion
          state={state}
          updateState={updateState}
          t={t}
          className="mt-4"
        />

        {/* Debug: revive all players */}
        {(gamePlayers.some((p) => !p.alive) || (state.villagePresentIds && state.villagePresentIds.length < gamePlayers.filter((p) => p.alive).length)) && (
          <div className="mt-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                updateState((s) => ({
                  ...s,
                  players: s.players.map((p) => ({ ...p, alive: true })),
                  villagePresentIds: s.players.map((p) => p.id),
                }));
              }}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl transition-colors"
              style={{
                background: 'rgba(107,142,90,0.08)',
                border: '1px dashed rgba(107,142,90,0.25)',
                color: '#6b8e5a',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <HeartPulse size={15} />
              Remettre tout le monde en vie (debug)
            </motion.button>
          </div>
        )}

        {/* End game button */}
        {onEndGame && (
          <div className="mt-4 mb-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setSelectedWinner(null); setShowEndGameConfirm(true); }}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl transition-colors"
              style={{
                background: 'rgba(212,168,67,0.08)',
                border: '1px solid rgba(212,168,67,0.25)',
                color: '#d4a843',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Flag size={15} />
              Terminer la partie
            </motion.button>
          </div>
        )}

        {/* Reset game button */}
        {onResetGame && (
          <div className="mt-2 mb-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl transition-colors"
              style={{
                background: 'rgba(196,30,58,0.08)',
                border: '1px solid rgba(196,30,58,0.2)',
                color: '#c41e3a',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} />
              Reset la partie
            </motion.button>
          </div>
        )}
      </div>

      {/* Reset confirmation modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-[90%] max-w-sm rounded-2xl p-6"
              style={{
                background: 'linear-gradient(180deg, #1a1520 0%, #0f0e1e 100%)',
                border: '1px solid rgba(196,30,58,0.25)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(196,30,58,0.12)', border: '2px solid rgba(196,30,58,0.3)' }}
                >
                  <AlertTriangle size={18} style={{ color: '#c41e3a' }} />
                </div>
                <h3 style={{ fontFamily: '"Cinzel", serif', color: '#c41e3a', fontSize: '1rem', fontWeight: 700 }}>
                  Reset la partie
                </h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Cette action va reinitialiser la partie : tous les joueurs seront remis en vie, les roles redistribues, et la partie reprendra depuis la phase de configuration.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowResetConfirm(false);
                    onResetGame?.();
                  }}
                  className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, rgba(196,30,58,0.8), rgba(160,20,45,0.9))',
                    border: '1px solid rgba(196,30,58,0.5)',
                    color: '#fff',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(196,30,58,0.3)',
                  }}
                >
                  <RotateCcw size={13} />
                  Confirmer
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* End game confirmation modal */}
        {showEndGameConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowEndGameConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-[90%] max-w-sm rounded-2xl p-6"
              style={{
                background: 'linear-gradient(180deg, #1a1520 0%, #0f0e1e 100%)',
                border: '1px solid rgba(212,168,67,0.25)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(212,168,67,0.12)', border: '2px solid rgba(212,168,67,0.3)' }}
                >
                  <Flag size={18} style={{ color: '#d4a843' }} />
                </div>
                <h3 style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '1rem', fontWeight: 700 }}>
                  Terminer la partie
                </h3>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Quelle équipe remporte la victoire ?
              </p>

              {/* Winner selection */}
              <div className="flex flex-col gap-2 mb-5">
                {[
                  { value: 'village' as const, label: 'Le Village', emoji: '🏡' },
                  { value: 'werewolf' as const, label: 'Les Loups-Garous', emoji: '🐺' },
                  ...(state.loverPairs && state.loverPairs.length > 0
                    ? [{ value: 'lovers' as const, label: 'Les Amoureux', emoji: '💘' }]
                    : []),
                ].map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedWinner(value)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                    style={{
                      background: selectedWinner === value ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${selectedWinner === value ? 'rgba(212,168,67,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{emoji}</span>
                    <span style={{ fontFamily: '"Cinzel", serif', color: selectedWinner === value ? '#d4a843' : 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {label}
                    </span>
                    {selectedWinner === value && (
                      <Check size={14} style={{ color: '#d4a843', marginLeft: 'auto' }} />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndGameConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  disabled={!selectedWinner}
                  onClick={() => {
                    if (!selectedWinner) return;
                    setShowEndGameConfirm(false);
                    onEndGame?.(selectedWinner);
                  }}
                  className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: selectedWinner
                      ? 'linear-gradient(135deg, rgba(212,168,67,0.9), rgba(184,150,10,0.9))'
                      : 'rgba(212,168,67,0.15)',
                    border: `1px solid ${selectedWinner ? 'rgba(212,168,67,0.6)' : 'rgba(212,168,67,0.2)'}`,
                    color: selectedWinner ? '#0a0e1a' : 'rgba(212,168,67,0.4)',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: selectedWinner ? 'pointer' : 'not-allowed',
                    boxShadow: selectedWinner ? '0 4px 16px rgba(212,168,67,0.3)' : 'none',
                  }}
                >
                  <Flag size={13} />
                  Confirmer
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}