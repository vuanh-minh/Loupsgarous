import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Send, Users,
  Type, Hash, List, Hourglass, Eye, Lightbulb, Handshake, Star, X as XIcon, ChevronDown,
  Search, Swords,
} from 'lucide-react';
import type { GameState, Quest, QuestTask, QuestTaskInputType, QuestStatus } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';
import { PAvatar } from './PAvatar';
import { HintFullscreenLightbox, getHintAssociations, setHintAssociation as setHintAssoc, extractRoleFromHintText } from '../../HintComponents';

interface PlayerQuestTasksPageProps {
  quest: Quest;
  state: GameState;
  currentPlayerId: number;
  onBack: () => void;
  onAnswerTask: (questId: number, taskId: number, answer: string) => void;
  onSetHypothesis?: (targetPlayerId: number, roleId: string) => void;
  t: GameThemeTokens;
}

// ── Palettes (must match PlayerQuestsPanel) ──
type CardPalette = {
  bg: string; bgOverlay: string; headerBg: string; border: string; borderLight: string; borderDark: string;
  title: string; text: string; textDim: string; divider: string; insetBg: string; insetBorder: string;
  accent: string; accentBg: string; accentBorder: string; accentDark: string;
  decorLine: string; cardShadow: string;
  collabBg: string; collabBorder: string; collabText: string;
};

const DAY_PALETTE: CardPalette = {
  bg: '#f5eed9', bgOverlay: 'none', headerBg: '#c9b48a',
  border: '#d8ccac', borderLight: '#c8b890', borderDark: '#b8a880',
  title: '#2a2010', text: '#4a3f30', textDim: '#8a7e65',
  divider: 'rgba(180,155,85,0.35)', insetBg: 'rgba(0,0,0,0.025)', insetBorder: 'rgba(160,140,90,0.18)',
  accent: '#9a8045', accentBg: 'rgba(154,128,69,0.1)', accentBorder: 'rgba(154,128,69,0.4)', accentDark: '#2a2010',
  decorLine: 'linear-gradient(90deg, transparent, rgba(180,150,70,0.5), transparent)',
  cardShadow: '0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
  collabBg: 'rgba(80,105,155,0.08)', collabBorder: 'rgba(80,105,155,0.2)', collabText: '#556a90',
};

const NIGHT_PALETTE: CardPalette = {
  bg: 'linear-gradient(165deg, #222640 0%, #1c2038 30%, #171a32 70%, #11132a 100%)',
  bgOverlay: 'linear-gradient(180deg, rgba(140,160,220,0.05) 0%, rgba(100,120,200,0.01) 100%)',
  headerBg: 'rgba(14,16,32,0.65)',
  border: '#4a5280', borderLight: '#5a6498', borderDark: '#14162a',
  title: '#d0daf5', text: '#b0bdd8', textDim: '#7a88b5',
  divider: 'rgba(140,160,220,0.12)', insetBg: 'rgba(10,12,30,0.35)', insetBorder: 'rgba(140,160,220,0.08)',
  accent: '#8aa4d8', accentBg: 'rgba(138,164,216,0.12)', accentBorder: 'rgba(138,164,216,0.25)', accentDark: '#0e1020',
  decorLine: 'linear-gradient(90deg, transparent, rgba(140,160,220,0.2), transparent)',
  cardShadow: 'inset 0 1px 0 rgba(140,160,220,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 0 20px rgba(80,100,180,0.06), 0 1px 3px rgba(0,0,0,0.3)',
  collabBg: 'rgba(120,140,200,0.15)', collabBorder: 'rgba(120,140,200,0.3)', collabText: '#a8b8e0',
};

