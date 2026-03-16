import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Map as MapIcon, Type, Hash, Users, List,
  AlertTriangle, BookOpen, Handshake, ExternalLink,
  Shuffle, Package, Zap, Send, UserPlus,
  Upload, Download, FileSpreadsheet, X,
  Tag, Pencil, Save, ArrowUpDown, Repeat,
} from 'lucide-react';
import type { GameState, Quest, QuestTaskInputType, QuestType } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { projectId, publicAnonKey } from '../../../context/apiConfig';
import { ImagePlus, UserCircle } from 'lucide-react';
import { GMAvatar } from './GMAvatar';
import { distributeQuestRound } from './gmPureHelpers';

interface GMQuestsPanelProps {
  state: GameState;
  updateState: (updater: (s: GameState) => GameState) => void;
  t: GameThemeTokens;
  isMobile: boolean;
  onNavigateToPlayer?: (playerId: number) => void;
}

const INPUT_TYPE_OPTIONS: { value: QuestTaskInputType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Texte libre', icon: <Type size={13} /> },
  { value: 'code', label: 'Code secret', icon: <Hash size={13} /> },
  { value: 'player-select', label: 'Joueur', icon: <Users size={13} /> },
  { value: 'multiple-choice', label: 'QCM', icon: <List size={13} /> },
];

/* ── 10+ Pre-built quest templates ── */
interface QuestTemplate {
  title: string;
  description: string;
  emoji: string;
  questType?: 'individual' | 'collaborative';
  collaborativeGroupSize?: number;
  tasks: Array<{
    question: string;
    inputType: QuestTaskInputType;
    correctAnswer: string;
    choices?: string[];
  }>;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    title: 'Test Code',
    description: 'Reponse : 1234',
    emoji: '🔑',
    tasks: [
      { question: 'Entrez le code secret', inputType: 'code', correctAnswer: '1234' },
    ],
  },
  {
    title: 'Test Joueur',
    description: 'Reponse : n\'importe quel joueur (auto-valide)',
    emoji: '👤',
    tasks: [
      { question: 'Selectionnez un joueur', inputType: 'player-select', correctAnswer: 'placeholder' },
    ],
  },
  {
    title: 'Test Texte Libre',
    description: 'Reponse : bonjour',
    emoji: '✏️',
    tasks: [
      { question: 'Ecrivez le mot magique', inputType: 'text', correctAnswer: 'bonjour' },
    ],
  },
  {
    title: 'Test 3 Taches',
    description: 'Code: abc / Joueur: n\'importe / Texte: loup',
    emoji: '📋',
    tasks: [
      { question: 'Tache 1 — Entrez le code', inputType: 'code', correctAnswer: 'abc' },
      { question: 'Tache 2 — Selectionnez un joueur', inputType: 'player-select', correctAnswer: 'placeholder' },
      { question: 'Tache 3 — Ecrivez le mot', inputType: 'text', correctAnswer: 'loup' },
    ],
  },
  {
    title: 'Test Collab x2',
    description: 'Quest collaborative a 2 joueurs — votez succes ou echec',
    emoji: '🤝',
    questType: 'collaborative',
    collaborativeGroupSize: 2,
    tasks: [],
  },
  {
    title: 'Test Collab x3',
    description: 'Quest collaborative a 3 joueurs — votez succes ou echec',
    emoji: '👥',
    questType: 'collaborative',
    collaborativeGroupSize: 3,
    tasks: [],
  },
];

/** Compute an aggregate status for a quest across given players */
function questAggregateStatus(quest: Quest, playerIds: number[]): { total: number; active: number; pending: number; success: number; fail: number } {
  let active = 0, pending = 0, success = 0, fail = 0;
  for (const pid of playerIds) {
    const s = quest.playerStatuses?.[pid] || 'active';
    if (s === 'active') active++;
    else if (s === 'pending-resolution') pending++;
    else if (s === 'success') success++;
    else if (s === 'fail') fail++;
  }
  return { total: playerIds.length, active, pending, success, fail };
}

/** Get players assigned to a quest */
function playersWithQuest(questId: number, assignments: Record<number, number[]>): number[] {
  const pids: number[] = [];
  for (const [pidStr, qids] of Object.entries(assignments)) {
    if (qids.includes(questId)) pids.push(Number(pidStr));
  }
  return pids;
}

