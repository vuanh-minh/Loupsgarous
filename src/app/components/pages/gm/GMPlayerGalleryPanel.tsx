import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Search, Plus, Trash2, Lightbulb,
  Check, X, UserPlus, Download, ClipboardList,
  Type, Hash, List as ListIcon, ImagePlus, Loader2,
  Shield, ChevronDown, Map as MapIcon,
} from 'lucide-react';
import type { GameState, DynamicHint, TaskTemplate, QuestTaskInputType } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import type { PlayerEntry } from '../setup/setupConstants';
import { AVATAR_GALLERY, type GalleryAvatar } from '../../../data/avatarGallery';
import { galleryRef, getGalleryId } from '../../../data/avatarResolver';
import { ROLES, getRoleById } from '../../../data/roles';
import { API_BASE, jsonAuthHeaders, authHeaders } from '../../../context/apiConfig';
import { GalleryQuestsTab } from './GalleryQuestsTab';

/* ================================================================
   Types
   ================================================================ */

export interface GalleryHintTemplate {
  id: number;
  text: string;
  priority: 1 | 2 | 3;
  imageUrl?: string;
}

/** Map of galleryId -> hint templates */
export type GalleryHintsMap = Record<number, GalleryHintTemplate[]>;

/** Task template linked to a gallery player (persistent across games) */
export interface GalleryTaskTemplate {
  id: number;
  question: string;
  inputType: QuestTaskInputType;
  correctAnswer: string;
  choices?: string[];
  imageUrl?: string;
}

/** Map of galleryId -> task templates */
export type GalleryTasksMap = Record<number, GalleryTaskTemplate[]>;

/** Map of galleryId -> default role id */
export type GalleryRolesMap = Record<number, string>;

/* ================================================================
   Helpers
   ================================================================ */

function nextTemplateId(templates: { id: number }[]): number {
  if (templates.length === 0) return 1;
  return Math.max(...templates.map((h) => h.id)) + 1;
}

const INPUT_TYPE_LABELS: Record<QuestTaskInputType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Texte', icon: <Type size={10} /> },
  code: { label: 'Code', icon: <Hash size={10} /> },
  'player-select': { label: 'Joueur', icon: <Users size={10} /> },
  'multiple-choice': { label: 'QCM', icon: <ListIcon size={10} /> },
};

const PRIORITY_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  2: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
  3: { bg: 'rgba(107,142,90,0.12)', border: 'rgba(107,142,90,0.3)', text: '#6b8e5a' },
};

/* ================================================================
   Main Component
   ================================================================ */