const DEAD_PALETTE: CardPalette = {
  bg: 'linear-gradient(165deg, #28222e 0%, #221e28 30%, #1d1922 70%, #17141c 100%)',
  bgOverlay: 'linear-gradient(180deg, rgba(150,130,180,0.04) 0%, rgba(120,100,160,0.01) 100%)',
  headerBg: 'rgba(22,18,28,0.65)',
  border: '#4a4258', borderLight: '#5a5068', borderDark: '#17141c',
  title: '#a898b5', text: '#887a95', textDim: '#655a70',
  divider: 'rgba(140,120,170,0.12)', insetBg: 'rgba(12,8,18,0.35)', insetBorder: 'rgba(140,120,170,0.08)',
  accent: '#9b8bb8', accentBg: 'rgba(155,139,184,0.12)', accentBorder: 'rgba(155,139,184,0.25)', accentDark: '#13101a',
  decorLine: 'linear-gradient(90deg, transparent, rgba(150,130,180,0.2), transparent)',
  cardShadow: 'inset 0 1px 0 rgba(150,130,180,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)',
  collabBg: 'rgba(130,110,160,0.15)', collabBorder: 'rgba(130,110,160,0.3)', collabText: '#9585a8',
};

function getCardPalette(phase: string, isDead?: boolean): CardPalette {
  if (isDead) return DEAD_PALETTE;
  return phase === 'night' ? NIGHT_PALETTE : DAY_PALETTE;
}

const INPUT_TYPE_LABELS: Record<QuestTaskInputType, { label: string; icon: React.ReactNode }> = {
  'text': { label: 'Texte', icon: <Type size={11} /> },
  'code': { label: 'Code', icon: <Hash size={11} /> },
  'player-select': { label: 'Joueur', icon: <Users size={11} /> },
  'multiple-choice': { label: 'QCM', icon: <List size={11} /> },
};

function playerQuestStatus(quest: Quest, playerId: number): QuestStatus {
  return quest.playerStatuses?.[playerId] || 'active';
}