export function GMQuestsPanel({ state, updateState, t, isMobile, onNavigateToPlayer }: GMQuestsPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedQuestId, setExpandedQuestId] = useState<number | null>(null);
  const [editingQuestId, setEditingQuestId] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastDistributionResult, setLastDistributionResult] = useState<string | null>(null);
  const [sharingQuestId, setSharingQuestId] = useState<number | null>(null);
  const [selectedSharePlayerIds, setSelectedSharePlayerIds] = useState<Set<number>>(new Set());
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvImportedCount, setCsvImportedCount] = useState<number | null>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  // ── Tag management state ──
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [tagAssignPlayerId, setTagAssignPlayerId] = useState<number | null>(null);

  const availableTags = state.availableTags || [];
  const playerTags = state.playerTags || {};

  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name || availableTags.includes(name)) return;
    updateState((s) => ({ ...s, availableTags: [...(s.availableTags || []), name] }));
    setNewTagName('');
  }, [newTagName, availableTags, updateState]);

  const handleDeleteTag = useCallback((tagName: string) => {
    updateState((s) => {
      const newAvailable = (s.availableTags || []).filter(t => t !== tagName);
      const newPlayerTags: Record<number, string[]> = {};
      for (const [pidStr, tags] of Object.entries(s.playerTags || {})) {
        const filtered = tags.filter(t => t !== tagName);
        if (filtered.length > 0) newPlayerTags[Number(pidStr)] = filtered;
      }
      // Also remove from any quest targetTags
      const newQuests = (s.quests || []).map(q => {
        if (!q.targetTags) return q;
        const filtered = q.targetTags.filter(t => t !== tagName);
        return { ...q, targetTags: filtered.length > 0 ? filtered : undefined };
      });
      return { ...s, availableTags: newAvailable, playerTags: newPlayerTags, quests: newQuests };
    });
  }, [updateState]);

  const handleTogglePlayerTag = useCallback((playerId: number, tagName: string) => {
    updateState((s) => {
      const current = (s.playerTags || {})[playerId] || [];
      const has = current.includes(tagName);
      const next = has ? current.filter(t => t !== tagName) : [...current, tagName];
      return { ...s, playerTags: { ...(s.playerTags || {}), [playerId]: next } };
    });
  }, [updateState]);

  // ── Create quest form state ──
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuestType, setNewQuestType] = useState<QuestType>('individual');
  const [newGroupSize, setNewGroupSize] = useState(3);
  const [newTargetMode, setNewTargetMode] = useState<'everyone' | 'tags'>('everyone');
  const [newTargetTags, setNewTargetTags] = useState<string[]>([]);
  const [newDistributionOrder, setNewDistributionOrder] = useState<number | 'random' | 'available'>('random');
  const [newTasks, setNewTasks] = useState<Array<{
    question: string;
    inputType: QuestTaskInputType;
    correctAnswer: string;
    choices: string[];
    imageUrl: string;
    referencedPlayerId?: number;
  }>>([{ question: '', inputType: 'text', correctAnswer: '', choices: ['', ''], imageUrl: '' }]);
  const [uploadingTaskIdx, setUploadingTaskIdx] = useState<number | null>(null);

  const quests = state.quests || [];
  const assignments = state.questAssignments || {};
  const presentSet = state.villagePresentIds ? new Set(state.villagePresentIds) : null;
  const alivePlayers = state.players.filter(p => p.alive && (!presentSet || presentSet.has(p.id)));
  const alivePlayerIds = alivePlayers.map(p => p.id);

  // Compute distribution stats
  const totalDistributed = new Set(
    Object.values(assignments).flat()
  ).size; // unique quest IDs that have been assigned to at least 1 player
  const minQuestsPerPlayer = alivePlayerIds.length > 0
    ? Math.min(...alivePlayerIds.map(pid => (assignments[pid] || []).length))
    : 0;
  const maxQuestsPerPlayer = alivePlayerIds.length > 0
    ? Math.max(...alivePlayerIds.map(pid => (assignments[pid] || []).length))
    : 0;

  /** Check if a player is eligible for a quest based on tags (OR logic)
   *  - Collaborative quests: strict tag filter (only tagged players)
   *  - Individual quests: tags are priority hints, all players are eligible */
  const isPlayerEligible = useCallback((playerId: number, quest: Quest): boolean => {
    if (!quest.targetTags || quest.targetTags.length === 0) return true; // everyone
    // Collaborative quests: strict tag filter
    if ((quest.questType || 'individual') === 'collaborative') {
      const pTags = (state.playerTags || {})[playerId] || [];
      return quest.targetTags.some(tag => pTags.includes(tag));
    }
    // Individual quests: tags are priority only, everyone is eligible
    return true;
  }, [state.playerTags]);

  // Can we distribute? Need at least 1 quest that some alive eligible player doesn't have yet
  // Can distribute if any player (alive or dead) can receive at least one quest
  // Dead players can only receive individual quests
  const canDistribute = quests.length > 0 && state.players.some(p => {
    const myQids = assignments[p.id] || [];
    return quests.some(q => {
      if (myQids.includes(q.id)) return false;
      if (!p.alive && (q.questType || 'individual') === 'collaborative') return false;
      return isPlayerEligible(p.id, q);
    });
  });

  /** Auto-assign a single "available" quest to all eligible players */
  const autoAssignAvailableQuest = useCallback((s: GameState, quest: Quest): Record<number, number[]> => {
    const allPlayers = s.players; // assign to all players (alive + dead)
    const aliveSet = new Set(s.players.filter(p => p.alive).map(p => p.id));
    const isCollab = (quest.questType || 'individual') === 'collaborative';
    const newAssign: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(s.questAssignments || {})) {
      newAssign[Number(k)] = [...v];
    }
    for (const p of allPlayers) {
      if (isCollab && !aliveSet.has(p.id)) continue;
      const myQids = newAssign[p.id] || [];
      if (myQids.includes(quest.id)) continue;
      if (isCollab && quest.targetTags && quest.targetTags.length > 0) {
        const pidTags = (s.playerTags || {})[p.id] || [];
        if (!quest.targetTags.some(tag => pidTags.includes(tag))) continue;
      }
      if (!newAssign[p.id]) newAssign[p.id] = [];
      newAssign[p.id].push(quest.id);
    }
    return newAssign;
  }, []);

  const resetForm = useCallback(() => {
    setNewTitle('');
    setNewDescription('');
    setNewQuestType('individual');
    setNewGroupSize(3);
    setNewTargetMode('everyone');
    setNewTargetTags([]);
    setNewDistributionOrder('random');
    setNewTasks([{ question: '', inputType: 'text', correctAnswer: '', choices: ['', ''], imageUrl: '' }]);
    setShowCreateForm(false);
    setEditingQuestId(null);
  }, []);

  const handleStartEdit = useCallback((quest: Quest) => {
    setEditingQuestId(quest.id);
    setNewTitle(quest.title);
    setNewDescription(quest.description || '');
    const qt = quest.questType || 'individual';
    setNewQuestType(qt);
    setNewGroupSize(quest.collaborativeGroupSize || 3);
    if (quest.targetTags && quest.targetTags.length > 0) {
      setNewTargetMode('tags');
      setNewTargetTags([...quest.targetTags]);
    } else {
      setNewTargetMode('everyone');
      setNewTargetTags([]);
    }
    setNewDistributionOrder(quest.distributionOrder ?? 'random');
    setNewTasks(quest.tasks.map(task => ({
      question: task.question,
      inputType: task.inputType,
      correctAnswer: task.correctAnswer,
      choices: task.choices ? [...task.choices] : ['', ''],
      imageUrl: task.imageUrl || '',
      referencedPlayerId: task.referencedPlayerId,
    })));
    setShowCreateForm(true);
    setExpandedQuestId(null);
    setSharingQuestId(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingQuestId || !newTitle.trim()) return;
    const resolvedTargetTags = newTargetMode === 'tags' && newTargetTags.length > 0 ? newTargetTags : undefined;
    const isCollab = newQuestType === 'collaborative';
    const validTasks = isCollab ? [] : newTasks.filter(t => t.question.trim() && t.correctAnswer.trim());
    if (!isCollab && validTasks.length === 0) return;

    updateState((s) => {
      const existingQuest = (s.quests || []).find(q => q.id === editingQuestId);
      if (!existingQuest) return s;

      const updatedQuest: Quest = {
        ...existingQuest,
        title: newTitle.trim(),
        description: newDescription.trim() || (isCollab ? 'Tous les joueurs doivent collaborer pour reussir.' : 'Resolution : debut du prochain Jour'),
        questType: isCollab ? 'collaborative' : undefined,
        collaborativeGroupSize: isCollab ? newGroupSize : undefined,
        targetTags: resolvedTargetTags,
        distributionOrder: newDistributionOrder,
        tasks: isCollab ? [] : validTasks.map((t, idx) => {
          const existingTask = existingQuest.tasks[idx];
          return {
            id: existingTask?.id ?? (editingQuestId * 100 + idx),
            question: t.question.trim(),
            inputType: t.inputType,
            correctAnswer: t.correctAnswer.trim(),
            choices: t.inputType === 'multiple-choice' ? t.choices.filter(c => c.trim()) : undefined,
            imageUrl: t.imageUrl || undefined,
            referencedPlayerId: t.referencedPlayerId || undefined,
            playerAnswers: existingTask?.playerAnswers ?? {},
            playerResults: existingTask?.playerResults ?? {},
          };
        }),
      };

      const ns = {
        ...s,
        quests: (s.quests || []).map(q => q.id === editingQuestId ? updatedQuest : q),
      };
      if (newDistributionOrder === 'available') {
        ns.questAssignments = autoAssignAvailableQuest(ns, updatedQuest);
      }
      return ns;
    });
    resetForm();
  }, [editingQuestId, newTitle, newDescription, newQuestType, newGroupSize, newTasks, newTargetMode, newTargetTags, newDistributionOrder, updateState, resetForm, autoAssignAvailableQuest]);

  const handleCreateQuest = useCallback(() => {
    if (!newTitle.trim()) return;

    const resolvedTargetTags = newTargetMode === 'tags' && newTargetTags.length > 0 ? newTargetTags : undefined;

    if (newQuestType === 'collaborative') {
      const questId = Date.now() + Math.floor(Math.random() * 10000);
      const quest: Quest = {
        id: questId,
        title: newTitle.trim(),
        description: newDescription.trim() || 'Tous les joueurs doivent collaborer pour reussir.',
        questType: 'collaborative',
        collaborativeGroupSize: newGroupSize,
        playerStatuses: {},
        tasks: [],
        collaborativeVotes: {},
        createdAt: new Date().toISOString(),
        hidden: true,
        targetTags: resolvedTargetTags,
        distributionOrder: newDistributionOrder,
      };
      updateState((s) => {
        const ns = { ...s, quests: [...(s.quests || []), quest] };
        if (newDistributionOrder === 'available') {
          ns.questAssignments = autoAssignAvailableQuest(ns, quest);
        }
        return ns;
      });
      resetForm();
      return;
    }

    const validTasks = newTasks.filter(t => t.question.trim() && t.correctAnswer.trim());
    if (validTasks.length === 0) return;

    const questId = Date.now() + Math.floor(Math.random() * 10000);
    const quest: Quest = {
      id: questId,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Resolution : debut du prochain Jour',
      playerStatuses: {},
      tasks: validTasks.map((t, idx) => ({
        id: questId * 100 + idx,
        question: t.question.trim(),
        inputType: t.inputType,
        correctAnswer: t.correctAnswer.trim(),
        choices: t.inputType === 'multiple-choice' ? t.choices.filter(c => c.trim()) : undefined,
        imageUrl: t.imageUrl || undefined,
        referencedPlayerId: t.referencedPlayerId || undefined,
        playerAnswers: {},
        playerResults: {},
      })),
      createdAt: new Date().toISOString(),
      hidden: true,
      targetTags: resolvedTargetTags,
      distributionOrder: newDistributionOrder,
    };

    updateState((s) => {
      const ns = { ...s, quests: [...(s.quests || []), quest] };
      if (newDistributionOrder === 'available') {
        ns.questAssignments = autoAssignAvailableQuest(ns, quest);
      }
      return ns;
    });
    resetForm();
  }, [newTitle, newDescription, newQuestType, newGroupSize, newTasks, newTargetMode, newTargetTags, newDistributionOrder, updateState, resetForm, autoAssignAvailableQuest]);

  const handleDeleteQuest = useCallback((questId: number) => {
    updateState((s) => {
      const newQuests = (s.quests || []).filter(q => q.id !== questId);
      // Remove this quest from all assignments
      const newAssignments: Record<number, number[]> = {};
      for (const [pidStr, qids] of Object.entries(s.questAssignments || {})) {
        newAssignments[Number(pidStr)] = qids.filter(qid => qid !== questId);
      }
      return { ...s, quests: newQuests, questAssignments: newAssignments };
    });
  }, [updateState]);

  // ── MANUAL SHARE: Assign a quest to selected players ──
  const handleToggleSharePlayer = useCallback((playerId: number) => {
    setSelectedSharePlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const handleManualShare = useCallback((questId: number) => {
    if (selectedSharePlayerIds.size === 0) return;
    const playerIds = [...selectedSharePlayerIds];

    updateState((s) => {
      const quest = (s.quests || []).find(q => q.id === questId);
      if (!quest) return s;

      const isCollab = (quest.questType || 'individual') === 'collaborative';
      // Block if not enough players for a collaborative quest
      if (isCollab) {
        const minSize = quest.collaborativeGroupSize || 2;
        if (playerIds.length < minSize) return s;
      }

      const newAssignments: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(s.questAssignments || {})) {
        newAssignments[Number(k)] = [...v];
      }
      let updatedQuests = s.quests || [];

      const newlyAssigned: number[] = [];
      for (const pid of playerIds) {
        if (!newAssignments[pid]) newAssignments[pid] = [];
        if (!newAssignments[pid].includes(questId)) {
          newAssignments[pid].push(questId);
          newlyAssigned.push(pid);
        }
      }

      if (isCollab && newlyAssigned.length > 0) {
        updatedQuests = updatedQuests.map(q => {
          if (q.id !== questId) return q;
          const groups: number[][] = (q.collaborativeGroups || []).map(g => [...g]);
          groups.push(newlyAssigned);
          return { ...q, collaborativeGroups: groups };
        });
      }

      return { ...s, quests: updatedQuests, questAssignments: newAssignments };
    });

    const count = playerIds.length;
    requestAnimationFrame(() => {
      setLastDistributionResult(`Quete partagee a ${count} joueur${count > 1 ? 's' : ''}`);
      setTimeout(() => setLastDistributionResult(null), 4000);
    });

    setSharingQuestId(null);
    setSelectedSharePlayerIds(new Set());
  }, [selectedSharePlayerIds, updateState]);

  const handleOpenShare = useCallback((questId: number) => {
    if (sharingQuestId === questId) {
      setSharingQuestId(null);
      setSelectedSharePlayerIds(new Set());
    } else {
      setSharingQuestId(questId);
      setSelectedSharePlayerIds(new Set());
    }
  }, [sharingQuestId]);

  // ── DISTRIBUTION: The core new mechanic ──
  // Respects distributionOrder: numeric orders are distributed first (ascending),
  // then 'random' quests are picked randomly for remaining players.
  const handleDistributeRound = useCallback(() => {
    let distributedCount = 0;

    updateState((s) => {
      const result = distributeQuestRound(s);
      distributedCount = result.distributedCount;
      return result.state;
    });

    // Show toast deferred to avoid setState-during-render
    requestAnimationFrame(() => {
      if (distributedCount > 0) {
        setLastDistributionResult(`${distributedCount} quete${distributedCount > 1 ? 's' : ''} distribuee${distributedCount > 1 ? 's' : ''}`);
        setTimeout(() => setLastDistributionResult(null), 4000);
      }
    });
  }, [updateState]);

  const addTask = useCallback(() => {
    setNewTasks(prev => [...prev, { question: '', inputType: 'text', correctAnswer: '', choices: ['', ''], imageUrl: '' }]);
  }, []);

  const removeTask = useCallback((idx: number) => {
    setNewTasks(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateTask = useCallback((idx: number, field: string, value: any) => {
    setNewTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }, []);

  const updateChoice = useCallback((taskIdx: number, choiceIdx: number, value: string) => {
    setNewTasks(prev => prev.map((t, i) => {
      if (i !== taskIdx) return t;
      const choices = [...t.choices];
      choices[choiceIdx] = value;
      return { ...t, choices };
    }));
  }, []);

  const addChoice = useCallback((taskIdx: number) => {
    setNewTasks(prev => prev.map((t, i) => i === taskIdx ? { ...t, choices: [...t.choices, ''] } : t));
  }, []);

  const handleTaskImageUpload = useCallback(async (taskIdx: number, file: File) => {
    setUploadingTaskIdx(taskIdx);
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
        updateTask(taskIdx, 'imageUrl', data.imageUrl);
      } else {
        console.error('Quest image upload failed:', data.error);
      }
    } catch (err) {
      console.error('Quest image upload error:', err);
    } finally {
      setUploadingTaskIdx(null);
    }
  }, [state.gameId, updateTask]);

  const handleAddTemplate = useCallback((template: QuestTemplate) => {
    const questId = Date.now() + Math.floor(Math.random() * 10000);
    const quest: Quest = {
      id: questId,
      title: template.title,
      description: template.description,
      playerStatuses: {},
      tasks: template.tasks.map((t, idx) => ({
        id: questId * 100 + idx,
        question: t.question,
        inputType: t.inputType,
        correctAnswer: t.correctAnswer,
        choices: t.inputType === 'multiple-choice' ? t.choices : undefined,
        playerAnswers: {},
        playerResults: {},
      })),
      createdAt: new Date().toISOString(),
      hidden: true,
      ...(template.questType === 'collaborative' ? { questType: 'collaborative' as const, collaborativeGroupSize: template.collaborativeGroupSize || 2 } : {}),
    };
    updateState((s) => ({ ...s, quests: [...(s.quests || []), quest] }));
  }, [updateState]);

  const handleAddAllTemplates = useCallback(() => {
    const now = Date.now();
    const newQuests: Quest[] = QUEST_TEMPLATES.map((template, tplIdx) => {
      const questId = now + tplIdx * 100 + Math.floor(Math.random() * 99);
      return {
        id: questId,
        title: template.title,
        description: template.description,
        playerStatuses: {},
        tasks: template.tasks.map((t, idx) => ({
          id: questId * 100 + idx,
          question: t.question,
          inputType: t.inputType,
          correctAnswer: t.correctAnswer,
          choices: t.inputType === 'multiple-choice' ? t.choices : undefined,
          playerAnswers: {},
          playerResults: {},
        })),
        createdAt: new Date().toISOString(),
        hidden: true,
        ...(template.questType === 'collaborative' ? { questType: 'collaborative' as const, collaborativeGroupSize: template.collaborativeGroupSize || 2 } : {}),
      };
    });
    updateState((s) => ({ ...s, quests: [...(s.quests || []), ...newQuests] }));
    setShowTemplates(false);
  }, [updateState]);

  // ── CSV TEMPLATE DOWNLOAD ──
  const CSV_HEADER = 'title,description,emoji,questType,groupSize,question,inputType,correctAnswer,choices,targetTags';

  const handleDownloadCsvTemplate = useCallback(() => {
    const rows = [CSV_HEADER];
    // Add a few example rows
    rows.push('"Le Serment de Lune","Retrouvez le mot secret murmure par le MJ","🌙","individual","","Quel mot secret le MJ a-t-il murmure ?","code","eclipse","","Famille|Amis"');
    rows.push('"L\'Enigme du Loup","Testez vos connaissances","🐺","individual","","Combien de loups se reveillent chaque nuit ?","multiple-choice","Tous les loups vivants","Un seul loup|Deux loups|Tous les loups vivants|Aucun",""');
    rows.push('"Epreuve du Feu","Epreuve en trois etapes","🔥","individual","","Quel role peut sauver une victime ?","multiple-choice","La Sorciere","Le Chasseur|La Sorciere|Le Cupidon|Le Maire","Collegues"');
    rows.push('"Epreuve du Feu","","","","","Quel est le cri de ralliement ?","code","victoire","",""');
    rows.push('"Le Conseil des Anciens","Reunissez-vous en groupe","🏛️","collaborative","3","Qui votre groupe designe comme Loup-Garou ?","player-select","placeholder","",""');
    const csvContent = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quetes_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── CSV PARSE & IMPORT ──
  const parseCsvLine = useCallback((line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  }, []);

  const handleCsvImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCsvImportedCount(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Strip BOM and normalize line endings
        const raw = (event.target?.result as string || '').replace(/^\uFEFF/, '');
        const lines = raw.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setCsvError('Le fichier est vide ou ne contient qu\'un en-tete.');
          return;
        }

        // Skip header row (detect if first row looks like a header)
        const firstCols = parseCsvLine(lines[0]);
        const looksLikeHeader = firstCols[0]?.toLowerCase().replace(/[^a-z]/g, '') === 'title';
        const dataLines = looksLikeHeader ? lines.slice(1) : lines;
        // Group rows by title -> same title = same quest (extra tasks)
        const questMap = new Map<string, { description: string; emoji: string; questType: string; groupSize: string; targetTags: string; tasks: { question: string; inputType: string; correctAnswer: string; choices: string }[] }>();
        const questOrder: string[] = [];

        for (const line of dataLines) {
          const cols = parseCsvLine(line);
          if (cols.length < 7) continue;

          const title = (cols[0] || '').trim();
          const description = (cols[1] || '').trim();
          const emoji = (cols[2] || '').trim();
          const questType = (cols[3] || '').trim();
          const groupSize = (cols[4] || '').trim();
          const question = (cols[5] || '').trim();
          const inputType = (cols[6] || '').trim();
          const correctAnswer = (cols[7] || '').trim();
          const choices = (cols[8] || '').trim();
          const targetTagsRaw = (cols[9] || '').trim();
          if (!title || !question) continue;

          const validInputTypes = ['text', 'code', 'player-select', 'multiple-choice'];
          const safeInputType = validInputTypes.includes(inputType) ? inputType : 'text';

          if (!questMap.has(title)) {
            questMap.set(title, {
              description: description || '',
              emoji: emoji || '📜',
              questType: (questType === 'collaborative') ? 'collaborative' : 'individual',
              groupSize: groupSize || '3',
              targetTags: targetTagsRaw || '',
              tasks: [],
            });
            questOrder.push(title);
          }

          const entry = questMap.get(title)!;
          // Allow overriding description/emoji from first non-empty row
          if (description && !entry.description) entry.description = description;
          if (emoji && entry.emoji === '📜') entry.emoji = emoji;

          entry.tasks.push({
            question,
            inputType: safeInputType,
            correctAnswer: correctAnswer || '',
            choices: choices || '',
          });
        }

        if (questOrder.length === 0) {
          setCsvError('Aucune quete valide trouvee. Verifiez le format du CSV.');
          return;
        }

        const now = Date.now();
        const newQuests: Quest[] = questOrder.map((title, tplIdx) => {
          const entry = questMap.get(title)!;
          const questId = now + tplIdx * 100 + Math.floor(Math.random() * 99);
          const isCollab = entry.questType === 'collaborative';
          return {
            id: questId,
            title,
            description: entry.description || 'Resolution : debut du prochain Jour',
            playerStatuses: {},
            tasks: entry.tasks.map((task, idx) => ({
              id: questId * 100 + idx,
              question: task.question,
              inputType: task.inputType as QuestTaskInputType,
              correctAnswer: task.correctAnswer,
              choices: task.inputType === 'multiple-choice' && task.choices
                ? task.choices.split('|').map(c => c.trim()).filter(Boolean)
                : undefined,
              playerAnswers: {},
              playerResults: {},
            })),
            createdAt: new Date().toISOString(),
            hidden: true,
            ...(isCollab ? { questType: 'collaborative' as const, collaborativeGroupSize: parseInt(entry.groupSize, 10) || 3 } : {}),
            ...(entry.targetTags ? { targetTags: entry.targetTags.split('|').map(t => t.trim()).filter(Boolean) } : {}),
          };
        });

        console.log('[CSV Import] Parsed', newQuests.length, 'quests:', newQuests.map(q => q.title));
        updateState((s) => ({ ...s, quests: [...(s.quests || []), ...newQuests] }));
        setCsvImportedCount(newQuests.length);
        setCsvError(null);
      } catch (err) {
        console.error('[CSV Import Error]', err);
        setCsvError(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.onerror = () => {
      console.error('[CSV Import] FileReader error', reader.error);
      setCsvError('Impossible de lire le fichier.');
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input so re-importing same file works
    if (csvFileRef.current) csvFileRef.current.value = '';
  }, [parseCsvLine, updateState]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon size={18} style={{ color: t.gold }} />
          <h2 style={{ fontFamily: '"Cinzel", serif', color: t.gold, fontSize: '1rem', fontWeight: 700 }}>
            Quetes
          </h2>
          <span
            className="px-2 py-0.5 rounded-full text-xs"
            style={{ background: t.goldBg, color: t.gold, border: `1px solid ${t.goldBorder}` }}
          >
            {quests.length} en reserve
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowTagManager(!showTagManager); setShowTemplates(false); setShowCreateForm(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: showTagManager ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.06)',
              border: '1px solid rgba(168,85,247,0.2)',
              color: '#a855f7',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
            }}
          >
            <Tag size={14} />
            Tags{availableTags.length > 0 ? ` (${availableTags.length})` : ''}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { setShowTemplates(!showTemplates); setShowCreateForm(false); setShowTagManager(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: showTemplates ? 'rgba(147,130,220,0.15)' : 'rgba(147,130,220,0.06)',
              border: '1px solid rgba(147,130,220,0.2)',
              color: '#9382dc',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
            }}
          >
            <BookOpen size={14} />
            Modeles
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => { if (editingQuestId) { resetForm(); } else { setShowCreateForm(!showCreateForm); } setShowTemplates(false); setShowTagManager(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{
              background: showCreateForm ? 'rgba(212,168,67,0.15)' : t.goldBg,
              border: `1px solid ${t.goldBorder}`,
              color: t.gold,
              fontFamily: '"Cinzel", serif',
              fontSize: '0.75rem',
            }}
          >
            <Plus size={14} />
            Nouvelle
          </motion.button>
        </div>
      </div>

      {/* Quest templates */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(147,130,220,0.06), rgba(255,255,255,0.02))',
              border: '1px solid rgba(147,130,220,0.15)',
            }}
          >
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 style={{ fontFamily: '"Cinzel", serif', color: '#9382dc', fontSize: '0.85rem' }}>
                  Quetes pre-faites
                </h3>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setShowCsvModal(true); setCsvError(null); setCsvImportedCount(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(76,175,80,0.08)',
                      border: '1px solid rgba(76,175,80,0.2)',
                      color: '#66bb6a',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                  >
                    <FileSpreadsheet size={12} />
                    Importer CSV
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddAllTemplates}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #7c6bc4, #9382dc)',
                      color: '#fff',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={12} />
                    Ajouter les {QUEST_TEMPLATES.length}
                  </motion.button>
                </div>
              </div>
              <p style={{ color: 'rgba(147,130,220,0.6)', fontSize: '0.65rem' }}>
                Cliquez sur une quete pour l'ajouter au pool. Les reponses sont editables apres ajout.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUEST_TEMPLATES.map((tpl, idx) => {
                  const taskTypes = tpl.tasks.map(t => INPUT_TYPE_OPTIONS.find(o => o.value === t.inputType)?.label || t.inputType);
                  return (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAddTemplate(tpl)}
                      className="rounded-lg p-3 text-left flex gap-3 items-start"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0 }}>{tpl.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: '"Cinzel", serif', color: t.text, fontSize: '0.75rem', fontWeight: 600 }}>
                          {tpl.title}
                        </p>
                        <p style={{ color: t.textDim, fontSize: '0.6rem', marginTop: '0.15rem' }}>
                          {tpl.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {tpl.tasks.length > 0 && (
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(147,130,220,0.08)', color: '#9382dc', fontSize: '0.55rem' }}
                          >
                            {tpl.tasks.length} tache{tpl.tasks.length > 1 ? 's' : ''}
                          </span>
                          )}
                          {tpl.questType === 'collaborative' && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(106,122,176,0.15)', fontSize: '0.5rem', color: '#9aabda', border: '1px solid rgba(106,122,176,0.3)' }}>
                              <Handshake size={9} /> Collab · {tpl.collaborativeGroupSize}j/grp
                            </span>
                          )}
                          {[...new Set(taskTypes)].map((type, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(212,168,67,0.06)', color: t.gold, fontSize: '0.55rem' }}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Plus size={14} style={{ color: '#9382dc', flexShrink: 0, marginTop: '0.15rem' }} />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Manager */}
      <AnimatePresence>
        {showTagManager && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl overflow-hidden"
            style={{
              background: t.isDay
                ? 'linear-gradient(135deg, rgba(126,59,161,0.06), rgba(255,255,255,0.3))'
                : 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(255,255,255,0.02))',
              border: `1px solid ${t.isDay ? 'rgba(126,59,161,0.15)' : 'rgba(168,85,247,0.15)'}`,
            }}
          >
            <div className="p-4 flex flex-col gap-4">
              <h3 style={{ fontFamily: '"Cinzel", serif', color: t.isDay ? '#7e3ba1' : '#a855f7', fontSize: '0.85rem' }}>
                Gestion des tags
              </h3>
              <p style={{ color: t.isDay ? 'rgba(126,59,161,0.7)' : 'rgba(168,85,247,0.6)', fontSize: '0.6rem', lineHeight: 1.5 }}>
                Creez des tags pour segmenter vos joueurs (ex: Famille, Amis, Collegues).
                Assignez-les ensuite aux joueurs. Les quetes ciblees ne seront distribuees qu'aux joueurs concernes.
              </p>

              {/* Create new tag */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nouveau tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTag(); }}
                  className="flex-1 px-3 py-2 rounded-lg outline-none"
                  style={{
                    background: t.isDay ? 'rgba(126,59,161,0.06)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${t.isDay ? 'rgba(126,59,161,0.2)' : 'rgba(168,85,247,0.2)'}`,
                    color: t.isDay ? '#4a1d6b' : '#e9d5ff',
                    fontSize: '0.8rem',
                  }}
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || availableTags.includes(newTagName.trim())}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
                  style={{
                    background: newTagName.trim() && !availableTags.includes(newTagName.trim())
                      ? (t.isDay ? 'linear-gradient(135deg, #7e3ba1, #a855f7)' : 'linear-gradient(135deg, #7c3aed, #a855f7)')
                      : (t.isDay ? 'rgba(126,59,161,0.08)' : 'rgba(168,85,247,0.08)'),
                    color: newTagName.trim() && !availableTags.includes(newTagName.trim())
                      ? '#fff'
                      : (t.isDay ? 'rgba(126,59,161,0.4)' : 'rgba(168,85,247,0.3)'),
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  <Plus size={13} />
                  Creer
                </motion.button>
              </div>

              {/* Existing tags */}
              {availableTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => {
                    const count = Object.values(playerTags).filter(tags => tags.includes(tag)).length;
                    return (
                      <div
                        key={tag}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                        style={{
                          background: t.isDay ? 'rgba(126,59,161,0.08)' : 'rgba(168,85,247,0.1)',
                          border: `1px solid ${t.isDay ? 'rgba(126,59,161,0.2)' : 'rgba(168,85,247,0.25)'}`,
                        }}
                      >
                        <Tag size={11} style={{ color: t.isDay ? '#7e3ba1' : '#a855f7' }} />
                        <span style={{ color: t.isDay ? '#6b2d8b' : '#c084fc', fontSize: '0.7rem', fontWeight: 600 }}>{tag}</span>
                        <span style={{ color: t.isDay ? 'rgba(126,59,161,0.5)' : 'rgba(168,85,247,0.5)', fontSize: '0.55rem' }}>
                          ({count})
                        </span>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="ml-1 p-0.5 rounded hover:bg-white/5 transition-colors"
                          title={`Supprimer le tag "${tag}"`}
                        >
                          <X size={10} style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {availableTags.length === 0 && (
                <p style={{ color: t.isDay ? 'rgba(126,59,161,0.45)' : 'rgba(168,85,247,0.4)', fontSize: '0.65rem', fontStyle: 'italic' }}>
                  Aucun tag cree. Creez un tag ci-dessus pour commencer.
                </p>
              )}

              {/* Player tag assignment */}
              {availableTags.length > 0 && state.players.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  <span style={{ fontFamily: '"Cinzel", serif', color: t.isDay ? '#7e3ba1' : '#c084fc', fontSize: '0.75rem', fontWeight: 600 }}>
                    Assigner aux joueurs
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {state.players.map(player => {
                      const pTags = playerTags[player.id] || [];
                      const isExpanded = tagAssignPlayerId === player.id;
                      return (
                        <div
                          key={player.id}
                          className="rounded-lg overflow-hidden"
                          style={{
                            background: t.isDay ? 'rgba(126,59,161,0.03)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isExpanded
                              ? (t.isDay ? 'rgba(126,59,161,0.25)' : 'rgba(168,85,247,0.3)')
                              : (t.isDay ? 'rgba(126,59,161,0.1)' : 'rgba(255,255,255,0.06)')}`,
                          }}
                        >
                          <button
                            onClick={() => setTagAssignPlayerId(isExpanded ? null : player.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                          >
                            <span style={{ fontSize: '1rem' }}>{player.avatar}</span>
                            <span className="flex-1 truncate" style={{ color: player.alive ? t.text : t.textDim, fontSize: '0.7rem', textDecoration: player.alive ? 'none' : 'line-through' }}>
                              {player.name}
                            </span>
                            {pTags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {pTags.map(tag => (
                                  <span
                                    key={tag}
                                    className="px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: t.isDay ? 'rgba(126,59,161,0.1)' : 'rgba(168,85,247,0.12)',
                                      color: t.isDay ? '#7e3ba1' : '#c084fc',
                                      fontSize: '0.5rem',
                                      border: `1px solid ${t.isDay ? 'rgba(126,59,161,0.18)' : 'rgba(168,85,247,0.2)'}`,
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {pTags.length === 0 && (
                              <span style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic' }}>
                                Aucun tag
                              </span>
                            )}
                            {isExpanded ? <ChevronUp size={12} style={{ color: t.textMuted }} /> : <ChevronDown size={12} style={{ color: t.textMuted }} />}
                          </button>
                          {isExpanded && (
                            <div className="px-2.5 pb-2.5 flex flex-wrap gap-1.5" style={{ borderTop: `1px solid ${t.isDay ? 'rgba(126,59,161,0.08)' : 'rgba(255,255,255,0.04)'}`, paddingTop: '0.5rem' }}>
                              {availableTags.map(tag => {
                                const has = pTags.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => handleTogglePlayerTag(player.id, tag)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md transition-all"
                                    style={{
                                      background: has
                                        ? (t.isDay ? 'rgba(126,59,161,0.15)' : 'rgba(168,85,247,0.2)')
                                        : (t.isDay ? 'rgba(126,59,161,0.04)' : 'rgba(255,255,255,0.03)'),
                                      border: `1px solid ${has
                                        ? (t.isDay ? 'rgba(126,59,161,0.35)' : 'rgba(168,85,247,0.4)')
                                        : (t.isDay ? 'rgba(126,59,161,0.1)' : 'rgba(255,255,255,0.06)')}`,
                                      color: has ? (t.isDay ? '#6b2d8b' : '#c084fc') : t.textMuted,
                                      fontSize: '0.65rem',
                                    }}
                                  >
                                    <Tag size={10} />
                                    {tag}
                                    {has && <CheckCircle size={10} style={{ color: t.isDay ? '#7e3ba1' : '#a855f7' }} />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl overflow-hidden"
            style={{
              background: editingQuestId
                ? 'linear-gradient(135deg, rgba(34,165,90,0.06), rgba(255,255,255,0.02))'
                : 'linear-gradient(135deg, rgba(212,168,67,0.06), rgba(255,255,255,0.02))',
              border: `1px solid ${editingQuestId ? 'rgba(34,165,90,0.25)' : t.goldBorder}`,
            }}
          >
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: '"Cinzel", serif', color: editingQuestId ? '#22a55a' : t.gold, fontSize: '0.85rem' }}>
                  {editingQuestId ? 'Modifier la quete' : 'Creer une quete'}
                </h3>
                {editingQuestId && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,165,90,0.1)', color: '#22a55a', fontSize: '0.55rem', border: '1px solid rgba(34,165,90,0.2)' }}
                  >
                    <Pencil size={9} /> Edition
                  </span>
                )}
              </div>

              <input
                type="text"
                placeholder="Titre de la quete..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.inputText,
                  fontSize: '0.8rem',
                  fontFamily: '"Cinzel", serif',
                }}
              />

              <input
                type="text"
                placeholder="Description (defaut: Resolution au prochain Jour)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none"
                style={{
                  background: t.inputBg,
                  border: `1px solid ${t.inputBorder}`,
                  color: t.textSecondary,
                  fontSize: '0.75rem',
                }}
              />

              {/* Quest type */}
              <div className="flex items-center gap-2">
                <span style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                  Type :
                </span>
                <button
                  onClick={() => { setNewQuestType('individual'); setNewTasks(prev => prev.length === 0 ? [{ question: '', inputType: 'text', correctAnswer: '', choices: ['', ''], imageUrl: '' }] : prev); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                  style={{
                    background: newQuestType === 'individual' ? t.goldBg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${newQuestType === 'individual' ? t.goldBorder : 'rgba(255,255,255,0.06)'}`,
                    color: newQuestType === 'individual' ? t.gold : t.textMuted,
                    fontSize: '0.7rem',
                  }}
                >
                  <Users size={12} />
                  Individuelle
                </button>
                <button
                  onClick={() => setNewQuestType('collaborative')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                  style={{
                    background: newQuestType === 'collaborative' ? 'rgba(106,122,176,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${newQuestType === 'collaborative' ? 'rgba(106,122,176,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    color: newQuestType === 'collaborative' ? '#9aabda' : t.textMuted,
                    fontSize: '0.7rem',
                  }}
                >
                  <Handshake size={12} />
                  Collaborative
                </button>
              </div>

              {/* Info banner based on quest type */}
              {newQuestType === 'individual' ? (
                <div
                  className="rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
                >
                  <Users size={13} style={{ color: '#3b82f6' }} />
                  <span style={{ color: '#3b82f6', fontSize: '0.65rem' }}>
                    Chaque joueur repond individuellement. Les resultats sont personnels.
                  </span>
                </div>
              ) : (
                <>
                  <div
                    className="rounded-lg px-3 py-2 flex items-center gap-2"
                    style={{ background: 'rgba(106,122,176,0.08)', border: '1px solid rgba(106,122,176,0.2)' }}
                  >
                    <Handshake size={13} style={{ color: '#9aabda' }} />
                    <span style={{ color: '#9aabda', fontSize: '0.65rem' }}>
                      Quand un joueur tire cette quete, le systeme forme automatiquement un groupe et l'envoie a tous ses membres.
                    </span>
                  </div>

                  {/* Group size selector */}
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                      Taille des groupes :
                    </span>
                    {[2, 3, 4, 5].map(size => (
                      <button
                        key={size}
                        onClick={() => setNewGroupSize(size)}
                        className="flex items-center justify-center rounded-md"
                        style={{
                          width: '2rem',
                          height: '2rem',
                          background: newGroupSize === size ? 'rgba(106,122,176,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${newGroupSize === size ? 'rgba(106,122,176,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          color: newGroupSize === size ? '#9aabda' : t.textMuted,
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          fontFamily: '"Cinzel", serif',
                        }}
                      >
                        {size}
                      </button>
                    ))}
                    <span style={{ color: t.textDim, fontSize: '0.6rem' }}>
                      joueurs / groupe
                    </span>
                  </div>
                </>
              )}

              {/* Target audience */}
              {availableTags.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                      Public cible :
                    </span>
                    <button
                      onClick={() => { setNewTargetMode('everyone'); setNewTargetTags([]); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                      style={{
                        background: newTargetMode === 'everyone' ? 'rgba(107,142,90,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${newTargetMode === 'everyone' ? 'rgba(107,142,90,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        color: newTargetMode === 'everyone' ? '#81c784' : t.textMuted,
                        fontSize: '0.7rem',
                      }}
                    >
                      <Users size={12} />
                      Tous
                    </button>
                    <button
                      onClick={() => setNewTargetMode('tags')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                      style={{
                        background: newTargetMode === 'tags' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${newTargetMode === 'tags' ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                        color: newTargetMode === 'tags' ? '#c084fc' : t.textMuted,
                        fontSize: '0.7rem',
                      }}
                    >
                      <Tag size={12} />
                      Par tags
                    </button>
                  </div>
                  {newTargetMode === 'tags' && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {availableTags.map(tag => {
                        const selected = newTargetTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => setNewTargetTags(prev => selected ? prev.filter(t => t !== tag) : [...prev, tag])}
                            className="flex items-center gap-1 px-2 py-1 rounded-md transition-all"
                            style={{
                              background: selected ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selected ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              color: selected ? '#c084fc' : t.textMuted,
                              fontSize: '0.65rem',
                            }}
                          >
                            <Tag size={10} />
                            {tag}
                            {selected && <CheckCircle size={10} style={{ color: '#a855f7' }} />}
                          </button>
                        );
                      })}
                      {newTargetTags.length > 0 && (
                        <span style={{ color: 'rgba(168,85,247,0.6)', fontSize: '0.55rem', alignSelf: 'center', marginLeft: '0.25rem' }}>
                          Joueurs avec {newTargetTags.join(' ou ')}
                        </span>
                      )}
                      {newTargetTags.length === 0 && (
                        <span style={{ color: '#f59e0b', fontSize: '0.55rem', fontStyle: 'italic', alignSelf: 'center' }}>
                          Selectionnez au moins un tag
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Distribution order */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={13} style={{ color: t.textMuted }} />
                  <span style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                    Ordre de distribution :
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setNewDistributionOrder('random')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                    style={{
                      background: newDistributionOrder === 'random' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${newDistributionOrder === 'random' ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      color: newDistributionOrder === 'random' ? '#60a5fa' : t.textMuted,
                      fontSize: '0.7rem',
                    }}
                  >
                    <Shuffle size={11} />
                    Aleatoire
                  </button>
                  <button
                    onClick={() => setNewDistributionOrder('available')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md"
                    style={{
                      background: newDistributionOrder === 'available' ? 'rgba(107,142,90,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${newDistributionOrder === 'available' ? 'rgba(107,142,90,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      color: newDistributionOrder === 'available' ? '#6b8e5a' : t.textMuted,
                      fontSize: '0.7rem',
                    }}
                  >
                    <Zap size={11} />
                    Dispo. par defaut
                  </button>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setNewDistributionOrder(n)}
                      className="flex items-center justify-center rounded-md"
                      style={{
                        width: '2rem',
                        height: '2rem',
                        background: newDistributionOrder === n ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${newDistributionOrder === n ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: newDistributionOrder === n ? '#d4a843' : t.textMuted,
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        fontFamily: '"Cinzel", serif',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span style={{ color: t.textDim, fontSize: '0.55rem', lineHeight: 1.3 }}>
                  {newDistributionOrder === 'available'
                    ? 'Cette quete sera automatiquement disponible pour tous les joueurs eligibles sans distribution manuelle.'
                    : newDistributionOrder === 'random'
                    ? 'Cette quete sera distribuee aleatoirement parmi les joueurs disponibles.'
                    : `Priorite ${newDistributionOrder} — cette quete sera distribuee en priorite a tous les joueurs eligibles.`}
                </span>
              </div>

              {/* Tasks — hidden for collaborative quests */}
              {newQuestType !== 'collaborative' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span style={{ color: t.textMuted, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                    Taches ({newTasks.length})
                  </span>
                  <button
                    onClick={addTask}
                    className="flex items-center gap-1 px-2 py-1 rounded-md"
                    style={{ background: 'rgba(255,255,255,0.04)', color: t.textMuted, fontSize: '0.7rem' }}
                  >
                    <Plus size={11} /> Ajouter
                  </button>
                </div>

                {newTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-3 flex flex-col gap-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ color: t.gold, fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>
                        Tache {idx + 1}
                      </span>
                      {newTasks.length > 1 && (
                        <button onClick={() => removeTask(idx)}>
                          <Trash2 size={12} style={{ color: '#c41e3a' }} />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Question / Objectif..."
                      value={task.question}
                      onChange={(e) => updateTask(idx, 'question', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md outline-none"
                      style={{
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '0.75rem',
                      }}
                    />

                    {/* Referenced player selector */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <UserCircle size={12} style={{ color: t.textMuted }} />
                        <span style={{ color: t.textMuted, fontSize: '0.65rem' }}>Joueur concerne :</span>
                        {task.referencedPlayerId && (() => {
                          const rp = state.players.find(p => p.id === task.referencedPlayerId);
                          if (!rp) return null;
                          return (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.25)' }}>
                              <span className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 inline-flex">
                                <GMAvatar player={rp} size="text-xs" />
                              </span>
                              <span style={{ color: t.gold, fontSize: '0.6rem', fontWeight: 600 }}>{rp.name}</span>
                              <button type="button" onClick={() => updateTask(idx, 'referencedPlayerId', undefined)} className="ml-0.5">
                                <X size={9} style={{ color: t.textMuted }} />
                              </button>
                            </span>
                          );
                        })()}
                      </div>
                      {!task.referencedPlayerId && (
                        <div className="flex flex-wrap gap-1">
                          {state.players.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => updateTask(idx, 'referencedPlayerId', p.id)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                fontSize: '0.55rem',
                                color: t.textSecondary,
                              }}
                            >
                              <span className="w-3.5 h-3.5 rounded-full overflow-hidden flex-shrink-0 inline-flex">
                                <GMAvatar player={p} size="text-xs" />
                              </span>
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Image upload */}
                    <div className="flex items-center gap-2">
                      {task.imageUrl ? (
                        <div className="relative rounded-lg overflow-hidden" style={{ maxWidth: '160px' }}>
                          <img src={task.imageUrl} alt="Task" className="w-full h-auto rounded-lg" style={{ maxHeight: '100px', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => updateTask(idx, 'imageUrl', '')}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <label
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: t.textMuted,
                            fontSize: '0.65rem',
                            opacity: uploadingTaskIdx === idx ? 0.5 : 1,
                          }}
                        >
                          {uploadingTaskIdx === idx ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <Clock size={12} />
                            </motion.div>
                          ) : (
                            <ImagePlus size={12} />
                          )}
                          {uploadingTaskIdx === idx ? 'Upload...' : 'Image'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingTaskIdx === idx}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleTaskImageUpload(idx, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {INPUT_TYPE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateTask(idx, 'inputType', opt.value)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                          style={{
                            background: task.inputType === opt.value ? t.goldBg : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${task.inputType === opt.value ? t.goldBorder : 'rgba(255,255,255,0.06)'}`,
                            color: task.inputType === opt.value ? t.gold : t.textMuted,
                            fontSize: '0.65rem',
                          }}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      ))}
                    </div>

                    {task.inputType === 'multiple-choice' && (
                      <div className="flex flex-col gap-1.5 pl-2">
                        <span style={{ color: t.textDim, fontSize: '0.65rem' }}>Options :</span>
                        {task.choices.map((choice, cIdx) => (
                          <input
                            key={cIdx}
                            type="text"
                            placeholder={`Option ${cIdx + 1}`}
                            value={choice}
                            onChange={(e) => updateChoice(idx, cIdx, e.target.value)}
                            className="w-full px-2 py-1 rounded-md outline-none"
                            style={{
                              background: t.inputBg,
                              border: `1px solid ${t.inputBorder}`,
                              color: t.inputText,
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                        <button
                          onClick={() => addChoice(idx)}
                          className="self-start flex items-center gap-1 px-2 py-0.5 rounded-md"
                          style={{ color: t.textMuted, fontSize: '0.6rem' }}
                        >
                          <Plus size={10} /> Option
                        </button>
                      </div>
                    )}

                    {task.inputType === 'player-select' && (
                      <div className="flex flex-col gap-1.5 pl-2">
                        <span style={{ color: t.textDim, fontSize: '0.65rem' }}>
                          Selectionnez le(s) joueur(s) valides comme bonne reponse :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {state.players.map(player => {
                            const selected = task.correctAnswer
                              .split('|')
                              .map(s => s.trim())
                              .filter(Boolean)
                              .includes(player.name);
                            return (
                              <button
                                key={player.id}
                                type="button"
                                onClick={() => {
                                  const current = task.correctAnswer
                                    .split('|')
                                    .map(s => s.trim())
                                    .filter(s => s && s !== 'placeholder');
                                  let next: string[];
                                  if (selected) {
                                    next = current.filter(n => n !== player.name);
                                  } else {
                                    next = [...current, player.name];
                                  }
                                  updateTask(idx, 'correctAnswer', next.join('|'));
                                }}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer"
                                style={{
                                  background: selected ? 'rgba(107,142,90,0.15)' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${selected ? 'rgba(107,142,90,0.35)' : 'rgba(255,255,255,0.06)'}`,
                                  color: selected ? '#81c784' : t.textSecondary,
                                  fontSize: '0.6rem',
                                }}
                              >
                                <span style={{ fontSize: '0.75rem' }}>{player.avatar}</span>
                                <span>{player.name}</span>
                                {selected && (
                                  <CheckCircle size={10} style={{ color: '#6b8e5a' }} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {task.correctAnswer && task.correctAnswer !== 'placeholder' && (
                          <span style={{ color: '#6b8e5a', fontSize: '0.55rem', fontStyle: 'italic' }}>
                            {task.correctAnswer.split('|').filter(Boolean).length} joueur(s) selectionne(s)
                          </span>
                        )}
                        {(!task.correctAnswer || task.correctAnswer === 'placeholder') && (
                          <span style={{ color: '#f59e0b', fontSize: '0.55rem', fontStyle: 'italic' }}>
                            Aucun joueur selectionne — toute reponse sera incorrecte
                          </span>
                        )}
                      </div>
                    )}

                    {task.inputType !== 'player-select' && (
                      <div className="flex items-center gap-2">
                        <span style={{ color: t.textDim, fontSize: '0.65rem', whiteSpace: 'nowrap' }}>Reponse :</span>
                        <input
                          type="text"
                          placeholder="Reponse correcte..."
                          value={task.correctAnswer}
                          onChange={(e) => updateTask(idx, 'correctAnswer', e.target.value)}
                          className="flex-1 px-2 py-1 rounded-md outline-none"
                          style={{
                            background: 'rgba(107,142,90,0.08)',
                            border: '1px solid rgba(107,142,90,0.2)',
                            color: '#6b8e5a',
                            fontSize: '0.7rem',
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ color: t.textMuted, fontSize: '0.75rem' }}
                >
                  Annuler
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={editingQuestId ? handleSaveEdit : handleCreateQuest}
                  disabled={!newTitle.trim() || (newQuestType !== 'collaborative' && newTasks.every(t => !t.question.trim() || !t.correctAnswer.trim()))}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg"
                  style={{
                    background: editingQuestId
                      ? 'linear-gradient(135deg, #0d7c3f, #22a55a)'
                      : 'linear-gradient(135deg, #b8860b, #d4a843)',
                    color: editingQuestId ? '#fff' : '#1a1207',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    opacity: (!newTitle.trim() || (newQuestType !== 'collaborative' && newTasks.every(t => !t.question.trim() || !t.correctAnswer.trim()))) ? 0.4 : 1,
                  }}
                >
                  {editingQuestId ? <Save size={13} /> : <Package size={13} />}
                  {editingQuestId ? 'Sauvegarder' : 'Ajouter au pool'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quests per phase setting ── */}
      {quests.length > 0 && (
        <div
          className="rounded-xl p-3 flex flex-col gap-2"
          style={{
            background: 'linear-gradient(135deg, rgba(212,168,67,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(212,168,67,0.12)',
          }}
        >
          <div className="flex items-center gap-2">
            <Repeat size={14} style={{ color: '#d4a843' }} />
            <span style={{ fontFamily: '"Cinzel", serif', color: '#d4a843', fontSize: '0.75rem', fontWeight: 600 }}>
              Quetes par phase
            </span>
          </div>
          <p style={{ color: t.textMuted, fontSize: '0.6rem', lineHeight: 1.5 }}>
            Nombre max de quetes qu'un joueur peut completer par phase (jour ou nuit). Quand il reussit une quete, la suivante est automatiquement assignee.
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 0].map((val) => (
              <button
                key={val}
                onClick={() => updateState((s) => ({ ...s, questsPerPhase: val }))}
                className="flex items-center justify-center px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: (state.questsPerPhase ?? 1) === val
                    ? 'rgba(212,168,67,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${(state.questsPerPhase ?? 1) === val ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: (state.questsPerPhase ?? 1) === val ? '#d4a843' : t.textMuted,
                  fontFamily: '"Cinzel", serif',
                  fontSize: '0.7rem',
                  fontWeight: (state.questsPerPhase ?? 1) === val ? 700 : 400,
                }}
              >
                {val === 0 ? '∞' : val}
              </button>
            ))}
            <span style={{ color: t.textDim, fontSize: '0.55rem', marginLeft: '0.25rem' }}>
              {(state.questsPerPhase ?? 1) === 0 ? 'Illimite' : `${state.questsPerPhase ?? 1}/phase`}
            </span>
          </div>
        </div>
      )}

      {/* ── Distribution section ── */}
      {quests.length > 0 && (
        <div
          className="rounded-xl p-3 flex flex-col gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(59,130,246,0.12)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shuffle size={15} style={{ color: '#3b82f6' }} />
              <span style={{ fontFamily: '"Cinzel", serif', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>
                Distribution
              </span>
            </div>
            <div className="flex items-center gap-2">
              {minQuestsPerPlayer > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '0.55rem', fontWeight: 600 }}
                >
                  {minQuestsPerPlayer === maxQuestsPerPlayer
                    ? `${minQuestsPerPlayer} quete${minQuestsPerPlayer > 1 ? 's' : ''}/joueur`
                    : `${minQuestsPerPlayer}-${maxQuestsPerPlayer}/joueur`}
                </span>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div
            className="rounded-lg px-3 py-2 flex items-start gap-2"
            style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.08)' }}
          >
            <Zap size={12} className="shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
            <span style={{ color: '#3b82f6', fontSize: '0.6rem', lineHeight: 1.5 }}>
              Chaque distribution donne <strong>1 quete aleatoire</strong> a chaque joueur vivant.
              Les quetes collaboratives forment automatiquement des groupes.
            </span>
          </div>

          {/* Distribution result toast */}
          <AnimatePresence>
            {lastDistributionResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-lg px-3 py-2 flex items-center gap-2"
                style={{ background: 'rgba(107,142,90,0.12)', border: '1px solid rgba(107,142,90,0.25)' }}
              >
                <CheckCircle size={13} style={{ color: '#6b8e5a' }} />
                <span style={{ color: '#6b8e5a', fontSize: '0.65rem', fontWeight: 600 }}>
                  {lastDistributionResult}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quest distribution count */}
          {alivePlayerIds.length > 0 && minQuestsPerPlayer > 0 && (
            <div
              className="rounded-lg px-4 py-2.5 flex items-center gap-3"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)' }}
            >
              <Users size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <div className="flex items-center gap-1.5 flex-wrap">
                {quests.map((q) => {
                  const assigned = Object.values(assignments).some(qids => qids.includes(q.id));
                  return (
                    <div
                      key={q.id}
                      title={q.title}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: assigned ? '#60a5fa' : 'rgba(59,130,246,0.2)',
                        transition: 'background 0.2s ease',
                      }}
                    />
                  );
                })}
                <span style={{ color: '#60a5fa', fontSize: '0.65rem', marginLeft: 4, opacity: 0.8 }}>
                  {totalDistributed}/{quests.length}
                </span>
              </div>
            </div>
          )}

          {/* Distribute button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDistributeRound}
            disabled={!canDistribute}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer"
            style={{
              background: canDistribute ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'rgba(59,130,246,0.08)',
              color: canDistribute ? '#fff' : 'rgba(59,130,246,0.3)',
              fontFamily: '"Cinzel", serif',
              fontSize: '0.7rem',
              fontWeight: 700,
              opacity: canDistribute ? 1 : 0.5,
            }}
          >
            <Shuffle size={14} />
            Distribuer une quete a chacun
          </motion.button>

          {!canDistribute && quests.length > 0 && (
            <span style={{ color: t.textDim, fontSize: '0.55rem', textAlign: 'center', fontStyle: 'italic' }}>
              Tous les joueurs ont deja toutes les quetes disponibles.
            </span>
          )}
        </div>
      )}

      {/* Empty state */}
      {quests.length === 0 && !showCreateForm && (
        <div
          className="rounded-xl p-8 flex flex-col items-center gap-3"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <MapIcon size={32} style={{ color: t.textDim }} />
          <p style={{ color: t.textMuted, fontSize: '0.8rem', textAlign: 'center' }}>
            Aucune quete dans le pool.
          </p>
          <p style={{ color: t.textDim, fontSize: '0.7rem', textAlign: 'center' }}>
            Creez des quetes ou utilisez les modeles, puis distribuez-les aux joueurs.
          </p>
        </div>
      )}

      {/* ── Quest pool list ── */}
      <div className="flex flex-col gap-2">
        {quests.map((quest) => {
          const isExpanded = expandedQuestId === quest.id;
          const assignedPlayerIds = playersWithQuest(quest.id, assignments);
          const agg = questAggregateStatus(quest, assignedPlayerIds);
          const allResolved = agg.success + agg.fail === agg.total && agg.total > 0;
          const isCollaborative = (quest.questType || 'individual') === 'collaborative';

          return (
            <motion.div
              key={quest.id}
              layout
              className="rounded-xl overflow-hidden"
              style={{
                background: allResolved
                  ? (agg.fail > 0 ? 'rgba(196,30,58,0.04)' : 'rgba(107,142,90,0.04)')
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${allResolved
                  ? (agg.fail > 0 ? 'rgba(196,30,58,0.15)' : 'rgba(107,142,90,0.15)')
                  : t.isDay ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {/* Quest header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedQuestId(isExpanded ? null : quest.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedQuestId(isExpanded ? null : quest.id); } }}
                className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: '"Cinzel", serif', color: t.text, fontSize: '0.8rem', fontWeight: 600 }}>
                        {quest.title}
                      </span>
                      {isCollaborative && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(106,122,176,0.15)', fontSize: '0.5rem', color: '#9aabda', border: '1px solid rgba(106,122,176,0.3)' }}>
                          <Handshake size={9} /> Collab
                        </span>
                      )}
                      {quest.targetTags && quest.targetTags.length > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', fontSize: '0.5rem', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                          <Tag size={9} /> {quest.targetTags.join(', ')}
                        </span>
                      )}
                      {quest.distributionOrder === 'available' ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(107,142,90,0.12)', fontSize: '0.5rem', color: '#6b8e5a', border: '1px solid rgba(107,142,90,0.25)' }}>
                          <Zap size={9} /> Auto
                        </span>
                      ) : typeof quest.distributionOrder === 'number' ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,168,67,0.12)', fontSize: '0.5rem', color: '#d4a843', border: '1px solid rgba(212,168,67,0.25)' }}>
                          <ArrowUpDown size={9} /> #{quest.distributionOrder}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.08)', fontSize: '0.5rem', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.15)' }}>
                          <Shuffle size={9} /> Alea
                        </span>
                      )}
                    </div>
                    {/* Status summary */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(212,168,67,0.1)', fontSize: '0.55rem', color: '#d4a843' }}>
                        <Users size={9} /> {assignedPlayerIds.length} joueur{assignedPlayerIds.length !== 1 ? 's' : ''}
                      </span>
                      {agg.pending > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', fontSize: '0.55rem', color: '#f59e0b' }}>
                          <AlertTriangle size={9} /> {agg.pending} en attente
                        </span>
                      )}
                      {agg.success > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(107,142,90,0.1)', fontSize: '0.55rem', color: '#6b8e5a' }}>
                          <CheckCircle size={9} /> {agg.success}
                        </span>
                      )}
                      {agg.fail > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(196,30,58,0.1)', fontSize: '0.55rem', color: '#c41e3a' }}>
                          <XCircle size={9} /> {agg.fail}
                        </span>
                      )}
                      {assignedPlayerIds.length === 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', fontSize: '0.55rem', color: t.textDim }}>
                          <Package size={9} /> En reserve
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isExpanded ? <ChevronUp size={14} style={{ color: t.textMuted }} /> : <ChevronDown size={14} style={{ color: t.textMuted }} />}
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-3 pb-3 flex flex-col gap-3"
                      style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.04)', paddingTop: '0.75rem' }}
                    >
                      <p style={{ color: t.textMuted, fontSize: '0.7rem' }}>{quest.description}</p>

                      {/* Collaborative group details */}
                      {isCollaborative && (quest.collaborativeGroups || []).length > 0 && (
                        <div
                          className="rounded-lg p-2.5 flex flex-col gap-2.5"
                          style={{ background: 'rgba(106,122,176,0.06)', border: '1px solid rgba(106,122,176,0.15)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Handshake size={12} style={{ color: '#9aabda' }} />
                            <span style={{ fontFamily: '"Cinzel", serif', color: '#9aabda', fontSize: '0.7rem', fontWeight: 600 }}>
                              Groupes ({quest.collaborativeGroups?.length || 0})
                            </span>
                            <span style={{ color: '#7b8ec8', fontSize: '0.55rem' }}>
                              — {quest.collaborativeGroupSize || '?'} joueurs/groupe
                            </span>
                          </div>
                          {(quest.collaborativeGroups || []).map((group, gIdx) => {
                            const groupAllVoted = group.every(pid => quest.collaborativeVotes?.[pid] !== undefined);
                            const groupHasFail = group.some(pid => quest.collaborativeVotes?.[pid] === false);
                            const groupStatus = !groupAllVoted ? 'active' : (groupHasFail ? 'fail' : 'success');
                            return (
                              <div
                                key={gIdx}
                                className="rounded-md p-2 flex flex-col gap-1"
                                style={{
                                  background: groupStatus === 'success' ? 'rgba(107,142,90,0.06)'
                                    : groupStatus === 'fail' ? 'rgba(196,30,58,0.06)'
                                    : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${groupStatus === 'success' ? 'rgba(107,142,90,0.15)'
                                    : groupStatus === 'fail' ? 'rgba(196,30,58,0.15)'
                                    : 'rgba(255,255,255,0.06)'}`,
                                }}
                              >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span style={{ fontFamily: '"Cinzel", serif', color: groupStatus === 'success' ? '#6b8e5a' : groupStatus === 'fail' ? '#c41e3a' : '#9aabda', fontSize: '0.6rem', fontWeight: 600 }}>
                                    Groupe {gIdx + 1}
                                  </span>
                                  {groupStatus === 'success' && <CheckCircle size={10} style={{ color: '#6b8e5a' }} />}
                                  {groupStatus === 'fail' && <XCircle size={10} style={{ color: '#c41e3a' }} />}
                                  {groupStatus === 'active' && <Clock size={10} style={{ color: '#f5b342' }} />}
                                </div>
                                {group.map(pid => {
                                  const player = state.players.find(p => p.id === pid);
                                  if (!player) return null;
                                  const vote = quest.collaborativeVotes?.[pid];
                                  const hasVoted = vote !== undefined;
                                  return (
                                    <div
                                      key={pid}
                                      role={onNavigateToPlayer ? 'button' : undefined}
                                      tabIndex={onNavigateToPlayer ? 0 : undefined}
                                      onClick={onNavigateToPlayer ? (e) => { e.stopPropagation(); onNavigateToPlayer(pid); } : undefined}
                                      onKeyDown={onNavigateToPlayer ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onNavigateToPlayer(pid); } } : undefined}
                                      className="flex items-center gap-2 px-2 py-0.5 rounded transition-colors"
                                      style={{
                                        background: !hasVoted ? 'rgba(255,255,255,0.02)'
                                          : vote ? 'rgba(107,142,90,0.08)' : 'rgba(196,30,58,0.08)',
                                        cursor: onNavigateToPlayer ? 'pointer' : 'default',
                                      }}
                                      title={onNavigateToPlayer ? `Voir le profil de ${player.name}` : undefined}
                                    >
                                      <span style={{ fontSize: '0.7rem' }}>{player.avatar}</span>
                                      <span style={{ color: t.textSecondary, fontSize: '0.6rem', flex: 1, textDecoration: onNavigateToPlayer ? 'underline' : 'none', textDecorationColor: 'rgba(255,255,255,0.15)', textUnderlineOffset: '2px' }}>
                                        {player.name}
                                      </span>
                                      {hasVoted ? (
                                        vote
                                          ? <CheckCircle size={11} style={{ color: '#6b8e5a' }} />
                                          : <XCircle size={11} style={{ color: '#c41e3a' }} />
                                      ) : (
                                        <Clock size={11} style={{ color: t.textDim }} />
                                      )}
                                      {onNavigateToPlayer && <ExternalLink size={9} style={{ color: t.textDim, opacity: 0.5 }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tasks detail */}
                      {quest.tasks.map((task, tIdx) => (
                        <div
                          key={task.id}
                          className="rounded-lg p-2.5 flex flex-col gap-1.5"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="flex items-start gap-2">
                            {task.referencedPlayerId && (() => {
                              const rp = state.players.find(p => p.id === task.referencedPlayerId);
                              if (!rp) return null;
                              return (
                                <span className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5" style={{ border: '2px solid rgba(212,168,67,0.35)' }}>
                                  <GMAvatar player={rp} size="text-xs" />
                                </span>
                              );
                            })()}
                            <span className="flex-1" style={{ color: t.text, fontSize: '0.75rem' }}>
                              <span style={{ color: t.gold, fontWeight: 600 }}>{tIdx + 1}.</span> {task.question}
                            </span>
                          </div>
                          {task.imageUrl && (
                            <div className="rounded-md overflow-hidden mt-1" style={{ maxWidth: '120px' }}>
                              <img src={task.imageUrl} alt="" className="w-full h-auto" style={{ maxHeight: '80px', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span style={{ color: t.textDim, fontSize: '0.6rem' }}>
                              Type: {INPUT_TYPE_OPTIONS.find(o => o.value === task.inputType)?.label}
                            </span>
                            <span style={{ color: '#6b8e5a', fontSize: '0.6rem' }}>
                              Reponse attendue:{' '}
                              {task.inputType === 'player-select' && task.correctAnswer.includes('|')
                                ? task.correctAnswer.split('|').filter(Boolean).join(', ')
                                : task.correctAnswer}
                            </span>
                            {task.inputType === 'player-select' && task.correctAnswer.includes('|') && (
                              <span style={{ color: '#9382dc', fontSize: '0.55rem' }}>
                                ({task.correctAnswer.split('|').filter(Boolean).length} joueurs)
                              </span>
                            )}
                          </div>

                          {/* Per-player answers */}
                          <div className="flex flex-col gap-1 mt-1">
                            {state.players.filter(p => task.playerAnswers?.[p.id] !== undefined).map(player => {
                              const answer = task.playerAnswers?.[player.id];
                              const result = task.playerResults?.[player.id];
                              const status = quest.playerStatuses?.[player.id] || 'active';
                              const isResolved = status === 'success' || status === 'fail';

                              return (
                                <div
                                  key={player.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
                                  style={{
                                    background: result === true
                                      ? 'rgba(107,142,90,0.08)'
                                      : result === false
                                        ? 'rgba(196,30,58,0.08)'
                                        : 'rgba(255,255,255,0.02)',
                                  }}
                                >
                                  <span style={{ fontSize: '0.75rem' }}>{player.avatar}</span>
                                  <button
                                    onClick={onNavigateToPlayer ? (e) => { e.stopPropagation(); onNavigateToPlayer(player.id); } : undefined}
                                    disabled={!onNavigateToPlayer}
                                    className="text-left"
                                    style={{
                                      color: t.textSecondary, fontSize: '0.65rem', minWidth: '3.5rem',
                                      cursor: onNavigateToPlayer ? 'pointer' : 'default',
                                      textDecoration: onNavigateToPlayer ? 'underline' : 'none',
                                      textDecorationColor: 'rgba(255,255,255,0.15)',
                                      textUnderlineOffset: '2px',
                                      background: 'none', border: 'none', padding: 0,
                                    }}
                                    title={onNavigateToPlayer ? `Voir le profil de ${player.name}` : undefined}
                                  >
                                    {player.name}
                                  </button>
                                  <span style={{ color: t.text, fontSize: '0.65rem', flex: 1 }}>
                                    {answer}
                                  </span>
                                  {isResolved && result !== undefined && (
                                    result
                                      ? <CheckCircle size={12} style={{ color: '#6b8e5a' }} />
                                      : <XCircle size={12} style={{ color: '#c41e3a' }} />
                                  )}
                                </div>
                              );
                            })}
                            {(() => {
                              const unanswered = assignedPlayerIds.filter(pid => task.playerAnswers?.[pid] === undefined);
                              if (unanswered.length === 0) return null;
                              return (
                                <span style={{ color: t.textDim, fontSize: '0.55rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                  {unanswered.length} joueur(s) n'ont pas encore repondu
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      ))}

                      {/* Share player picker */}
                      <AnimatePresence>
                        {sharingQuestId === quest.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="rounded-lg p-2.5 flex flex-col gap-2"
                              style={{ background: 'rgba(147,130,220,0.05)', border: '1px solid rgba(147,130,220,0.15)' }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <UserPlus size={12} style={{ color: '#9382dc' }} />
                                  <span style={{ fontFamily: '"Cinzel", serif', color: '#9382dc', fontSize: '0.65rem', fontWeight: 600 }}>
                                    Partager a...
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    const eligiblePlayers = ((quest.questType || 'individual') === 'collaborative' ? alivePlayers : state.players)
                                      .filter(player => isPlayerEligible(player.id, quest) && !(assignments[player.id] || []).includes(quest.id));
                                    const allSelected = eligiblePlayers.length > 0 && eligiblePlayers.every(p => selectedSharePlayerIds.has(p.id));
                                    return eligiblePlayers.length > 0 ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (allSelected) {
                                            setSelectedSharePlayerIds(new Set());
                                          } else {
                                            setSelectedSharePlayerIds(new Set(eligiblePlayers.map(p => p.id)));
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded-md cursor-pointer transition-all"
                                        style={{
                                          background: allSelected ? 'rgba(147,130,220,0.15)' : 'rgba(147,130,220,0.08)',
                                          border: `1px solid ${allSelected ? 'rgba(147,130,220,0.35)' : 'rgba(147,130,220,0.15)'}`,
                                          color: '#9382dc',
                                          fontSize: '0.55rem',
                                          fontWeight: 600,
                                          fontFamily: '"Cinzel", serif',
                                        }}
                                      >
                                        {allSelected ? 'Aucun' : 'Tous'}
                                      </button>
                                    ) : null;
                                  })()}
                                  {selectedSharePlayerIds.size > 0 && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-full"
                                      style={{ background: 'rgba(147,130,220,0.12)', color: '#9382dc', fontSize: '0.55rem', fontWeight: 600 }}
                                    >
                                      {selectedSharePlayerIds.size} selectionne{selectedSharePlayerIds.size > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {quest.targetTags && quest.targetTags.length > 0 && (
                                <div className="flex items-center gap-1.5 mb-1" style={{ color: '#c084fc', fontSize: '0.55rem' }}>
                                  <Tag size={10} />
                                  <span>Filtre par tags : {quest.targetTags.join(', ')}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {((quest.questType || 'individual') === 'collaborative' ? alivePlayers : state.players).filter(player => isPlayerEligible(player.id, quest) || (assignments[player.id] || []).includes(quest.id)).map(player => {
                                  const alreadyHas = (assignments[player.id] || []).includes(quest.id);
                                  const isSelected = selectedSharePlayerIds.has(player.id);
                                  return (
                                    <button
                                      key={player.id}
                                      onClick={(e) => { e.stopPropagation(); if (!alreadyHas) handleToggleSharePlayer(player.id); }}
                                      disabled={alreadyHas}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer"
                                      style={{
                                        background: alreadyHas
                                          ? 'rgba(107,142,90,0.08)'
                                          : isSelected
                                            ? 'rgba(147,130,220,0.15)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${alreadyHas
                                          ? 'rgba(107,142,90,0.2)'
                                          : isSelected
                                            ? 'rgba(147,130,220,0.35)'
                                            : 'rgba(255,255,255,0.06)'}`,
                                        color: alreadyHas ? '#6b8e5a' : isSelected ? '#b8a9e8' : t.textSecondary,
                                        fontSize: '0.6rem',
                                        opacity: alreadyHas ? 0.6 : 1,
                                      }}
                                    >
                                      <span style={{ fontSize: '0.75rem' }}>{player.avatar}</span>
                                      <span style={{ opacity: player.alive ? 1 : 0.6 }}>{player.name}{!player.alive ? ' 💀' : ''}</span>
                                      {alreadyHas && <CheckCircle size={10} style={{ color: '#6b8e5a' }} />}
                                      {isSelected && !alreadyHas && (
                                        <span
                                          className="rounded-full flex items-center justify-center"
                                          style={{ width: 14, height: 14, background: '#9382dc', color: '#fff', fontSize: '0.5rem', fontWeight: 700 }}
                                        >
                                          ✓
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex justify-end gap-2 mt-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSharingQuestId(null); setSelectedSharePlayerIds(new Set()); }}
                                  className="px-2.5 py-1 rounded-md cursor-pointer"
                                  style={{ color: t.textMuted, fontSize: '0.6rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                                >
                                  Annuler
                                </button>
                                {(() => {
                                  const collabMinSize = isCollaborative ? (quest.collaborativeGroupSize || 2) : 1;
                                  const enoughSelected = selectedSharePlayerIds.size >= collabMinSize;
                                  return (
                                    <>
                                      {isCollaborative && selectedSharePlayerIds.size > 0 && !enoughSelected && (
                                        <span style={{ color: '#f59e0b', fontSize: '0.5rem', alignSelf: 'center' }}>
                                          Min. {collabMinSize} joueurs
                                        </span>
                                      )}
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={(e) => { e.stopPropagation(); handleManualShare(quest.id); }}
                                        disabled={!enoughSelected}
                                        className="flex items-center gap-1 px-3 py-1 rounded-md cursor-pointer"
                                        style={{
                                          background: enoughSelected ? 'linear-gradient(135deg, #7c6bc4, #9382dc)' : 'rgba(147,130,220,0.08)',
                                          color: enoughSelected ? '#fff' : 'rgba(147,130,220,0.3)',
                                          fontSize: '0.6rem',
                                          fontWeight: 700,
                                          fontFamily: '"Cinzel", serif',
                                          opacity: enoughSelected ? 1 : 0.5,
                                        }}
                                      >
                                        <Send size={11} />
                                        Envoyer{isCollaborative ? ` (${selectedSharePlayerIds.size}/${collabMinSize})` : ''}
                                      </motion.button>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action buttons */}
                      <div className="flex justify-end gap-2 mt-1">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); handleStartEdit(quest); }}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg"
                          style={{
                            background: t.goldBg,
                            border: `1px solid ${t.goldBorder}`,
                            color: t.gold,
                            fontSize: '0.7rem',
                          }}
                        >
                          <Pencil size={12} />
                          Modifier
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); handleOpenShare(quest.id); }}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg"
                          style={{
                            background: sharingQuestId === quest.id ? 'rgba(147,130,220,0.15)' : 'rgba(147,130,220,0.06)',
                            border: `1px solid ${sharingQuestId === quest.id ? 'rgba(147,130,220,0.3)' : 'rgba(147,130,220,0.15)'}`,
                            color: '#9382dc',
                            fontSize: '0.7rem',
                          }}
                        >
                          <Send size={12} />
                          Partager
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDeleteQuest(quest.id)}
                          className="flex items-center gap-1 px-3 py-1 rounded-lg"
                          style={{
                            background: 'rgba(196,30,58,0.08)',
                            border: '1px solid rgba(196,30,58,0.2)',
                            color: '#c41e3a',
                            fontSize: '0.7rem',
                          }}
                        >
                          <Trash2 size={12} />
                          Supprimer
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── CSV Import Modal ── */}
      <AnimatePresence>
        {showCsvModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCsvModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="rounded-2xl w-full max-w-md overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #1e1b2e, #161322)',
                border: '1px solid rgba(147,130,220,0.2)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(147,130,220,0.1)' }}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={18} style={{ color: '#66bb6a' }} />
                  <h3 style={{ fontFamily: '"Cinzel", serif', color: '#9382dc', fontSize: '0.95rem', fontWeight: 700 }}>
                    Importer des quetes
                  </h3>
                </div>
                <button
                  onClick={() => setShowCsvModal(false)}
                  className="rounded-lg p-1.5 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Step 1: Download template */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full flex items-center justify-center shrink-0"
                      style={{ width: 22, height: 22, background: 'rgba(147,130,220,0.12)', color: '#9382dc', fontSize: '0.65rem', fontWeight: 700 }}
                    >
                      1
                    </span>
                    <span style={{ fontFamily: '"Cinzel", serif', color: '#b8a9e8', fontSize: '0.75rem', fontWeight: 600 }}>
                      Telecharger le modele
                    </span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', marginLeft: '1.9rem', lineHeight: 1.5 }}>
                    Le CSV utilise les colonnes : <span style={{ color: '#9382dc' }}>title, description, emoji, questType, groupSize, question, inputType, correctAnswer, choices, targetTags</span>.
                    Les lignes avec le meme titre sont groupees en une seule quete multi-taches. Les choix QCM et les tags cibles sont separes par <span style={{ color: '#9382dc' }}>|</span>. Les tags vides = tout le monde.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDownloadCsvTemplate}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer self-start"
                    style={{
                      marginLeft: '1.9rem',
                      background: 'rgba(147,130,220,0.08)',
                      border: '1px solid rgba(147,130,220,0.2)',
                      color: '#9382dc',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    <Download size={14} />
                    quetes_template.csv
                  </motion.button>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(147,130,220,0.08)' }} />

                {/* Step 2: Upload CSV */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full flex items-center justify-center shrink-0"
                      style={{ width: 22, height: 22, background: 'rgba(76,175,80,0.12)', color: '#66bb6a', fontSize: '0.65rem', fontWeight: 700 }}
                    >
                      2
                    </span>
                    <span style={{ fontFamily: '"Cinzel", serif', color: '#81c784', fontSize: '0.75rem', fontWeight: 600 }}>
                      Importer votre fichier
                    </span>
                  </div>

                  <input
                    ref={csvFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvImport}
                    className="hidden"
                    id="csv-import-input"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => csvFileRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl cursor-pointer"
                    style={{
                      marginLeft: '1.9rem',
                      marginRight: '1.9rem',
                      background: 'linear-gradient(135deg, rgba(76,175,80,0.1), rgba(76,175,80,0.04))',
                      border: '2px dashed rgba(76,175,80,0.25)',
                      color: '#66bb6a',
                      fontFamily: '"Cinzel", serif',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    <Upload size={16} />
                    Choisir un fichier .csv
                  </motion.button>

                  {/* Error message */}
                  <AnimatePresence>
                    {csvError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ marginLeft: '1.9rem', background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.2)' }}
                      >
                        <AlertTriangle size={13} style={{ color: '#c41e3a', flexShrink: 0 }} />
                        <span style={{ color: '#e57373', fontSize: '0.65rem' }}>{csvError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success message */}
                  <AnimatePresence>
                    {csvImportedCount !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ marginLeft: '1.9rem', background: 'rgba(107,142,90,0.1)', border: '1px solid rgba(107,142,90,0.25)' }}
                      >
                        <CheckCircle size={13} style={{ color: '#6b8e5a', flexShrink: 0 }} />
                        <span style={{ color: '#81c784', fontSize: '0.65rem', fontWeight: 600 }}>
                          {csvImportedCount} quete{csvImportedCount > 1 ? 's' : ''} importee{csvImportedCount > 1 ? 's' : ''} avec succes !
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Modal footer */}
              <div
                className="px-5 py-3 flex justify-end"
                style={{ borderTop: '1px solid rgba(147,130,220,0.08)' }}
              >
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-1.5 rounded-lg cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)',
                    fontFamily: '"Cinzel", serif',
                    fontSize: '0.7rem',
                  }}
                >
                  Fermer
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