export function GMPlayerGalleryPanel({
  state,
  onUpdateState,
  t,
  isMobile,
  playerEntries,
  setPlayerEntries,
}: {
  state: GameState;
  onUpdateState: (updater: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  isMobile: boolean;
  playerEntries: PlayerEntry[];
  setPlayerEntries: React.Dispatch<React.SetStateAction<PlayerEntry[]>>;
  onUploadAvatar?: (file: File, playerId: number, isPreGame: boolean) => void;
  uploadingPlayerId?: number | null;
}) {
  const gameStarted = state.screen === 'game' || state.screen === 'vote' || state.screen === 'end';

  // ── Gallery sub-tab ──
  type GallerySubTab = 'players' | 'quests';
  const [gallerySubTab, setGallerySubTab] = useState<GallerySubTab>('players');

  // ── Local state ──
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newHintText, setNewHintText] = useState('');
  const [newHintPriority, setNewHintPriority] = useState<1 | 2 | 3>(1);
  const hintInputRef = useRef<HTMLInputElement | null>(null);
  const keyboardNavRef = useRef(false);
  const [galleryHints, setGalleryHints] = useState<GalleryHintsMap>({});
  const [loadingHints, setLoadingHints] = useState(true);
  const [savingHints, setSavingHints] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gallery task templates (persistent) ──
  const [galleryTasks, setGalleryTasks] = useState<GalleryTasksMap>({});
  const [savingTasks, setSavingTasks] = useState(false);
  const saveTasksTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newTaskQuestion, setNewTaskQuestion] = useState('');
  const [newTaskInputType, setNewTaskInputType] = useState<QuestTaskInputType>('text');
  const [newTaskCorrectAnswer, setNewTaskCorrectAnswer] = useState('');
  const [newTaskChoices, setNewTaskChoices] = useState<string[]>(['', '', '', '']);
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  // ── Image upload state ──
  const [newHintImageUrl, setNewHintImageUrl] = useState<string | undefined>();
  const [newTaskImageUrl, setNewTaskImageUrl] = useState<string | undefined>();
  const [uploadingHintImage, setUploadingHintImage] = useState(false);
  const [uploadingTaskImage, setUploadingTaskImage] = useState(false);
  const hintImageInputRef = useRef<HTMLInputElement | null>(null);
  const taskImageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Gallery default roles (persistent) ──
  const [galleryRoles, setGalleryRoles] = useState<GalleryRolesMap>({});
  const [savingRoles, setSavingRoles] = useState(false);
  const saveRolesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [deletedAvatarIds, setDeletedAvatarIds] = useState<Set<number>>(new Set());

  // Track which gallery IDs are already in the current game
  const usedGalleryIds = useMemo(() => {
    const ids = new Set<number>();
    const allPlayers = state.players.length > 0 ? state.players : playerEntries;
    allPlayers.forEach((p) => {
      const gid = getGalleryId(p.avatarUrl);
      if (gid !== null) ids.add(gid);
    });
    return ids;
  }, [state.players, playerEntries]);

  // ── Load gallery hints from server ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/hints`, { headers: jsonAuthHeaders() });
        const data = await res.json();
        if (data.hints) setGalleryHints(data.hints);
      } catch (err) {
        console.error('Failed to load gallery hints:', err);
      } finally {
        setLoadingHints(false);
      }
    })();
  }, []);

  // ── Load deleted avatar IDs from server ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/deleted`, { headers: jsonAuthHeaders() });
        const data = await res.json();
        if (data.deleted && Array.isArray(data.deleted)) {
          setDeletedAvatarIds(new Set(data.deleted));
        }
      } catch (err) {
        console.error('Failed to load deleted avatar IDs:', err);
      }
    })();
  }, []);

  // ── Debounced save to server ──
  const saveGalleryHints = useCallback((newHints: GalleryHintsMap) => {
    setGalleryHints(newHints);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSavingHints(true);
      try {
        await fetch(`${API_BASE}/gallery/hints`, {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ password: 'loupgarou', hints: newHints }),
        });
      } catch (err) {
        console.error('Failed to save gallery hints:', err);
      } finally {
        setSavingHints(false);
      }
    }, 800);
  }, []);

  // ── Load gallery tasks from server ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/tasks`, { headers: jsonAuthHeaders() });
        const data = await res.json();
        if (data.tasks) setGalleryTasks(data.tasks);
      } catch (err) {
        console.error('Failed to load gallery tasks:', err);
      }
    })();
  }, []);

  // ── Debounced save tasks to server ──
  const saveGalleryTasks = useCallback((newTasks: GalleryTasksMap) => {
    setGalleryTasks(newTasks);
    if (saveTasksTimeoutRef.current) clearTimeout(saveTasksTimeoutRef.current);
    saveTasksTimeoutRef.current = setTimeout(async () => {
      setSavingTasks(true);
      try {
        await fetch(`${API_BASE}/gallery/tasks`, {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ password: 'loupgarou', tasks: newTasks }),
        });
      } catch (err) {
        console.error('Failed to save gallery tasks:', err);
      } finally {
        setSavingTasks(false);
      }
    }, 800);
  }, []);

  // ── Load gallery roles from server ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/gallery/roles`, { headers: jsonAuthHeaders() });
        const data = await res.json();
        if (data.roles) setGalleryRoles(data.roles);
      } catch (err) {
        console.error('Failed to load gallery roles:', err);
      }
    })();
  }, []);

  // ── Debounced save roles to server ──
  const saveGalleryRoles = useCallback((newRoles: GalleryRolesMap) => {
    setGalleryRoles(newRoles);
    if (saveRolesTimeoutRef.current) clearTimeout(saveRolesTimeoutRef.current);
    saveRolesTimeoutRef.current = setTimeout(async () => {
      setSavingRoles(true);
      try {
        await fetch(`${API_BASE}/gallery/roles`, {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ password: 'loupgarou', roles: newRoles }),
        });
      } catch (err) {
        console.error('Failed to save gallery roles:', err);
      } finally {
        setSavingRoles(false);
      }
    }, 800);
  }, []);

  // ── Set/clear default role for selected player ──
  const setDefaultRole = useCallback((roleId: string | undefined) => {
    if (selectedGalleryId === null) return;
    const newRoles = { ...galleryRoles };
    if (roleId) {
      newRoles[selectedGalleryId] = roleId;
    } else {
      delete newRoles[selectedGalleryId];
    }
    saveGalleryRoles(newRoles);
    setRoleDropdownOpen(false);
  }, [selectedGalleryId, galleryRoles, saveGalleryRoles]);

  // ── Delete gallery player data ──
  const deleteGalleryPlayer = useCallback(async (galleryId: number) => {
    setDeletingPlayer(true);
    try {
      const res = await fetch(`${API_BASE}/gallery/player/${galleryId}`, {
        method: 'DELETE',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ password: 'loupgarou' }),
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Delete gallery player error:', data.error);
        return;
      }
      // Clear local state
      setGalleryHints((prev) => { const n = { ...prev }; delete n[galleryId]; return n; });
      setGalleryTasks((prev) => { const n = { ...prev }; delete n[galleryId]; return n; });
      setGalleryRoles((prev) => { const n = { ...prev }; delete n[galleryId]; return n; });
      setDeletedAvatarIds((prev) => new Set([...prev, galleryId]));
      setSelectedGalleryId(null);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Delete gallery player network error:', err);
    } finally {
      setDeletingPlayer(false);
    }
  }, []);

  // ── Filtered gallery avatars ──
  const filteredAvatars = useMemo(() => {
    const base = AVATAR_GALLERY.filter((a) => !deletedAvatarIds.has(a.id));
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter((a) => a.name.toLowerCase().includes(q));
  }, [searchQuery, deletedAvatarIds]);

  const selectedAvatar = useMemo(
    () => (selectedGalleryId !== null ? AVATAR_GALLERY.find((a) => a.id === selectedGalleryId) ?? null : null),
    [selectedGalleryId],
  );

  const selectedHints = useMemo(
    () => (selectedGalleryId !== null ? galleryHints[selectedGalleryId] ?? [] : []),
    [selectedGalleryId, galleryHints],
  );

  const selectedTasks = useMemo(
    () => (selectedGalleryId !== null ? galleryTasks[selectedGalleryId] ?? [] : []),
    [selectedGalleryId, galleryTasks],
  );

  // ── Desktop arrow-key navigation through gallery grid ──
  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const cols = 5;
      const ids = filteredAvatars.map(a => a.id);
      if (ids.length === 0) return;
      const currentIdx = selectedGalleryId !== null ? ids.indexOf(selectedGalleryId) : -1;
      let nextIdx = -1;
      switch (e.key) {
        case 'ArrowRight': nextIdx = currentIdx < ids.length - 1 ? currentIdx + 1 : currentIdx; break;
        case 'ArrowLeft': nextIdx = currentIdx > 0 ? currentIdx - 1 : currentIdx; break;
        case 'ArrowDown': nextIdx = currentIdx + cols < ids.length ? currentIdx + cols : currentIdx; break;
        case 'ArrowUp': nextIdx = currentIdx - cols >= 0 ? currentIdx - cols : currentIdx; break;
        default: return;
      }
      e.preventDefault();
      if (nextIdx === -1) nextIdx = 0;
      const nextId = ids[nextIdx];
      if (!usedGalleryIds.has(nextId)) {
        keyboardNavRef.current = true;
        setSelectedGalleryId(nextId);
        // Auto-scroll the selected card into view
        requestAnimationFrame(() => {
          document.querySelector(`[data-avatar-id="${nextId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, filteredAvatars, selectedGalleryId, usedGalleryIds]);

  // Focus hint input when selecting a player (skip during keyboard navigation)
  useEffect(() => {
    if (selectedGalleryId !== null) {
      if (keyboardNavRef.current) {
        keyboardNavRef.current = false;
      } else {
        setTimeout(() => hintInputRef.current?.focus(), 200);
      }
    }
  }, [selectedGalleryId]);

  // ── Add hint template ──
  const addHint = useCallback(() => {
    if (selectedGalleryId === null || (!newHintText.trim() && !newHintImageUrl)) return;
    const current = galleryHints[selectedGalleryId] ?? [];
    const id = nextTemplateId(current);
    const newHints = {
      ...galleryHints,
      [selectedGalleryId]: [
        ...current,
        { id, text: newHintText.trim(), priority: newHintPriority, imageUrl: newHintImageUrl },
      ],
    };
    saveGalleryHints(newHints);
    setNewHintText('');
    setNewHintImageUrl(undefined);
    setTimeout(() => hintInputRef.current?.focus(), 50);
  }, [selectedGalleryId, newHintText, newHintPriority, newHintImageUrl, galleryHints, saveGalleryHints]);

  // ── Delete hint template ──
  const deleteHint = useCallback((hintId: number) => {
    if (selectedGalleryId === null) return;
    const current = galleryHints[selectedGalleryId] ?? [];
    const newHints = {
      ...galleryHints,
      [selectedGalleryId]: current.filter((h) => h.id !== hintId),
    };
    saveGalleryHints(newHints);
  }, [selectedGalleryId, galleryHints, saveGalleryHints]);

  // ── Add task template ──
  const addTask = useCallback(() => {
    if (selectedGalleryId === null || !newTaskQuestion.trim() || !newTaskCorrectAnswer.trim()) return;
    const current = galleryTasks[selectedGalleryId] ?? [];
    const id = nextTemplateId(current);
    const newTasks = {
      ...galleryTasks,
      [selectedGalleryId]: [
        ...current,
        {
          id,
          question: newTaskQuestion.trim(),
          inputType: newTaskInputType,
          correctAnswer: newTaskCorrectAnswer.trim(),
          choices: newTaskInputType === 'multiple-choice' ? newTaskChoices.filter((c) => c.trim()) : undefined,
          imageUrl: newTaskImageUrl,
        },
      ],
    };
    saveGalleryTasks(newTasks);
    setNewTaskQuestion('');
    setNewTaskInputType('text');
    setNewTaskCorrectAnswer('');
    setNewTaskChoices(['', '', '', '']);
    setNewTaskImageUrl(undefined);
    setTimeout(() => taskInputRef.current?.focus(), 50);
  }, [selectedGalleryId, newTaskQuestion, newTaskInputType, newTaskCorrectAnswer, newTaskChoices, newTaskImageUrl, galleryTasks, saveGalleryTasks]);

  // ── Delete task template ──
  const deleteTask = useCallback((taskId: number) => {
    if (selectedGalleryId === null) return;
    const current = galleryTasks[selectedGalleryId] ?? [];
    const newTasks = {
      ...galleryTasks,
      [selectedGalleryId]: current.filter((h) => h.id !== taskId),
    };
    saveGalleryTasks(newTasks);
  }, [selectedGalleryId, galleryTasks, saveGalleryTasks]);

  // ── Import single player into current game ──
  const importPlayer = useCallback((avatar: GalleryAvatar) => {
    const avatarUrl = galleryRef(avatar.id);
    if (gameStarted) {
      onUpdateState((s) => {
        const maxId = s.players.reduce((m, p) => Math.max(m, p.id), 0);
        const newPlayer = {
          id: maxId + 1,
          name: avatar.name,
          avatar: '',
          avatarUrl,
          role: '',
          alive: true,
          shortCode: '',
          votesReceived: 0,
        };
        const templates = galleryHints[avatar.id] ?? [];
        const existingDynamic = s.dynamicHints ?? [];
        let nextId = existingDynamic.length > 0 ? Math.max(...existingDynamic.map((h) => h.id)) + 1 : 1;
        const newDynamicHints: DynamicHint[] = templates.map((tpl) => ({
          id: nextId++,
          targetPlayerId: newPlayer.id,
          text: tpl.text,
          imageUrl: tpl.imageUrl,
          priority: tpl.priority,
          revealed: false,
          createdAt: new Date().toISOString(),
        }));
        const taskTpls = galleryTasks[avatar.id] ?? [];
        const existingLib = s.taskLibrary ?? [];
        let nextTaskLibId = existingLib.length > 0 ? Math.max(...existingLib.map((tt) => tt.id)) + 1 : 1;
        const newLibTasks: TaskTemplate[] = taskTpls.map((gt) => ({
          id: nextTaskLibId++,
          question: gt.question,
          inputType: gt.inputType,
          correctAnswer: gt.correctAnswer,
          choices: gt.choices,
          imageUrl: gt.imageUrl,
          referencedPlayerId: newPlayer.id,
          createdAt: new Date().toISOString(),
        }));
        return {
          ...s,
          players: [...s.players, newPlayer],
          dynamicHints: [...existingDynamic, ...newDynamicHints],
          taskLibrary: [...existingLib, ...newLibTasks],
        };
      });
    } else {
      setPlayerEntries((prev) => {
        const maxId = prev.reduce((m, e) => Math.max(m, e.id), 0);
        const defaultRole = galleryRoles[avatar.id];
        return [...prev, { id: maxId + 1, name: avatar.name, avatar: '', avatarUrl, assignedRole: defaultRole }];
      });
    }
  }, [gameStarted, galleryHints, galleryTasks, galleryRoles, onUpdateState, setPlayerEntries]);

  // ── Import all selected (batch) ──
  const [selectedForImport, setSelectedForImport] = useState<Set<number>>(new Set());

  const toggleImportSelection = useCallback((id: number) => {
    setSelectedForImport((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const importSelected = useCallback(() => {
    const toImport = AVATAR_GALLERY.filter(
      (a) => selectedForImport.has(a.id) && !usedGalleryIds.has(a.id),
    );
    if (toImport.length === 0) return;

    if (gameStarted) {
      onUpdateState((s) => {
        let maxId = s.players.reduce((m, p) => Math.max(m, p.id), 0);
        const existingDynamic = s.dynamicHints ?? [];
        let nextDynId = existingDynamic.length > 0 ? Math.max(...existingDynamic.map((h) => h.id)) + 1 : 1;
        const newPlayers = toImport.map((a) => ({
          id: ++maxId,
          name: a.name,
          avatar: '',
          avatarUrl: galleryRef(a.id),
          role: '',
          alive: true,
          shortCode: '',
          votesReceived: 0,
        }));
        const newDynamicHints: DynamicHint[] = [];
        newPlayers.forEach((np, i) => {
          const templates = galleryHints[toImport[i].id] ?? [];
          templates.forEach((tpl) => {
            newDynamicHints.push({
              id: nextDynId++,
              targetPlayerId: np.id,
              text: tpl.text,
              imageUrl: tpl.imageUrl,
              priority: tpl.priority,
              revealed: false,
              createdAt: new Date().toISOString(),
            });
          });
        });
        const existingLib = s.taskLibrary ?? [];
        let nextTaskLibId = existingLib.length > 0 ? Math.max(...existingLib.map((tt) => tt.id)) + 1 : 1;
        const newLibTasks: TaskTemplate[] = [];
        newPlayers.forEach((np, i) => {
          const taskTpls = galleryTasks[toImport[i].id] ?? [];
          taskTpls.forEach((gt) => {
            newLibTasks.push({
              id: nextTaskLibId++,
              question: gt.question,
              inputType: gt.inputType,
              correctAnswer: gt.correctAnswer,
              choices: gt.choices,
              imageUrl: gt.imageUrl,
              referencedPlayerId: np.id,
              createdAt: new Date().toISOString(),
            });
          });
        });
        return {
          ...s,
          players: [...s.players, ...newPlayers],
          dynamicHints: [...existingDynamic, ...newDynamicHints],
          taskLibrary: [...existingLib, ...newLibTasks],
        };
      });
    } else {
      setPlayerEntries((prev) => {
        let maxId = prev.reduce((m, e) => Math.max(m, e.id), 0);
        const newEntries = toImport.map((a) => ({
          id: ++maxId,
          name: a.name,
          avatar: '',
          avatarUrl: galleryRef(a.id),
          assignedRole: galleryRoles[a.id],
        }));
        return [...prev, ...newEntries];
      });
    }
    setSelectedForImport(new Set());
  }, [selectedForImport, usedGalleryIds, gameStarted, galleryHints, galleryTasks, galleryRoles, onUpdateState, setPlayerEntries]);

  // ── Image upload helper ──
  const uploadGalleryImage = useCallback(async (file: File, type: 'hint' | 'task'): Promise<string | null> => {
    if (!selectedGalleryId) return null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', 'loupgarou');
    formData.append('galleryId', String(selectedGalleryId));
    formData.append('type', type);
    try {
      const res = await fetch(`${API_BASE}/gallery/image`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (data.imageUrl) return data.imageUrl;
      console.error('Gallery image upload failed:', data.error);
      return null;
    } catch (err) {
      console.error('Gallery image upload error:', err);
      return null;
    }
  }, [selectedGalleryId]);

  // ── Styles ──
  const cardBg = 'rgba(255,255,255,0.03)';
  const cardBorder = 'rgba(255,255,255,0.08)';
  const inputBg = 'rgba(0,0,0,0.3)';
  const inputBorder = 'rgba(255,255,255,0.1)';

  /* ── Count badge helper ── */
  const countBadge = (count: number, Icon: typeof Lightbulb) => (
    <span className="px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: count > 0 ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${count > 0 ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
      <Icon size={8} style={{ color: count > 0 ? '#8b5cf6' : t.textDim }} />
      <span style={{ color: count > 0 ? '#8b5cf6' : t.textDim, fontSize: '0.45rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>{count}</span>
    </span>
  );

  /* ── Render player item ── */
  const renderPlayerItem = (avatar: typeof AVATAR_GALLERY[number]) => {
    const hintsCount = (galleryHints[avatar.id] ?? []).length;
    const tasksCount = (galleryTasks[avatar.id] ?? []).length;
    const isSelected = selectedGalleryId === avatar.id;
    const isInGame = usedGalleryIds.has(avatar.id);
    const isSelectedForImport = selectedForImport.has(avatar.id);

    if (isMobile) {
      /* Mobile: grid card */
      return (
        <motion.div
          key={avatar.id} layout
          className="rounded-xl p-2.5 text-center transition-all relative group cursor-pointer"
          style={{
            background: isSelected ? 'linear-gradient(135deg, rgba(184,134,11,0.1), rgba(255,255,255,0.02))' : isSelectedForImport ? 'rgba(184,134,11,0.06)' : cardBg,
            border: `1px solid ${isSelected ? `${t.gold}40` : isSelectedForImport ? `${t.gold}30` : cardBorder}`,
            boxShadow: isSelected ? `0 0 20px ${t.gold}10` : 'none',
            opacity: isInGame ? 0.45 : 1,
          }}
          whileHover={{ scale: isInGame ? 1 : 1.03 }}
          whileTap={{ scale: isInGame ? 1 : 0.97 }}
          onClick={() => { if (!isInGame) setSelectedGalleryId(isSelected ? null : avatar.id); }}
        >
          {!isInGame && (
            <div onClick={(e) => { e.stopPropagation(); toggleImportSelection(avatar.id); }} className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10" style={{ background: isSelectedForImport ? `${t.gold}30` : 'rgba(255,255,255,0.06)', border: `1px solid ${isSelectedForImport ? `${t.gold}60` : 'rgba(255,255,255,0.1)'}`, ...(isSelectedForImport ? { opacity: 1 } : {}) }} role="button">
              {isSelectedForImport && <Check size={10} style={{ color: t.gold }} />}
            </div>
          )}
          {isInGame && (
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md z-10" style={{ background: 'rgba(107,142,90,0.15)', border: '1px solid rgba(107,142,90,0.3)' }}>
              <span style={{ color: '#6b8e5a', fontSize: '0.4rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>En jeu</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-full overflow-hidden mx-auto" style={{ border: `2px solid ${isSelected ? `${t.gold}50` : 'rgba(255,255,255,0.08)'}`, background: 'linear-gradient(to bottom, #070b1a, #0f1629)' }}>
              <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <p className="truncate w-full font-semibold" style={{ color: isSelected ? t.gold : t.text, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>{avatar.name}</p>
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {(() => { const r = galleryRoles[avatar.id] ? getRoleById(galleryRoles[avatar.id]) : null; return r ? <span className="px-1 py-0.5 rounded-md" style={{ background: `${r.color}12`, border: `1px solid ${r.color}25`, fontSize: '0.55rem' }} title={r.name}>{r.emoji}</span> : null; })()}
              {countBadge(hintsCount, Lightbulb)}
              {countBadge(tasksCount, ClipboardList)}
            </div>
          </div>
        </motion.div>
      );
    }

    /* Desktop: compact card tile for grid */
    return (
      <motion.div
        key={avatar.id} layout
        data-avatar-id={avatar.id}
        className="rounded-xl p-2 text-center transition-all relative group cursor-pointer flex flex-col items-center gap-1.5"
        style={{
          background: isSelected ? 'linear-gradient(135deg, rgba(184,134,11,0.12), rgba(255,255,255,0.03))' : isSelectedForImport ? 'rgba(184,134,11,0.06)' : 'transparent',
          border: `1px solid ${isSelected ? `${t.gold}40` : isSelectedForImport ? `${t.gold}30` : 'transparent'}`,
          opacity: isInGame ? 0.45 : 1,
        }}
        whileHover={{ scale: isInGame ? 1 : 1.03, backgroundColor: isInGame ? undefined : 'rgba(255,255,255,0.03)' }}
        whileTap={{ scale: isInGame ? 1 : 0.97 }}
        onClick={() => { if (!isInGame) setSelectedGalleryId(avatar.id); }}
      >
        {!isInGame && (
          <div onClick={(e) => { e.stopPropagation(); toggleImportSelection(avatar.id); }} className="absolute top-1 right-1 w-4 h-4 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10" style={{ background: isSelectedForImport ? `${t.gold}30` : 'rgba(255,255,255,0.06)', border: `1px solid ${isSelectedForImport ? `${t.gold}60` : 'rgba(255,255,255,0.1)'}`, ...(isSelectedForImport ? { opacity: 1 } : {}) }} role="button">
            {isSelectedForImport && <Check size={8} style={{ color: t.gold }} />}
          </div>
        )}
        {isInGame && (
          <div className="absolute top-1 right-1 px-1 py-0.5 rounded-md z-10" style={{ background: 'rgba(107,142,90,0.15)', border: '1px solid rgba(107,142,90,0.3)' }}>
            <span style={{ color: '#6b8e5a', fontSize: '0.35rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>En jeu</span>
          </div>
        )}

        <div className="w-10 h-10 rounded-full overflow-hidden" style={{ border: `2px solid ${isSelected ? `${t.gold}50` : 'rgba(255,255,255,0.08)'}`, background: t.isDay ? 'linear-gradient(to bottom, #e8dcc8, #d4c4a8)' : 'linear-gradient(to bottom, #070b1a, #0f1629)' }}>
          <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />
        </div>

        <p className="truncate w-full font-semibold" style={{ color: isSelected ? t.gold : t.text, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>{avatar.name}</p>

        <div className="flex items-center gap-0.5 flex-wrap justify-center">
          {(() => { const r = galleryRoles[avatar.id] ? getRoleById(galleryRoles[avatar.id]) : null; return r ? <span className="px-0.5 py-0.5 rounded-md" style={{ background: `${r.color}12`, border: `1px solid ${r.color}25`, fontSize: '0.5rem' }} title={r.name}>{r.emoji}</span> : null; })()}
          {countBadge(hintsCount, Lightbulb)}
          {countBadge(tasksCount, ClipboardList)}
        </div>
      </motion.div>
    );
  };

  /* ── Detail panel content ── */
  const detailPanelContent = selectedAvatar ? (
    <div
      className="flex-1 min-w-0 rounded-xl p-5 space-y-4 overflow-y-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(255,255,255,0.01))',
        border: '1px solid rgba(139,92,246,0.15)',
        maxHeight: isMobile ? undefined : 'calc(100vh - 120px)',
      }}
    >
      {/* Player profile header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden shrink-0" style={{ border: `2px solid ${t.gold}40`, background: 'linear-gradient(to bottom, #070b1a, #0f1629)' }}>
          <img src={selectedAvatar.url} alt={selectedAvatar.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1.1rem' }}>{selectedAvatar.name}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span style={{ color: t.textDim, fontSize: '0.55rem' }}>
              {selectedHints.length} indice{selectedHints.length !== 1 ? 's' : ''} · {selectedTasks.length} tache{selectedTasks.length !== 1 ? 's' : ''}
            </span>
            {usedGalleryIds.has(selectedAvatar.id) ? (
              <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.12)', border: '1px solid rgba(107,142,90,0.25)', color: '#6b8e5a', fontSize: '0.55rem', fontWeight: 600 }}>En jeu</span>
            ) : (
              <button onClick={() => importPlayer(selectedAvatar)} className="flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors hover:bg-white/5" style={{ background: 'rgba(184,134,11,0.1)', border: '1px solid rgba(184,134,11,0.25)', color: t.gold, fontSize: '0.55rem', fontWeight: 600, fontFamily: '"Cinzel", serif' }}>
                <UserPlus size={10} /> Importer
              </button>
            )}

          </div>
        </div>
        {isMobile && (
          <button onClick={() => setSelectedGalleryId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors shrink-0" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <X size={14} style={{ color: t.textMuted }} />
          </button>
        )}
        {/* ── Default Role (top right) ── */}
        <div className="shrink-0 relative" style={{ width: '220px' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield size={11} style={{ color: '#3b82f6' }} />
            <span style={{ fontFamily: '"Cinzel", serif', color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600 }}>Role par defaut</span>
            {savingRoles && <span style={{ color: t.textDim, fontSize: '0.4rem', fontFamily: '"Cinzel", serif' }}>Sauvegarde...</span>}
          </div>
          {(() => {
            const currentRoleId = selectedGalleryId !== null ? galleryRoles[selectedGalleryId] : undefined;
            const currentRole = currentRoleId ? getRoleById(currentRoleId) : null;
            return (
              <>
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                  style={{
                    background: currentRole ? `${currentRole.color}12` : cardBg,
                    border: `1px solid ${currentRole ? `${currentRole.color}30` : cardBorder}`,
                  }}
                >
                  {currentRole ? (
                    <>
                      <span style={{ fontSize: '0.85rem' }}>{currentRole.emoji}</span>
                      <span style={{ color: currentRole.color, fontSize: '0.6rem', fontWeight: 600, fontFamily: '"Cinzel", serif', flex: 1, textAlign: 'left' }}>{currentRole.name}</span>
                      <span className="px-1 py-0.5 rounded-md" style={{ background: `${currentRole.color}15`, border: `1px solid ${currentRole.color}25`, color: currentRole.color, fontSize: '0.4rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>{currentRole.team === 'werewolf' ? 'Loup' : currentRole.team === 'village' ? 'Village' : 'Solo'}</span>
                    </>
                  ) : (
                    <>
                      <Shield size={12} style={{ color: t.textDim, opacity: 0.4 }} />
                      <span style={{ color: t.textDim, fontSize: '0.6rem', flex: 1, textAlign: 'left' }}>Aucun role</span>
                    </>
                  )}
                  <ChevronDown size={11} style={{ color: t.textDim, transform: roleDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                <AnimatePresence>
                  {roleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="absolute left-0 right-0 overflow-hidden mt-1 rounded-lg z-20"
                      style={{ background: 'rgba(0,0,0,0.6)', border: `1px solid ${cardBorder}`, backdropFilter: 'blur(12px)' }}
                    >
                      <div className="max-h-48 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(59,130,246,0.3) transparent' }}>
                        {currentRoleId && (
                          <button
                            onClick={() => setDefaultRole(undefined)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                          >
                            <X size={12} style={{ color: '#c41e3a' }} />
                            <span style={{ color: '#c41e3a', fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>Retirer le role</span>
                          </button>
                        )}
                        {ROLES.map((role) => {
                          const isActive = currentRoleId === role.id;
                          return (
                            <button
                              key={role.id}
                              onClick={() => setDefaultRole(role.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                              style={{ background: isActive ? `${role.color}12` : 'transparent' }}
                            >
                              <span style={{ fontSize: '0.85rem' }}>{role.emoji}</span>
                              <span className="flex-1 text-left truncate" style={{ color: isActive ? role.color : t.text, fontSize: '0.6rem', fontWeight: isActive ? 700 : 400, fontFamily: '"Cinzel", serif' }}>{role.name}</span>
                              <span className="px-1.5 py-0.5 rounded-md shrink-0" style={{ background: `${role.color}10`, border: `1px solid ${role.color}20`, color: role.color, fontSize: '0.4rem', fontFamily: '"Cinzel", serif', fontWeight: 700 }}>{role.team === 'werewolf' ? 'Loup' : role.team === 'village' ? 'Village' : 'Solo'}</span>
                              {isActive && <Check size={10} style={{ color: role.color }} />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Hint Templates ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={14} style={{ color: '#8b5cf6' }} />
          <h4 style={{ fontFamily: '"Cinzel", serif', color: '#8b5cf6', fontSize: '0.8rem' }}>Indices pre-configures</h4>
          <span style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic' }}>(importes automatiquement)</span>
        </div>
        <div className="space-y-2">
          {selectedHints.map((hint) => {
            const pc = PRIORITY_COLORS[hint.priority ?? 1];
            return (
              <div key={hint.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <span className="px-1.5 py-0.5 rounded-md shrink-0 mt-0.5" style={{ background: pc.bg, border: `1px solid ${pc.border}`, color: pc.text, fontSize: '0.5rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>P{hint.priority ?? 1}</span>
                <div className="flex-1 min-w-0">
                  {hint.imageUrl && <img src={hint.imageUrl} alt="Hint" className="w-12 h-12 rounded-lg object-cover mb-1" />}
                  <p className="text-sm" style={{ color: t.text, fontSize: '0.7rem', lineHeight: 1.5 }}>{hint.text || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Image seule</span>}</p>
                </div>
                <button onClick={() => deleteHint(hint.id)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0" title="Supprimer"><Trash2 size={12} style={{ color: '#c41e3a' }} /></button>
              </div>
            );
          })}
          {selectedHints.length === 0 && (
            <div className="text-center py-4" style={{ color: t.textDim }}>
              <Lightbulb size={20} className="mx-auto mb-2 opacity-20" />
              <p style={{ fontSize: '0.6rem' }}>Aucun indice pre-configure</p>
              <p style={{ fontSize: '0.5rem', marginTop: 2 }}>Ajoutez des indices ci-dessous</p>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input ref={hintInputRef} type="text" value={newHintText} onChange={(e) => setNewHintText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (newHintText.trim() || newHintImageUrl)) addHint(); }} placeholder={`Indice sur ${selectedAvatar.name}... (ex: {role} porte du rouge, les yeux {durole})`} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
            <div className="flex items-center gap-0.5 shrink-0">
              {([1, 2, 3] as const).map((p) => (
                <button key={p} onClick={() => setNewHintPriority(p)} className="px-1.5 py-1 rounded-md transition-colors" style={{ background: newHintPriority === p ? PRIORITY_COLORS[p].bg : 'transparent', border: `1px solid ${newHintPriority === p ? PRIORITY_COLORS[p].border : 'transparent'}`, color: newHintPriority === p ? PRIORITY_COLORS[p].text : t.textDim, fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>P{p}</button>
              ))}
            </div>
            {/* Image upload button */}
            <input ref={hintImageInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              setUploadingHintImage(true);
              const url = await uploadGalleryImage(file, 'hint');
              setUploadingHintImage(false);
              if (url) setNewHintImageUrl(url);
            }} />
            <button onClick={() => hintImageInputRef.current?.click()} disabled={uploadingHintImage} className="p-1.5 rounded-md transition-colors shrink-0" style={{ background: newHintImageUrl ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${newHintImageUrl ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`, color: newHintImageUrl ? '#8b5cf6' : t.textDim }} title="Ajouter une image">
              {uploadingHintImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            </button>
          </div>
          {/* Image preview */}
          {newHintImageUrl && (
            <div className="flex items-center gap-2 px-2">
              <img src={newHintImageUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid rgba(139,92,246,0.25)' }} />
              <button onClick={() => setNewHintImageUrl(undefined)} className="p-1 rounded-md hover:bg-white/5 transition-colors" title="Retirer l'image"><X size={12} style={{ color: '#c41e3a' }} /></button>
            </div>
          )}
          <button onClick={addHint} disabled={!newHintText.trim() && !newHintImageUrl} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors" style={{ background: newHintText.trim() || newHintImageUrl ? `${t.gold}20` : 'rgba(255,255,255,0.03)', border: `1px solid ${newHintText.trim() || newHintImageUrl ? `${t.gold}40` : 'rgba(255,255,255,0.05)'}`, color: newHintText.trim() || newHintImageUrl ? t.gold : t.textDim, fontFamily: '"Cinzel", serif', fontSize: '0.65rem', cursor: newHintText.trim() || newHintImageUrl ? 'pointer' : 'not-allowed' }}>
            <Plus size={12} /> Ajouter indice
          </button>
        </div>
      </div>

      {/* ── Task Templates ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList size={14} style={{ color: '#8b5cf6' }} />
          <h4 style={{ fontFamily: '"Cinzel", serif', color: '#8b5cf6', fontSize: '0.8rem' }}>Taches pre-configures</h4>
          <span style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic' }}>(importes automatiquement)</span>
        </div>
        <div className="space-y-2">
          {selectedTasks.map((task) => {
            const itl = INPUT_TYPE_LABELS[task.inputType];
            return (
              <div key={task.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <span className="px-1.5 py-0.5 rounded-md shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6', fontSize: '0.5rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>{itl.icon}</span>
                <div className="flex-1 min-w-0">
                  {task.imageUrl && <img src={task.imageUrl} alt="Task" className="w-12 h-12 rounded-lg object-cover mb-1" />}
                  <p className="text-sm" style={{ color: t.text, fontSize: '0.7rem', lineHeight: 1.5 }}>{task.question || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Image seule</span>}</p>
                </div>
                <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-md hover:bg-white/5 transition-colors shrink-0" title="Supprimer"><Trash2 size={12} style={{ color: '#c41e3a' }} /></button>
              </div>
            );
          })}
          {selectedTasks.length === 0 && (
            <div className="text-center py-4" style={{ color: t.textDim }}>
              <ClipboardList size={20} className="mx-auto mb-2 opacity-20" />
              <p style={{ fontSize: '0.6rem' }}>Aucune tache pre-configuree</p>
              <p style={{ fontSize: '0.5rem', marginTop: 2 }}>Ajoutez des taches ci-dessous</p>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input ref={taskInputRef} type="text" value={newTaskQuestion} onChange={(e) => setNewTaskQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newTaskQuestion.trim() && newTaskCorrectAnswer.trim()) addTask(); }} placeholder={`Question pour ${selectedAvatar.name}...`} className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
            <div className="flex items-center gap-0.5 shrink-0">
              {Object.keys(INPUT_TYPE_LABELS).map((it) => (
                <button key={it} onClick={() => setNewTaskInputType(it as QuestTaskInputType)} className="px-1.5 py-1 rounded-md transition-colors" style={{ background: newTaskInputType === it ? 'rgba(139,92,246,0.12)' : 'transparent', border: `1px solid ${newTaskInputType === it ? 'rgba(139,92,246,0.25)' : 'transparent'}`, color: newTaskInputType === it ? '#8b5cf6' : t.textDim, fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>{INPUT_TYPE_LABELS[it as QuestTaskInputType].icon}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="text" value={newTaskCorrectAnswer} onChange={(e) => setNewTaskCorrectAnswer(e.target.value)} placeholder="Reponse correcte..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
            {newTaskInputType === 'multiple-choice' && (
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input type="text" value={newTaskChoices[0]} onChange={(e) => { const nc = [...newTaskChoices]; nc[0] = e.target.value; setNewTaskChoices(nc); }} placeholder="Choix 1..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
                  <input type="text" value={newTaskChoices[1]} onChange={(e) => { const nc = [...newTaskChoices]; nc[1] = e.target.value; setNewTaskChoices(nc); }} placeholder="Choix 2..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input type="text" value={newTaskChoices[2]} onChange={(e) => { const nc = [...newTaskChoices]; nc[2] = e.target.value; setNewTaskChoices(nc); }} placeholder="Choix 3..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
                  <input type="text" value={newTaskChoices[3]} onChange={(e) => { const nc = [...newTaskChoices]; nc[3] = e.target.value; setNewTaskChoices(nc); }} placeholder="Choix 4..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }} />
                </div>
              </div>
            )}
          </div>
          {/* Image upload for task */}
          <div className="flex items-center gap-2">
            <input ref={taskImageInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              setUploadingTaskImage(true);
              const url = await uploadGalleryImage(file, 'task');
              setUploadingTaskImage(false);
              if (url) setNewTaskImageUrl(url);
            }} />
            <button onClick={() => taskImageInputRef.current?.click()} disabled={uploadingTaskImage} className="p-1.5 rounded-md transition-colors shrink-0" style={{ background: newTaskImageUrl ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${newTaskImageUrl ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`, color: newTaskImageUrl ? '#8b5cf6' : t.textDim }} title="Ajouter une image">
              {uploadingTaskImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
            </button>
            <span style={{ color: t.textDim, fontSize: '0.5rem' }}>{newTaskImageUrl ? 'Image jointe' : 'Image optionnelle'}</span>
          </div>
          {/* Task image preview */}
          {newTaskImageUrl && (
            <div className="flex items-center gap-2 px-2">
              <img src={newTaskImageUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid rgba(139,92,246,0.25)' }} />
              <button onClick={() => setNewTaskImageUrl(undefined)} className="p-1 rounded-md hover:bg-white/5 transition-colors" title="Retirer l'image"><X size={12} style={{ color: '#c41e3a' }} /></button>
            </div>
          )}
          <button onClick={addTask} disabled={!newTaskQuestion.trim() || !newTaskCorrectAnswer.trim()} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-colors" style={{ background: newTaskQuestion.trim() && newTaskCorrectAnswer.trim() ? `${t.gold}20` : 'rgba(255,255,255,0.03)', border: `1px solid ${newTaskQuestion.trim() && newTaskCorrectAnswer.trim() ? `${t.gold}40` : 'rgba(255,255,255,0.05)'}`, color: newTaskQuestion.trim() && newTaskCorrectAnswer.trim() ? t.gold : t.textDim, fontFamily: '"Cinzel", serif', fontSize: '0.65rem', cursor: newTaskQuestion.trim() && newTaskCorrectAnswer.trim() ? 'pointer' : 'not-allowed' }}>
            <Plus size={12} /> Ajouter tache
          </button>
        </div>
      </div>

      {/* Quick info */}
      <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}>
        <p style={{ color: '#8b5cf6', fontSize: '0.5rem', lineHeight: 1.6 }}>
          <strong>Astuce :</strong> Utilisez <code style={{ background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 4 }}>{'{role}'}</code> (le/la) ou <code style={{ background: 'rgba(139,92,246,0.15)', padding: '1px 4px', borderRadius: 4 }}>{'{durole}'}</code> (du/de la) pour inserer automatiquement le role du joueur.
        </p>
      </div>

      {/* ── Delete this user (destructive) ── */}
      <div className="pt-2 mt-2" style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
        {confirmDeleteId === selectedAvatar.id ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Trash2 size={13} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                  Supprimer {selectedAvatar.name} ?
                </p>
                <p style={{ color: '#ef4444', fontSize: '0.48rem', opacity: 0.7 }}>
                  Ce joueur sera retire de la galerie{(selectedHints.length > 0 || selectedTasks.length > 0 || galleryRoles[selectedAvatar.id]) ? ` avec toutes ses donnees (${selectedHints.length} indice${selectedHints.length !== 1 ? 's' : ''}, ${selectedTasks.length} tache${selectedTasks.length !== 1 ? 's' : ''}${galleryRoles[selectedAvatar.id] ? ', role par defaut' : ''})` : ''}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => deleteGalleryPlayer(selectedAvatar.id)}
                disabled={deletingPlayer}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors hover:brightness-110"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}
              >
                {deletingPlayer ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deletingPlayer ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: t.textDim, fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}
              >
                Annuler
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            onClick={() => setConfirmDeleteId(selectedAvatar.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors hover:bg-red-500/10"
            style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 600, fontFamily: '"Cinzel", serif', opacity: 0.8 }}
          >
            <Trash2 size={13} /> Supprimer ce joueur
          </button>
        )}
      </div>
    </div>
  ) : null;

  /* ── Search bar ── */
  const searchBar = (
    <div className="relative">
      <div className={`${t.isDay ? 'bg-[rgba(255,255,255,0.5)]' : 'bg-[rgba(255,255,255,0.04)]'} relative rounded-[10px] w-full h-[38px]`}>
        <div className="content-stretch flex gap-[8px] items-center overflow-clip px-[12px] py-[8px] relative rounded-[inherit] size-full">
          <Search size={14} style={{ color: t.textDim, flexShrink: 0 }} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className={`bg-transparent w-full text-[12px] font-['Inter',sans-serif] outline-none ${t.isDay ? 'placeholder:text-[rgba(42,31,16,0.5)]' : 'placeholder:text-[rgba(192,200,216,0.5)]'}`} style={{ color: t.isDay ? 'rgba(42,31,16,0.85)' : 'rgba(220,225,240,0.85)' }} />
        </div>
        <div aria-hidden="true" className={`absolute border-[0.616px] border-solid inset-0 pointer-events-none rounded-[10px] ${t.isDay ? 'border-[rgba(120,100,60,0.15)]' : 'border-[rgba(255,255,255,0.1)]'}`} style={{ pointerEvents: 'none', zIndex: -1 }} />
      </div>
    </div>
  );

  /* ── Import bar ── */
  const importBar = selectedForImport.size > 0 ? (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      <div className={`flex ${isMobile ? 'items-center justify-between' : 'flex-col gap-2'} px-3 py-2.5 rounded-xl`} style={{ background: 'rgba(184,134,11,0.08)', border: '1px solid rgba(184,134,11,0.2)' }}>
        <div className="flex items-center gap-2">
          <UserPlus size={14} style={{ color: t.gold }} />
          <span style={{ color: t.gold, fontSize: '0.65rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>{selectedForImport.size} selectionne{selectedForImport.size > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedForImport(new Set())} className="px-2 py-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: t.textMuted, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>Annuler</button>
          <button onClick={importSelected} className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors" style={{ background: 'rgba(184,134,11,0.2)', border: '1px solid rgba(184,134,11,0.4)', color: t.gold, fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}><Download size={10} /> Importer</button>
        </div>
      </div>
    </motion.div>
  ) : null;

  /* ── Loading / empty states ── */
  const loadingState = (
    <div className="text-center py-8" style={{ color: t.textDim }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block"><Lightbulb size={24} className="opacity-30" /></motion.div>
      <p style={{ fontSize: '0.7rem', fontFamily: '"Cinzel", serif', marginTop: 8 }}>Chargement...</p>
    </div>
  );

  const emptyState = (
    <div className="text-center py-6" style={{ color: t.textDim }}>
      <Search size={24} className="mx-auto mb-2 opacity-30" />
      <p style={{ fontSize: '0.65rem' }}>Aucun resultat pour "{searchQuery}"</p>
    </div>
  );

  /* ── Sub-tab bar (shared between mobile & desktop) ── */
  const subTabBar = (
    <div className="flex items-center gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {([
        { id: 'players' as GallerySubTab, label: 'Joueurs', icon: <Users size={13} /> },
        { id: 'quests' as GallerySubTab, label: 'Quetes', icon: <MapIcon size={13} /> },
      ]).map(tab => {
        const isActive = gallerySubTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setGallerySubTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all"
            style={{
              background: isActive ? `${t.gold}15` : 'transparent',
              border: `1px solid ${isActive ? `${t.gold}30` : 'transparent'}`,
              color: isActive ? t.gold : t.textDim,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.65rem',
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════════════
     MOBILE LAYOUT — stacked
     ═══════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div className="space-y-5">
        {subTabBar}
        {gallerySubTab === 'quests' ? (
          <GalleryQuestsTab t={t} isMobile={isMobile} />
        ) : (
        <>
        <div className="rounded-xl p-5" style={{ background: 'linear-gradient(135deg, rgba(184,134,11,0.06), rgba(255,255,255,0.01))', border: '1px solid rgba(184,134,11,0.15)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(184,134,11,0.15)' }}><Users size={16} style={{ color: t.gold }} /></div>
            <div className="flex-1"><h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.95rem' }}>Galerie des Joueurs</h3></div>
            <div className="flex items-center gap-2">
              {(savingHints || savingTasks || savingRoles) && <span style={{ color: t.textDim, fontSize: '0.5rem', fontFamily: '"Cinzel", serif' }}>Sauvegarde...</span>}
              <span className="px-2 py-0.5 rounded-md" style={{ background: `${t.gold}15`, color: t.gold, fontSize: '0.65rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>{AVATAR_GALLERY.length} joueurs</span>
            </div>
          </div>
          <div className="mb-4">{searchBar}</div>
          {importBar && <div className="mb-4">{importBar}</div>}
          {loadingHints ? loadingState : (
            <>
              {filteredAvatars.length === 0 && emptyState}
              <div className="grid gap-3 grid-cols-3">{filteredAvatars.map(renderPlayerItem)}</div>
            </>
          )}
        </div>
        <AnimatePresence>
          {detailPanelContent && (
            <motion.div key={`detail-${selectedAvatar!.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
              {detailPanelContent}
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DESKTOP LAYOUT — split 1/3 list | 2/3 detail
     ═══════════════════════════════════════════════════════ */
  return (
    <div>
      {subTabBar}
      {gallerySubTab === 'quests' ? (
        <GalleryQuestsTab t={t} isMobile={isMobile} />
      ) : (
      <div className="flex gap-4" style={{ height: 'calc(100vh - 170px)' }}>
        {/* ── Left panel: 1/3 ── */}
        <div className="w-2/5 shrink-0 rounded-xl flex flex-col overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(184,134,11,0.06), rgba(255,255,255,0.01))', border: '1px solid rgba(184,134,11,0.15)' }}>
          <div className="p-4 pb-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(184,134,11,0.15)' }}><Users size={14} style={{ color: t.gold }} /></div>
              <div className="flex-1 min-w-0">
                <h3 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '0.85rem' }}>Galerie</h3>
                <p style={{ color: t.textDim, fontSize: '0.5rem' }}>Indices & taches persistants</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(savingHints || savingTasks || savingRoles) && <span style={{ color: t.textDim, fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>Sauvegarde...</span>}
                <span className="px-1.5 py-0.5 rounded-md" style={{ background: `${t.gold}15`, color: t.gold, fontSize: '0.55rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>{AVATAR_GALLERY.length - deletedAvatarIds.size}</span>
              </div>
            </div>
            <div className="mb-3">{searchBar}</div>
            {importBar && <div className="mb-3">{importBar}</div>}
          </div>

          {/* Scrollable player list */}
          <div className="flex-1 overflow-y-auto px-2 pb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: `${t.gold}30 transparent` }}>
            {loadingHints ? loadingState : (
              <>
                {filteredAvatars.length === 0 && emptyState}
                <div className="grid grid-cols-5 gap-1">{filteredAvatars.map(renderPlayerItem)}</div>
              </>
            )}
          </div>
        </div>

        {/* ── Right panel: 2/3 ── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {detailPanelContent ? (
              <motion.div key={`detail-${selectedAvatar!.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                {detailPanelContent}
              </motion.div>
            ) : (
              <motion.div key="empty-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl flex flex-col items-center justify-center h-full" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.02), rgba(255,255,255,0.01))', border: '1px dashed rgba(139,92,246,0.15)', minHeight: '400px' }}>
                <Users size={40} style={{ color: t.textDim, opacity: 0.15 }} />
                <p style={{ color: t.textDim, fontSize: '0.75rem', fontFamily: '"Cinzel", serif', marginTop: 16, opacity: 0.5 }}>Selectionnez un joueur</p>
                <p style={{ color: t.textDim, fontSize: '0.55rem', marginTop: 4, opacity: 0.35 }}>pour configurer ses indices et taches</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      )}
    </div>
  );
}