// ── Player Select Modal (rendered at page level) ──
function PlayerSelectModal({ players, cp, isNight, onSelect, onClose }: {
  players: GameState['players'];
  cp: CardPalette;
  isNight: boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const [playerSearch, setPlayerSearch] = useState('');

  return (
    <motion.div
      key="player-select-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[95] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.div
        key="player-select-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full rounded-t-2xl overflow-hidden flex flex-col"
        style={{
          background: isNight
            ? 'linear-gradient(165deg, #222640 0%, #1c2038 60%, #171a32 100%)'
            : DAY_PALETTE.bg,
          border: `1px solid ${cp.border}`,
          borderBottom: 'none',
          height: '65vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: cp.textDim, opacity: 0.4 }}
          />
        </div>

        {/* Sheet header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: `1px solid ${cp.divider}` }}
        >
          <div className="flex items-center gap-2">
            <Users size={15} style={{ color: cp.accent }} />
            <span style={{
              fontFamily: '"Cinzel", serif',
              color: cp.title,
              fontSize: '0.82rem',
              fontWeight: 700,
            }}>
              Choisir un joueur
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full active:scale-90 transition-transform"
            style={{
              background: cp.insetBg,
              border: `1px solid ${cp.insetBorder}`,
              color: cp.textDim,
            }}
          >
            <XIcon size={13} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-3 pt-2.5 pb-1.5 shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: cp.insetBg,
              border: `1px solid ${cp.insetBorder}`,
            }}
          >
            <Search size={14} style={{ color: cp.textDim, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Rechercher un joueur..."
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className="bg-transparent outline-none w-full"
              style={{
                color: cp.text,
                fontSize: '0.78rem',
                fontFamily: 'sans-serif',
              }}
              autoFocus
            />
            {playerSearch && (
              <button
                onClick={() => setPlayerSearch('')}
                className="shrink-0 flex items-center justify-center"
                style={{ color: cp.textDim }}
              >
                <XIcon size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Player list */}
        <div className="overflow-y-auto flex-1 min-h-0 px-3 py-3 grid grid-cols-4 gap-2 auto-rows-min content-start">
          {players.filter((p) =>
            p.name.toLowerCase().includes(playerSearch.toLowerCase())
          ).map((p, idx) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: idx * 0.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { onSelect(p.name); onClose(); }}
              className="flex flex-col items-center gap-1 p-2 rounded-xl text-center w-full"
              style={{
                background: cp.insetBg,
                border: `1px solid ${cp.insetBorder}`,
                opacity: !p.alive ? 0.5 : 1,
              }}
            >
              <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden mx-auto">
                <PAvatar player={p} size="text-sm" />
              </div>
              <span className="line-clamp-2 break-words" style={{
                color: cp.text,
                fontSize: '0.55rem',
                fontWeight: 600,
                lineHeight: 1.2,
              }}>
                {p.name}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── TaskInput ──
function TaskInput({ task, quest, state, playerId, onAnswer, cp, onOpenPlayerSelect, isDead }: {
  task: QuestTask;
  quest: Quest;
  state: GameState;
  playerId: number;
  onAnswer: (answer: string) => void;
  cp: CardPalette;
  onOpenPlayerSelect: () => void;
  isDead?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const myAnswer = task.playerAnswers?.[playerId];
  const isAnswered = myAnswer !== undefined && myAnswer !== '';
  const myStatus = playerQuestStatus(quest, playerId);
  const isResolved = myStatus === 'success' || myStatus === 'fail';
  const isActive = myStatus === 'active';
  const myResult = task.playerResults?.[playerId];

  const handleSubmit = useCallback(() => {
    if (!draft.trim()) return;
    onAnswer(draft.trim());
    setDraft('');
  }, [draft, onAnswer]);

  const accentColor = isDead ? '#9b8bb8' : '#d4a843';
  const accentBg = isDead ? 'rgba(155,139,184,0.1)' : 'rgba(212,168,67,0.1)';
  const accentBorder = isDead ? 'rgba(155,139,184,0.2)' : 'rgba(212,168,67,0.2)';
  const successColor = isDead ? '#8a7ba0' : '#7ac462';
  const successBg = isDead ? 'rgba(140,120,170,0.12)' : 'rgba(90,150,70,0.12)';
  const successBorder = isDead ? 'rgba(140,120,170,0.25)' : 'rgba(90,150,70,0.25)';
  const neutralBg = isDead ? 'rgba(140,120,170,0.08)' : 'rgba(160,130,90,0.08)';
  const neutralBorder = isDead ? 'rgba(140,120,170,0.15)' : 'rgba(160,130,90,0.15)';

  if (isAnswered && !isResolved) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md flex-1"
          style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
        >
          <CheckCircle size={12} style={{ color: accentColor }} />
          <span style={{ color: accentColor, fontSize: '0.7rem', fontWeight: 500 }}>
            Repondu : {myAnswer}
          </span>
        </div>
      </div>
    );
  }

  if (isResolved && myResult !== undefined) {
    const isFailed = myStatus === 'fail';
    const showCorrect = !isFailed && myResult;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
          style={{
            background: showCorrect ? successBg : neutralBg,
            border: `1px solid ${showCorrect ? successBorder : neutralBorder}`,
          }}
        >
          {showCorrect
            ? <CheckCircle size={12} style={{ color: successColor }} />
            : <span style={{ color: cp.textDim, fontSize: '0.65rem' }}>?</span>
          }
          <span style={{ color: showCorrect ? successColor : cp.textDim, fontSize: '0.7rem', fontWeight: 500 }}>
            {showCorrect ? 'Correct' : 'Repondu'}
          </span>
        </div>
        {myAnswer !== undefined && (
          <span style={{ color: cp.textDim, fontSize: '0.6rem' }}>
            Ta reponse : {myAnswer}
          </span>
        )}
      </div>
    );
  }

  if (!isActive) return null;

  if (task.inputType === 'player-select') {
    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onOpenPlayerSelect}
        className="flex items-center gap-3 px-4 py-3 rounded-xl w-full mt-2"
        style={{
          background: isDead
            ? 'linear-gradient(135deg, #5a4e6a 0%, #7a6a90 60%, #6a5e7a 100%)'
            : 'linear-gradient(135deg, #b8860b 0%, #d4a843 60%, #c9a040 100%)',
          boxShadow: isDead
            ? '0 3px 12px rgba(90,70,110,0.35), 0 1px 3px rgba(0,0,0,0.2)'
            : '0 3px 12px rgba(184,134,11,0.35), 0 1px 3px rgba(0,0,0,0.2)',
          color: isDead ? '#151218' : '#1a1207',
          fontSize: '0.8rem',
          fontWeight: 700,
          fontFamily: '"Cinzel", serif',
          letterSpacing: '0.02em',
        }}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <Users size={15} style={{ color: '#1a1207' }} />
        </div>
        <span className="flex-1 text-left">Choisir un joueur</span>
        <ChevronDown size={16} style={{ color: 'rgba(26,18,7,0.6)', flexShrink: 0 }} />
      </motion.button>
    );
  }

  if (task.inputType === 'multiple-choice' && task.choices && task.choices.length > 0) {
    return (
      <div className="flex flex-col gap-1.5 mt-2">
        {task.choices.map((choice, idx) => (
          <motion.button
            key={idx}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAnswer(choice)}
            className="w-full text-left px-3 py-2 rounded-md transition-colors"
            style={{
              background: cp.insetBg,
              border: `1px solid ${cp.insetBorder}`,
              color: cp.text,
              fontSize: '0.75rem',
            }}
          >
            <span style={{ color: accentColor, fontWeight: 600, marginRight: '0.5rem' }}>
              {String.fromCharCode(65 + idx)}.
            </span>
            {choice}
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 mt-2">
      {task.inputType === 'code' ? (
        <div className="flex gap-2.5 flex-1 items-center justify-center">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={draft[i] || ''}
              data-code-index={i}
              onChange={(e) => {
                const ch = e.target.value.slice(-1).toUpperCase();
                const chars = draft.split('');
                while (chars.length <= i) chars.push('');
                chars[i] = ch;
                while (chars.length > 0 && chars[chars.length - 1] === '') chars.pop();
                const newDraft = chars.join('');
                setDraft(newDraft);
                if (ch && i < 3) {
                  const next = e.target.parentElement?.querySelector(
                    `[data-code-index="${i + 1}"]`
                  ) as HTMLInputElement | null;
                  next?.focus();
                }
                if (ch && i === 3 && newDraft.length === 4) {
                  e.target.blur();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') {
                  if (!draft[i] && i > 0) {
                    e.preventDefault();
                    const chars = draft.split('');
                    if (chars.length > i - 1) chars[i - 1] = '';
                    while (chars.length > 0 && chars[chars.length - 1] === '') chars.pop();
                    setDraft(chars.join(''));
                    const prev = (e.target as HTMLElement).parentElement?.querySelector(
                      `[data-code-index="${i - 1}"]`
                    ) as HTMLInputElement | null;
                    prev?.focus();
                  }
                }
                if (e.key === 'Enter') handleSubmit();
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, 4).toUpperCase();
                setDraft(pasted);
                const targetIdx = Math.min(pasted.length, 3);
                const el = (e.target as HTMLElement).parentElement?.querySelector(
                  `[data-code-index="${targetIdx}"]`
                ) as HTMLInputElement | null;
                el?.focus();
              }}
              className="w-11 h-13 text-center rounded-lg outline-none transition-all duration-150"
              style={{
                background: draft[i]
                  ? (isDead ? 'rgba(130,130,140,0.08)' : 'rgba(212,168,67,0.08)')
                  : 'rgba(0,0,0,0.3)',
                border: `1.5px solid ${draft[i] ? (isDead ? 'rgba(155,139,184,0.45)' : 'rgba(212,168,67,0.45)') : 'rgba(210,180,130,0.15)'}`,
                color: cp.title,
                fontSize: '1.15rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                letterSpacing: '0.05em',
                caretColor: accentColor,
                boxShadow: draft[i]
                  ? (isDead
                    ? '0 0 8px rgba(155,139,184,0.12), inset 0 1px 2px rgba(155,139,184,0.06)'
                    : '0 0 8px rgba(212,168,67,0.12), inset 0 1px 2px rgba(212,168,67,0.06)')
                  : 'inset 0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
          ))}
        </div>
      ) : (
        <input
          type="text"
          placeholder="Votre reponse..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          className="flex-1 px-3 py-1.5 rounded-md outline-none"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(210,180,130,0.12)',
            color: cp.title,
            fontSize: '0.75rem',
            fontFamily: 'inherit',
          }}
        />
      )}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleSubmit}
        disabled={!draft.trim()}
        className="px-3 py-1.5 rounded-md flex items-center gap-1 shrink-0"
        style={{
          background: draft.trim()
            ? (isDead ? 'linear-gradient(135deg, #5a4e6a, #7a6a90)' : 'linear-gradient(135deg, #b8860b, #d4a843)')
            : (isDead ? 'rgba(155,139,184,0.1)' : 'rgba(212,168,67,0.1)'),
          color: draft.trim() ? (isDead ? '#151218' : '#1a1207') : cp.textDim,
          fontSize: '0.7rem',
          fontWeight: 600,
          opacity: draft.trim() ? 1 : 0.4,
        }}
      >
        <Send size={12} />
      </motion.button>
    </div>
  );
}

