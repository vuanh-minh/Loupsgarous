import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Send, Eye, Users, Shield, Skull,
  ChevronDown, AlertTriangle, Target,
  ClipboardPaste, X, Check, Clock, MessageSquarePlus, Download,
  Lightbulb, ImagePlus, Home, Image, Search,
  ChevronUp, Minus, Lock, UserX, FileText,
} from 'lucide-react';
import type { GameState, DynamicHint, Player, Hint } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import type { PlayerEntry } from '../setup/setupConstants';
import { getRoleById } from '../../../data/roles';
import { nextHintId, GMHintPanel } from '../../HintComponents';
import { resolveAvatarUrl } from '../../../data/avatarResolver';
import { AVATAR_GALLERY } from '../../../data/avatarGallery';
import { sendPushNotifications } from '../../../context/useNotifications';
import { projectId, publicAnonKey } from '../../../context/apiConfig';

const searchIconPaths = {
  p28ad87f1: "M6.41405 11.0788C8.99032 11.0788 11.0788 8.99032 11.0788 6.41405C11.0788 3.83777 8.99032 1.74929 6.41405 1.74929C3.83777 1.74929 1.74929 3.83777 1.74929 6.41405C1.74929 8.99032 3.83777 11.0788 6.41405 11.0788Z",
  p3cc92f00: "M12.245 12.245L9.73769 9.73769",
};

/* ================================================================
   Helpers
   ================================================================ */

type RecipientTeam = 'village' | 'wolves' | 'villageois' | 'pending' | null;

/** Determine which team should receive a hint about the given player */
function computeRecipientTeam(player: Player): RecipientTeam {
  if (!player.role) return 'pending';
  const role = getRoleById(player.role);
  if (!role) return 'pending';
  if (role.team === 'werewolf') return 'village';
  if (role.id === 'villageois') return 'villageois'; // Villager hints distributed as fallback when no special/wolf hints remain
  if (role.id !== 'cupidon') return 'wolves';
  return null;
}

/** Resolve {role} and {durole} placeholders in hint text — includes French articles with auto-capitalization */
function resolveHintText(text: string, player: Player): string {
  const role = getRoleById(player.role);
  if (!role) return text.replace(/\{role\}/gi, player.role).replace(/\{durole\}/gi, player.role);
  // {role} → "le Loup-Garou", "la Voyante" (auto-cap at start)
  let result = text.replace(/\{role\}/gi, (_match, offset: number) => {
    const capitalize = offset === 0;
    const art = capitalize
      ? role.article.charAt(0).toUpperCase() + role.article.slice(1)
      : role.article;
    return `${art} ${role.name}`;
  });
  // {durole} → "du Loup-Garou" (le→du), "de la Voyante" (la→de la), auto-cap at start
  result = result.replace(/\{durole\}/gi, (_match, offset: number) => {
    const capitalize = offset === 0;
    if (role.article === 'le') {
      return capitalize ? `Du ${role.name}` : `du ${role.name}`;
    }
    return capitalize ? `De la ${role.name}` : `de la ${role.name}`;
  });
  return result;
}

/** Get next dynamic hint ID */
function nextDynamicHintId(hints: DynamicHint[]): number {
  if (hints.length === 0) return 1;
  return Math.max(...hints.map((h) => h.id)) + 1;
}

/** Player avatar inline */
function AvatarSmall({ player, size = 6 }: { player: Player; size?: number }) {
  const url = resolveAvatarUrl(player.avatarUrl);
  if (url) {
    return <img src={url} alt={player.name} className={`w-${size} h-${size} rounded-full object-cover inline-block`} style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }} />;
  }
  return <span style={{ fontSize: size >= 8 ? '1.2rem' : '0.9rem' }}>{player.avatar}</span>;
}

/* ================================================================
   Categorized hint with computed metadata
   ================================================================ */
interface CategorizedHint {
  hint: DynamicHint;
  targetPlayer: Player | undefined;
  recipientTeam: RecipientTeam;
  resolvedText: string;
  available: boolean;
}

const TEAM_COLORS = {
  village: { bg: 'rgba(107,142,90,0.12)', border: 'rgba(107,142,90,0.3)', text: '#6b8e5a', label: 'Village', icon: Shield, emoji: '🏘️' },
  wolves: { bg: 'rgba(196,30,58,0.12)', border: 'rgba(196,30,58,0.3)', text: '#c41e3a', label: 'Loups-Garous', icon: Skull, emoji: '🐺' },
  villageois: { bg: 'rgba(139,161,196,0.12)', border: 'rgba(139,161,196,0.3)', text: '#8ba1c4', label: 'Villageois', icon: Home, emoji: '🧑‍🌾' },
  pending: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', label: 'En attente', icon: Clock, emoji: '⏳' },
  neutral: { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.4)', label: 'Neutre', icon: Users, emoji: '🤷' },
  away: { bg: 'rgba(120,113,108,0.10)', border: 'rgba(120,113,108,0.25)', text: '#78716c', label: 'Absents', icon: UserX, emoji: '🚪' },
} as const;

/* ================================================================
   Main Component
   ================================================================ */
