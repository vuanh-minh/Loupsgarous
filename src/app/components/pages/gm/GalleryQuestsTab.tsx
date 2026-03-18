import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Map as MapIcon,
  Type, Hash, Users, List as ListIcon,
  Handshake, Shuffle, Zap, Send,
  Tag, Pencil, Save, X, Loader2, BookOpen, Check,
  Library, UserCircle,
} from 'lucide-react';
import type { QuestTaskInputType, QuestType } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { API_BASE, jsonAuthHeaders } from '../../../context/apiConfig';
import { AVATAR_GALLERY } from '../../../data/avatarGallery';
import type { GalleryTaskTemplate, GalleryTasksMap } from './GMPlayerGalleryPanel';

/* ================================================================
   Types
   ================================================================ */

export interface GalleryPreQuestTask {
  id: number;
  question: string;
  inputType: QuestTaskInputType;
  correctAnswer: string;
  choices?: string[];
  imageUrl?: string;
}

export interface GalleryPreQuest {
  id: number;
  title: string;
  description: string;
  questType: QuestType;
  collaborativeGroupSize?: number;
  tasks: GalleryPreQuestTask[];
  targetTags?: string[];
  distributionOrder?: number | 'random' | 'available';
  createdAt: string;
}

/** Array of pre-quests stored globally */
export type GalleryPreQuestList = GalleryPreQuest[];

/** A general-purpose pre-task template (not player-specific) */
export interface GalleryPreTask {
  id: number;
  question: string;
  inputType: QuestTaskInputType;
  correctAnswer: string;
  choices?: string[];
  imageUrl?: string;
  createdAt: string;
}

/** Array of pre-tasks stored globally */
export type GalleryPreTaskList = GalleryPreTask[];

/* ================================================================
   Constants
   ================================================================ */

const INPUT_TYPE_OPTIONS: { value: QuestTaskInputType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Texte libre', icon: <Type size={12} /> },
  { value: 'code', label: 'Code secret', icon: <Hash size={12} /> },
  { value: 'player-select', label: 'Joueur', icon: <Users size={12} /> },
  { value: 'multiple-choice', label: 'QCM', icon: <ListIcon size={12} /> },
];

const INPUT_TYPE_LABELS: Record<QuestTaskInputType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Texte', icon: <Type size={10} /> },
  code: { label: 'Code', icon: <Hash size={10} /> },
  'player-select': { label: 'Joueur', icon: <Users size={10} /> },
  'multiple-choice': { label: 'QCM', icon: <ListIcon size={10} /> },
};

/* ================================================================
   Component
   ================================================================ */