// ── Page ──
export const PlayerQuestTasksPage = React.memo(function PlayerQuestTasksPage({
  quest, state, currentPlayerId, onBack, onAnswerTask, onSetHypothesis, t,
}: PlayerQuestTasksPageProps) {
  const pid = currentPlayerId;
  const isDead = !state.players.find(p => p.id === pid)?.alive;
  const cp = getCardPalette(state.phase, isDead);
  const isNight = state.phase === 'night';
  const myStatus = playerQuestStatus(quest, pid);
  const isResolved = myStatus === 'success' || myStatus === 'fail';
  const totalTasks = quest.tasks.length;
  const answeredCount = quest.tasks.filter(tk => {
    const a = tk.playerAnswers?.[pid];
    return a !== undefined && a !== '';
  }).length;

  // Reward hint for succeeded quests
  const allHints = state.hints || [];
  const rewardHintId = quest.rewardHintIds?.[pid];
  const rewardHint = rewardHintId != null ? allHints.find(h => h.id === rewardHintId) : null;
  const hasRewardHint = myStatus === 'success' && !!rewardHint;

  // Player select modal state — lifted to page level so modal is positioned over the whole page
  const [playerSelectTarget, setPlayerSelectTarget] = useState<{
    questId: number;
    taskId: number;
  } | null>(null);

  const handleOpenPlayerSelect = useCallback((questId: number, taskId: number) => {
    setPlayerSelectTarget({ questId, taskId });
  }, []);

  const handlePlayerSelected = useCallback((name: string) => {
    if (!playerSelectTarget) return;
    onAnswerTask(playerSelectTarget.questId, playerSelectTarget.taskId, name);
    setPlayerSelectTarget(null);
  }, [playerSelectTarget, onAnswerTask]);

  // Fullscreen image state (for task images)
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);

  // Fullscreen hint lightbox (for reward hints — with navigation across all revealed hints)
  const [fullscreenHintId, setFullscreenHintId] = useState<number | null>(null);
  // Hint-player associations for hypothesis mechanism
  const [hintAssociations, setHintAssociations] = useState<Record<number, number>>(() =>
    state.gameId ? getHintAssociations(state.gameId, pid) : {}
  );
  const handleSetHintAssociation = useCallback((hintId: number, targetPlayerId: number | null) => {
    if (!state.gameId) return;
    setHintAssoc(state.gameId, pid, hintId, targetPlayerId);
    setHintAssociations(getHintAssociations(state.gameId, pid));
  }, [state.gameId, pid]);
  const revealedHintIds = React.useMemo(() => {
    const playerHints = state.playerHints || [];
    const hintIdSet = new Set((state.hints || []).map(h => h.id));
    return playerHints
      .filter(ph => ph.playerId === pid && ph.revealed && hintIdSet.has(ph.hintId))
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .map(ph => ph.hintId);
  }, [state.playerHints, state.hints, pid]);

  const deadAccent = isDead ? '#9b8bb8' : '#d4a843';
  const deadSuccessColor = isDead ? '#8a7ba0' : '#7ac462';
  const deadFailColor = isDead ? '#8a7080' : '#e06060';

  return (
    <div className="flex flex-col h-full relative">
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${cp.divider}` }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center shrink-0 active:scale-95 transition-transform"
          style={{ color: isDead ? '#9b8bb8' : t.gold }}
          aria-label="Retour"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 style={{
            fontFamily: '"Cinzel", serif',
            color: isDead ? '#9b8bb8' : t.gold,
            fontSize: '0.9rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Taches
          </h2>
        </div>
        <span
          className="shrink-0 px-2.5 py-1 rounded-full"
          style={{
            background: isResolved
              ? (myStatus === 'success'
                ? (isDead ? 'rgba(140,120,170,0.15)' : 'rgba(90,150,70,0.15)')
                : (isDead ? 'rgba(140,100,130,0.12)' : 'rgba(200,60,60,0.12)'))
              : (isDead ? 'rgba(155,139,184,0.12)' : 'rgba(212,168,67,0.12)'),
            border: `1px solid ${isResolved
              ? (myStatus === 'success'
                ? (isDead ? 'rgba(140,120,170,0.3)' : 'rgba(90,150,70,0.3)')
                : (isDead ? 'rgba(140,100,130,0.25)' : 'rgba(200,60,60,0.25)'))
              : (isDead ? 'rgba(155,139,184,0.25)' : 'rgba(212,168,67,0.25)')}`,
            color: isResolved
              ? (myStatus === 'success' ? deadSuccessColor : deadFailColor)
              : deadAccent,
            fontSize: '0.65rem',
            fontWeight: 700,
            fontFamily: '"Cinzel", serif',
          }}
        >
          {answeredCount}/{totalTasks} repondues
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {/* Quest title reminder */}
          <div className="flex items-center gap-2 mb-1">
            <Swords size={14} style={{ color: deadAccent, opacity: 0.6 }} />
            <span style={{
              fontFamily: '"Cinzel", serif',
              color: cp.title,
              fontSize: '0.75rem',
              fontWeight: 600,
              opacity: 0.8,
            }}>
              {quest.title}
            </span>
          </div>

          {/* Overall result banner */}
          {isResolved && (
            <div
              className="rounded-xl p-3.5 flex items-center gap-2.5"
              style={{
                background: myStatus === 'success'
                  ? (isDead ? 'rgba(140,120,170,0.12)' : 'rgba(90,150,70,0.12)')
                  : (isDead ? 'rgba(140,100,130,0.1)' : 'rgba(200,60,60,0.1)'),
                border: `1px solid ${myStatus === 'success'
                  ? (isDead ? 'rgba(140,120,170,0.25)' : 'rgba(90,150,70,0.25)')
                  : (isDead ? 'rgba(140,100,130,0.2)' : 'rgba(200,60,60,0.2)')}`,
              }}
            >
              {myStatus === 'success'
                ? <CheckCircle size={20} style={{ color: deadSuccessColor }} />
                : <XCircle size={20} style={{ color: deadFailColor }} />
              }
              <div>
                <p style={{
                  fontFamily: '"Cinzel", serif',
                  color: myStatus === 'success' ? deadSuccessColor : deadFailColor,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}>
                  {myStatus === 'success' ? 'Quete Reussie !' : 'Quete Echouee'}
                </p>
                <p style={{ color: cp.textDim, fontSize: '0.6rem' }}>
                  {myStatus === 'success'
                    ? `${quest.tasks.filter(tk => tk.playerResults?.[pid] === true).length}/${totalTasks} taches correctes`
                    : `${totalTasks} tache${totalTasks > 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Reward hint for succeeded quests */}
          {hasRewardHint && rewardHint && (
            <div
              className="rounded-xl p-3.5 flex items-start gap-2.5 cursor-pointer active:opacity-80 transition-opacity"
              style={{
                background: isDead ? 'rgba(155,139,184,0.08)' : 'rgba(212,168,67,0.08)',
                border: `1px solid ${isDead ? 'rgba(155,139,184,0.2)' : 'rgba(212,168,67,0.2)'}`,
              }}
              onClick={() => setFullscreenHintId(rewardHint.id)}
            >
              <Lightbulb size={18} className="shrink-0 mt-0.5" style={{ color: deadAccent }} />
              <div className="flex-1 min-w-0">
                <p style={{
                  fontFamily: '"Cinzel", serif',
                  color: deadAccent,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginBottom: '0.25rem',
                }}>
                  Indice obtenu :
                </p>
                {rewardHint.text && (
                  <p style={{
                    color: cp.title,
                    fontSize: '0.78rem',
                    fontFamily: '"MedievalSharp", serif',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}>
                    {rewardHint.text}
                  </p>
                )}
                {rewardHint.imageUrl && (() => {
                  const hypothesisPlayerId = hintAssociations[rewardHint.id];
                  const hypothesisPlayer = hypothesisPlayerId ? state.players.find(p => p.id === hypothesisPlayerId) : null;
                  return (
                    <div className="relative inline-block mt-1">
                      <img
                        src={rewardHint.imageUrl}
                        alt="Indice"
                        className="rounded-lg max-h-40 object-contain"
                        style={{ border: `1px solid ${isDead ? 'rgba(155,139,184,0.2)' : 'rgba(212,168,67,0.2)'}` }}
                      />
                      {hypothesisPlayer && (
                        <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full overflow-hidden border-2" style={{ borderColor: isDead ? 'rgba(155,139,184,0.5)' : 'rgba(212,168,67,0.5)' }}>
                          <PAvatar player={hypothesisPlayer} size="text-xs" />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {myStatus === 'pending-resolution' && (
            <div
              className="rounded-xl p-3 flex items-center gap-2"
              style={{
                background: isDead ? 'rgba(155,139,184,0.1)' : 'rgba(245,179,66,0.1)',
                border: `1px solid ${isDead ? 'rgba(155,139,184,0.2)' : 'rgba(245,179,66,0.2)'}`,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="shrink-0"
              >
                <Clock size={14} style={{ color: isDead ? '#9b8bb8' : '#f5b342' }} />
              </motion.div>
              <p style={{ color: isDead ? '#9b8bb8' : '#f5b342', fontSize: '0.7rem' }}>
                Resolution en cours
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  ...
                </motion.span>
              </p>
            </div>
          )}

          {/* Task list */}
          {quest.tasks.map((task, idx) => {
            const myResult = task.playerResults?.[pid];
            const showPerTaskResult = myStatus === 'success';
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.06 }}
                className="rounded-xl p-3.5"
                style={{
                  background: isDead
                    ? (showPerTaskResult && myResult === true ? 'rgba(140,120,170,0.06)' : 'rgba(24,20,30,0.55)')
                    : (showPerTaskResult && myResult === true
                      ? 'rgba(90,150,70,0.06)'
                      : isNight ? 'rgba(18,20,42,0.55)' : '#E7DCC5'),
                  border: `1px solid ${isDead
                    ? (showPerTaskResult && myResult === true ? 'rgba(140,120,170,0.15)' : cp.insetBorder)
                    : (showPerTaskResult && myResult === true
                      ? 'rgba(90,150,70,0.15)'
                      : cp.insetBorder)}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span style={{
                    fontFamily: '"Cinzel", serif',
                    color: cp.accent,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    lineHeight: '1.4',
                  }}>
                    {idx + 1}.
                  </span>
                  {task.referencedPlayerId && (() => {
                    const rp = state.players.find(p => p.id === task.referencedPlayerId);
                    if (!rp) return null;
                    return (
                      <div className="flex-shrink-0 mt-0.5">
                        <div
                          className="w-10 h-10 rounded-full overflow-hidden"
                          style={{ border: `2px solid ${cp.accentBorder}`, boxShadow: `0 2px 8px rgba(0,0,0,0.25)` }}
                        >
                          <PAvatar player={rp} size="text-sm" />
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <p style={{ color: cp.text, fontSize: '0.8rem', lineHeight: '1.5' }}>
                      {task.question}
                    </p>
                    {task.imageUrl && (
                      <div className="mt-2 mb-1 rounded-lg overflow-hidden" style={{ border: `1px solid ${cp.insetBorder}` }}>
                        <img
                          src={task.imageUrl}
                          alt=""
                          className="w-full h-auto cursor-pointer active:opacity-80 transition-opacity"
                          style={{ maxHeight: '200px', objectFit: 'contain', background: cp.insetBg }}
                          onClick={() => setFullscreenImageUrl(task.imageUrl!)}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span style={{ color: cp.textDim, fontSize: '0.6rem' }}>
                        {INPUT_TYPE_LABELS[task.inputType]?.icon}
                      </span>
                      <span style={{ color: cp.textDim, fontSize: '0.6rem' }}>
                        {INPUT_TYPE_LABELS[task.inputType]?.label}
                      </span>
                    </div>
                    <TaskInput
                      task={task}
                      quest={quest}
                      state={state}
                      playerId={pid}
                      onAnswer={(answer) => onAnswerTask(quest.id, task.id, answer)}
                      cp={cp}
                      onOpenPlayerSelect={() => handleOpenPlayerSelect(quest.id, task.id)}
                      isDead={isDead}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Player Select Modal — rendered via portal so it covers the full viewport including footer */}
      {createPortal(
        <AnimatePresence>
          {playerSelectTarget !== null && (
            <PlayerSelectModal
              players={state.players}
              cp={cp}
              isNight={isNight}
              onSelect={handlePlayerSelected}
              onClose={() => setPlayerSelectTarget(null)}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Fullscreen Image Modal — rendered via portal so it covers the full viewport including footer */}
      {createPortal(
        <AnimatePresence>
          {fullscreenImageUrl !== null && (
            <motion.div
              key="fullscreen-image-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[95] flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
              onClick={() => setFullscreenImageUrl(null)}
            >
              {/* Close button */}
              <button
                onClick={() => setFullscreenImageUrl(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform z-10"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                }}
              >
                <XIcon size={16} />
              </button>

              {/* Image */}
              <motion.img
                key="fullscreen-image"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                src={fullscreenImageUrl}
                alt=""
                className="max-w-full max-h-full rounded-xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Fullscreen Hint Lightbox with navigation */}
      <HintFullscreenLightbox
        hints={state.hints || []}
        revealedHintIds={revealedHintIds}
        fullscreenHintId={fullscreenHintId}
        setFullscreenHintId={setFullscreenHintId}
        players={state.players}
        hintAssociations={hintAssociations}
        onSetHintAssociation={handleSetHintAssociation}
        onSetHypothesis={onSetHypothesis}
      />
    </div>
  );
});