export function GMDynamicHintsPanel({
  state,
  onUpdateState,
  t,
  isMobile,
  playerEntries,
  externalPerPlayerTarget,
  onClearExternalTarget,
}: {
  state: GameState;
  onUpdateState: (updater: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  isMobile: boolean;
  playerEntries?: PlayerEntry[];
  externalPerPlayerTarget?: number | null;
  onClearExternalTarget?: () => void;
}) {
  const dynamicHints = state.dynamicHints ?? [];

  // During setup, state.players is empty — use playerEntries as fallback
  const players: Player[] = useMemo(() => {
    if (state.players.length > 0) return state.players;
    if (!playerEntries || playerEntries.length === 0) return [];
    return playerEntries.map((e) => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      avatarUrl: e.avatarUrl,
      role: '',
      alive: true,
      shortCode: e.shortCode ?? '',
      votesReceived: 0,
    } as Player));
  }, [state.players, playerEntries]);

  // ── Local state ──
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [newText, setNewText] = useState('');
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmRevealId, setConfirmRevealId] = useState<number | null>(null);
  const [excludedRecipients, setExcludedRecipients] = useState<Set<number>>(new Set());
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['village', 'wolves', 'villageois', 'pending', 'villageois-neutral']));
  const [globalHintsTab, setGlobalHintsTab] = useState<'list' | 'byPlayer'>('list');
  const [expandedHintPlayers, setExpandedHintPlayers] = useState<Set<number>>(new Set());
  const [uploadingDynImage, setUploadingDynImage] = useState<number | null>(null); // playerId currently uploading for
  const dynImageInputRef = useRef<HTMLInputElement | null>(null);
  const [dynImageTargetPlayer, setDynImageTargetPlayer] = useState<number | null>(null);
  const dynImageTextRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [galleryTargetPlayer, setGalleryTargetPlayer] = useState<number | null>(null);
  const [shareHintPlayerId, setShareHintPlayerId] = useState<number | null>(null);
  const [shareHintSearch, setShareHintSearch] = useState('');

  // Select an image from the gallery as a dynamic hint
  const handleGalleryImageSelect = useCallback((imageUrl: string, playerId: number, text?: string) => {
    const id = nextDynamicHintId(dynamicHints);
    onUpdateState((s) => ({
      ...s,
      dynamicHints: [
        ...(s.dynamicHints ?? []),
        { id, targetPlayerId: playerId, text: text || '', imageUrl, priority: newPriority, revealed: false, createdAt: new Date().toISOString() },
      ],
    }));
    setGalleryTargetPlayer(null);
    setNewText('');
  }, [dynamicHints, newPriority, onUpdateState, setNewText]);

  // Upload an image as a dynamic hint for a specific player
  const handleDynImageUpload = useCallback(async (file: File, playerId: number, text?: string) => {
    setUploadingDynImage(playerId);
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
        const id = nextDynamicHintId(dynamicHints);
        onUpdateState((s) => ({
          ...s,
          dynamicHints: [
            ...(s.dynamicHints ?? []),
            { id, targetPlayerId: playerId, text: text || '', imageUrl: data.imageUrl, priority: newPriority, revealed: false, createdAt: new Date().toISOString() },
          ],
        }));
        setNewText('');
      } else {
        console.error('Dynamic hint image upload failed:', data.error);
      }
    } catch (err) {
      console.error('Dynamic hint image upload error:', err);
    } finally {
      setUploadingDynImage(null);
    }
  }, [dynamicHints, newPriority, onUpdateState, state.gameId, setNewText]);

  // Auto-focus input when selecting a player
  useEffect(() => {
    if (selectedPlayerId !== null) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [selectedPlayerId]);

  // ── Categorize all hints (with priority-based availability) ──
  const categorized: CategorizedHint[] = useMemo(() => {
    // Pre-compute revealed priorities per target player for priority gating
    const revealedPrioritiesByTarget = new Map<number, Set<1 | 2 | 3>>();
    for (const h of dynamicHints) {
      if (h.revealed) {
        if (!revealedPrioritiesByTarget.has(h.targetPlayerId)) revealedPrioritiesByTarget.set(h.targetPlayerId, new Set());
        revealedPrioritiesByTarget.get(h.targetPlayerId)!.add(h.priority ?? 1);
      }
    }
    return dynamicHints.map((hint) => {
      const targetPlayer = players.find((p) => p.id === hint.targetPlayerId);
      const recipientTeam = targetPlayer ? computeRecipientTeam(targetPlayer) : null;
      const resolvedText = targetPlayer ? resolveHintText(hint.text, targetPlayer) : hint.text;
      // Away players (alive but not in villagePresentIds) cannot be hint targets
      const vpIds = state.villagePresentIds;
      const isTargetAway = vpIds ? !vpIds.includes(hint.targetPlayerId) : false;
      const baseAvailable = !!targetPlayer && targetPlayer.alive && !isTargetAway && !hint.revealed && recipientTeam !== 'pending';
      // Priority gating: P2 requires revealed P1 on same target, P3 requires revealed P2
      const priority = hint.priority ?? 1;
      const revealedSet = revealedPrioritiesByTarget.get(hint.targetPlayerId);
      let priorityUnlocked = true;
      if (priority === 2) priorityUnlocked = !!revealedSet?.has(1);
      else if (priority === 3) priorityUnlocked = !!revealedSet?.has(2);
      const available = baseAvailable && priorityUnlocked;
      return { hint, targetPlayer, recipientTeam, resolvedText, available };
    });
  }, [dynamicHints, players, state.villagePresentIds]);

  // ── Group hints by player (sorted by priority then creation) ──
  const hintsByPlayer = useMemo(() => {
    const map = new Map<number, CategorizedHint[]>();
    for (const cat of categorized) {
      const pid = cat.hint.targetPlayerId;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(cat);
    }
    // Sort each group by priority asc, then creation order
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.hint.priority ?? 1) - (b.hint.priority ?? 1) || a.hint.id - b.hint.id);
    }
    return map;
  }, [categorized]);

  // ── Filtered players ──
  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, searchQuery]);

  // ── Players grouped by recipient team ──
  const groupedPlayers = useMemo(() => {
    const village: Player[] = [];
    const wolves: Player[] = [];
    const villageois: Player[] = [];
    const pending: Player[] = [];
    const neutral: Player[] = [];
    const away: Player[] = [];
    const vpIds = state.villagePresentIds;
    for (const p of filteredPlayers) {
      // Away players (alive but not present) go into their own section
      if (p.alive && vpIds && !vpIds.includes(p.id)) {
        away.push(p);
        continue;
      }
      const team = computeRecipientTeam(p);
      if (team === 'village') village.push(p);
      else if (team === 'wolves') wolves.push(p);
      else if (team === 'villageois') villageois.push(p);
      else if (team === 'pending') pending.push(p);
      else neutral.push(p);
    }
    return { village, wolves, villageois, pending, neutral, away };
  }, [filteredPlayers, state.villagePresentIds]);

  // ── Stats ──
  const stats = useMemo(() => {
    const pending = categorized.filter((c) => c.recipientTeam === 'pending').length;
    const village = categorized.filter((c) => c.recipientTeam === 'village' && c.available).length;
    const wolves = categorized.filter((c) => c.recipientTeam === 'wolves' && c.available).length;
    const villageois = categorized.filter((c) => c.recipientTeam === 'villageois' && c.available).length;
    const revealed = categorized.filter((c) => c.hint.revealed).length;
    const total = dynamicHints.length;
    return { pending, village, wolves, villageois, revealed, total };
  }, [categorized, dynamicHints]);

  // ── Compute recipients for each revealed dynamic hint ──
  const hintRecipientsMap = useMemo(() => {
    const map = new Map<number, Player[]>();
    const stateHints = state.hints ?? [];
    const statePlayerHints = state.playerHints ?? [];
    for (const dh of dynamicHints) {
      if (!dh.revealed || !dh.revealedAt) continue;
      // Match the delivered Hint by createdAt timestamp (set in same callback as revealedAt)
      const deliveredHint = stateHints.find((h) => h.createdAt === dh.revealedAt);
      if (!deliveredHint) continue;
      const recipientIds = statePlayerHints
        .filter((ph) => ph.hintId === deliveredHint.id)
        .map((ph) => ph.playerId);
      const recipientPlayers = recipientIds
        .map((pid) => players.find((p) => p.id === pid))
        .filter(Boolean) as Player[];
      map.set(dh.id, recipientPlayers);
    }
    return map;
  }, [dynamicHints, state.hints, state.playerHints, players]);

  // ── Add hint for selected player ──
  const addHintForPlayer = useCallback((playerId: number) => {
    const text = newText.trim();
    if (!text) return;
    const id = nextDynamicHintId(dynamicHints);
    onUpdateState((s) => ({
      ...s,
      dynamicHints: [
        ...(s.dynamicHints ?? []),
        { id, targetPlayerId: playerId, text, priority: newPriority, revealed: false, createdAt: new Date().toISOString() },
      ],
    }));
    setNewText('');
    // Keep focus on input for rapid multi-hint entry
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [newText, newPriority, dynamicHints, onUpdateState]);

  // ── Delete hint ──
  const deleteHint = useCallback((hintId: number) => {
    onUpdateState((s) => ({
      ...s,
      dynamicHints: (s.dynamicHints ?? []).filter((h) => h.id !== hintId),
    }));
  }, [onUpdateState]);

  // ── Reveal hint → distribute to team OR individual selection ──
  const revealHint = useCallback((cat: CategorizedHint, overrideRecipientIds?: number[]) => {
    const { hint, targetPlayer, recipientTeam, resolvedText } = cat;
    if (!targetPlayer) return;
    // Safety guard: never distribute hints about dead or away players
    if (!targetPlayer.alive) return;
    const vpIds = state.villagePresentIds;
    if (vpIds && !vpIds.includes(targetPlayer.id)) return;

    let recipientPlayerIds: number[];
    if (overrideRecipientIds) {
      recipientPlayerIds = overrideRecipientIds;
    } else if (recipientTeam === 'village') {
      // Dead players also receive hints
      recipientPlayerIds = players
        .filter((p) => getRoleById(p.role)?.team !== 'werewolf')
        .map((p) => p.id);
    } else if (recipientTeam === 'wolves') {
      // Wolves receive hints about village-team special powers
      const wolfIds = players
        .filter((p) => getRoleById(p.role)?.team === 'werewolf')
        .map((p) => p.id);
      // Villageois (simple villagers) also receive hints about special powers,
      // but never about their own role — exclude the target player.
      const villageoisIds = players
        .filter((p) => p.id !== targetPlayer.id && getRoleById(p.role)?.id === 'villageois')
        .map((p) => p.id);
      recipientPlayerIds = [...wolfIds, ...villageoisIds];
    } else if (recipientTeam === 'villageois') {
      // Hints about simple villagers → all players except the target (dead included)
      recipientPlayerIds = players
        .filter((p) => p.id !== targetPlayer.id)
        .map((p) => p.id);
    } else {
      recipientPlayerIds = [];
    }

    onUpdateState((s) => {
      const updatedDynamicHints = (s.dynamicHints ?? []).map((h) =>
        h.id === hint.id ? { ...h, revealed: true, revealedAt: new Date().toISOString() } : h
      );
      const hintIdForDelivery = nextHintId(s.hints ?? []);
      const newHint: Hint = {
        id: hintIdForDelivery,
        text: resolvedText,
        ...(hint.imageUrl ? { imageUrl: hint.imageUrl } : {}),
        fromDynamic: true,
        createdAt: new Date().toISOString(),
      };
      const now = new Date().toISOString();
      const newPlayerHints = recipientPlayerIds.map((pid) => ({
        hintId: hintIdForDelivery, playerId: pid, sentAt: now, revealed: false,
      }));
      return {
        ...s,
        dynamicHints: updatedDynamicHints,
        hints: [...(s.hints ?? []), newHint],
        playerHints: [...(s.playerHints ?? []), ...newPlayerHints],
      };
    });

    const recipientShortCodes = players
      .filter((p) => recipientPlayerIds.includes(p.id))
      .map((p) => p.shortCode)
      .filter(Boolean);
    if (recipientShortCodes.length > 0 && state.gameId) {
      sendPushNotifications(state.gameId, recipientShortCodes, 'Loup-Garou', 'Nouvel indice disponible !', 'hint-dynamic');
    }
    setConfirmRevealId(null);
    setExcludedRecipients(new Set());
  }, [players, state, onUpdateState]);

  // Send a picked dynamic hint directly to a specific player
  const sendPickedHint = useCallback((cat: CategorizedHint, playerId: number) => {
    revealHint(cat, [playerId]);
    setShareHintPlayerId(null);
    setShareHintSearch('');
  }, [revealHint]);

  // ── Styles ──
  const cardBg = 'rgba(255,255,255,0.03)';
  const cardBorder = 'rgba(255,255,255,0.08)';
  const inputBg = 'rgba(0,0,0,0.3)';
  const inputBorder = 'rgba(255,255,255,0.1)';

  const togglePlayer = (id: number) => {
    setSelectedPlayerId((prev) => prev === id ? null : id);
    setNewText('');
  };

  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  // ── Export CSV ──
  const handleExportCsv = useCallback(() => {
    const lines: string[] = ['Joueur;Indice;Priorite;Statut;Equipe destinataire'];
    for (const cat of categorized) {
      const playerName = cat.targetPlayer?.name ?? `Joueur #${cat.hint.targetPlayerId}`;
      const status = cat.hint.revealed ? 'Revele' : cat.recipientTeam === 'pending' ? 'En attente' : cat.available ? 'Disponible' : 'Verrouille';
      const teamLabel = cat.recipientTeam === 'village' ? 'Village'
        : cat.recipientTeam === 'wolves' ? 'Loups-Garous'
        : cat.recipientTeam === 'pending' ? 'En attente'
        : 'Neutre';
      // Escape semicolons and quotes in hint text
      const safeText = cat.hint.text.replace(/"/g, '""');
      lines.push(`${playerName};"${safeText}";P${cat.hint.priority ?? 1};${status};${teamLabel}`);
    }
    const csvContent = '\uFEFF' + lines.join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indices-dynamiques-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [categorized]);

  const globalHintCount = (state.hints ?? []).filter((h) => !h.fromDynamic).length;

  // ── Per-player hint aggregation for "Indices par joueurs" tab ──
  const perPlayerHints = useMemo(() => {
    const hints = state.hints ?? [];
    const playerHints = state.playerHints ?? [];
    const hintMap = new Map(hints.map(h => [h.id, h]));
    const grouped = new Map<number, { hint: Hint; sentAt: string; revealed: boolean }[]>();
    for (const ph of playerHints) {
      const hint = hintMap.get(ph.hintId);
      if (!hint) continue;
      if (!grouped.has(ph.playerId)) grouped.set(ph.playerId, []);
      grouped.get(ph.playerId)!.push({ hint, sentAt: ph.sentAt, revealed: ph.revealed });
    }
    return players
      .filter(p => grouped.has(p.id))
      .map(p => ({
        player: p,
        hints: grouped.get(p.id)!.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
      }))
      .sort((a, b) => b.hints.length - a.hints.length);
  }, [state.hints, state.playerHints, players]);

  const playersWithHintsCount = perPlayerHints.length;

  return (
    <div className="space-y-5">
      {/* ══════════════════════════════════════════════════
          SECTION 1 — Indices Globaux
         ══════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(255,255,255,0.01))',
          border: '1px solid rgba(245,158,11,0.15)',
        }}
      >
        {/* Collapsible header */}
        <button
          onClick={() => toggleSection('global')}
          className="w-full flex items-center gap-3 mb-1 cursor-pointer transition-colors hover:brightness-110"
          style={{ background: 'transparent' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Lightbulb size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div className="flex-1 text-left">
            <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.95rem' }}>Indices en jeux</h3>
            {!isMobile && (
              <p style={{ color: t.textDim, fontSize: '0.6rem' }}>
                Indices envoyés manuellement à des joueurs spécifiques
              </p>
            )}
          </div>
          <span
            className="px-2 py-0.5 rounded-md"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
          >
            {globalHintCount}
          </span>
          <motion.div
            animate={{ rotate: collapsedSections.has('global') ? -90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} style={{ color: '#f59e0b' }} />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {!collapsedSections.has('global') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              {/* ── Tab navigation ── */}
              <div className="flex gap-1 mt-3 mb-3 p-0.5 rounded-lg" style={{ background: `rgba(${t.overlayChannel}, 0.04)` }}>
                <button
                  onClick={() => setGlobalHintsTab('list')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                  style={{
                    background: globalHintsTab === 'list' ? 'rgba(245,158,11,0.15)' : 'transparent',
                    color: globalHintsTab === 'list' ? '#f59e0b' : t.textDim,
                    fontSize: '0.6rem',
                    fontFamily: '"Cinzel", serif',
                    fontWeight: globalHintsTab === 'list' ? 700 : 400,
                    border: globalHintsTab === 'list' ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
                  }}
                >
                  <Lightbulb size={11} /> Indices en jeu
                </button>
                <button
                  onClick={() => setGlobalHintsTab('byPlayer')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                  style={{
                    background: globalHintsTab === 'byPlayer' ? 'rgba(245,158,11,0.15)' : 'transparent',
                    color: globalHintsTab === 'byPlayer' ? '#f59e0b' : t.textDim,
                    fontSize: '0.6rem',
                    fontFamily: '"Cinzel", serif',
                    fontWeight: globalHintsTab === 'byPlayer' ? 700 : 400,
                    border: globalHintsTab === 'byPlayer' ? '1px solid rgba(245,158,11,0.25)' : '1px solid transparent',
                  }}
                >
                  <Users size={11} /> Par joueur
                  {playersWithHintsCount > 0 && (
                    <span
                      className="px-1.5 py-0 rounded-full"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.5rem', fontWeight: 700 }}
                    >
                      {playersWithHintsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ── Tab: Indices en jeu (existing) ── */}
              {globalHintsTab === 'list' && (
                <div>
                  <GMHintPanel
                    state={state}
                    onUpdateState={onUpdateState}
                    t={t}
                    isMobile={isMobile}
                    externalPerPlayerTarget={externalPerPlayerTarget}
                    onClearExternalTarget={onClearExternalTarget}
                  />
                </div>
              )}

              {/* ── Tab: Indices par joueur ── */}
              {globalHintsTab === 'byPlayer' && (
                <div className="space-y-1.5">
                  {perPlayerHints.length === 0 ? (
                    <div className="text-center py-6">
                      <Users size={24} style={{ color: t.textDim, margin: '0 auto 0.5rem' }} />
                      <p style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                        Aucun joueur n'a reçu d'indice
                      </p>
                    </div>
                  ) : perPlayerHints.map(({ player: p, hints: pHints }) => {
                    const isExpanded = expandedHintPlayers.has(p.id);
                    return (
                      <div key={p.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid rgba(${t.overlayChannel}, 0.08)` }}>
                        <button
                          onClick={() => setExpandedHintPlayers(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                            return next;
                          })}
                          className="w-full flex items-center gap-3 p-3 transition-colors"
                          style={{
                            background: isExpanded ? 'rgba(245,158,11,0.06)' : `rgba(${t.overlayChannel}, 0.02)`,
                          }}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                            <AvatarSmall player={p} size={8} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="truncate" style={{ color: t.text, fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}>
                              {p.name}
                            </p>
                            <p style={{ color: t.textDim, fontSize: '0.55rem' }}>
                              {pHints.length} indice{pHints.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          {!p.alive && (
                            <Skull size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                          )}
                          <span
                            className="px-1.5 py-0.5 rounded-md flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
                          >
                            {pHints.length}
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 0 : -90 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={12} style={{ color: t.textDim }} />
                          </motion.div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                <div className="h-px" style={{ background: `rgba(${t.overlayChannel}, 0.08)` }} />
                                {/* Share a hint from pool */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShareHintPlayerId(p.id); setShareHintSearch(''); }}
                                  className="relative z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5 mt-1"
                                  style={{
                                    background: 'rgba(245,158,11,0.06)',
                                    border: '1px solid rgba(245,158,11,0.15)',
                                    color: '#f59e0b',
                                    fontSize: '0.6rem',
                                    fontFamily: '"Cinzel", serif',
                                    pointerEvents: 'auto',
                                  }}
                                >
                                  <Send size={10} />
                                  Partager un indice
                                </button>
                                {pHints.map(({ hint, sentAt, revealed }, idx) => (
                                  <div
                                    key={hint.id}
                                    className="flex items-start gap-2.5 p-2.5 rounded-lg"
                                    style={{
                                      background: `rgba(${t.overlayChannel}, 0.03)`,
                                      border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
                                    }}
                                  >
                                    <div className="flex-shrink-0 mt-0.5">
                                      {hint.imageUrl ? (
                                        <Image size={12} style={{ color: '#f59e0b' }} />
                                      ) : (
                                        <Lightbulb size={12} style={{ color: '#f59e0b' }} />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      {hint.text && (
                                        <p style={{
                                          color: t.text,
                                          fontSize: '0.65rem',
                                          lineHeight: 1.5,
                                          fontFamily: '"IM Fell English", serif',
                                          fontStyle: 'italic',
                                        }}>
                                          &ldquo;{hint.text}&rdquo;
                                        </p>
                                      )}
                                      {hint.imageUrl && (
                                        <img
                                          src={hint.imageUrl}
                                          alt="Indice"
                                          className="rounded-lg max-h-20 object-contain mt-1.5"
                                          style={{ border: `1px solid rgba(${t.overlayChannel}, 0.1)` }}
                                          draggable={false}
                                        />
                                      )}
                                      <div className="flex items-center gap-2 mt-1.5">
                                        <Clock size={9} style={{ color: t.textDim }} />
                                        <span style={{ color: t.textDim, fontSize: '0.5rem' }}>
                                          {new Date(sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {hint.fromDynamic && (
                                          <span className="px-1.5 py-0 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: '0.45rem' }}>
                                            dynamique
                                          </span>
                                        )}
                                        {revealed ? (
                                          <span className="px-1.5 py-0 rounded-full" style={{ background: 'rgba(107,142,90,0.12)', color: '#6b8e5a', fontSize: '0.45rem' }}>
                                            <Eye size={8} className="inline mr-0.5" style={{ verticalAlign: '-1px' }} /> lu
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '0.45rem' }}>
                                            non lu
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — Indices Dynamiques (par joueur / équipe)
         ══════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(255,255,255,0.01))',
          border: '1px solid rgba(139,92,246,0.15)',
        }}
      >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
          <Target size={16} style={{ color: '#8b5cf6' }} />
        </div>
        <div className="flex-1">
          <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.95rem' }}>
            Indices Dynamiques
          </h3>
          {!isMobile && (
            <p style={{ color: t.textDim, fontSize: '0.6rem' }}>
              Indices ciblés par joueur, distribués automatiquement par équipe
            </p>
          )}
        </div>
        {/* Bulk import toggle */}
        <button
          onClick={() => { setShowBulkImport(!showBulkImport); setBulkErrors([]); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{
            background: showBulkImport ? `${t.gold}15` : cardBg,
            border: `1px solid ${showBulkImport ? `${t.gold}40` : cardBorder}`,
            color: showBulkImport ? t.gold : t.textDim,
            fontSize: '0.6rem',
            fontFamily: '"Cinzel", serif',
          }}
        >
          <ClipboardPaste size={12} />
          CSV
        </button>
        {/* Export CSV */}
        <button
          onClick={handleExportCsv}
          disabled={dynamicHints.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            color: dynamicHints.length > 0 ? t.textDim : `${t.textDim}50`,
            fontSize: '0.6rem',
            fontFamily: '"Cinzel", serif',
            cursor: dynamicHints.length > 0 ? 'pointer' : 'not-allowed',
            opacity: dynamicHints.length > 0 ? 1 : 0.5,
          }}
        >
          <Download size={12} />
          Export
        </button>
      </div>

      {/* ── Stats pills ── */}
      {stats.total > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            ...(stats.pending > 0 ? [{ label: 'En attente', count: stats.pending, color: '#f59e0b' }] : []),
            { label: 'Village', count: stats.village, color: TEAM_COLORS.village.text },
            { label: 'Loups', count: stats.wolves, color: TEAM_COLORS.wolves.text },
            { label: 'Villageois', count: stats.villageois, color: TEAM_COLORS.villageois.text },
            { label: 'Révélés', count: stats.revealed, color: '#8b5cf6' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ background: `${s.color}10`, border: `1px solid ${s.color}20` }}
            >
              <span style={{ color: s.color, fontSize: '0.75rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                {s.count}
              </span>
              <span style={{ color: s.color, fontSize: '0.5rem', opacity: 0.8 }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input for dynamic hint image upload */}
      <input
        ref={dynImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && dynImageTargetPlayer !== null) {
            handleDynImageUpload(file, dynImageTargetPlayer, dynImageTextRef.current);
          }
          e.target.value = '';
          setDynImageTargetPlayer(null);
          dynImageTextRef.current = '';
        }}
      />

      {/* ── Bulk Import (collapsible) ── */}
      <AnimatePresence>
        {showBulkImport && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            >
              <p style={{ color: t.textDim, fontSize: '0.55rem', lineHeight: 1.6 }}>
                Format: <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 3 }}>
                NomDuJoueur;Texte de l'indice;P1</code> (priorité optionnelle : <code style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '1px 4px', borderRadius: 3 }}>P1</code> <code style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '1px 4px', borderRadius: 3 }}>P2</code> <code style={{ color: '#6b8e5a', background: 'rgba(107,142,90,0.12)', padding: '1px 4px', borderRadius: 3 }}>P3</code>, défaut P1)<br />
                Separateurs acceptes : <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 3 }}>;</code> <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 3 }}>,</code> <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 3 }}>Tab</code>
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Alice;{role} porte du rouge;P1\nBob;Les cheveux {durole} sont blonds;P2\nCharlie;{role} est arrive en retard`}
                rows={5}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontFamily: 'monospace', fontSize: '0.65rem', lineHeight: 1.8 }}
              />
              {bulkErrors.length > 0 && (
                <div className="rounded-lg p-2.5 space-y-1" style={{ background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.2)' }}>
                  {bulkErrors.map((err, i) => (
                    <p key={i} style={{ color: '#c41e3a', fontSize: '0.55rem' }}>
                      <AlertTriangle size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />{err}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowBulkImport(false); setBulkText(''); setBulkErrors([]); }}
                  className="px-3 py-2 rounded-lg transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: t.textDim, fontFamily: '"Cinzel", serif', fontSize: '0.65rem' }}
                >
                  <X size={12} className="inline mr-1" />Annuler
                </button>
                <button
                  onClick={() => {
                    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
                    if (lines.length === 0) return;
                    const errors: string[] = [];
                    const newHints: DynamicHint[] = [];
                    let runningId = nextDynamicHintId(dynamicHints);
                    const now = new Date().toISOString();
                    for (let i = 0; i < lines.length; i++) {
                      const line = lines[i];
                      let parts: string[] | null = null;
                      for (const sep of [';', '\t', ',']) {
                        const idx = line.indexOf(sep);
                        if (idx > 0) {
                          // Split into up to 3 parts: name, hint text, optional priority
                          const first = line.slice(0, idx).trim();
                          const rest = line.slice(idx + 1);
                          const idx2 = rest.indexOf(sep);
                          if (idx2 > 0) {
                            const second = rest.slice(0, idx2).trim();
                            const third = rest.slice(idx2 + 1).trim();
                            parts = [first, second, third];
                          } else {
                            parts = [first, rest.trim()];
                          }
                          break;
                        }
                      }
                      if (!parts || parts.length < 2 || !parts[0] || !parts[1]) {
                        errors.push(`Ligne ${i + 1}: format invalide — "${line.slice(0, 40)}"`);
                        continue;
                      }
                      const [nameRaw, hintText, priorityRaw] = parts;
                      // Parse optional priority (P1, P2, P3, 1, 2, 3)
                      let priority: 1 | 2 | 3 = 1;
                      if (priorityRaw) {
                        const pVal = parseInt(priorityRaw.replace(/^p/i, ''), 10);
                        if (pVal === 1 || pVal === 2 || pVal === 3) priority = pVal as 1 | 2 | 3;
                        else errors.push(`Ligne ${i + 1}: priorité "${priorityRaw}" invalide (P1/P2/P3), défaut P1 appliqué`);
                      }
                      const target = players.find((p) => p.name.toLowerCase() === nameRaw.toLowerCase());
                      if (!target) {
                        errors.push(`Ligne ${i + 1}: joueur "${nameRaw}" introuvable`);
                        continue;
                      }
                      newHints.push({ id: runningId++, targetPlayerId: target.id, text: hintText, priority, revealed: false, createdAt: now });
                    }
                    setBulkErrors(errors);
                    if (newHints.length > 0) {
                      onUpdateState((s) => ({ ...s, dynamicHints: [...(s.dynamicHints ?? []), ...newHints] }));
                      setBulkText('');
                      if (errors.length === 0) setShowBulkImport(false);
                    }
                  }}
                  disabled={!bulkText.trim()}
                  className="flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: !bulkText.trim() ? 'rgba(255,255,255,0.03)' : `${t.gold}20`,
                    border: `1px solid ${!bulkText.trim() ? 'rgba(255,255,255,0.05)' : `${t.gold}40`}`,
                    color: !bulkText.trim() ? t.textDim : t.gold,
                    fontFamily: '"Cinzel", serif', fontSize: '0.7rem',
                  }}
                >
                  <Check size={14} />
                  Importer
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search bar ── */}
      {players.length > 6 && (
        <div className="relative my-2">
          <div className={`${t.isDay ? 'bg-[rgba(255,255,255,0.5)]' : 'bg-[rgba(255,255,255,0.04)]'} relative rounded-[10px] w-full h-[38px]`}>
            <div className="content-stretch flex gap-[8px] items-center overflow-clip px-[12px] py-[8px] relative rounded-[inherit] size-full">
              <div className="relative shrink-0 size-[13.994px]">
                <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.9943 13.9943">
                  <path d={searchIconPaths.p28ad87f1} stroke={t.isDay ? 'rgba(154,138,106,1)' : '#939393'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
                  <path d={searchIconPaths.p3cc92f00} stroke={t.isDay ? 'rgba(154,138,106,1)' : '#939393'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16619" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un joueur..."
                className={`bg-transparent w-full text-[12px] font-['Inter',sans-serif] outline-none ${t.isDay ? 'placeholder:text-[rgba(42,31,16,0.5)]' : 'placeholder:text-[rgba(192,200,216,0.5)]'}`}
                style={{ color: t.isDay ? 'rgba(42,31,16,0.85)' : 'rgba(220,225,240,0.85)' }}
              />
            </div>
            <div aria-hidden="true" className={`absolute border-[0.616px] border-solid inset-0 pointer-events-none rounded-[10px] ${t.isDay ? 'border-[rgba(120,100,60,0.15)]' : 'border-[rgba(255,255,255,0.1)]'}`} />
          </div>
        </div>
      )}

      {/* ── Player list ── */}
      <div className="space-y-2">
        {filteredPlayers.length === 0 && players.length === 0 && (
          <div className="text-center py-8" style={{ color: t.textDim }}>
            <Users size={32} className="mx-auto mb-3 opacity-30" />
            <p style={{ fontSize: '0.75rem', fontFamily: '"Cinzel", serif' }}>Aucun joueur</p>
            <p style={{ fontSize: '0.6rem', marginTop: 4 }}>Ajoutez des joueurs dans l'onglet Paramétrages</p>
          </div>
        )}

        {filteredPlayers.length === 0 && players.length > 0 && (
          <div className="text-center py-6" style={{ color: t.textDim }}>
            <Search size={24} className="mx-auto mb-2 opacity-30" />
            <p style={{ fontSize: '0.7rem' }}>Aucun résultat pour "{searchQuery}"</p>
          </div>
        )}

        {/* ── Indices Loups-Garous Section ── */}
        {groupedPlayers.wolves.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('village')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.wolves.bg,
                border: `1px solid ${TEAM_COLORS.wolves.border}`,
              }}
            >
              <Skull size={14} style={{ color: TEAM_COLORS.wolves.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.wolves.text, fontSize: '0.75rem', fontWeight: 700 }}>
                Indices Loups-Garous
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.wolves.text}20`, color: TEAM_COLORS.wolves.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.wolves.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.wolves.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Indices sur les Loups-Garous &rarr; destinés aux Loups
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('village') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.wolves.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('village') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                >
                  {groupedPlayers.wolves.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayerId === player.id}
                      playerHints={hintsByPlayer.get(player.id) ?? []}
                      onToggle={togglePlayer}
                      onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                      onDelete={deleteHint}
                      onAddHint={addHintForPlayer}
                      onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                      onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                      uploadingImage={uploadingDynImage === player.id}
                      newText={newText}
                      setNewText={setNewText}
                      newPriority={newPriority}
                      setNewPriority={setNewPriority}
                      inputRef={inputRef}
                      t={t}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hintRecipientsMap={hintRecipientsMap}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Indices Village Section (werewolves + special roles) ── */}
        {(groupedPlayers.village.length > 0 || groupedPlayers.wolves.length > 0) && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('wolves')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.village.bg,
                border: `1px solid ${TEAM_COLORS.village.border}`,
                marginTop: groupedPlayers.wolves.length > 0 ? '0.75rem' : 0,
              }}
            >
              <Shield size={14} style={{ color: TEAM_COLORS.village.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.village.text, fontSize: '0.75rem', fontWeight: 700 }}>
                Indices Village
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.village.text}20`, color: TEAM_COLORS.village.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.village.length + groupedPlayers.wolves.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.village.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Loups-Garous + Rôles spéciaux &rarr; destinés au Village
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('wolves') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.village.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('wolves') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                >
                  {/* Sub-header: Loups-Garous targets */}
                  {groupedPlayers.village.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-2 pt-1">
                        <Skull size={11} style={{ color: TEAM_COLORS.wolves.text, opacity: 0.7 }} />
                        <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.wolves.text, fontSize: '0.6rem', fontWeight: 600, opacity: 0.8 }}>
                          Indices sur les Loups-Garous
                        </span>
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ background: `${TEAM_COLORS.wolves.text}15`, color: TEAM_COLORS.wolves.text, fontSize: '0.5rem', fontWeight: 700 }}
                        >
                          {groupedPlayers.village.length}
                        </span>
                      </div>
                      {groupedPlayers.village.map((player) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          isSelected={selectedPlayerId === player.id}
                          playerHints={hintsByPlayer.get(player.id) ?? []}
                          onToggle={togglePlayer}
                          onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                          onDelete={deleteHint}
                          onAddHint={addHintForPlayer}
                          onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                          onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                          uploadingImage={uploadingDynImage === player.id}
                          newText={newText}
                          setNewText={setNewText}
                          newPriority={newPriority}
                          setNewPriority={setNewPriority}
                          inputRef={inputRef}
                          t={t}
                          cardBg={cardBg}
                          cardBorder={cardBorder}
                          inputBg={inputBg}
                          inputBorder={inputBorder}
                          hintRecipientsMap={hintRecipientsMap}
                        />
                      ))}
                    </>
                  )}

                  {/* Sub-header: Special roles targets */}
                  {groupedPlayers.wolves.length > 0 && (
                    <>
                      {groupedPlayers.village.length > 0 && (
                        <div className="mx-2 my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                      )}
                      <div className="flex items-center gap-2 px-2 pt-1">
                        <Shield size={11} style={{ color: TEAM_COLORS.village.text, opacity: 0.7 }} />
                        <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.village.text, fontSize: '0.6rem', fontWeight: 600, opacity: 0.8 }}>
                          Indices sur les Rôles spéciaux
                        </span>
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ background: `${TEAM_COLORS.village.text}15`, color: TEAM_COLORS.village.text, fontSize: '0.5rem', fontWeight: 700 }}
                        >
                          {groupedPlayers.wolves.length}
                        </span>
                        {!isMobile && (
                          <span style={{ color: TEAM_COLORS.village.text, fontSize: '0.45rem', opacity: 0.5, fontStyle: 'italic' }}>
                            (sauf Cupidon)
                          </span>
                        )}
                        <span
                          className="px-1.5 py-0.5 rounded-md flex items-center gap-1"
                          style={{ background: `${TEAM_COLORS.villageois.text}12`, border: `1px solid ${TEAM_COLORS.villageois.text}25`, color: TEAM_COLORS.villageois.text, fontSize: '0.45rem', fontWeight: 600, fontFamily: '"Cinzel", serif', marginLeft: isMobile ? 'auto' : '0' }}
                        >
                          <Home size={9} style={{ opacity: 0.8 }} />
                          &rarr; Villageois
                        </span>
                      </div>
                      {groupedPlayers.wolves.map((player) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          isSelected={selectedPlayerId === player.id}
                          playerHints={hintsByPlayer.get(player.id) ?? []}
                          onToggle={togglePlayer}
                          onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                          onDelete={deleteHint}
                          onAddHint={addHintForPlayer}
                          onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                          onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                          uploadingImage={uploadingDynImage === player.id}
                          newText={newText}
                          setNewText={setNewText}
                          newPriority={newPriority}
                          setNewPriority={setNewPriority}
                          inputRef={inputRef}
                          t={t}
                          cardBg={cardBg}
                          cardBorder={cardBorder}
                          inputBg={inputBg}
                          inputBorder={inputBorder}
                          hintRecipientsMap={hintRecipientsMap}
                        />
                      ))}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Villageois Hints Section ── */}
        {groupedPlayers.villageois.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('villageois')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.villageois.bg,
                border: `1px solid ${TEAM_COLORS.villageois.border}`,
                marginTop: (groupedPlayers.village.length > 0 || groupedPlayers.wolves.length > 0) ? '0.75rem' : 0,
              }}
            >
              <Home size={14} style={{ color: TEAM_COLORS.villageois.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.villageois.text, fontSize: '0.75rem', fontWeight: 700 }}>
                Indices Villageois
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.villageois.text}20`, color: TEAM_COLORS.villageois.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.villageois.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.villageois.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Indices sur les Villageois &mdash; distribués en fallback
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('villageois') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.villageois.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('villageois') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                >
                  {groupedPlayers.villageois.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayerId === player.id}
                      playerHints={hintsByPlayer.get(player.id) ?? []}
                      onToggle={togglePlayer}
                      onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                      onDelete={deleteHint}
                      onAddHint={addHintForPlayer}
                      onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                      onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                      uploadingImage={uploadingDynImage === player.id}
                      newText={newText}
                      setNewText={setNewText}
                      newPriority={newPriority}
                      setNewPriority={setNewPriority}
                      inputRef={inputRef}
                      t={t}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hintRecipientsMap={hintRecipientsMap}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Pending Section ── */}
        {groupedPlayers.pending.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('pending')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.pending.bg,
                border: `1px solid ${TEAM_COLORS.pending.border}`,
                marginTop: (groupedPlayers.village.length > 0 || groupedPlayers.wolves.length > 0 || groupedPlayers.villageois.length > 0) ? '0.75rem' : 0,
              }}
            >
              <Clock size={14} style={{ color: TEAM_COLORS.pending.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.pending.text, fontSize: '0.75rem', fontWeight: 700 }}>
                En attente d'attribution
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.pending.text}20`, color: TEAM_COLORS.pending.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.pending.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.pending.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Rôles non assignés
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('pending') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.pending.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('pending') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                >
                  {groupedPlayers.pending.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayerId === player.id}
                      playerHints={hintsByPlayer.get(player.id) ?? []}
                      onToggle={togglePlayer}
                      onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                      onDelete={deleteHint}
                      onAddHint={addHintForPlayer}
                      onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                      onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                      uploadingImage={uploadingDynImage === player.id}
                      newText={newText}
                      setNewText={setNewText}
                      newPriority={newPriority}
                      setNewPriority={setNewPriority}
                      inputRef={inputRef}
                      t={t}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hintRecipientsMap={hintRecipientsMap}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Neutral roles (Cupidon etc.) — no hints distributed ── */}
        {groupedPlayers.neutral.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('villageois-neutral')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.villageois.bg,
                border: `1px solid ${TEAM_COLORS.villageois.border}`,
                marginTop: (groupedPlayers.village.length > 0 || groupedPlayers.wolves.length > 0 || groupedPlayers.villageois.length > 0) ? '0.75rem' : 0,
              }}
            >
              <Home size={14} style={{ color: TEAM_COLORS.villageois.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.villageois.text, fontSize: '0.75rem', fontWeight: 700 }}>
                Neutres
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.villageois.text}20`, color: TEAM_COLORS.villageois.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.neutral.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.villageois.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Aucun indice distribué
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('villageois-neutral') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.villageois.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('villageois-neutral') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                >
                  {groupedPlayers.neutral.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayerId === player.id}
                      playerHints={hintsByPlayer.get(player.id) ?? []}
                      onToggle={togglePlayer}
                      onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                      onDelete={deleteHint}
                      onAddHint={addHintForPlayer}
                      onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                      onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                      uploadingImage={uploadingDynImage === player.id}
                      newText={newText}
                      setNewText={setNewText}
                      newPriority={newPriority}
                      setNewPriority={setNewPriority}
                      inputRef={inputRef}
                      t={t}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hintRecipientsMap={hintRecipientsMap}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Away Players Section ── */}
        {groupedPlayers.away.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => toggleSection('away')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:brightness-110 cursor-pointer"
              style={{
                background: TEAM_COLORS.away.bg,
                border: `1px solid ${TEAM_COLORS.away.border}`,
                marginTop: '0.75rem',
              }}
            >
              <UserX size={14} style={{ color: TEAM_COLORS.away.text }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: TEAM_COLORS.away.text, fontSize: '0.75rem', fontWeight: 700 }}>
                Absents
              </span>
              <span
                className="px-1.5 py-0.5 rounded-md"
                style={{ background: `${TEAM_COLORS.away.text}20`, color: TEAM_COLORS.away.text, fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {groupedPlayers.away.length}
              </span>
              {!isMobile && (
                <span style={{ color: TEAM_COLORS.away.text, fontSize: '0.55rem', opacity: 0.7, marginLeft: 'auto', marginRight: '0.5rem' }}>
                  Indices bloqués
                </span>
              )}
              <motion.div
                animate={{ rotate: collapsedSections.has('away') ? -90 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ marginLeft: isMobile ? 'auto' : 0 }}
              >
                <ChevronDown size={14} style={{ color: TEAM_COLORS.away.text }} />
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {!collapsedSections.has('away') && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-2"
                  style={{ opacity: 0.6 }}
                >
                  {groupedPlayers.away.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      isSelected={selectedPlayerId === player.id}
                      playerHints={hintsByPlayer.get(player.id) ?? []}
                      onToggle={togglePlayer}
                      onReveal={(hintId) => { setConfirmRevealId(hintId); setExcludedRecipients(new Set()); }}
                      onDelete={deleteHint}
                      onAddHint={addHintForPlayer}
                      onImageUpload={(pid) => { dynImageTextRef.current = newText; setDynImageTargetPlayer(pid); dynImageInputRef.current?.click(); }}
                      onGalleryOpen={(pid) => setGalleryTargetPlayer(pid)}
                      uploadingImage={uploadingDynImage === player.id}
                      newText={newText}
                      setNewText={setNewText}
                      newPriority={newPriority}
                      setNewPriority={setNewPriority}
                      inputRef={inputRef}
                      t={t}
                      cardBg={cardBg}
                      cardBorder={cardBorder}
                      inputBg={inputBg}
                      inputBorder={inputBorder}
                      hintRecipientsMap={hintRecipientsMap}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Confirm Reveal Modal ── */}
      {createPortal(<AnimatePresence>
        {confirmRevealId !== null && (() => {
          const cat = categorized.find((c) => c.hint.id === confirmRevealId);
          if (!cat) return null;
          const tc = (cat.recipientTeam === 'village' || cat.recipientTeam === 'wolves') ? TEAM_COLORS[cat.recipientTeam] : null;
          const teamPlayers = cat.recipientTeam === 'village'
            ? players.filter((p) => p.alive && getRoleById(p.role)?.team !== 'werewolf')
            : cat.recipientTeam === 'wolves'
              ? players.filter((p) => p.alive && (getRoleById(p.role)?.team === 'werewolf' || getRoleById(p.role)?.id === 'villageois'))
              : [];
          const selectedCount = teamPlayers.filter((p) => !excludedRecipients.has(p.id)).length;
          const allSelected = excludedRecipients.size === 0;
          const canReveal = selectedCount > 0;

          const toggleRecipient = (pid: number) => {
            setExcludedRecipients((prev) => {
              const next = new Set(prev);
              if (next.has(pid)) next.delete(pid); else next.add(pid);
              return next;
            });
          };

          const toggleAll = () => {
            if (allSelected) {
              setExcludedRecipients(new Set(teamPlayers.map((p) => p.id)));
            } else {
              setExcludedRecipients(new Set());
            }
          };

          return (
            <motion.div
              key="confirm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
              onClick={() => { setConfirmRevealId(null); setExcludedRecipients(new Set()); }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-[90%] max-w-md rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #0f0c1a 0%, #0a0e1a 100%)',
                  border: `1px solid ${tc ? tc.border : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: `0 0 40px ${tc ? tc.text : t.gold}15`,
                  maxHeight: '85vh',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 space-y-3.5 flex-1 overflow-y-auto">
                  {/* Title */}
                  <div className="text-center">
                    <span className="text-3xl block mb-2">{tc?.emoji ?? '💬'}</span>
                    <h3 style={{ fontFamily: '"Cinzel Decorative", "Cinzel", serif', color: tc?.text ?? t.gold, fontSize: '1rem' }}>
                      Révéler l'indice ?
                    </h3>
                  </div>

                  {/* Hint preview */}
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: tc ? tc.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tc ? tc.border : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    <p style={{ color: t.text, fontSize: '0.75rem', lineHeight: 1.6, marginBottom: 8 }}>
                      "{cat.resolvedText}"
                    </p>
                    <div className="flex items-center gap-2">
                      <Target size={12} style={{ color: t.textDim }} />
                      <span style={{ color: t.textDim, fontSize: '0.55rem' }}>
                        Cible: {cat.targetPlayer?.name ?? '?'}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded font-bold"
                        style={{
                          fontSize: '0.45rem',
                          fontFamily: '"Cinzel", serif',
                          background: (cat.hint.priority ?? 1) === 1 ? 'rgba(239,68,68,0.12)' : (cat.hint.priority ?? 1) === 2 ? 'rgba(245,158,11,0.12)' : 'rgba(107,142,90,0.12)',
                          color: (cat.hint.priority ?? 1) === 1 ? '#ef4444' : (cat.hint.priority ?? 1) === 2 ? '#f59e0b' : '#6b8e5a',
                          border: `1px solid ${(cat.hint.priority ?? 1) === 1 ? 'rgba(239,68,68,0.2)' : (cat.hint.priority ?? 1) === 2 ? 'rgba(245,158,11,0.2)' : 'rgba(107,142,90,0.2)'}`,
                        }}
                      >
                        P{cat.hint.priority ?? 1}
                      </span>
                    </div>
                  </div>

                  {/* ── Team recipients with checkboxes ── */}
                  {teamPlayers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Send size={12} style={{ color: tc?.text ?? t.textDim }} />
                          <span style={{ color: tc?.text ?? t.textDim, fontSize: '0.6rem', fontWeight: 600 }}>
                            Destinataires ({tc?.label ?? 'Équipe'})
                          </span>
                        </div>
                        <button
                          onClick={toggleAll}
                          className="px-2 py-0.5 rounded transition-colors hover:bg-white/5"
                          style={{ color: t.textDim, fontSize: '0.5rem', fontFamily: '"Cinzel", serif' }}
                        >
                          {allSelected ? 'Décocher tout' : 'Tout cocher'}
                        </button>
                      </div>
                      <div
                        className="rounded-lg overflow-y-auto space-y-0.5 p-1"
                        style={{
                          maxHeight: '28vh',
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {(() => {
                          const renderPlayerRow = (p: Player, accentColor: string) => {
                            const pRole = getRoleById(p.role);
                            const isChecked = !excludedRecipients.has(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleRecipient(p.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors"
                                style={{
                                  background: isChecked ? `${accentColor}08` : 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                }}
                              >
                                <div
                                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                  style={{
                                    background: isChecked ? accentColor : 'transparent',
                                    border: `1.5px solid ${isChecked ? accentColor : 'rgba(255,255,255,0.2)'}`,
                                  }}
                                >
                                  {isChecked && <Check size={10} style={{ color: '#0a0e1a' }} />}
                                </div>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${pRole?.color ?? t.gold}15` }}>
                                  <AvatarSmall player={p} size={5} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ color: isChecked ? t.text : t.textDim, fontSize: '0.7rem', fontWeight: isChecked ? 600 : 400 }}>
                                    {p.name}
                                  </p>
                                </div>
                                {pRole && (
                                  <span style={{ color: pRole.color, fontSize: '0.5rem', opacity: 0.7 }}>
                                    {pRole.emoji} {pRole.name}
                                  </span>
                                )}
                              </button>
                            );
                          };

                          const wolvesInList = teamPlayers.filter((p) => getRoleById(p.role)?.team === 'werewolf');
                          const villageoisInList = teamPlayers.filter((p) => getRoleById(p.role)?.id === 'villageois');
                          const hasBothGroups = wolvesInList.length > 0 && villageoisInList.length > 0;

                          if (!hasBothGroups) {
                            return teamPlayers.map((p) => renderPlayerRow(p, tc?.text ?? t.gold));
                          }

                          return (
                            <>
                              {/* Loups-Garous group */}
                              <div
                                className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5"
                                style={{ borderBottom: `1px solid ${TEAM_COLORS.wolves.border}` }}
                              >
                                <span style={{ fontSize: '0.6rem' }}>{TEAM_COLORS.wolves.emoji}</span>
                                <span style={{ color: TEAM_COLORS.wolves.text, fontSize: '0.5rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                                  {TEAM_COLORS.wolves.label}
                                </span>
                                <span style={{ color: TEAM_COLORS.wolves.text, fontSize: '0.45rem', opacity: 0.6, marginLeft: 'auto' }}>
                                  {wolvesInList.filter((p) => !excludedRecipients.has(p.id)).length}/{wolvesInList.length}
                                </span>
                              </div>
                              {wolvesInList.map((p) => renderPlayerRow(p, TEAM_COLORS.wolves.text))}

                              {/* Villageois group */}
                              <div
                                className="flex items-center gap-1.5 px-2 pt-2.5 pb-0.5"
                                style={{ borderBottom: `1px solid ${TEAM_COLORS.villageois.border}` }}
                              >
                                <span style={{ fontSize: '0.6rem' }}>{TEAM_COLORS.villageois.emoji}</span>
                                <span style={{ color: TEAM_COLORS.villageois.text, fontSize: '0.5rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                                  {TEAM_COLORS.villageois.label}
                                </span>
                                <span style={{ color: TEAM_COLORS.villageois.text, fontSize: '0.45rem', opacity: 0.6, marginLeft: 'auto' }}>
                                  {villageoisInList.filter((p) => !excludedRecipients.has(p.id)).length}/{villageoisInList.length}
                                </span>
                              </div>
                              {villageoisInList.map((p) => renderPlayerRow(p, TEAM_COLORS.villageois.text))}
                            </>
                          );
                        })()}
                      </div>
                      <p style={{ color: tc?.text ?? t.gold, fontSize: '0.55rem', textAlign: 'center', fontWeight: 600 }}>
                        {selectedCount}/{teamPlayers.length} joueur{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  {teamPlayers.length === 0 && (
                    <div className="flex items-center gap-2 justify-center py-2">
                      <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b', fontSize: '0.65rem' }}>
                        Aucun destinataire disponible
                      </span>
                    </div>
                  )}

                  {/* ── Action buttons ── */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setConfirmRevealId(null); setExcludedRecipients(new Set()); }}
                      className="flex-1 py-3 rounded-xl text-center"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: t.textSecondary,
                        fontFamily: '"Cinzel", serif',
                        fontSize: '0.75rem',
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => {
                        const recipientIds = teamPlayers
                          .filter((p) => !excludedRecipients.has(p.id))
                          .map((p) => p.id);
                        revealHint(cat, recipientIds);
                      }}
                      disabled={!canReveal}
                      className="flex-1 py-3 rounded-xl text-center flex items-center justify-center gap-2 transition-opacity"
                      style={{
                        background: canReveal ? (tc ? `${tc.text}20` : `${t.gold}20`) : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${canReveal ? (tc ? `${tc.text}50` : `${t.gold}50`) : 'rgba(255,255,255,0.06)'}`,
                        color: canReveal ? (tc?.text ?? t.gold) : t.textDim,
                        fontFamily: '"Cinzel", serif',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: canReveal ? 'pointer' : 'not-allowed',
                        opacity: canReveal ? 1 : 0.5,
                      }}
                    >
                      <Send size={14} />
                      Révéler
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>, document.body)}
      </div>{/* end Indices Dynamiques wrapper */}

      {/* ── Hint Image Gallery Modal ── */}
      <AnimatePresence>
        {galleryTargetPlayer !== null && (
          <HintImageGalleryModal
            open
            onClose={() => setGalleryTargetPlayer(null)}
            onSelect={(imageUrl, text) => handleGalleryImageSelect(imageUrl, galleryTargetPlayer, text)}
            players={players}
            targetPlayerName={players.find(p => p.id === galleryTargetPlayer)?.name ?? ''}
            t={t}
            initialText={newText}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════
          MODAL — Pick a hint from pool to share with a player
         ══════════════════════════════════════════════════ */}
      {createPortal(
      <AnimatePresence>
        {shareHintPlayerId !== null && (() => {
          const targetPlayer = players.find(p => p.id === shareHintPlayerId);
          if (!targetPlayer) return null;
          const availablePool = categorized.filter(c => !c.hint.revealed);
          const q = shareHintSearch.toLowerCase();
          const filtered = q
            ? availablePool.filter(c =>
                c.resolvedText.toLowerCase().includes(q) ||
                (c.targetPlayer?.name.toLowerCase().includes(q)) ||
                (c.recipientTeam && TEAM_COLORS[c.recipientTeam]?.label.toLowerCase().includes(q))
              )
            : availablePool;
          return (
            <motion.div
              key="share-hint-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
              onClick={() => { setShareHintPlayerId(null); setShareHintSearch(''); }}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.92, opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
                style={{
                  background: t.isDay
                    ? 'linear-gradient(145deg, rgba(245,240,228,0.98), rgba(235,228,210,0.98))'
                    : 'linear-gradient(145deg, rgba(30,25,40,0.98), rgba(20,15,30,0.98))',
                  border: `1px solid ${t.goldBorder}`,
                  boxShadow: t.isDay
                    ? '0 25px 60px rgba(0,0,0,0.15), 0 0 40px rgba(160,120,8,0.08)'
                    : '0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,158,11,0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid rgba(${t.overlayChannel}, 0.06)` }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                    <AvatarSmall player={targetPlayer} size={9} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.9rem' }}>
                      Partager un indice
                    </h3>
                    <p className="truncate" style={{ color: t.textDim, fontSize: '0.6rem' }}>
                      Envoyer à <strong style={{ color: t.text }}>{targetPlayer.name}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => { setShareHintPlayerId(null); setShareHintSearch(''); }}
                    className="p-2 rounded-lg transition-colors hover:bg-white/5"
                    style={{ color: t.textDim }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3" style={{ borderBottom: `1px solid rgba(${t.overlayChannel}, 0.04)` }}>
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
                    <input
                      type="text"
                      value={shareHintSearch}
                      onChange={(e) => setShareHintSearch(e.target.value)}
                      placeholder="Rechercher un indice..."
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 rounded-lg outline-none"
                      style={{
                        background: t.isDay ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid rgba(${t.overlayChannel}, 0.1)`,
                        color: t.text,
                        fontSize: '0.7rem',
                        fontFamily: '"IM Fell English", serif',
                      }}
                    />
                  </div>
                </div>

                {/* Hint list */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2" style={{ minHeight: 0 }}>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8">
                      <Lightbulb size={28} style={{ color: t.textDim, margin: '0 auto 0.75rem' }} />
                      <p style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                        {availablePool.length === 0 ? 'Aucun indice disponible dans le pool' : 'Aucun résultat'}
                      </p>
                    </div>
                  ) : filtered.map((cat) => {
                    const teamStyle = cat.recipientTeam ? TEAM_COLORS[cat.recipientTeam] : TEAM_COLORS.neutral;
                    return (
                      <button
                        key={cat.hint.id}
                        onClick={() => sendPickedHint(cat, shareHintPlayerId!)}
                        className="w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all hover:brightness-110 group/hint"
                        style={{
                          background: `rgba(${t.overlayChannel}, 0.03)`,
                          border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                        }}
                      >
                        {/* Priority badge */}
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5"
                          style={{
                            background: cat.hint.priority === 3 ? 'rgba(239,68,68,0.15)' : cat.hint.priority === 2 ? 'rgba(245,158,11,0.15)' : 'rgba(107,142,90,0.15)',
                            color: cat.hint.priority === 3 ? '#ef4444' : cat.hint.priority === 2 ? '#f59e0b' : '#6b8e5a',
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            fontFamily: '"Cinzel", serif',
                          }}
                        >
                          P{cat.hint.priority ?? 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {cat.resolvedText && (
                            <p style={{
                              color: t.text,
                              fontSize: '0.7rem',
                              lineHeight: 1.5,
                              fontFamily: '"IM Fell English", serif',
                              fontStyle: 'italic',
                            }}>
                              &ldquo;{cat.resolvedText}&rdquo;
                            </p>
                          )}
                          {cat.hint.imageUrl && (
                            <img
                              src={cat.hint.imageUrl}
                              alt="Indice"
                              className="rounded-lg max-h-16 object-contain mt-1.5"
                              style={{ border: `1px solid rgba(${t.overlayChannel}, 0.1)` }}
                              draggable={false}
                            />
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {cat.targetPlayer && (
                              <span className="flex items-center gap-1" style={{ fontSize: '0.5rem', color: t.textDim }}>
                                <AvatarSmall player={cat.targetPlayer} size={4} />
                                {cat.targetPlayer.name}
                              </span>
                            )}
                            <span
                              className="px-1.5 py-0 rounded-full"
                              style={{ background: teamStyle.bg, color: teamStyle.text, fontSize: '0.45rem', fontWeight: 600 }}
                            >
                              {teamStyle.emoji} {teamStyle.label}
                            </span>
                            {!cat.available && (
                              <span className="flex items-center gap-0.5 px-1.5 py-0 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: t.textDim, fontSize: '0.45rem' }}>
                                <Lock size={8} /> Verrouillé
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className="flex-shrink-0 mt-1 opacity-40 group-hover/hint:opacity-100 transition-opacity"
                          style={{ color: '#6b8e5a' }}
                        >
                          <Send size={14} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer count */}
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid rgba(${t.overlayChannel}, 0.06)` }}>
                  <span style={{ color: t.textDim, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>
                    {filtered.length} indice{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => { setShareHintPlayerId(null); setShareHintSearch(''); }}
                    className="px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                    style={{
                      background: `rgba(${t.overlayChannel}, 0.04)`,
                      border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
                      color: t.textDim,
                      fontSize: '0.6rem',
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
      , document.body)}
    </div>
  );
}

/* ================================================================
   Sub-component: Hint Image Gallery Modal
   Shows current game players + predefined avatar gallery
   ================================================================ */
function HintImageGalleryModal({
  open,
  onClose,
  onSelect,
  players,
  targetPlayerName,
  t,
  initialText = '',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string, text?: string) => void;
  players: Player[];
  targetPlayerName: string;
  t: GameThemeTokens;
  initialText?: string;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'players' | 'gallery'>('players');
  const [optionalText, setOptionalText] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(null);
      setActiveTab('players');
      setOptionalText(initialText);
      setTimeout(() => searchRef.current?.focus(), 200);
    }
  }, [open, initialText]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Players with avatars
  const playersWithAvatars = useMemo(() => {
    return players
      .filter(p => p.avatarUrl)
      .map(p => ({
        id: p.id,
        name: p.name,
        url: resolveAvatarUrl(p.avatarUrl),
      }))
      .filter((p): p is typeof p & { url: string } => !!p.url);
  }, [players]);

  const filteredPlayers = search
    ? playersWithAvatars.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : playersWithAvatars;

  const filteredGallery = search
    ? AVATAR_GALLERY.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : AVATAR_GALLERY;

  const handleConfirm = useCallback(() => {
    if (selected) {
      onSelect(selected, optionalText.trim() || undefined);
      onClose();
    }
  }, [selected, optionalText, onSelect, onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(14,17,36,0.98), rgba(20,24,48,0.98))',
          border: '1px solid rgba(212,168,67,0.2)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,168,67,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h3 style={{ color: '#e8dcc8', fontSize: '1rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
              Galerie d'images
            </h3>
            <p style={{ color: '#7c8db5', fontSize: '0.7rem', marginTop: '0.15rem' }}>
              Indice image pour <span style={{ color: '#d4a843' }}>{targetPlayerName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X size={16} style={{ color: '#7c8db5' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-2 shrink-0">
          <button
            onClick={() => setActiveTab('players')}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              fontFamily: '"Cinzel", serif',
              background: activeTab === 'players' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === 'players' ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === 'players' ? '#d4a843' : '#7c8db5',
            }}
          >
            Joueurs ({playersWithAvatars.length})
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              fontFamily: '"Cinzel", serif',
              background: activeTab === 'gallery' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === 'gallery' ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === 'gallery' ? '#d4a843' : '#7c8db5',
            }}
          >
            Galerie ({AVATAR_GALLERY.length})
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#7c8db5' }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${search ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: '#e8dcc8',
                fontSize: '0.75rem',
                fontFamily: '"Cinzel", serif',
              }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
          {activeTab === 'players' && (
            <>
              {filteredPlayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <p style={{ color: '#4a5568', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>
                    {playersWithAvatars.length === 0 ? 'Aucun joueur avec avatar' : 'Aucun résultat'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                  {filteredPlayers.map((p) => {
                    const isSelected = selected === p.url;
                    return (
                      <button
                        key={`player-${p.id}`}
                        onClick={() => setSelected(p.url!)}
                        className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'rgba(212,168,67,0.15)' : 'transparent',
                          border: isSelected ? '2px solid rgba(212,168,67,0.5)' : '2px solid transparent',
                        }}
                      >
                        <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shrink-0"
                          style={{ background: 'linear-gradient(to bottom, #070b1a, #0f1629)' }}
                        >
                          <img src={p.url!} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ background: 'rgba(212,168,67,0.3)' }}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#d4a843' }}>
                                <Check size={14} style={{ color: '#0a0e1a' }} />
                              </div>
                            </motion.div>
                          )}
                        </div>
                        <span
                          className="text-center truncate w-full"
                          style={{
                            color: isSelected ? '#d4a843' : '#7c8db5',
                            fontSize: '0.55rem',
                            fontFamily: '"Cinzel", serif',
                            lineHeight: 1.2,
                          }}
                        >
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {activeTab === 'gallery' && (
            <>
              {filteredGallery.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <p style={{ color: '#4a5568', fontSize: '0.8rem', fontFamily: '"Cinzel", serif' }}>
                    Aucun avatar trouvé
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2.5">
                  {filteredGallery.map((avatar) => {
                    const isSelected = selected === avatar.url;
                    return (
                      <button
                        key={`gallery-${avatar.id}`}
                        onClick={() => setSelected(avatar.url)}
                        className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'rgba(212,168,67,0.15)' : 'transparent',
                          border: isSelected ? '2px solid rgba(212,168,67,0.5)' : '2px solid transparent',
                        }}
                      >
                        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0"
                          style={{ background: 'linear-gradient(to bottom, #070b1a, #0f1629)' }}
                        >
                          <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute inset-0 flex items-center justify-center"
                              style={{ background: 'rgba(212,168,67,0.3)' }}
                            >
                              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#d4a843' }}>
                                <Check size={14} style={{ color: '#0a0e1a' }} />
                              </div>
                            </motion.div>
                          )}
                        </div>
                        <span
                          className="text-center truncate w-full"
                          style={{
                            color: isSelected ? '#d4a843' : '#7c8db5',
                            fontSize: '0.5rem',
                            fontFamily: '"Cinzel", serif',
                            lineHeight: 1.2,
                          }}
                        >
                          {avatar.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Optional text input (visible when image selected) */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden shrink-0"
            >
              <div className="px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={12} style={{ color: '#d4a843' }} />
                  <span style={{ color: '#e8dcc8', fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                    Texte associé <span style={{ color: '#4a5568' }}>(optionnel)</span>
                  </span>
                </div>
                <input
                  type="text"
                  value={optionalText}
                  onChange={(e) => setOptionalText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && selected) handleConfirm(); }}
                  placeholder="Ex: Ce joueur est {role}... / les yeux {durole}..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${optionalText ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    color: '#e8dcc8',
                    fontSize: '0.75rem',
                    fontFamily: '"Cinzel", serif',
                  }}
                />
                {(optionalText.includes('{role}') || optionalText.includes('{durole}')) && (
                  <p style={{ color: '#6b8e5a', fontSize: '0.6rem', marginTop: '0.35rem' }}>
                    ✓ <span style={{ fontFamily: '"Cinzel", serif' }}>{'{role}'}</span> → le/la · <span style={{ fontFamily: '"Cinzel", serif' }}>{'{durole}'}</span> → du/de la — résolu avec le rôle du joueur
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ color: '#4a5568', fontSize: '0.65rem' }}>
            {activeTab === 'players'
              ? `${filteredPlayers.length} joueur${filteredPlayers.length > 1 ? 's' : ''}`
              : `${AVATAR_GALLERY.length} avatars`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#7c8db5',
                fontSize: '0.75rem',
                fontFamily: '"Cinzel", serif',
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected === null}
              className="px-4 py-1.5 rounded-lg transition-all"
              style={{
                background: selected ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selected ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`,
                color: selected ? '#d4a843' : '#4a5568',
                fontSize: '0.75rem',
                fontFamily: '"Cinzel", serif',
                cursor: selected ? 'pointer' : 'not-allowed',
              }}
            >
              Ajouter comme indice
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

/* ================================================================
   Sub-component: Individual hint row within a player card
   ================================================================ */
function PlayerHintRow({
  cat,
  onReveal,
  onDelete,
  t,
  recipients,
}: {
  cat: CategorizedHint;
  onReveal: () => void;
  onDelete: (id: number) => void;
  t: GameThemeTokens;
  recipients?: Player[];
}) {
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const { hint, targetPlayer, recipientTeam, resolvedText, available } = cat;
  const isRevealed = hint.revealed;
  const isPending = recipientTeam === 'pending';
  const tc = recipientTeam && recipientTeam !== 'pending'
    ? TEAM_COLORS[recipientTeam as 'village' | 'wolves']
    : recipientTeam === 'pending' ? TEAM_COLORS.pending : null;

  return (
    <motion.div
      layout
      className="rounded-lg px-3 py-2 flex items-center gap-2.5 group"
      style={{
        background: isRevealed
          ? 'rgba(139,92,246,0.08)'
          : isPending
            ? 'rgba(245,158,11,0.02)'
            : 'rgba(255,255,255,0.01)',
        border: `1px solid ${isRevealed ? 'rgba(139,92,246,0.2)' : isPending ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)'}`,
        opacity: !available && !isRevealed ? 0.4 : isRevealed ? 1 : 0.55,
      }}
    >
      {/* Priority badge */}
      <span
        className="shrink-0 rounded px-1 py-0.5 font-bold select-none"
        style={{
          fontSize: '0.42rem',
          fontFamily: '"Cinzel", serif',
          background: isRevealed
            ? 'rgba(139,92,246,0.15)'
            : (hint.priority ?? 1) === 1 ? 'rgba(239,68,68,0.12)' : (hint.priority ?? 1) === 2 ? 'rgba(245,158,11,0.12)' : 'rgba(107,142,90,0.12)',
          color: isRevealed
            ? '#8b5cf6'
            : (hint.priority ?? 1) === 1 ? '#ef4444' : (hint.priority ?? 1) === 2 ? '#f59e0b' : '#6b8e5a',
          border: `1px solid ${isRevealed ? 'rgba(139,92,246,0.25)' : (hint.priority ?? 1) === 1 ? 'rgba(239,68,68,0.2)' : (hint.priority ?? 1) === 2 ? 'rgba(245,158,11,0.2)' : 'rgba(107,142,90,0.2)'}`,
        }}
        title={`Priorité ${hint.priority ?? 1}`}
      >
        P{hint.priority ?? 1}
      </span>

      {/* Hint content */}
      <div className="flex-1 min-w-0">
        {hint.imageUrl && (
          <img
            src={hint.imageUrl}
            alt="Indice image"
            className="rounded-lg max-h-24 object-contain mb-1.5"
            style={{ border: `1px solid ${isRevealed ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)'}` }}
          />
        )}
        {hint.text ? (
          <p
            className="truncate"
            style={{
              color: isRevealed ? '#8b5cf6' : t.text,
              fontSize: '0.68rem',
              lineHeight: 1.4,
              textDecoration: isRevealed ? 'line-through' : 'none',
              opacity: isRevealed ? 0.7 : 1,
            }}
            title={hint.text}
          >
            {hint.text}
          </p>
        ) : !hint.imageUrl ? (
          <p style={{ color: t.textDim, fontSize: '0.65rem', fontStyle: 'italic' }}>(vide)</p>
        ) : null}
        {/* Role resolution preview */}
        {hint.text && (hint.text.includes('{role}') || hint.text.includes('{durole}')) && !isRevealed && (
          <p style={{ color: isPending ? '#f59e0b' : t.textDim, fontSize: '0.48rem', marginTop: 1, fontStyle: 'italic' }}>
            {isPending ? '⏳ {role}/{durole} résolu après attribution' : `→ ${resolvedText}`}
          </p>
        )}
        {isRevealed && hint.revealedAt && (
          <p style={{ color: '#8b5cf6', fontSize: '0.45rem', marginTop: 1 }}>
            ✓ {new Date(hint.revealedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Team badge */}
      {tc && !isRevealed && (
        <span
          className="shrink-0 px-1.5 py-0.5 rounded text-center"
          style={{ background: `${tc.text}12`, color: tc.text, fontSize: '0.42rem', fontWeight: 600 }}
        >
          {tc.emoji}
        </span>
      )}

      {/* Recipients count badge (revealed hints only) */}
      {isRevealed && recipients && recipients.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowRecipientsModal(true); }}
          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors hover:brightness-125 cursor-pointer"
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
          title={`Envoyé à ${recipients.length} joueur${recipients.length > 1 ? 's' : ''}`}
        >
          <Users size={9} style={{ color: '#8b5cf6' }} />
          <span style={{ color: '#8b5cf6', fontSize: '0.48rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
            {recipients.length}
          </span>
        </button>
      )}

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
        {!isRevealed && !available && !isPending && targetPlayer?.alive && (
          <span
            className="p-1 rounded"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            title={`Verrouillé — révélez d'abord un indice P${(hint.priority ?? 1) - 1} sur ce joueur`}
          >
            <Lock size={11} />
          </span>
        )}
        {!isRevealed && available && (
          <button
            onClick={onReveal}
            className="p-1 rounded transition-colors hover:bg-white/5"
            style={{ color: t.gold }}
            title="Révéler"
          >
            <Send size={12} />
          </button>
        )}
        {!isRevealed && (
          <button
            onClick={() => onDelete(hint.id)}
            className="p-1 rounded transition-colors hover:bg-red-500/10"
            style={{ color: t.isDay ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)' }}
            title="Supprimer"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Recipients modal */}
      {createPortal(<AnimatePresence>
        {showRecipientsModal && recipients && recipients.length > 0 && (
          <motion.div
            key="recipients-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowRecipientsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl p-5 w-[90vw] max-w-sm"
              style={{
                background: t.isDay ? 'rgba(255,255,255,0.95)' : 'rgba(15,20,40,0.97)',
                border: '1px solid rgba(139,92,246,0.25)',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: '#8b5cf6' }} />
                  <span style={{ color: '#8b5cf6', fontSize: '0.75rem', fontWeight: 700, fontFamily: '"Cinzel Decorative", serif' }}>
                    Destinataires
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
                  >
                    {recipients.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowRecipientsModal(false)}
                  className="p-1 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: t.textDim }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Hint preview */}
              <div
                className="rounded-lg px-3 py-2 mb-3"
                style={{
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}
              >
                {hint.imageUrl && (
                  <img
                    src={hint.imageUrl}
                    alt="Indice"
                    className="rounded-md max-h-16 object-contain mb-1.5"
                    style={{ border: '1px solid rgba(139,92,246,0.15)' }}
                  />
                )}
                {hint.text && (
                  <p style={{ color: '#8b5cf6', fontSize: '0.6rem', lineHeight: 1.4, opacity: 0.8 }}>
                    {resolvedText}
                  </p>
                )}
                {hint.revealedAt && (
                  <p style={{ color: '#8b5cf6', fontSize: '0.45rem', marginTop: 2, opacity: 0.5 }}>
                    Révélé à {new Date(hint.revealedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>

              {/* Recipient list */}
              <div
                className="rounded-lg overflow-y-auto space-y-0.5 p-1"
                style={{
                  maxHeight: '40vh',
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {recipients.map((p) => {
                  const pRole = getRoleById(p.role);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(139,92,246,0.04)' }}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${pRole?.color ?? '#8b5cf6'}15` }}>
                        <AvatarSmall player={p} size={5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: t.text, fontSize: '0.7rem', fontWeight: 600 }}>
                          {p.name}
                        </p>
                      </div>
                      {pRole && (
                        <span style={{ color: pRole.color, fontSize: '0.5rem', opacity: 0.7 }}>
                          {pRole.emoji} {pRole.name}
                        </span>
                      )}
                      {!p.alive && (
                        <span style={{ color: '#ef4444', fontSize: '0.42rem', fontWeight: 600 }}>💀</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </motion.div>
  );
}

/* ================================================================
   Sub-component: Player card with hints
   ================================================================ */
function PlayerCard({
  player,
  isSelected,
  playerHints,
  onToggle,
  onReveal,
  onDelete,
  onAddHint,
  onImageUpload,
  onGalleryOpen,
  uploadingImage,
  newText,
  setNewText,
  newPriority,
  setNewPriority,
  inputRef,
  t,
  cardBg,
  cardBorder,
  inputBg,
  inputBorder,
  hintRecipientsMap,
}: {
  player: Player;
  isSelected: boolean;
  playerHints: CategorizedHint[];
  onToggle: (id: number) => void;
  onReveal: (hintId: number) => void;
  onDelete: (id: number) => void;
  onAddHint: (playerId: number) => void;
  onImageUpload: (playerId: number) => void;
  onGalleryOpen: (playerId: number) => void;
  uploadingImage: boolean;
  newText: string;
  setNewText: (text: string) => void;
  newPriority: 1 | 2 | 3;
  setNewPriority: (p: 1 | 2 | 3) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  t: GameThemeTokens;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  hintRecipientsMap?: Map<number, Player[]>;
}) {
  const hintCount = playerHints.length;
  const revealedCount = playerHints.filter((c) => c.hint.revealed).length;
  const availableCount = playerHints.filter((c) => c.available).length;
  const role = getRoleById(player.role);
  const team = computeRecipientTeam(player);
  const tc = team && team !== 'pending' ? TEAM_COLORS[team] : team === 'pending' ? TEAM_COLORS.pending : null;
  const isDead = !player.alive;

  return (
    <div
      key={player.id}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isSelected ? (tc?.border ?? `${t.gold}40`) : cardBorder}`,
        background: isSelected ? `${tc?.bg ?? 'rgba(184,134,11,0.06)'}` : cardBg,
        boxShadow: isSelected ? `0 0 20px ${tc?.text ?? t.gold}08` : 'none',
      }}
    >
      {/* Player row (clickable) */}
      <button
        onClick={() => onToggle(player.id)}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors group"
        style={{ background: 'transparent', opacity: revealedCount > 0 ? 1 : 0.5 }}
      >
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
          style={{
            background: isDead ? 'rgba(255,0,0,0.1)' : `${role?.color ?? t.gold}15`,
            border: `2px solid ${isDead ? 'rgba(255,0,0,0.2)' : isSelected ? (tc?.border ?? `${t.gold}50`) : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          <AvatarSmall player={player} size={7} />
          {isDead && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#1a0000', border: '1px solid rgba(255,0,0,0.3)' }}>
              <Skull size={8} style={{ color: '#c41e3a' }} />
            </div>
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{
            color: isDead ? 'rgba(120,100,80,0.55)' : t.text,
            fontSize: '0.8rem',
            fontWeight: 600,
            textDecoration: isDead ? 'line-through' : 'none',
          }}>
            {player.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {role ? (
              <span style={{ color: role.color ?? t.textDim, fontSize: '0.55rem' }}>
                {role.emoji} {role.name}
              </span>
            ) : (
              <span style={{ color: '#f59e0b', fontSize: '0.55rem' }}>
                ⏳ Rôle non assigné
              </span>
            )}
            {tc && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: `${tc.text}15`, color: tc.text, fontSize: '0.45rem', fontWeight: 600 }}
              >
                → {tc.label}
              </span>
            )}
            {team === 'wolves' && (
              <span
                className="px-1.5 py-0.5 rounded flex items-center gap-0.5"
                style={{ background: `${TEAM_COLORS.villageois.text}12`, border: `1px solid ${TEAM_COLORS.villageois.text}20`, color: TEAM_COLORS.villageois.text, fontSize: '0.45rem', fontWeight: 600 }}
              >
                <Home size={8} style={{ opacity: 0.8 }} />
                → Villageois
              </span>
            )}
          </div>
        </div>

        {/* Hint count badge */}
        <div className="flex items-center gap-2 shrink-0">
          {hintCount > 0 && (
            <div className="flex items-center gap-1">
              {revealedCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                  style={{ background: 'rgba(139,92,246,0.12)', fontSize: '0.55rem', color: '#8b5cf6' }}
                >
                  <Check size={8} />{revealedCount}
                </span>
              )}
              <span
                className="px-2 py-0.5 rounded-md font-bold"
                style={{
                  background: availableCount > 0 ? `${t.gold}20` : 'rgba(255,255,255,0.05)',
                  color: availableCount > 0 ? t.gold : t.textDim,
                  fontSize: '0.6rem',
                  fontFamily: '"Cinzel", serif',
                }}
              >
                {hintCount}
              </span>
            </div>
          )}
          <motion.div
            animate={{ rotate: isSelected ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} style={{ color: isSelected ? (tc?.text ?? t.gold) : t.textDim }} />
          </motion.div>
        </div>
      </button>

      {/* Expanded: hints + add input */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3.5 space-y-2"
              style={{ borderTop: `1px solid ${cardBorder}` }}
            >
              {/* Existing hints */}
              {playerHints.length > 0 ? (
                <div className="space-y-1.5 pt-2.5">
                  {playerHints.map((cat) => (
                    <PlayerHintRow
                      key={cat.hint.id}
                      cat={cat}
                      onReveal={() => { onReveal(cat.hint.id); }}
                      onDelete={onDelete}
                      t={t}
                      recipients={hintRecipientsMap?.get(cat.hint.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-3 text-center">
                  <p style={{ color: t.textDim, fontSize: '0.6rem', fontStyle: 'italic' }}>
                    Aucun indice — ajoutez-en ci-dessous
                  </p>
                </div>
              )}

              {/* Add hint input */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <MessageSquarePlus size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: t.textDim }} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && newText.trim()) onAddHint(player.id); }}
                    placeholder="{role} porte du rouge... / les yeux {durole}..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: inputBg,
                      border: `1px solid ${inputBorder}`,
                      color: t.text,
                      fontSize: '0.72rem',
                    }}
                  />
                </div>
                {/* Priority selector */}
                <div className="flex items-center rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid rgba(255,255,255,0.08)`, background: 'rgba(255,255,255,0.03)' }}>
                  <button
                    onClick={() => setNewPriority(Math.max(1, newPriority - 1) as 1 | 2 | 3)}
                    disabled={newPriority <= 1}
                    className="px-1.5 py-1.5 transition-colors hover:bg-white/5"
                    style={{ color: newPriority <= 1 ? 'rgba(255,255,255,0.1)' : t.textDim, cursor: newPriority <= 1 ? 'not-allowed' : 'pointer' }}
                    title="Diminuer priorité"
                  >
                    <Minus size={10} />
                  </button>
                  <span
                    className="px-1.5 py-0.5 font-bold select-none"
                    style={{
                      color: newPriority === 1 ? '#ef4444' : newPriority === 2 ? '#f59e0b' : '#6b8e5a',
                      fontSize: '0.6rem',
                      fontFamily: '"Cinzel", serif',
                      minWidth: '1.2rem',
                      textAlign: 'center',
                    }}
                    title={`Priorité ${newPriority}`}
                  >
                    P{newPriority}
                  </span>
                  <button
                    onClick={() => setNewPriority(Math.min(3, newPriority + 1) as 1 | 2 | 3)}
                    disabled={newPriority >= 3}
                    className="px-1.5 py-1.5 transition-colors hover:bg-white/5"
                    style={{ color: newPriority >= 3 ? 'rgba(255,255,255,0.1)' : t.textDim, cursor: newPriority >= 3 ? 'not-allowed' : 'pointer' }}
                    title="Augmenter priorité"
                  >
                    <Plus size={10} />
                  </button>
                </div>
                <button
                  onClick={() => onAddHint(player.id)}
                  disabled={!newText.trim()}
                  className="px-3 py-2 rounded-lg flex items-center gap-1 transition-all active:scale-95"
                  style={{
                    background: newText.trim() ? 'linear-gradient(135deg, #b8860b, #d4a843)' : 'rgba(255,255,255,0.03)',
                    color: newText.trim() ? '#0a0e1a' : t.textDim,
                    fontSize: '0.65rem',
                    fontFamily: '"Cinzel", serif',
                    fontWeight: 700,
                    cursor: newText.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => onImageUpload(player.id)}
                  disabled={uploadingImage}
                  className="px-2.5 py-2 rounded-lg flex items-center gap-1 transition-all active:scale-95 hover:bg-white/5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    color: t.textDim,
                    fontSize: '0.6rem',
                    opacity: uploadingImage ? 0.5 : 1,
                  }}
                  title="Ajouter un indice image"
                >
                  {uploadingImage ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Clock size={12} />
                    </motion.div>
                  ) : (
                    <ImagePlus size={13} />
                  )}
                </button>
                <button
                  onClick={() => onGalleryOpen(player.id)}
                  className="px-2.5 py-2 rounded-lg flex items-center gap-1 transition-all active:scale-95 hover:bg-white/5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid rgba(255,255,255,0.08)`,
                    color: t.textDim,
                    fontSize: '0.6rem',
                  }}
                  title="Choisir depuis la galerie"
                >
                  <Image size={13} />
                </button>
              </div>

              {/* Preview */}
              {newText.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg px-3 py-2 flex items-start gap-2"
                  style={{
                    background: team === 'pending' ? 'rgba(245,158,11,0.06)' : tc ? tc.bg : 'rgba(255,255,255,0.02)',
                    border: `1px dashed ${team === 'pending' ? 'rgba(245,158,11,0.2)' : tc ? tc.border : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <Eye size={10} style={{ color: tc?.text ?? t.textDim, marginTop: 2, shrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ color: t.textSecondary, fontSize: '0.6rem' }}>
                      {team === 'pending' ? newText : resolveHintText(newText, player)}
                    </p>
                    <p style={{ color: tc?.text ?? t.textDim, fontSize: '0.48rem', marginTop: 1 }}>
                      {team === 'pending'
                        ? '⏳ Sera catégorisé après attribution des rôles'
                        : tc ? `${tc.emoji} → ${tc.label}` : '→ Aucune équipe cible'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Helper text (only if no hints yet) */}
              {playerHints.length === 0 && !newText.trim() && (
                <p style={{ color: t.textDim, fontSize: '0.5rem', lineHeight: 1.5 }}>
                  💡 Utilisez <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 3px', borderRadius: 2, fontSize: '0.5rem' }}>{'{role}'}</code> (le/la) ou <code style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', padding: '1px 3px', borderRadius: 2, fontSize: '0.5rem' }}>{'{durole}'}</code> (du/de la) pour insérer le rôle automatiquement.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ================================================================
   Exported helper: compute total available dynamic hints count
   Used by GameMasterPage for the tab badge.
   ================================================================ */
export function countAvailableDynamicHints(state: GameState): number {
  const dynamicHints = state.dynamicHints ?? [];
  const players = state.players;
  return dynamicHints.filter((h) => {
    if (h.revealed) return false;
    const target = players.find((p) => p.id === h.targetPlayerId);
    return target && target.alive;
  }).length;
}