export function GalleryQuestsTab({ t, isMobile }: {
  t: GameThemeTokens;
  isMobile: boolean;
}) {
  // ── Data ──
  const [preQuests, setPreQuests] = useState<GalleryPreQuestList>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── UI state ──
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  // ── Create/Edit form state ──
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuestType, setFormQuestType] = useState<QuestType>('individual');
  const [formGroupSize, setFormGroupSize] = useState(3);
  const [formDistribution, setFormDistribution] = useState<number | 'random' | 'available'>('random');
  const [formTasks, setFormTasks] = useState<GalleryPreQuestTask[]>([]);

  // ── Inline task creation ──
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskQuestion, setTaskQuestion] = useState('');
  const [taskInputType, setTaskInputType] = useState<QuestTaskInputType>('text');
  const [taskCorrectAnswer, setTaskCorrectAnswer] = useState('');
  const [taskChoices, setTaskChoices] = useState<string[]>(['', '', '', '']);

  // ── Gallery tasks from player gallery (for picker) ──
  const [galleryTasks, setGalleryTasks] = useState<GalleryTasksMap>({});
  const [loadingGalleryTasks, setLoadingGalleryTasks] = useState(true);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [expandedPickerPlayerId, setExpandedPickerPlayerId] = useState<number | null>(null);

  // ── General pre-tasks (global, not player-specific) ──
  const [preTasks, setPreTasks] = useState<GalleryPreTaskList>([]);
  const [savingPreTasks, setSavingPreTasks] = useState(false);
  const preTaskSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreTaskForm, setShowPreTaskForm] = useState(false);
  const [editingPreTaskId, setEditingPreTaskId] = useState<number | null>(null);
  const [ptQuestion, setPtQuestion] = useState('');
  const [ptInputType, setPtInputType] = useState<QuestTaskInputType>('text');
  const [ptCorrectAnswer, setPtCorrectAnswer] = useState('');
  const [ptChoices, setPtChoices] = useState<string[]>(['', '', '', '']);
  const [expandedPtPlayerId, setExpandedPtPlayerId] = useState<number | null>(null);

  // ── Load from server ──
  useEffect(() => {
    (async () => {
      try {
        const [questsRes, tasksRes, preTasksRes] = await Promise.all([
          fetch(`${API_BASE}/gallery/quests`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/tasks`, { headers: jsonAuthHeaders() }),
          fetch(`${API_BASE}/gallery/pretasks`, { headers: jsonAuthHeaders() }),
        ]);
        const questsData = await questsRes.json();
        const tasksData = await tasksRes.json();
        const preTasksData = await preTasksRes.json();
        if (questsData.quests) {
          const list = Array.isArray(questsData.quests) ? questsData.quests : (questsData.quests.list ?? []);
          setPreQuests(list);
        }
        if (tasksData.tasks) setGalleryTasks(tasksData.tasks);
        if (preTasksData.pretasks) {
          const ptList = Array.isArray(preTasksData.pretasks) ? preTasksData.pretasks : (preTasksData.pretasks.list ?? []);
          setPreTasks(ptList);
        }
      } catch (err) {
        console.error('Failed to load gallery quests/tasks:', err);
      } finally {
        setLoading(false);
        setLoadingGalleryTasks(false);
      }
    })();
  }, []);

  // ── Debounced save ──
  const savePreQuests = useCallback((newList: GalleryPreQuestList) => {
    setPreQuests(newList);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`${API_BASE}/gallery/quests`, {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ password: 'loupgarou', quests: { list: newList } }),
        });
      } catch (err) {
        console.error('Failed to save gallery quests:', err);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, []);

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormDescription('');
    setFormQuestType('individual');
    setFormGroupSize(3);
    setFormDistribution('random');
    setFormTasks([]);
    setShowTaskForm(false);
    setTaskQuestion('');
    setTaskInputType('text');
    setTaskCorrectAnswer('');
    setTaskChoices(['', '', '', '']);
    setShowCreateForm(false);
    setEditingId(null);
  }, []);

  // ── Add task to form ──
  const addTaskToForm = useCallback(() => {
    if (!taskQuestion.trim() || !taskCorrectAnswer.trim()) return;
    const id = Date.now() + Math.floor(Math.random() * 100000);
    const newTask: GalleryPreQuestTask = {
      id,
      question: taskQuestion.trim(),
      inputType: taskInputType,
      correctAnswer: taskCorrectAnswer.trim(),
      choices: taskInputType === 'multiple-choice' ? taskChoices.filter(c => c.trim()) : undefined,
    };
    setFormTasks(prev => [...prev, newTask]);
    setTaskQuestion('');
    setTaskInputType('text');
    setTaskCorrectAnswer('');
    setTaskChoices(['', '', '', '']);
    setShowTaskForm(false);
  }, [taskQuestion, taskInputType, taskCorrectAnswer, taskChoices]);

  // ── Remove task from form ──
  const removeTaskFromForm = useCallback((taskId: number) => {
    setFormTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  // ── Create pre-quest ──
  const handleCreate = useCallback(() => {
    if (!formTitle.trim()) return;
    const isCollab = formQuestType === 'collaborative';
    if (!isCollab && formTasks.length === 0) return;

    const newQuest: GalleryPreQuest = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      title: formTitle.trim(),
      description: formDescription.trim() || (isCollab ? 'Quete collaborative' : 'Resolution au prochain Jour'),
      questType: formQuestType,
      collaborativeGroupSize: isCollab ? formGroupSize : undefined,
      tasks: isCollab ? [] : formTasks,
      distributionOrder: formDistribution,
      createdAt: new Date().toISOString(),
    };
    savePreQuests([...preQuests, newQuest]);
    resetForm();
  }, [formTitle, formDescription, formQuestType, formGroupSize, formTasks, formDistribution, preQuests, savePreQuests, resetForm]);

  // ── Start editing ──
  const handleStartEdit = useCallback((quest: GalleryPreQuest) => {
    setEditingId(quest.id);
    setFormTitle(quest.title);
    setFormDescription(quest.description);
    setFormQuestType(quest.questType);
    setFormGroupSize(quest.collaborativeGroupSize ?? 3);
    setFormDistribution(quest.distributionOrder ?? 'random');
    setFormTasks([...quest.tasks]);
    setShowCreateForm(true);
    setExpandedId(null);
  }, []);

  // ── Save edit ──
  const handleSaveEdit = useCallback(() => {
    if (!editingId || !formTitle.trim()) return;
    const isCollab = formQuestType === 'collaborative';
    if (!isCollab && formTasks.length === 0) return;

    const updated = preQuests.map(q => {
      if (q.id !== editingId) return q;
      return {
        ...q,
        title: formTitle.trim(),
        description: formDescription.trim() || (isCollab ? 'Quete collaborative' : 'Resolution au prochain Jour'),
        questType: formQuestType,
        collaborativeGroupSize: isCollab ? formGroupSize : undefined,
        tasks: isCollab ? [] : formTasks,
        distributionOrder: formDistribution,
      };
    });
    savePreQuests(updated);
    resetForm();
  }, [editingId, formTitle, formDescription, formQuestType, formGroupSize, formTasks, formDistribution, preQuests, savePreQuests, resetForm]);

  // ── Delete ──
  const handleDelete = useCallback((questId: number) => {
    savePreQuests(preQuests.filter(q => q.id !== questId));
  }, [preQuests, savePreQuests]);

  // ══════════════════════════════════════════════
  //  PRE-TASKS CRUD
  // ══════════════════════════════════════════════

  const savePreTasks = useCallback((newList: GalleryPreTaskList) => {
    setPreTasks(newList);
    if (preTaskSaveRef.current) clearTimeout(preTaskSaveRef.current);
    preTaskSaveRef.current = setTimeout(async () => {
      setSavingPreTasks(true);
      try {
        await fetch(`${API_BASE}/gallery/pretasks`, {
          method: 'POST',
          headers: jsonAuthHeaders(),
          body: JSON.stringify({ password: 'loupgarou', pretasks: { list: newList } }),
        });
      } catch (err) {
        console.error('Failed to save gallery pretasks:', err);
      } finally {
        setSavingPreTasks(false);
      }
    }, 800);
  }, []);

  const resetPreTaskForm = useCallback(() => {
    setPtQuestion('');
    setPtInputType('text');
    setPtCorrectAnswer('');
    setPtChoices(['', '', '', '']);
    setShowPreTaskForm(false);
    setEditingPreTaskId(null);
  }, []);

  const handleCreatePreTask = useCallback(() => {
    if (!ptQuestion.trim() || !ptCorrectAnswer.trim()) return;
    const newTask: GalleryPreTask = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      question: ptQuestion.trim(),
      inputType: ptInputType,
      correctAnswer: ptCorrectAnswer.trim(),
      choices: ptInputType === 'multiple-choice' ? ptChoices.filter(c => c.trim()) : undefined,
      createdAt: new Date().toISOString(),
    };
    savePreTasks([...preTasks, newTask]);
    resetPreTaskForm();
  }, [ptQuestion, ptInputType, ptCorrectAnswer, ptChoices, preTasks, savePreTasks, resetPreTaskForm]);

  const handleStartEditPreTask = useCallback((task: GalleryPreTask) => {
    setEditingPreTaskId(task.id);
    setPtQuestion(task.question);
    setPtInputType(task.inputType);
    setPtCorrectAnswer(task.correctAnswer);
    setPtChoices(task.choices && task.choices.length > 0 ? [...task.choices, '', '', '', ''].slice(0, 4) : ['', '', '', '']);
    setShowPreTaskForm(true);
  }, []);

  const handleSaveEditPreTask = useCallback(() => {
    if (!editingPreTaskId || !ptQuestion.trim() || !ptCorrectAnswer.trim()) return;
    const updated = preTasks.map(pt => {
      if (pt.id !== editingPreTaskId) return pt;
      return {
        ...pt,
        question: ptQuestion.trim(),
        inputType: ptInputType,
        correctAnswer: ptCorrectAnswer.trim(),
        choices: ptInputType === 'multiple-choice' ? ptChoices.filter(c => c.trim()) : undefined,
      };
    });
    savePreTasks(updated);
    resetPreTaskForm();
  }, [editingPreTaskId, ptQuestion, ptInputType, ptCorrectAnswer, ptChoices, preTasks, savePreTasks, resetPreTaskForm]);

  const handleDeletePreTask = useCallback((taskId: number) => {
    savePreTasks(preTasks.filter(pt => pt.id !== taskId));
  }, [preTasks, savePreTasks]);

  // ── Styles ──
  const cardBg = 'rgba(255,255,255,0.03)';
  const cardBorder = 'rgba(255,255,255,0.08)';
  const inputBg = 'rgba(0,0,0,0.3)';
  const inputBorder = 'rgba(255,255,255,0.1)';
  const accentColor = '#d97706'; // amber for quests

  const distributionLabel = (d: number | 'random' | 'available' | undefined) => {
    if (d === 'available') return 'Auto (tous)';
    if (d === 'random' || d === undefined) return 'Aleatoire';
    return `Priorite ${d}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: t.textDim }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="inline-block">
          <MapIcon size={24} className="opacity-30" />
        </motion.div>
        <p style={{ fontSize: '0.7rem', fontFamily: '"Cinzel", serif', marginTop: 8 }}>Chargement des pre-quetes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accentColor}20` }}>
            <MapIcon size={16} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 style={{ fontFamily: '"Cinzel", serif', color: accentColor, fontSize: '0.95rem' }}>Pre-Quetes</h3>
            <p style={{ color: t.textDim, fontSize: '0.5rem' }}>Modeles de quetes reutilisables</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span style={{ color: t.textDim, fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>Sauvegarde...</span>}
          <span className="px-2 py-0.5 rounded-md" style={{ background: `${accentColor}15`, color: accentColor, fontSize: '0.65rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
            {preQuests.length} quete{preQuests.length !== 1 ? 's' : ''}
          </span>
          {!showCreateForm && (
            <button
              onClick={() => { resetForm(); setShowCreateForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:brightness-110"
              style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40`, color: accentColor, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}
            >
              <Plus size={12} /> Nouvelle
            </button>
          )}
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(255,255,255,0.01))', border: `1px solid ${accentColor}25` }}>
              <div className="flex items-center justify-between">
                <h4 style={{ fontFamily: '"Cinzel", serif', color: accentColor, fontSize: '0.8rem' }}>
                  {editingId ? 'Modifier la pre-quete' : 'Nouvelle pre-quete'}
                </h4>
                <button onClick={resetForm} className="p-1 rounded-md hover:bg-white/5"><X size={14} style={{ color: t.textMuted }} /></button>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Titre de la quete..."
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }}
                />
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Description (optionnel)..."
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }}
                />
              </div>

              {/* Quest Type */}
              <div className="flex items-center gap-2">
                <span style={{ color: t.textDim, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>Type :</span>
                <button
                  onClick={() => setFormQuestType('individual')}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                  style={{
                    background: formQuestType === 'individual' ? `${accentColor}15` : 'transparent',
                    border: `1px solid ${formQuestType === 'individual' ? `${accentColor}40` : 'transparent'}`,
                    color: formQuestType === 'individual' ? accentColor : t.textDim,
                    fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
                  }}
                >
                  <BookOpen size={11} /> Individuelle
                </button>
                <button
                  onClick={() => setFormQuestType('collaborative')}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                  style={{
                    background: formQuestType === 'collaborative' ? `${accentColor}15` : 'transparent',
                    border: `1px solid ${formQuestType === 'collaborative' ? `${accentColor}40` : 'transparent'}`,
                    color: formQuestType === 'collaborative' ? accentColor : t.textDim,
                    fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
                  }}
                >
                  <Handshake size={11} /> Collaborative
                </button>
              </div>

              {/* Collaborative group size */}
              {formQuestType === 'collaborative' && (
                <div className="flex items-center gap-2">
                  <span style={{ color: t.textDim, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>Taille des groupes :</span>
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setFormGroupSize(n)}
                      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                      style={{
                        background: formGroupSize === n ? `${accentColor}20` : cardBg,
                        border: `1px solid ${formGroupSize === n ? `${accentColor}40` : cardBorder}`,
                        color: formGroupSize === n ? accentColor : t.textDim,
                        fontSize: '0.6rem', fontWeight: 700, fontFamily: '"Cinzel", serif',
                      }}
                    >{n}</button>
                  ))}
                </div>
              )}

              {/* Distribution order */}
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: t.textDim, fontSize: '0.6rem', fontFamily: '"Cinzel", serif' }}>Distribution :</span>
                {[
                  { value: 'random' as const, label: 'Aleatoire', icon: <Shuffle size={10} /> },
                  { value: 'available' as const, label: 'Auto (tous)', icon: <Zap size={10} /> },
                  { value: 1, label: 'P1', icon: <Send size={10} /> },
                  { value: 2, label: 'P2', icon: <Send size={10} /> },
                  { value: 3, label: 'P3', icon: <Send size={10} /> },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setFormDistribution(opt.value)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                    style={{
                      background: formDistribution === opt.value ? `${accentColor}15` : 'transparent',
                      border: `1px solid ${formDistribution === opt.value ? `${accentColor}35` : 'transparent'}`,
                      color: formDistribution === opt.value ? accentColor : t.textDim,
                      fontSize: '0.5rem', fontWeight: 600, fontFamily: '"Cinzel", serif',
                    }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>

              {/* ── Tasks section (individual only) ── */}
              {formQuestType === 'individual' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.textDim, fontSize: '0.6rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
                      Taches ({formTasks.length})
                    </span>
                    {!showTaskForm && (
                      <button
                        onClick={() => setShowTaskForm(true)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
                        style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}25`, color: accentColor, fontSize: '0.5rem', fontFamily: '"Cinzel", serif' }}
                      >
                        <Plus size={9} /> Ajouter
                      </button>
                    )}
                  </div>

                  {/* Existing tasks */}
                  {formTasks.map((task, idx) => {
                    const itl = INPUT_TYPE_LABELS[task.inputType];
                    return (
                      <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <span className="px-1.5 py-0.5 rounded-md shrink-0" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}25`, color: accentColor, fontSize: '0.45rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                          {itl.icon}
                        </span>
                        <span className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: '0.65rem' }}>{task.question}</span>
                        <span style={{ color: t.textDim, fontSize: '0.5rem' }}>= {task.correctAnswer}</span>
                        <button onClick={() => removeTaskFromForm(task.id)} className="p-1 rounded-md hover:bg-white/5 shrink-0">
                          <Trash2 size={10} style={{ color: '#c41e3a' }} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Inline task creation form */}
                  <AnimatePresence>
                    {showTaskForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${cardBorder}` }}>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={taskQuestion}
                              onChange={e => setTaskQuestion(e.target.value)}
                              placeholder="Question..."
                              className="flex-1 px-2.5 py-1.5 rounded-md outline-none"
                              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.65rem' }}
                            />
                            <div className="flex items-center gap-0.5 shrink-0">
                              {INPUT_TYPE_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setTaskInputType(opt.value)}
                                  className="p-1.5 rounded-md transition-colors"
                                  style={{
                                    background: taskInputType === opt.value ? `${accentColor}15` : 'transparent',
                                    border: `1px solid ${taskInputType === opt.value ? `${accentColor}30` : 'transparent'}`,
                                    color: taskInputType === opt.value ? accentColor : t.textDim,
                                  }}
                                  title={opt.label}
                                >
                                  {opt.icon}
                                </button>
                              ))}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={taskCorrectAnswer}
                            onChange={e => setTaskCorrectAnswer(e.target.value)}
                            placeholder="Reponse correcte..."
                            className="w-full px-2.5 py-1.5 rounded-md outline-none"
                            style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.65rem' }}
                          />
                          {taskInputType === 'multiple-choice' && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {taskChoices.map((c, i) => (
                                <input
                                  key={i}
                                  type="text"
                                  value={c}
                                  onChange={e => { const nc = [...taskChoices]; nc[i] = e.target.value; setTaskChoices(nc); }}
                                  placeholder={`Choix ${i + 1}...`}
                                  className="px-2.5 py-1.5 rounded-md outline-none"
                                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.6rem' }}
                                />
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={addTaskToForm}
                              disabled={!taskQuestion.trim() || !taskCorrectAnswer.trim()}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors"
                              style={{
                                background: taskQuestion.trim() && taskCorrectAnswer.trim() ? `${accentColor}20` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${taskQuestion.trim() && taskCorrectAnswer.trim() ? `${accentColor}40` : cardBorder}`,
                                color: taskQuestion.trim() && taskCorrectAnswer.trim() ? accentColor : t.textDim,
                                fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
                              }}
                            >
                              <Check size={10} /> Valider
                            </button>
                            <button
                              onClick={() => setShowTaskForm(false)}
                              className="px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
                              style={{ color: t.textDim, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Gallery task picker ── */}
                  {(() => {
                    const playersWithTasks = AVATAR_GALLERY.filter(a => (galleryTasks[a.id] ?? []).length > 0);
                    const totalPlayerTasks = Object.values(galleryTasks).reduce((sum, arr) => sum + arr.length, 0);
                    const totalGalleryTasks = totalPlayerTasks + preTasks.length;
                    if (totalGalleryTasks === 0 && !loadingGalleryTasks) return null;
                    return (
                      <div className="mt-1">
                        <button
                          onClick={() => setShowGalleryPicker(!showGalleryPicker)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors w-full justify-center"
                          style={{
                            background: showGalleryPicker ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.05)',
                            border: `1px solid ${showGalleryPicker ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.15)'}`,
                            color: '#8b5cf6',
                            fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600,
                          }}
                        >
                          <Library size={11} />
                          {showGalleryPicker ? 'Masquer' : 'Piocher depuis la galerie'}
                          {!showGalleryPicker && totalGalleryTasks > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.15)', fontSize: '0.45rem', fontWeight: 700 }}>
                              {totalGalleryTasks}
                            </span>
                          )}
                        </button>
                        <AnimatePresence>
                          {showGalleryPicker && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 rounded-lg p-2.5 space-y-1.5" style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}>
                                {loadingGalleryTasks ? (
                                  <div className="flex items-center gap-2 py-3 justify-center">
                                    <Loader2 size={12} className="animate-spin" style={{ color: '#8b5cf6', opacity: 0.5 }} />
                                    <span style={{ color: '#8b5cf6', fontSize: '0.55rem', opacity: 0.6, fontFamily: '"Cinzel", serif' }}>Chargement...</span>
                                  </div>
                                ) : playersWithTasks.length === 0 ? (
                                  <p style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                                    Aucune tache dans la galerie joueurs
                                  </p>
                                ) : (
                                  <div className="space-y-1">
                                    {/* General pre-tasks group */}
                                    {preTasks.length > 0 && (
                                      <div>
                                        <button
                                          onClick={() => setExpandedPickerPlayerId(expandedPickerPlayerId === -1 ? null : -1)}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                                        >
                                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
                                            <Library size={11} style={{ color: '#8b5cf6' }} />
                                          </div>
                                          <span className="flex-1 text-left truncate" style={{ color: '#8b5cf6', fontSize: '0.6rem', fontWeight: 600, fontFamily: '"Cinzel", serif' }}>
                                            Pre-taches generales
                                          </span>
                                          <span className="px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: '0.45rem', fontWeight: 700 }}>
                                            {preTasks.length}
                                          </span>
                                          {expandedPickerPlayerId === -1 ? <ChevronUp size={10} style={{ color: t.textDim }} /> : <ChevronDown size={10} style={{ color: t.textDim }} />}
                                        </button>
                                        <AnimatePresence>
                                          {expandedPickerPlayerId === -1 && (
                                            <motion.div
                                              initial={{ height: 0, opacity: 0 }}
                                              animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }}
                                              className="overflow-hidden"
                                            >
                                              <div className="pl-8 pr-1 pb-1 space-y-1">
                                                {preTasks.map(gt => {
                                                  const alreadyAdded = formTasks.some(ft => ft.question === gt.question && ft.correctAnswer === gt.correctAnswer);
                                                  const itl = INPUT_TYPE_LABELS[gt.inputType];
                                                  return (
                                                    <button
                                                      key={gt.id}
                                                      disabled={alreadyAdded}
                                                      onClick={() => {
                                                        const id = Date.now() + Math.floor(Math.random() * 100000);
                                                        setFormTasks(prev => [...prev, {
                                                          id,
                                                          question: gt.question,
                                                          inputType: gt.inputType,
                                                          correctAnswer: gt.correctAnswer,
                                                          choices: gt.choices ? [...gt.choices] : undefined,
                                                        }]);
                                                      }}
                                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left"
                                                      style={{
                                                        background: alreadyAdded ? 'rgba(107,142,90,0.08)' : 'rgba(0,0,0,0.12)',
                                                        border: `1px solid ${alreadyAdded ? 'rgba(107,142,90,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                                        opacity: alreadyAdded ? 0.6 : 1,
                                                        cursor: alreadyAdded ? 'default' : 'pointer',
                                                      }}
                                                    >
                                                      <span className="shrink-0" style={{ fontSize: '0.45rem' }}>{itl.icon}</span>
                                                      <span className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: '0.58rem' }}>{gt.question}</span>
                                                      {alreadyAdded ? (
                                                        <Check size={10} style={{ color: '#6b8e5a', flexShrink: 0 }} />
                                                      ) : (
                                                        <Plus size={10} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                                                      )}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    )}
                                    {/* Player-specific task groups */}
                                    {playersWithTasks.map(avatar => {
                                      const tasks = galleryTasks[avatar.id] ?? [];
                                      const isPlayerExpanded = expandedPickerPlayerId === avatar.id;
                                      return (
                                        <div key={avatar.id}>
                                          <button
                                            onClick={() => setExpandedPickerPlayerId(isPlayerExpanded ? null : avatar.id)}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors"
                                          >
                                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
                                              <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />
                                            </div>
                                            <span className="flex-1 text-left truncate" style={{ color: t.text, fontSize: '0.6rem', fontWeight: 600, fontFamily: '"Cinzel", serif' }}>
                                              {avatar.name}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', fontSize: '0.45rem', fontWeight: 700 }}>
                                              {tasks.length}
                                            </span>
                                            {isPlayerExpanded ? <ChevronUp size={10} style={{ color: t.textDim }} /> : <ChevronDown size={10} style={{ color: t.textDim }} />}
                                          </button>
                                          <AnimatePresence>
                                            {isPlayerExpanded && (
                                              <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="pl-8 pr-1 pb-1 space-y-1">
                                                  {tasks.map(gt => {
                                                    const alreadyAdded = formTasks.some(ft => ft.question === gt.question && ft.correctAnswer === gt.correctAnswer);
                                                    const itl = INPUT_TYPE_LABELS[gt.inputType];
                                                    return (
                                                      <button
                                                        key={gt.id}
                                                        disabled={alreadyAdded}
                                                        onClick={() => {
                                                          const id = Date.now() + Math.floor(Math.random() * 100000);
                                                          setFormTasks(prev => [...prev, {
                                                            id,
                                                            question: gt.question,
                                                            inputType: gt.inputType,
                                                            correctAnswer: gt.correctAnswer,
                                                            choices: gt.choices ? [...gt.choices] : undefined,
                                                            imageUrl: gt.imageUrl,
                                                          }]);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-left"
                                                        style={{
                                                          background: alreadyAdded ? 'rgba(107,142,90,0.08)' : 'rgba(0,0,0,0.12)',
                                                          border: `1px solid ${alreadyAdded ? 'rgba(107,142,90,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                                          opacity: alreadyAdded ? 0.6 : 1,
                                                          cursor: alreadyAdded ? 'default' : 'pointer',
                                                        }}
                                                      >
                                                        <span className="shrink-0" style={{ fontSize: '0.45rem' }}>{itl.icon}</span>
                                                        <span className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: '0.58rem' }}>{gt.question}</span>
                                                        {alreadyAdded ? (
                                                          <Check size={10} style={{ color: '#6b8e5a', flexShrink: 0 }} />
                                                        ) : (
                                                          <Plus size={10} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                                                        )}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {formTasks.length === 0 && !showTaskForm && !showGalleryPicker && (
                    <p style={{ color: t.textDim, fontSize: '0.5rem', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                      Ajoutez au moins une tache pour creer la quete
                    </p>
                  )}
                </div>
              )}

              {/* ── Submit button ── */}
              <button
                onClick={editingId ? handleSaveEdit : handleCreate}
                disabled={!formTitle.trim() || (formQuestType === 'individual' && formTasks.length === 0)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors"
                style={{
                  background: formTitle.trim() && (formQuestType === 'collaborative' || formTasks.length > 0) ? `${accentColor}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${formTitle.trim() && (formQuestType === 'collaborative' || formTasks.length > 0) ? `${accentColor}40` : cardBorder}`,
                  color: formTitle.trim() && (formQuestType === 'collaborative' || formTasks.length > 0) ? accentColor : t.textDim,
                  fontFamily: '"Cinzel", serif', fontSize: '0.7rem', fontWeight: 600,
                  cursor: formTitle.trim() && (formQuestType === 'collaborative' || formTasks.length > 0) ? 'pointer' : 'not-allowed',
                }}
              >
                {editingId ? <><Save size={13} /> Sauvegarder</> : <><Plus size={13} /> Creer la pre-quete</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pre-quest list ── */}
      {preQuests.length === 0 && !showCreateForm && (
        <div className="text-center py-10" style={{ color: t.textDim }}>
          <MapIcon size={32} className="mx-auto mb-3 opacity-15" />
          <p style={{ fontSize: '0.7rem', fontFamily: '"Cinzel", serif' }}>Aucune pre-quete configuree</p>
          <p style={{ fontSize: '0.55rem', marginTop: 4, opacity: 0.6 }}>Creez des modeles de quetes reutilisables pour vos parties</p>
        </div>
      )}

      <div className="space-y-2">
        {preQuests.map(quest => {
          const isExpanded = expandedId === quest.id;
          const isCollab = quest.questType === 'collaborative';
          return (
            <motion.div
              key={quest.id}
              layout
              className="rounded-xl overflow-hidden"
              style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
            >
              {/* Quest header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : quest.id)}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accentColor}15` }}>
                  {isCollab ? <Handshake size={13} style={{ color: accentColor }} /> : <MapIcon size={13} style={{ color: accentColor }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ color: t.text, fontSize: '0.75rem', fontWeight: 600, fontFamily: '"Cinzel", serif' }}>{quest.title}</p>
                  <p className="truncate" style={{ color: t.textDim, fontSize: '0.5rem' }}>
                    {isCollab ? `Collaborative (x${quest.collaborativeGroupSize ?? 3})` : `${quest.tasks.length} tache${quest.tasks.length !== 1 ? 's' : ''}`}
                    {' · '}
                    {distributionLabel(quest.distributionOrder)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(quest); }}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={11} style={{ color: t.textDim }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(quest.id); }}
                    className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={11} style={{ color: '#c41e3a' }} />
                  </button>
                  {isExpanded ? <ChevronUp size={13} style={{ color: t.textDim }} /> : <ChevronDown size={13} style={{ color: t.textDim }} />}
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
                    <div className="px-4 pb-4 space-y-2" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      {quest.description && (
                        <p className="pt-2" style={{ color: t.textDim, fontSize: '0.6rem', lineHeight: 1.5 }}>{quest.description}</p>
                      )}
                      {quest.tasks.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {quest.tasks.map((task, idx) => {
                            const itl = INPUT_TYPE_LABELS[task.inputType];
                            return (
                              <div key={task.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.15)', border: `1px solid rgba(255,255,255,0.04)` }}>
                                <span className="text-xs font-bold shrink-0" style={{ color: `${accentColor}90`, fontFamily: '"Cinzel", serif', fontSize: '0.45rem' }}>#{idx + 1}</span>
                                <span className="px-1 py-0.5 rounded shrink-0" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}20`, fontSize: '0.45rem' }}>{itl.icon}</span>
                                <span className="flex-1 min-w-0 truncate" style={{ color: t.text, fontSize: '0.6rem' }}>{task.question}</span>
                                <span className="px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'rgba(107,142,90,0.1)', border: '1px solid rgba(107,142,90,0.2)', color: '#6b8e5a', fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>
                                  {task.correctAnswer}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isCollab && quest.tasks.length === 0 && (
                        <p className="pt-2" style={{ color: t.textDim, fontSize: '0.55rem', fontStyle: 'italic' }}>
                          Quete collaborative : les joueurs votent succes/echec
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="px-3 py-2 rounded-lg" style={{ background: `${accentColor}05`, border: `1px solid ${accentColor}10` }}>
        <p style={{ color: accentColor, fontSize: '0.5rem', lineHeight: 1.6 }}>
          <strong>Info :</strong> Les pre-quetes sont des modeles reutilisables. Lors de la creation d'une partie, vous pourrez selectionner celles a inclure.
        </p>
      </div>

      {/* ══════════════════════════════════════════════
           PRE-TASKS SECTION
         ══════════════════════════════════════════════ */}
      <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(139,92,246,0.12)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
              <Library size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: '"Cinzel", serif', color: '#8b5cf6', fontSize: '0.95rem' }}>Pre-Taches</h3>
              <p style={{ color: t.textDim, fontSize: '0.5rem' }}>Taches generiques reutilisables dans les quetes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {savingPreTasks && <span style={{ color: t.textDim, fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>Sauvegarde...</span>}
            {(() => {
              const totalPt = preTasks.length + Object.values(galleryTasks).reduce((s, a) => s + a.length, 0);
              return (
                <span className="px-2 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: '0.65rem', fontWeight: 700, fontFamily: '"Cinzel", serif' }}>
                  {totalPt} tache{totalPt !== 1 ? 's' : ''}
                </span>
              );
            })()}
            {!showPreTaskForm && (
              <button
                onClick={() => { resetPreTaskForm(); setShowPreTaskForm(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors hover:brightness-110"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', fontSize: '0.6rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}
              >
                <Plus size={12} /> Nouvelle
              </button>
            )}
          </div>
        </div>

        {/* Create / Edit Pre-Task Form */}
        <AnimatePresence>
          {showPreTaskForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(255,255,255,0.01))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="flex items-center justify-between">
                  <h4 style={{ fontFamily: '"Cinzel", serif', color: '#8b5cf6', fontSize: '0.8rem' }}>
                    {editingPreTaskId ? 'Modifier la pre-tache' : 'Nouvelle pre-tache'}
                  </h4>
                  <button onClick={resetPreTaskForm} className="p-1 rounded-md hover:bg-white/5"><X size={14} style={{ color: t.textMuted }} /></button>
                </div>

                {/* Question */}
                <input
                  type="text"
                  value={ptQuestion}
                  onChange={e => setPtQuestion(e.target.value)}
                  placeholder="Question..."
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }}
                />

                {/* Input type selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span style={{ color: t.textDim, fontSize: '0.55rem', fontFamily: '"Cinzel", serif' }}>Type :</span>
                  {INPUT_TYPE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPtInputType(opt.value)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
                      style={{
                        background: ptInputType === opt.value ? 'rgba(139,92,246,0.15)' : 'transparent',
                        border: `1px solid ${ptInputType === opt.value ? 'rgba(139,92,246,0.35)' : 'transparent'}`,
                        color: ptInputType === opt.value ? '#8b5cf6' : t.textDim,
                        fontSize: '0.5rem', fontWeight: 600, fontFamily: '"Cinzel", serif',
                      }}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>

                {/* Correct answer */}
                <input
                  type="text"
                  value={ptCorrectAnswer}
                  onChange={e => setPtCorrectAnswer(e.target.value)}
                  placeholder="Reponse correcte..."
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.7rem' }}
                />

                {/* QCM choices */}
                {ptInputType === 'multiple-choice' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {ptChoices.map((c, i) => (
                      <input
                        key={i}
                        type="text"
                        value={c}
                        onChange={e => { const nc = [...ptChoices]; nc[i] = e.target.value; setPtChoices(nc); }}
                        placeholder={`Choix ${i + 1}...`}
                        className="px-2.5 py-1.5 rounded-md outline-none"
                        style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: t.text, fontSize: '0.6rem' }}
                      />
                    ))}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={editingPreTaskId ? handleSaveEditPreTask : handleCreatePreTask}
                  disabled={!ptQuestion.trim() || !ptCorrectAnswer.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors"
                  style={{
                    background: ptQuestion.trim() && ptCorrectAnswer.trim() ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ptQuestion.trim() && ptCorrectAnswer.trim() ? 'rgba(139,92,246,0.35)' : cardBorder}`,
                    color: ptQuestion.trim() && ptCorrectAnswer.trim() ? '#8b5cf6' : t.textDim,
                    fontFamily: '"Cinzel", serif', fontSize: '0.7rem', fontWeight: 600,
                    cursor: ptQuestion.trim() && ptCorrectAnswer.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  {editingPreTaskId ? <><Save size={13} /> Sauvegarder</> : <><Plus size={13} /> Creer la pre-tache</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-task list */}
        {(() => {
          const playersWithTasks = AVATAR_GALLERY.filter(a => (galleryTasks[a.id] ?? []).length > 0);
          const totalPlayerTasks = Object.values(galleryTasks).reduce((sum, arr) => sum + arr.length, 0);
          const totalAll = preTasks.length + totalPlayerTasks;
          const isEmpty = totalAll === 0 && !showPreTaskForm;

          return (
            <>
              {isEmpty && (
                <div className="text-center py-8" style={{ color: t.textDim }}>
                  <Library size={28} className="mx-auto mb-2 opacity-15" />
                  <p style={{ fontSize: '0.65rem', fontFamily: '"Cinzel", serif' }}>Aucune pre-tache configuree</p>
                  <p style={{ fontSize: '0.5rem', marginTop: 4, opacity: 0.6 }}>Creez des taches generiques reutilisables dans vos quetes</p>
                </div>
              )}

              {/* ── General pre-tasks ── */}
              {preTasks.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Library size={11} style={{ color: '#8b5cf6' }} />
                    <span style={{ color: '#8b5cf6', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600 }}>
                      Generales
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '0.42rem', fontWeight: 700 }}>
                      {preTasks.length}
                    </span>
                  </div>
                  {preTasks.map(pt => {
                    const itl = INPUT_TYPE_LABELS[pt.inputType];
                    return (
                      <motion.div
                        key={pt.id}
                        layout
                        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg group"
                        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                      >
                        <span className="px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', fontSize: '0.45rem' }}>
                          {itl.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: t.text, fontSize: '0.68rem' }}>{pt.question}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span style={{ color: t.textDim, fontSize: '0.48rem' }}>{itl.label}</span>
                            <span className="px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(107,142,90,0.08)', border: '1px solid rgba(107,142,90,0.15)', color: '#6b8e5a', fontSize: '0.45rem', fontFamily: '"Cinzel", serif' }}>
                              = {pt.correctAnswer}
                            </span>
                            {pt.choices && pt.choices.length > 0 && (
                              <span style={{ color: t.textDim, fontSize: '0.42rem' }}>
                                {pt.choices.length} choix
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStartEditPreTask(pt)}
                            className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={10} style={{ color: t.textDim }} />
                          </button>
                          <button
                            onClick={() => handleDeletePreTask(pt.id)}
                            className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={10} style={{ color: '#c41e3a' }} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* ── Player gallery tasks ── */}
              {playersWithTasks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <UserCircle size={11} style={{ color: '#8b5cf6', opacity: 0.7 }} />
                    <span style={{ color: '#8b5cf6', fontSize: '0.55rem', fontFamily: '"Cinzel", serif', fontWeight: 600, opacity: 0.8 }}>
                      Galerie joueurs
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', fontSize: '0.42rem', fontWeight: 700, opacity: 0.7 }}>
                      {totalPlayerTasks}
                    </span>
                  </div>
                  {playersWithTasks.map(avatar => {
                    const tasks = galleryTasks[avatar.id] ?? [];
                    const isExp = expandedPtPlayerId === avatar.id;
                    return (
                      <div key={avatar.id}>
                        <button
                          onClick={() => setExpandedPtPlayerId(isExp ? null : avatar.id)}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                          style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                        >
                          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0" style={{ border: '1px solid rgba(139,92,246,0.15)' }}>
                            <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <span className="flex-1 text-left truncate" style={{ color: t.text, fontSize: '0.65rem', fontWeight: 600, fontFamily: '"Cinzel", serif' }}>
                            {avatar.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: '0.42rem', fontWeight: 700 }}>
                            {tasks.length} tache{tasks.length !== 1 ? 's' : ''}
                          </span>
                          {isExp ? <ChevronUp size={11} style={{ color: t.textDim }} /> : <ChevronDown size={11} style={{ color: t.textDim }} />}
                        </button>
                        <AnimatePresence>
                          {isExp && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pl-9 pr-1 py-1 space-y-1">
                                {tasks.map(gt => {
                                  const itl = INPUT_TYPE_LABELS[gt.inputType];
                                  return (
                                    <div
                                      key={gt.id}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                      style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.04)' }}
                                    >
                                      <span className="shrink-0" style={{ fontSize: '0.45rem', color: '#8b5cf6', opacity: 0.7 }}>{itl.icon}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="truncate" style={{ color: t.text, fontSize: '0.6rem' }}>{gt.question}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <span style={{ color: t.textDim, fontSize: '0.42rem' }}>{itl.label}</span>
                                          <span className="px-1 py-0.5 rounded" style={{ background: 'rgba(107,142,90,0.08)', color: '#6b8e5a', fontSize: '0.4rem', fontFamily: '"Cinzel", serif' }}>
                                            = {gt.correctAnswer}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info box */}
              {totalAll > 0 && (
                <div className="px-3 py-2 rounded-lg mt-3" style={{ background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(139,92,246,0.08)' }}>
                  <p style={{ color: '#8b5cf6', fontSize: '0.5rem', lineHeight: 1.6 }}>
                    <strong>Info :</strong> Les pre-taches sont disponibles dans le selecteur "Piocher depuis la galerie" lors de la creation de pre-quetes.
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}