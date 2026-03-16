import React, { useState, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare, Plus, Edit3, Trash2, Send, Check, X,
  Eye, Lock, Lightbulb, Users, ChevronDown, ChevronUp, Search, CheckSquare, Square,
  ScrollText, BookOpen, Upload, FileText, AlertCircle,
  ImagePlus, Image as ImageIcon, Clock,
} from 'lucide-react';
import type { Player, Hint, PlayerHint, GameState } from '../context/GameContext';
import type { GameThemeTokens } from '../context/gameTheme';
import { sendPushNotifications } from '../context/useNotifications';
import { getRoleById } from '../data/roles';
import { projectId, publicAnonKey } from '../context/apiConfig';
import { resolveAvatarUrl } from '../data/avatarResolver';

/* ================================================================
   Standalone tap-safe button for unrevealed hints.
   Uses a native pointerup listener via ref to bypass React event
   delegation issues on mobile (touch→click translation, stopPropagation
   in swipe containers, etc.).
   ================================================================ */
function HintRevealButton({
  onPress,
  inModal,
}: {
  onPress: () => void;
  inModal: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      startRef.current = { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx < 12 && dy < 12) {
        e.stopPropagation();
        e.preventDefault();
        console.log('[HintRevealButton] tap detected via native pointerup');
        onPressRef.current();
      }
    };

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors hover:bg-white/[0.03] cursor-pointer select-none"
      style={{
        background: inModal ? 'rgba(139,90,43,0.12)' : 'rgba(245,158,11,0.06)',
        border: `1px solid ${inModal ? 'rgba(139,90,43,0.25)' : 'rgba(245,158,11,0.15)'}`,
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'rgba(245,158,11,0.15)',
      }}
    >
      <Lock size={14} style={{ color: inModal ? '#8b5a2b' : '#f59e0b' }} />
      <span style={{ color: inModal ? '#5c3a1e' : '#f59e0b', fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
        Reveler l'indice
      </span>
      <Eye size={12} style={{ color: inModal ? '#8b5a2b' : '#f59e0b', marginLeft: 'auto' }} />
    </div>
  );
}

/* ================================================================
   Shared helper: get a player's avatar
   ================================================================ */
function AvatarInline({ player, size = 'w-6 h-6' }: { player: Pick<Player, 'avatar' | 'avatarUrl' | 'name'>; size?: string }) {
  const resolvedUrl = resolveAvatarUrl(player.avatarUrl);
  if (resolvedUrl) {
    return <img src={resolvedUrl} alt={player.name} className={`${size} rounded-full object-cover inline-block`} />;
  }
  return <span className="text-sm">{player.avatar}</span>;
}

let hintIdCounter = 0;
export function nextHintId(existingHints: Hint[]): number {
  if (existingHints.length > 0) {
    const maxId = Math.max(...existingHints.map(h => h.id));
    if (maxId >= hintIdCounter) hintIdCounter = maxId;
  }
  return ++hintIdCounter;
}

/* ================================================================
   GM: Hint Management Panel
   ================================================================ */
export function GMHintPanel({
  state,
  onUpdateState,
  t,
  isMobile,
  externalPerPlayerTarget,
  onClearExternalTarget,
}: {
  state: GameState;
  onUpdateState: (updater: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  isMobile: boolean;
  externalPerPlayerTarget?: number | null;
  onClearExternalTarget?: () => void;
}) {
  const hints = (state.hints ?? []).filter((h) => !h.fromDynamic);
  const playerHints = state.playerHints ?? [];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [newText, setNewText] = useState('');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendHintId, setSendHintId] = useState<number | null>(null);
  const [sendPlayerIds, setSendPlayerIds] = useState<Set<number>>(new Set());
  const [sendPlayerSearch, setSendPlayerSearch] = useState('');
  const [perPlayerModalOpen, setPerPlayerModalOpen] = useState<number | null>(null);
  const [perPlayerSelectedHints, setPerPlayerSelectedHints] = useState<Set<number>>(new Set());
  const [perPlayerHintSearch, setPerPlayerHintSearch] = useState('');
  const [perPlayerNewHintText, setPerPlayerNewHintText] = useState('');

  // Image upload state
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  const hintImageInputRef = useRef<HTMLInputElement>(null);

  const handleHintImageUpload = async (file: File) => {
    setUploadingHintImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gameId', state.gameId || '');
      formData.append('password', 'loupgarou');
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-2c00868b/game/quest-image`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${publicAnonKey}` },
          body: formData,
        }
      );
      const data = await res.json();
      if (data.imageUrl) {
        const id = nextHintId(hints);
        onUpdateState((s) => ({
          ...s,
          hints: [...(s.hints ?? []), { id, text: '', imageUrl: data.imageUrl, createdAt: new Date().toISOString() }],
        }));
      } else {
        console.error('Hint image upload failed:', data.error);
      }
    } catch (err) {
      console.error('Hint image upload error:', err);
    } finally {
      setUploadingHintImage(false);
    }
  };

  // CSV import state (desktop only)
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<string[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvRemovedIndices, setCsvRemovedIndices] = useState<Set<number>>(new Set());

  const handleCsvFile = (file: File) => {
    setCsvError(null);
    setCsvRemovedIndices(new Set());
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setCsvError('Le fichier est vide.');
          setCsvPreview(null);
          return;
        }
        // Parse CSV: support one hint per line, or multiple columns per line
        // Strip BOM, split by newlines, then by common delimiters (;,\t)
        const raw = text.replace(/^\uFEFF/, '');
        const lines = raw.split(/\r?\n/);
        const parsed: string[] = [];
        for (const line of lines) {
          // Try splitting by semicolon, then comma, then tab
          // But only if the line contains a delimiter — otherwise treat entire line as one hint
          let cells: string[];
          if (line.includes(';')) {
            cells = line.split(';');
          } else if (line.includes('\t')) {
            cells = line.split('\t');
          } else {
            cells = [line];
          }
          for (const cell of cells) {
            // Remove surrounding quotes
            const cleaned = cell.replace(/^["']|["']$/g, '').trim();
            if (cleaned) parsed.push(cleaned);
          }
        }
        if (parsed.length === 0) {
          setCsvError('Aucun indice trouve dans le fichier.');
          setCsvPreview(null);
          return;
        }
        setCsvPreview(parsed);
      } catch {
        setCsvError('Erreur de lecture du fichier.');
        setCsvPreview(null);
      }
    };
    reader.onerror = () => {
      setCsvError('Erreur de lecture du fichier.');
      setCsvPreview(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const confirmCsvImport = () => {
    if (!csvPreview) return;
    const toImport = csvPreview.filter((_, i) => !csvRemovedIndices.has(i));
    if (toImport.length === 0) { setCsvPreview(null); return; }
    onUpdateState((s) => {
      const currentHints = s.hints ?? [];
      // Build IDs sequentially so each hint gets a unique ID
      const runningHints = [...currentHints];
      const builtHints: Hint[] = [];
      for (const text of toImport) {
        const id = nextHintId(runningHints);
        const h: Hint = { id, text, createdAt: new Date().toISOString() };
        builtHints.push(h);
        runningHints.push(h);
      }
      return { ...s, hints: [...currentHints, ...builtHints] };
    });
    setCsvPreview(null);
    setCsvRemovedIndices(new Set());
    // Reset file input so the same file can be re-selected
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  // Handle external per-player hint target (from sidebar button)
  useEffect(() => {
    if (externalPerPlayerTarget != null) {
      setPerPlayerModalOpen(externalPerPlayerTarget);
      setPerPlayerSelectedHints(new Set());
      setPerPlayerHintSearch('');
      setPerPlayerNewHintText('');
      onClearExternalTarget?.();
    }
  }, [externalPerPlayerTarget, onClearExternalTarget]);

  const addHint = () => {
    const raw = newText.trim();
    if (!raw) return;
    // Support bulk paste: split on ";" to create multiple hints at once
    const segments = raw.split(';').map(s => s.trim()).filter(Boolean);
    if (segments.length === 0) return;
    onUpdateState((s) => {
      const currentHints = s.hints ?? [];
      const runningHints = [...currentHints];
      const builtHints: Hint[] = [];
      for (const text of segments) {
        const id = nextHintId(runningHints);
        const h: Hint = { id, text, createdAt: new Date().toISOString() };
        builtHints.push(h);
        runningHints.push(h);
      }
      return { ...s, hints: [...currentHints, ...builtHints] };
    });
    setNewText('');
  };

  const saveEdit = (id: number) => {
    const text = editText.trim();
    const hint = hints.find(h => h.id === id);
    // Allow empty text if hint has an image
    if (!text && !hint?.imageUrl) return;
    onUpdateState((s) => ({
      ...s,
      hints: (s.hints ?? []).map(h => h.id === id ? { ...h, text } : h),
    }));
    setEditingId(null);
  };

  const deleteHint = (id: number) => {
    onUpdateState((s) => ({
      ...s,
      hints: (s.hints ?? []).filter(h => h.id !== id),
      playerHints: (s.playerHints ?? []).filter(ph => ph.hintId !== id),
    }));
  };

  const openSendModal = (hintId: number) => {
    setSendHintId(hintId);
    setSendPlayerIds(new Set());
    setSendPlayerSearch('');
    setSendModalOpen(true);
  };

  const confirmSend = () => {
    if (sendHintId === null || sendPlayerIds.size === 0) return;
    const now = new Date().toISOString();
    onUpdateState((s) => {
      const existing = s.playerHints ?? [];
      const newEntries: PlayerHint[] = [];
      sendPlayerIds.forEach(pid => {
        // Don't duplicate
        if (!existing.some(ph => ph.hintId === sendHintId && ph.playerId === pid)) {
          newEntries.push({ hintId: sendHintId!, playerId: pid, sentAt: now, revealed: false });
        }
      });
      return { ...s, playerHints: [...existing, ...newEntries] };
    });
    setSendModalOpen(false);
    // Send push notifications to selected players
    if (state.gameId) {
      const targetShortCodes = Array.from(sendPlayerIds)
        .map(pid => state.players.find(p => p.id === pid)?.shortCode)
        .filter(Boolean) as string[];
      if (targetShortCodes.length > 0) {
        sendPushNotifications(state.gameId, targetShortCodes, 'Loup-Garou', '\uD83D\uDC41\uFE0F Vous avez re\u00e7u un Indice.', 'new-hint');
      }
    }
  };

  const openPerPlayerModal = (playerId: number) => {
    setPerPlayerModalOpen(playerId);
    setPerPlayerSelectedHints(new Set());
    setPerPlayerHintSearch('');
    setPerPlayerNewHintText('');
  };

  const confirmPerPlayerSend = () => {
    if (perPlayerModalOpen === null || perPlayerSelectedHints.size === 0) return;
    const pid = perPlayerModalOpen;
    const now = new Date().toISOString();
    onUpdateState((s) => {
      const existing = s.playerHints ?? [];
      const newEntries: PlayerHint[] = [];
      perPlayerSelectedHints.forEach(hid => {
        if (!existing.some(ph => ph.hintId === hid && ph.playerId === pid)) {
          newEntries.push({ hintId: hid, playerId: pid, sentAt: now, revealed: false });
        }
      });
      return { ...s, playerHints: [...existing, ...newEntries] };
    });
    setPerPlayerModalOpen(null);
    // Send push notification to the player
    if (state.gameId) {
      const player = state.players.find(p => p.id === pid);
      if (player?.shortCode) {
        sendPushNotifications(state.gameId, [player.shortCode], 'Loup-Garou', '\uD83D\uDC41\uFE0F Vous avez re\u00e7u un Indice.', 'new-hint');
      }
    }
  };

  const alivePlayers = state.players.filter(p => p.alive);

  return (
    <div className="space-y-4">
      {/* Create new hint */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addHint(); }}
          placeholder="Nouvel indice... (séparer par ; pour plusieurs)"
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: t.inputBg,
            border: `1px solid ${t.inputBorder}`,
            color: t.inputText,
            fontSize: '0.75rem',
          }}
        />
        <button
          onClick={addHint}
          disabled={!newText.trim()}
          className="px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
          style={{
            background: newText.trim() ? 'rgba(245,158,11,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
            color: newText.trim() ? '#f59e0b' : t.textDim,
            fontSize: '0.7rem',
            border: `1px solid ${newText.trim() ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
          }}
        >
          <Plus size={12} />
          Creer
        </button>
        {/* Image hint upload button */}
        <label
          className="px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer hover:opacity-80 shrink-0"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            color: t.textSecondary,
            fontSize: '0.7rem',
            border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
            opacity: uploadingHintImage ? 0.5 : 1,
          }}
          title="Creer un indice image"
        >
          {uploadingHintImage ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Clock size={12} />
            </motion.div>
          ) : (
            <ImagePlus size={12} />
          )}
          {uploadingHintImage ? 'Upload...' : 'Image'}
          <input
            ref={hintImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingHintImage}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleHintImageUpload(file);
              e.target.value = '';
            }}
          />
        </label>
        {/* CSV import button — desktop only */}
        {!isMobile && (
          <>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvFile(file);
              }}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{
                background: `rgba(${t.overlayChannel}, 0.04)`,
                color: t.textSecondary,
                fontSize: '0.7rem',
                border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
              }}
              title="Importer des indices depuis un fichier CSV"
            >
              <Upload size={12} />
              Importer
            </button>
          </>
        )}
      </div>

      {/* Hint list */}
      {hints.length === 0 ? (
        <div className="text-center py-6" style={{ color: t.textDim, fontSize: '0.65rem' }}>
          Aucun indice cree.
        </div>
      ) : (
        <div className="space-y-2">
          {hints.map(hint => {
            const sentTo = playerHints.filter(ph => ph.hintId === hint.id);
            const isEditing = editingId === hint.id;
            return (
              <div
                key={hint.id}
                className="rounded-lg p-3"
                style={{
                  background: `rgba(${t.overlayChannel}, 0.03)`,
                  border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
                }}
              >
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(hint.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 px-2 py-1 rounded bg-transparent outline-none"
                      style={{ color: t.inputText, fontSize: '0.75rem', border: `1px solid ${t.goldBorder}` }}
                      autoFocus
                    />
                    <button onClick={() => saveEdit(hint.id)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5">
                      <Check size={11} style={{ color: '#6b8e5a' }} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5">
                      <X size={11} style={{ color: t.textMuted }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      {hint.imageUrl ? (
                        <ImageIcon size={12} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                      ) : (
                        <Lightbulb size={12} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                      )}
                      <div className="flex-1 flex flex-col gap-1.5">
                        {hint.text && (
                          <p style={{ color: t.text, fontSize: '0.75rem', lineHeight: 1.5 }}>
                            {hint.text}
                          </p>
                        )}
                        {hint.imageUrl && (
                          <img
                            src={hint.imageUrl}
                            alt="Indice image"
                            className="rounded-lg max-h-32 object-contain"
                            style={{ border: '1px solid rgba(245,158,11,0.15)' }}
                          />
                        )}
                        {!hint.text && !hint.imageUrl && (
                          <p style={{ color: t.textDim, fontSize: '0.7rem', fontStyle: 'italic' }}>(vide)</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingId(hint.id); setEditText(hint.text); }}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
                          title="Modifier"
                        >
                          <Edit3 size={10} style={{ color: t.textMuted }} />
                        </button>
                        <button
                          onClick={() => deleteHint(hint.id)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={10} style={{ color: '#c41e3a' }} />
                        </button>
                        <button
                          onClick={() => openSendModal(hint.id)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/5 transition-colors"
                          title="Envoyer"
                        >
                          <Send size={10} style={{ color: '#3b82f6' }} />
                        </button>
                      </div>
                    </div>
                    {sentTo.length > 0 && (() => {
                      const sentPlayerIds = new Set(sentTo.map(ph => ph.playerId));
                      const allAliveReceived = alivePlayers.length > 0 && alivePlayers.every(p => sentPlayerIds.has(p.id));
                      const goodPlayers = alivePlayers.filter(p => { const r = getRoleById(p.role); return r?.team === 'village'; });
                      const evilPlayers = alivePlayers.filter(p => { const r = getRoleById(p.role); return r?.team === 'werewolf' || r?.team === 'solo'; });
                      const allGoodReceived = goodPlayers.length > 0 && goodPlayers.every(p => sentPlayerIds.has(p.id));
                      const allEvilReceived = evilPlayers.length > 0 && evilPlayers.every(p => sentPlayerIds.has(p.id));

                      // Determine which individual tags to show (exclude grouped players)
                      const groupedIds = new Set<number>();
                      if (allAliveReceived) {
                        alivePlayers.forEach(p => groupedIds.add(p.id));
                      } else {
                        if (allGoodReceived) goodPlayers.forEach(p => groupedIds.add(p.id));
                        if (allEvilReceived) evilPlayers.forEach(p => groupedIds.add(p.id));
                      }
                      const individualEntries = sentTo.filter(ph => !groupedIds.has(ph.playerId));

                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {allAliveReceived ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                              style={{
                                background: 'rgba(59,130,246,0.1)',
                                border: '1px solid rgba(59,130,246,0.2)',
                                fontSize: '0.5rem',
                                color: '#3b82f6',
                              }}
                            >
                              <Users size={9} />
                              Tous les joueurs
                            </span>
                          ) : (
                            <>
                              {allGoodReceived && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(107,142,90,0.1)',
                                    border: '1px solid rgba(107,142,90,0.2)',
                                    fontSize: '0.5rem',
                                    color: '#6b8e5a',
                                  }}
                                >
                                  <Users size={9} />
                                  Village ({goodPlayers.length})
                                </span>
                              )}
                              {allEvilReceived && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(196,30,58,0.1)',
                                    border: '1px solid rgba(196,30,58,0.2)',
                                    fontSize: '0.5rem',
                                    color: '#c41e3a',
                                  }}
                                >
                                  <Users size={9} />
                                  Loups ({evilPlayers.length})
                                </span>
                              )}
                              {individualEntries.map(ph => {
                                const p = state.players.find(pl => pl.id === ph.playerId);
                                return p ? (
                                  <span
                                    key={ph.playerId}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: ph.revealed ? 'rgba(107,142,90,0.1)' : 'rgba(245,158,11,0.08)',
                                      border: `1px solid ${ph.revealed ? 'rgba(107,142,90,0.2)' : 'rgba(245,158,11,0.15)'}`,
                                      fontSize: '0.5rem',
                                      color: ph.revealed ? '#6b8e5a' : '#f59e0b',
                                    }}
                                  >
                                    <AvatarInline player={p} size="w-3 h-3" />
                                    {p.name}
                                    {ph.revealed ? <Eye size={8} /> : <Lock size={8} />}
                                  </span>
                                ) : null;
                              })}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Send Hint Modal (global) */}
      <AnimatePresence>
        {sendModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setSendModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-[90%] max-w-md rounded-2xl p-5"
              style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <Send size={16} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
                  Envoyer l'indice
                </h3>
              </div>
              {sendHintId !== null && (() => {
                const _sendHint = hints.find(h => h.id === sendHintId);
                return _sendHint ? (
                  <div
                    className="rounded-lg p-3 mb-4"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                  >
                    {_sendHint.text && (
                      <p style={{ color: t.text, fontSize: '0.75rem' }}>{_sendHint.text}</p>
                    )}
                    {_sendHint.imageUrl && (
                      <img src={_sendHint.imageUrl} alt="Indice" className="rounded-lg max-h-28 object-contain mt-1" />
                    )}
                  </div>
                ) : null;
              })()}
              <p style={{ color: t.textMuted, fontSize: '0.65rem', marginBottom: '0.5rem' }}>
                Selectionner les joueurs :
              </p>
              {(() => {
                const filteredPlayers = alivePlayers.filter(p => sendPlayerSearch === '' || p.name.toLowerCase().includes(sendPlayerSearch.toLowerCase()));
                const selectablePlayers = filteredPlayers.filter(p => !playerHints.some(ph => ph.hintId === sendHintId && ph.playerId === p.id));
                const allSelectableSelected = selectablePlayers.length > 0 && selectablePlayers.every(p => sendPlayerIds.has(p.id));
                const toggleSelectAll = () => {
                  if (allSelectableSelected) {
                    const next = new Set(sendPlayerIds);
                    selectablePlayers.forEach(p => next.delete(p.id));
                    setSendPlayerIds(next);
                  } else {
                    const next = new Set(sendPlayerIds);
                    selectablePlayers.forEach(p => next.add(p.id));
                    setSendPlayerIds(next);
                  }
                };
                // Team quick-select helpers
                const goodSelectablePlayers = selectablePlayers.filter(p => { const r = getRoleById(p.role); return r?.team === 'village'; });
                const evilSelectablePlayers = selectablePlayers.filter(p => { const r = getRoleById(p.role); return r?.team === 'werewolf' || r?.team === 'solo'; });
                const allGoodSelected = goodSelectablePlayers.length > 0 && goodSelectablePlayers.every(p => sendPlayerIds.has(p.id));
                const allEvilSelected = evilSelectablePlayers.length > 0 && evilSelectablePlayers.every(p => sendPlayerIds.has(p.id));
                const toggleTeam = (teamPlayers: typeof alivePlayers, allSelected: boolean) => {
                  const next = new Set(sendPlayerIds);
                  if (allSelected) {
                    teamPlayers.forEach(p => next.delete(p.id));
                  } else {
                    teamPlayers.forEach(p => next.add(p.id));
                  }
                  setSendPlayerIds(next);
                };
                return (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={sendPlayerSearch}
                          onChange={e => setSendPlayerSearch(e.target.value)}
                          placeholder="Rechercher un joueur..."
                          className="w-full px-3 py-2 pl-8 rounded-lg text-sm outline-none"
                          style={{
                            background: t.inputBg,
                            border: `1px solid ${t.inputBorder}`,
                            color: t.inputText,
                            fontSize: '0.75rem',
                          }}
                        />
                        <Search size={13} className="absolute top-2.5 left-2.5" style={{ color: t.textDim }} />
                      </div>
                      {selectablePlayers.length > 0 && (
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg shrink-0 transition-colors hover:bg-white/5"
                          style={{
                            background: allSelectableSelected ? 'rgba(59,130,246,0.1)' : `rgba(${t.overlayChannel}, 0.04)`,
                            border: `1px solid ${allSelectableSelected ? 'rgba(59,130,246,0.25)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                            color: allSelectableSelected ? '#3b82f6' : t.textMuted,
                            fontSize: '0.65rem',
                          }}
                        >
                          {allSelectableSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                          Tous
                        </button>
                      )}
                    </div>
                    {/* Team quick-select buttons */}
                    {(goodSelectablePlayers.length > 0 || evilSelectablePlayers.length > 0) && (
                      <div className="flex items-center gap-2 mb-2">
                        {goodSelectablePlayers.length > 0 && (
                          <button
                            onClick={() => toggleTeam(goodSelectablePlayers, allGoodSelected)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{
                              background: allGoodSelected ? 'rgba(107,142,90,0.12)' : `rgba(${t.overlayChannel}, 0.04)`,
                              border: `1px solid ${allGoodSelected ? 'rgba(107,142,90,0.25)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                              color: allGoodSelected ? '#6b8e5a' : t.textMuted,
                              fontSize: '0.6rem',
                            }}
                          >
                            {allGoodSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                            Village ({goodSelectablePlayers.length})
                          </button>
                        )}
                        {evilSelectablePlayers.length > 0 && (
                          <button
                            onClick={() => toggleTeam(evilSelectablePlayers, allEvilSelected)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{
                              background: allEvilSelected ? 'rgba(196,30,58,0.12)' : `rgba(${t.overlayChannel}, 0.04)`,
                              border: `1px solid ${allEvilSelected ? 'rgba(196,30,58,0.25)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                              color: allEvilSelected ? '#c41e3a' : t.textMuted,
                              fontSize: '0.6rem',
                            }}
                          >
                            {allEvilSelected ? <CheckSquare size={11} /> : <Square size={11} />}
                            Loups ({evilSelectablePlayers.length})
                          </button>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto mb-4">
                      {filteredPlayers.map(p => {
                        const selected = sendPlayerIds.has(p.id);
                        const alreadySent = playerHints.some(ph => ph.hintId === sendHintId && ph.playerId === p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (alreadySent) return;
                              const next = new Set(sendPlayerIds);
                              if (selected) next.delete(p.id); else next.add(p.id);
                              setSendPlayerIds(next);
                            }}
                            className="flex items-center gap-2 p-2 rounded-lg transition-colors text-left"
                            style={{
                              background: alreadySent ? 'rgba(107,142,90,0.06)' : selected ? 'rgba(59,130,246,0.1)' : `rgba(${t.overlayChannel}, 0.03)`,
                              border: `1px solid ${alreadySent ? 'rgba(107,142,90,0.15)' : selected ? 'rgba(59,130,246,0.3)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                              opacity: alreadySent ? 0.5 : 1,
                            }}
                          >
                            <AvatarInline player={p} />
                            <span style={{ color: t.text, fontSize: '0.7rem' }} className="truncate">{p.name}</span>
                            {alreadySent && <Check size={10} style={{ color: '#6b8e5a' }} className="ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
              <div className="flex gap-2">
                <button
                  onClick={() => setSendModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl"
                  style={{ background: `rgba(${t.overlayChannel}, 0.04)`, color: t.textMuted, fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}
                >
                  Annuler
                </button>
                <button
                  onClick={confirmSend}
                  disabled={sendPlayerIds.size === 0}
                  className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    background: sendPlayerIds.size > 0 ? 'rgba(59,130,246,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                    color: sendPlayerIds.size > 0 ? '#3b82f6' : t.textDim,
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                    border: `1px solid ${sendPlayerIds.size > 0 ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  }}
                >
                  <Send size={12} />
                  Envoyer ({sendPlayerIds.size})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Per-player hint modal */}
      <AnimatePresence>
        {perPlayerModalOpen !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setPerPlayerModalOpen(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-[90%] max-w-md rounded-2xl p-5"
              style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}` }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const player = state.players.find(p => p.id === perPlayerModalOpen);
                return (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Send size={16} style={{ color: '#3b82f6' }} />
                      <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
                        Indice pour {player?.name}
                      </h3>
                    </div>

                    {/* Inline create new hint */}
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={perPlayerNewHintText}
                        onChange={e => setPerPlayerNewHintText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && perPlayerNewHintText.trim()) {
                            const text = perPlayerNewHintText.trim();
                            const newId = nextHintId(hints);
                            onUpdateState((s) => ({
                              ...s,
                              hints: [...(s.hints ?? []), { id: newId, text, createdAt: new Date().toISOString() }],
                            }));
                            setPerPlayerSelectedHints(prev => new Set([...prev, newId]));
                            setPerPlayerNewHintText('');
                          }
                        }}
                        placeholder="Creer un nouvel indice..."
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{
                          background: t.inputBg,
                          border: `1px solid ${t.inputBorder}`,
                          color: t.inputText,
                          fontSize: '0.7rem',
                        }}
                      />
                      <button
                        onClick={() => {
                          const text = perPlayerNewHintText.trim();
                          if (!text) return;
                          const newId = nextHintId(hints);
                          onUpdateState((s) => ({
                            ...s,
                            hints: [...(s.hints ?? []), { id: newId, text, createdAt: new Date().toISOString() }],
                          }));
                          setPerPlayerSelectedHints(prev => new Set([...prev, newId]));
                          setPerPlayerNewHintText('');
                        }}
                        disabled={!perPlayerNewHintText.trim()}
                        className="px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                        style={{
                          background: perPlayerNewHintText.trim() ? 'rgba(245,158,11,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                          color: perPlayerNewHintText.trim() ? '#f59e0b' : t.textDim,
                          fontSize: '0.65rem',
                          border: `1px solid ${perPlayerNewHintText.trim() ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                        }}
                      >
                        <Plus size={11} />
                        Creer
                      </button>
                    </div>

                    {hints.length === 0 ? (
                      <p style={{ color: t.textDim, fontSize: '0.7rem', textAlign: 'center', padding: '2rem 0' }}>
                        Aucun indice cree. Creez-en dans le panneau Indices.
                      </p>
                    ) : (
                      (() => {
                        const filteredHints = hints.filter(h => perPlayerHintSearch === '' || (h.text || '').toLowerCase().includes(perPlayerHintSearch.toLowerCase()) || (h.imageUrl && 'image'.includes(perPlayerHintSearch.toLowerCase())));
                        const selectableHints = filteredHints.filter(h => !playerHints.some(ph => ph.hintId === h.id && ph.playerId === perPlayerModalOpen));
                        const allSelectableSelected = selectableHints.length > 0 && selectableHints.every(h => perPlayerSelectedHints.has(h.id));
                        const toggleSelectAllHints = () => {
                          if (allSelectableSelected) {
                            const next = new Set(perPlayerSelectedHints);
                            selectableHints.forEach(h => next.delete(h.id));
                            setPerPlayerSelectedHints(next);
                          } else {
                            const next = new Set(perPlayerSelectedHints);
                            selectableHints.forEach(h => next.add(h.id));
                            setPerPlayerSelectedHints(next);
                          }
                        };
                        return (
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={perPlayerHintSearch}
                                  onChange={e => setPerPlayerHintSearch(e.target.value)}
                                  placeholder="Rechercher un indice..."
                                  className="w-full px-3 py-2 pl-8 rounded-lg text-sm outline-none"
                                  style={{
                                    background: t.inputBg,
                                    border: `1px solid ${t.inputBorder}`,
                                    color: t.inputText,
                                    fontSize: '0.75rem',
                                  }}
                                />
                                <Search size={13} className="absolute top-2.5 left-2.5" style={{ color: t.textDim }} />
                              </div>
                              {selectableHints.length > 0 && (
                                <button
                                  onClick={toggleSelectAllHints}
                                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg shrink-0 transition-colors hover:bg-white/5"
                                  style={{
                                    background: allSelectableSelected ? 'rgba(245,158,11,0.1)' : `rgba(${t.overlayChannel}, 0.04)`,
                                    border: `1px solid ${allSelectableSelected ? 'rgba(245,158,11,0.25)' : `rgba(${t.overlayChannel}, 0.08)`}`,
                                    color: allSelectableSelected ? '#f59e0b' : t.textMuted,
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  {allSelectableSelected ? <CheckSquare size={12} /> : <Square size={12} />}
                                  Tous
                                </button>
                              )}
                            </div>
                            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                              {filteredHints.map(hint => {
                                const selected = perPlayerSelectedHints.has(hint.id);
                                const alreadySent = playerHints.some(ph => ph.hintId === hint.id && ph.playerId === perPlayerModalOpen);
                                return (
                                  <button
                                    key={hint.id}
                                    onClick={() => {
                                      if (alreadySent) return;
                                      const next = new Set(perPlayerSelectedHints);
                                      if (selected) next.delete(hint.id); else next.add(hint.id);
                                      setPerPlayerSelectedHints(next);
                                    }}
                                    className="w-full flex items-start gap-2 p-3 rounded-lg text-left transition-colors"
                                    style={{
                                      background: alreadySent ? 'rgba(107,142,90,0.06)' : selected ? 'rgba(245,158,11,0.1)' : `rgba(${t.overlayChannel}, 0.03)`,
                                      border: `1px solid ${alreadySent ? 'rgba(107,142,90,0.15)' : selected ? 'rgba(245,158,11,0.3)' : `rgba(${t.overlayChannel}, 0.06)`}`,
                                      opacity: alreadySent ? 0.5 : 1,
                                    }}
                                  >
                                    {hint.imageUrl ? (
                                      <ImageIcon size={12} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                                    ) : (
                                      <Lightbulb size={12} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                                    )}
                                    <div className="flex-1 flex flex-col gap-1">
                                      {hint.text && <span style={{ color: t.text, fontSize: '0.7rem', lineHeight: 1.5 }}>{hint.text}</span>}
                                      {hint.imageUrl && <img src={hint.imageUrl} alt="Indice" className="rounded max-h-16 object-contain" />}
                                    </div>
                                    {alreadySent && <Check size={10} style={{ color: '#6b8e5a' }} className="ml-auto mt-0.5 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPerPlayerModalOpen(null)}
                        className="flex-1 py-2.5 rounded-xl"
                        style={{ background: `rgba(${t.overlayChannel}, 0.04)`, color: t.textMuted, fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={confirmPerPlayerSend}
                        disabled={perPlayerSelectedHints.size === 0}
                        className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                        style={{
                          background: perPlayerSelectedHints.size > 0 ? 'rgba(245,158,11,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                          color: perPlayerSelectedHints.size > 0 ? '#f59e0b' : t.textDim,
                          fontSize: '0.75rem',
                          fontFamily: '"Cinzel", serif',
                          border: `1px solid ${perPlayerSelectedHints.size > 0 ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                        }}
                      >
                        <Send size={12} />
                        Envoyer ({perPlayerSelectedHints.size})
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSV Import Preview Modal (desktop only) */}
      <AnimatePresence>
        {(csvPreview !== null || csvError !== null) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => { setCsvPreview(null); setCsvError(null); setCsvRemovedIndices(new Set()); if (csvInputRef.current) csvInputRef.current.value = ''; }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-[90%] max-w-lg rounded-2xl p-5"
              style={{ background: t.modalBg, border: `1px solid ${t.modalBorder}` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText size={16} style={{ color: '#f59e0b' }} />
                <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
                  Importer des indices
                </h3>
              </div>

              {csvError ? (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <AlertCircle size={16} style={{ color: '#c41e3a' }} />
                  <p style={{ color: '#c41e3a', fontSize: '0.8rem' }}>{csvError}</p>
                </div>
              ) : csvPreview ? (
                <>
                  <p style={{ color: t.textMuted, fontSize: '0.65rem', marginBottom: '0.75rem' }}>
                    {csvPreview.length - csvRemovedIndices.size} indice{csvPreview.length - csvRemovedIndices.size !== 1 ? 's' : ''} a importer.
                    Cliquez sur <X size={9} className="inline" /> pour retirer un indice.
                  </p>
                  <div
                    className="space-y-1.5 max-h-[45vh] overflow-y-auto mb-4 pr-1"
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {csvPreview.map((text, i) => {
                      const removed = csvRemovedIndices.has(i);
                      return (
                        <motion.div
                          key={i}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: removed ? 0.35 : 1, y: 0 }}
                          transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.3) }}
                          className="flex items-start gap-2 p-2.5 rounded-lg group"
                          style={{
                            background: removed ? `rgba(${t.overlayChannel}, 0.02)` : `rgba(${t.overlayChannel}, 0.04)`,
                            border: `1px solid rgba(${t.overlayChannel}, ${removed ? '0.04' : '0.08'})`,
                            textDecoration: removed ? 'line-through' : 'none',
                          }}
                        >
                          <span
                            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                            style={{
                              background: 'rgba(245,158,11,0.1)',
                              color: '#f59e0b',
                              fontSize: '0.5rem',
                              fontWeight: 600,
                            }}
                          >
                            {i + 1}
                          </span>
                          <p className="flex-1 min-w-0" style={{ color: removed ? t.textDim : t.text, fontSize: '0.72rem', lineHeight: 1.5 }}>
                            {text}
                          </p>
                          <button
                            onClick={() => {
                              const next = new Set(csvRemovedIndices);
                              if (removed) next.delete(i); else next.add(i);
                              setCsvRemovedIndices(next);
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                            title={removed ? 'Restaurer' : 'Retirer'}
                          >
                            {removed ? (
                              <Plus size={10} style={{ color: '#6b8e5a' }} />
                            ) : (
                              <X size={10} style={{ color: '#c41e3a' }} />
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={() => { setCsvPreview(null); setCsvError(null); setCsvRemovedIndices(new Set()); if (csvInputRef.current) csvInputRef.current.value = ''; }}
                  className="flex-1 py-2.5 rounded-xl"
                  style={{ background: `rgba(${t.overlayChannel}, 0.04)`, color: t.textMuted, fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}
                >
                  {csvError ? 'Fermer' : 'Annuler'}
                </button>
                {csvPreview && !csvError && (
                  <button
                    onClick={confirmCsvImport}
                    disabled={csvPreview.length - csvRemovedIndices.size === 0}
                    className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2"
                    style={{
                      background: (csvPreview.length - csvRemovedIndices.size) > 0 ? 'rgba(245,158,11,0.15)' : `rgba(${t.overlayChannel}, 0.04)`,
                      color: (csvPreview.length - csvRemovedIndices.size) > 0 ? '#f59e0b' : t.textDim,
                      fontSize: '0.75rem',
                      fontFamily: '"Cinzel", serif',
                      border: `1px solid ${(csvPreview.length - csvRemovedIndices.size) > 0 ? 'rgba(245,158,11,0.3)' : 'transparent'}`,
                    }}
                  >
                    <Upload size={12} />
                    Importer ({csvPreview.length - csvRemovedIndices.size})
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================
   GM: Per-player "Send Hint" button
   ================================================================ */
export function GMSendHintButton({
  playerId,
  t,
  onClick,
}: {
  playerId: number;
  t: GameThemeTokens;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/5 opacity-50 hover:opacity-100 transition-all"
      title="Envoyer un indice"
    >
      <Lightbulb size={12} style={{ color: '#f59e0b' }} />
    </button>
  );
}

/* ================================================================
   Player: Hint Section (used in GamePanel day/night + QuestsPanel)
   ================================================================ */
export function PlayerHintSection({
  hints,
  playerHints,
  playerId,
  t,
  onReveal,
  compact = false,
  variant = 'game',
}: {
  hints: Hint[];
  playerHints: PlayerHint[];
  playerId: number;
  t: GameThemeTokens;
  onReveal: (hintId: number) => void;
  compact?: boolean;
  variant?: 'game' | 'journal';
}) {
  // Only keep playerHints whose hintId actually exists in the hints array.
  // This guards against stale playerHints referencing deleted/not-yet-loaded hints.
  const hintIdSet = new Set(hints.map(h => h.id));
  const myHints = playerHints.filter(ph => ph.playerId === playerId && hintIdSet.has(ph.hintId));
  const [revealModalHintId, setRevealModalHintId] = useState<number | null>(null);
  const [allHintsModalOpen, setAllHintsModalOpen] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  // Optimistic local set: hints revealed this session (before server sync)
  const [localRevealedIds, setLocalRevealedIds] = useState<Set<number>>(() => new Set());

  const isJournalDay = variant === 'journal' && t.isDay;

  if (myHints.length === 0) return null;

  // Sort by sentAt descending to get most recent first
  const sortedHints = [...myHints].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  const mostRecent = sortedHints[0];
  const hasMultiple = myHints.length > 1;
  const unrevealed = myHints.filter(ph => !ph.revealed && !localRevealedIds.has(ph.hintId));

  // ── Game variant: single compact button (no preview) ──
  const handleGameButtonClick = () => {
    if (unrevealed.length > 0) {
      const firstUnrevealed = unrevealed[0];
      onReveal(firstUnrevealed.hintId);
      setLocalRevealedIds(prev => new Set(prev).add(firstUnrevealed.hintId));
      setRevealModalHintId(firstUnrevealed.hintId);
    } else {
      setAllHintsModalOpen(true);
    }
  };

  const hasNewHint = unrevealed.length > 0;
  const gameButtonLabel = hasNewHint
    ? (unrevealed.length > 1 ? 'Nouveaux indices' : 'Nouvel indice')
    : (myHints.length === 1 ? "Voir l'indice" : `Voir les indices (${myHints.length})`);

  // Render a single hint entry (used in both inline + modal)
  const renderHintEntry = (ph: PlayerHint, inModal = false) => {
    if (!ph.revealed && !localRevealedIds.has(ph.hintId)) {
      return (
        <HintRevealButton
          key={`${ph.hintId}-unrevealed`}
          onPress={() => {
            console.log('[PlayerHintSection] revealing hint and opening modal', ph.hintId);
            onReveal(ph.hintId);
            setLocalRevealedIds(prev => new Set(prev).add(ph.hintId));
            setRevealModalHintId(ph.hintId);
          }}
          inModal={inModal}
        />
      );
    }
    const hint = hints.find(h => h.id === ph.hintId);
    if (!hint) return null;
    return (
      <div
        key={`${ph.hintId}-revealed`}
        className="flex items-start gap-2 p-2.5 rounded-[12.5px]"
        style={{
          background: inModal ? 'rgba(139,90,43,0.08)' : isJournalDay ? 'rgba(160,120,8,0.06)' : 'rgba(255,255,255,0.05)',
          border: `0.6px solid ${inModal ? 'rgba(139,90,43,0.18)' : isJournalDay ? t.goldBorder : '#685844'}`,
        }}
      >
        {hint.imageUrl ? (
          <ImageIcon size={12} className="mt-0.5 shrink-0" style={{ color: inModal ? '#8b5a2b' : isJournalDay ? t.gold : '#f59e0b' }} />
        ) : (
          <Lightbulb size={12} className="mt-0.5 shrink-0" style={{ color: inModal ? '#8b5a2b' : isJournalDay ? t.gold : '#f59e0b' }} />
        )}
        <div className="flex-1 flex flex-col gap-1.5">
          {hint.text && (
            <p style={{ color: inModal ? '#3d2b1f' : isJournalDay ? t.text : '#ffffff', fontSize: '0.85rem', lineHeight: 1.5, fontFamily: inModal ? '"IM Fell English", "Cinzel", serif' : undefined }}>
              {hint.text}
            </p>
          )}
          {hint.imageUrl && (
            <img
              src={hint.imageUrl}
              alt="Indice"
              className="rounded-lg max-h-40 object-contain cursor-pointer active:opacity-80 transition-opacity"
              style={{ border: `1px solid ${inModal ? 'rgba(139,90,43,0.15)' : 'rgba(245,158,11,0.15)'}` }}
              onClick={(e) => { e.stopPropagation(); setFullscreenImageUrl(hint.imageUrl!); }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {variant === 'game' ? (
        /* ── Game view: compact button only, no preview ── */
        <button
          onClick={handleGameButtonClick}
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[20px] transition-all active:scale-[0.97]"
          style={{
            background: hasNewHint
              ? 'linear-gradient(135deg, rgba(212,165,74,0.18) 0%, rgba(180,130,50,0.12) 100%)'
              : 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: hasNewHint
              ? '0.6px solid rgba(212,165,74,0.5)'
              : '0.6px solid rgba(164,136,103,0.45)',
            boxShadow: hasNewHint
              ? '0 0 16px rgba(212,165,74,0.15), inset 0 1px 0 rgba(222,195,150,0.15)'
              : '0 0 12px rgba(139,90,43,0.1), inset 0 1px 0 rgba(222,195,150,0.08)',
          }}
        >
          <span className="relative inline-flex">
            <Lightbulb size={16} style={{ color: '#d4a54a', filter: hasNewHint ? 'drop-shadow(0 0 6px rgba(212,165,74,0.6))' : 'drop-shadow(0 0 3px rgba(212,165,74,0.35))' }} />
            {hasNewHint && (
              <span
                className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ background: '#dc2626', border: '1.5px solid #ef4444', boxShadow: '0 0 6px rgba(220,38,38,0.6)' }}
              />
            )}
          </span>
          <span style={{
            fontFamily: '"Cinzel", serif',
            color: hasNewHint ? '#e8c560' : '#d4a843',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            textShadow: hasNewHint ? '0 0 8px rgba(212,165,74,0.3)' : 'none',
          }}>
            {gameButtonLabel}
          </span>
          {hasNewHint && unrevealed.length > 1 && (
            <span
              className="px-1.5 py-0.5 rounded-full"
              style={{
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '0.5rem',
                fontWeight: 600,
                border: '1px solid #ef4444',
                boxShadow: '0 0 6px rgba(220,38,38,0.4)',
              }}
            >
              {unrevealed.length}
            </span>
          )}
        </button>
      ) : (
        /* ── Journal view: full card with preview ── */
        <div
          className={`rounded-[20px] relative ${compact ? 'px-4 pb-1 pt-2' : 'px-4 pb-1 pt-2'}`}
          style={{
            background: isJournalDay ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: isJournalDay ? '0.6px solid rgba(180,140,50,0.2)' : '0.6px solid rgba(164,136,103,0.45)',
            boxShadow: isJournalDay
              ? '0 0 12px rgba(160,120,8,0.06), inset 0 1px 0 rgba(255,255,255,0.5)'
              : '0 0 12px rgba(139,90,43,0.1), inset 0 1px 0 rgba(222,195,150,0.08)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <span className="relative inline-flex">
              <Lightbulb size={compact ? 14 : 15} style={{ color: isJournalDay ? t.gold : '#d4a54a', filter: isJournalDay ? 'none' : 'drop-shadow(0 0 3px rgba(212,165,74,0.35))' }} />
              {unrevealed.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 border border-red-400" style={{ boxShadow: '0 0 4px rgba(239,68,68,0.5)' }} />
              )}
            </span>
            <span style={{ fontFamily: '"Cinzel", serif', color: isJournalDay ? t.gold : '#d4a843', fontSize: compact ? '0.8rem' : '1rem', fontWeight: 700, letterSpacing: '0.03em' }}>
              Indices
            </span>
            {unrevealed.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full ml-auto"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '0.5rem',
                  fontWeight: 600,
                  border: '1px solid #ef4444',
                  boxShadow: '0 0 6px rgba(220,38,38,0.4)',
                }}
              >
                {unrevealed.length} nouveau{unrevealed.length > 1 ? 'x' : ''}
              </span>
            )}
          </div>

          {/* Most recent hint only */}
          <div className="mb-3">
            {renderHintEntry(mostRecent)}
          </div>

          {/* "See all hints" button */}
          {hasMultiple && (
            <button
              onClick={() => setAllHintsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[12.5px] mb-3 transition-colors active:opacity-80"
              style={{
                background: isJournalDay ? 'rgba(160,120,8,0.06)' : 'rgba(255,255,255,0.05)',
                border: isJournalDay ? `0.6px solid ${t.goldBorder}` : '0.6px solid #685844',
                color: isJournalDay ? t.gold : '#d4a843',
                fontSize: compact ? '0.7rem' : '0.8rem',
                fontWeight: 700,
                fontFamily: '"Cinzel", serif',
              }}
            >
              <ScrollText size={13} />
              Voir tous les indices ({myHints.length})
            </button>
          )}
        </div>
      )}

      {/* All Hints Manuscript Modal */}
      {createPortal(
        <AnimatePresence>
          {allHintsModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[75] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
              onClick={() => setAllHintsModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                className="w-[92%] max-w-md max-h-[85vh] rounded-2xl overflow-hidden relative flex flex-col"
                style={{
                  background: 'linear-gradient(170deg, #f5e6c8 0%, #e8d5a8 25%, #f0dbb8 50%, #e5cea0 75%, #f2dfc0 100%)',
                  border: '2px solid #c4a06a',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(139,90,43,0.2)',
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Parchment edge texture overlay */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 20% 0%, rgba(139,90,43,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(139,90,43,0.08) 0%, transparent 60%)',
                  }}
                />
                {/* Aged stain effect */}
                <div
                  className="absolute top-8 right-6 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(139,90,43,0.04) 0%, transparent 70%)' }}
                />
                <div
                  className="absolute bottom-12 left-4 w-16 h-16 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(139,90,43,0.05) 0%, transparent 70%)' }}
                />

                {/* Header with decorative rule */}
                <div className="relative px-6 pt-6 pb-3 shrink-0">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, #8b5a2b, transparent)' }} />
                    <ScrollText size={22} style={{ color: '#6b4226' }} />
                    <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, #8b5a2b, transparent)' }} />
                  </div>
                  <h3
                    className="text-center"
                    style={{
                      fontFamily: '"Cinzel Decorative", "Cinzel", serif',
                      color: '#3d2b1f',
                      fontSize: '1rem',
                      letterSpacing: '0.08em',
                      textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    Manuscrit des Indices
                  </h3>
                  <p
                    className="text-center mt-1"
                    style={{
                      fontFamily: '"IM Fell English", "Cinzel", serif',
                      color: '#7a5c3a',
                      fontSize: '0.6rem',
                      fontStyle: 'italic',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {myHints.length} indice{myHints.length > 1 ? 's' : ''} du Maitre du Jeu
                  </p>
                  <div className="mt-2 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(139,90,43,0.3), transparent)' }} />
                </div>

                {/* Hint list */}
                <div className="relative px-6 pb-2 overflow-y-auto min-h-0 flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4a06a #e8d5a8', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                  <div className="space-y-3">
                    {sortedHints.map((ph, index) => (
                      <motion.div
                        key={`${ph.hintId}-all`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                      >
                        {/* Index number */}
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: 'rgba(139,90,43,0.12)',
                              border: '1px solid rgba(139,90,43,0.25)',
                              fontSize: '0.5rem',
                              fontFamily: '"Cinzel", serif',
                              color: '#6b4226',
                            }}
                          >
                            {myHints.length - index}
                          </span>
                          <span style={{ fontSize: '0.5rem', color: '#9a7b5a', fontStyle: 'italic', fontFamily: '"IM Fell English", serif' }}>
                            {new Date(ph.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {index === 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded-full ml-auto"
                              style={{
                                background: 'rgba(139,90,43,0.12)',
                                border: '1px solid rgba(139,90,43,0.2)',
                                fontSize: '0.45rem',
                                color: '#6b4226',
                                fontFamily: '"Cinzel", serif',
                              }}
                            >
                              Plus recent
                            </span>
                          )}
                        </div>
                        {renderHintEntry(ph, true)}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Footer with close */}
                <div className="relative px-6 pt-2 pb-5 shrink-0">
                  <div className="mb-3 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(139,90,43,0.3), transparent)' }} />
                  <button
                    onClick={() => setAllHintsModalOpen(false)}
                    className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    style={{
                      background: 'rgba(139,90,43,0.1)',
                      border: '1px solid rgba(139,90,43,0.25)',
                      color: '#5c3a1e',
                      fontSize: '0.75rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    <X size={13} />
                    Fermer le manuscrit
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Reveal Modal */}
      {createPortal(
        <AnimatePresence>
          {revealModalHintId !== null && (
            <HintRevealModal
              hint={hints.find(h => h.id === revealModalHintId) ?? null}
              t={t}
              onClose={() => setRevealModalHintId(null)}
              onImageEnlarge={(url) => setFullscreenImageUrl(url)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Fullscreen Image Lightbox */}
      {createPortal(
        <AnimatePresence>
          {fullscreenImageUrl !== null && (
            <motion.div
              key="fullscreen-hint-image-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[95] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
              onClick={() => setFullscreenImageUrl(null)}
            >
              <button
                onClick={() => setFullscreenImageUrl(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform z-10"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <X size={18} style={{ color: '#fff' }} />
              </button>
              <motion.img
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                src={fullscreenImageUrl}
                alt=""
                className="max-w-full max-h-full rounded-xl object-contain"
                onClick={(e) => e.stopPropagation()}
                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

/* ================================================================
   Player: Hint Reveal Modal
   ================================================================ */
function HintRevealModal({
  hint,
  t,
  onClose,
  onImageEnlarge,
}: {
  hint: Hint | null;
  t: GameThemeTokens;
  onClose: () => void;
  onImageEnlarge?: (url: string) => void;
}) {
  // Ghost-click protection: ignore backdrop clicks/taps for the first 500ms after mount.
  const mountedAt = useRef(Date.now());

  // Auto-close if hint is null (deleted or not yet loaded)
  useEffect(() => {
    if (!hint) {
      console.warn('[HintRevealModal] hint is null — auto-closing modal');
      onClose();
    }
  }, [hint, onClose]);

  if (!hint) {
    return null;
  }

  const handleBackdropClose = () => {
    const elapsed = Date.now() - mountedAt.current;
    console.log('[HintRevealModal] backdrop interaction, elapsed:', elapsed);
    if (elapsed > 500) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={handleBackdropClose}
      onPointerUp={(e) => {
        if (e.target === e.currentTarget) {
          const elapsed = Date.now() - mountedAt.current;
          if (elapsed <= 500) {
            e.stopPropagation();
            e.preventDefault();
          }
        }
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateX: -15 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-[85%] max-w-sm rounded-2xl overflow-hidden"
        style={{ background: t.modalBg, border: '2px solid rgba(245,158,11,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.15)' }}
        />

        <div className="relative p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
          >
            <Lightbulb size={40} style={{ color: '#f59e0b', margin: '0 auto' }} />
          </motion.div>
          <h3 style={{ fontFamily: '"Cinzel", serif', color: '#f59e0b', fontSize: '1rem', marginTop: '1rem' }}>
            Indice revele !
          </h3>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-4 rounded-xl p-4"
            style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
          >
            {hint.text && (
              <p style={{ color: t.text, fontSize: '0.85rem', lineHeight: 1.6 }}>
                {hint.text}
              </p>
            )}
            {hint.imageUrl && (
              <img
                src={hint.imageUrl}
                alt="Indice revele"
                className="rounded-lg max-h-48 object-contain mx-auto mt-2 cursor-pointer active:opacity-80 transition-opacity"
                style={{ border: '1px solid rgba(245,158,11,0.15)' }}
                onClick={() => onImageEnlarge?.(hint.imageUrl!)}
              />
            )}
          </motion.div>
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 rounded-xl"
            style={{
              background: `rgba(${t.overlayChannel}, 0.06)`,
              color: t.textSecondary,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
            }}
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}