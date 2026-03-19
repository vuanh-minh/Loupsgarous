import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Vote, Moon, Scroll, MessageSquare, Send } from 'lucide-react';
import { type Player, type GameState } from '../../../context/gameTypes';
import { getRoleById } from '../../../data/roles';

/* ================================================================
   GMNotifyModal — lets the GM choose which notification to send
   to a specific player before sending.
   ================================================================ */

/** Roles that have an active night action (non-passive). */
const NIGHT_ACTION_ROLES = new Set([
  'loup-garou', 'voyante', 'sorciere', 'garde', 'corbeau', 'cupidon', 'renard', 'concierge',
]);

interface NotifyOption {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled: boolean;
  disabledReason?: string;
  message: string;
}

function hasPlayerCompletedNightAction(state: GameState, player: Player): boolean {
  const role = player.role;
  switch (role) {
    case 'loup-garou':
      return state.werewolfVotes?.[player.id] !== undefined;
    case 'voyante':
      return state.seerTargets?.[player.id] !== undefined;
    case 'sorciere': {
      const healed = !!(state.witchHealedThisNight || {})[player.id];
      const killed = state.witchKillTargets?.[player.id] !== undefined;
      return healed || killed;
    }
    case 'garde':
      return state.guardTargets?.[player.id] !== undefined;
    case 'cupidon':
      return (state.cupidLinkedBy || []).length > 0;
    case 'corbeau':
      return state.corbeauTargets?.[player.id] !== undefined;
    case 'renard':
      return (state.foxTargets?.[player.id] || []).length > 0;
    case 'concierge':
      return state.conciergeTargets?.[player.id] !== undefined;
    default:
      return false;
  }
}

interface GMNotifyModalProps {
  player: Player;
  state: GameState;
  isNight: boolean;
  onSend: (message: string) => void;
  onClose: () => void;
}

export const GMNotifyModal = React.memo(function GMNotifyModal({
  player,
  state,
  isNight,
  onSend,
  onClose,
}: GMNotifyModalProps) {
  const [customMessage, setCustomMessage] = useState('');

  const role = getRoleById(player.role);

  const options = useMemo<NotifyOption[]>(() => {
    const items: NotifyOption[] = [];

    // 1. Vote to submit
    const hasVotedDay = state.votes?.[player.id] !== undefined;
    const hasVotedEarly = state.earlyVotes?.[player.id] !== undefined;
    const hasVotedWolf = state.werewolfVotes?.[player.id] !== undefined;
    const hasVoted = isNight ? (hasVotedEarly || (player.role === 'loup-garou' && hasVotedWolf)) : hasVotedDay;
    items.push({
      id: 'vote',
      icon: <Vote size={18} />,
      label: 'Vote a soumettre',
      description: hasVoted ? 'A deja vote' : 'Rappeler au joueur de voter',
      disabled: hasVoted,
      disabledReason: hasVoted ? 'A deja vote' : undefined,
      message: '\uD83D\uDDF3\uFE0F N\'oubliez pas de voter\u00A0!',
    });

    // 2. Night action
    const hasNightRole = NIGHT_ACTION_ROLES.has(player.role);
    const nightActionDone = hasNightRole ? hasPlayerCompletedNightAction(state, player) : false;
    const nightDisabled = !isNight || !hasNightRole || nightActionDone;
    let nightDisabledReason: string | undefined;
    if (!isNight) nightDisabledReason = 'Ce n\'est pas la nuit';
    else if (!hasNightRole) nightDisabledReason = 'Pas d\'action nocturne';
    else if (nightActionDone) nightDisabledReason = 'Action deja effectuee';

    items.push({
      id: 'night',
      icon: <Moon size={18} />,
      label: 'Action nocturne',
      description: nightDisabled
        ? (nightDisabledReason || '')
        : `Rappeler a ${role?.emoji || ''} ${role?.name || player.role} d'agir`,
      disabled: nightDisabled,
      disabledReason: nightDisabledReason,
      message: `\uD83C\uDF19 C'est a vous d'agir cette nuit\u00A0!`,
    });

    // 3. Quest available — only enabled if the player has at least one ongoing (active/pending) quest
    const assignedQuestIds = (state.questAssignments || {})[player.id] || [];
    const hasQuests = assignedQuestIds.length > 0;
    const quests = state.quests || [];
    const ongoingQuestCount = assignedQuestIds.filter((qid: number) => {
      const q = quests.find((quest: any) => quest.id === qid);
      if (!q) return false;
      const status = q.playerStatuses?.[player.id];
      return !status || status === 'active' || status === 'pending-resolution';
    }).length;
    const questDisabled = !hasQuests || ongoingQuestCount === 0;
    const questDisabledReason = !hasQuests
      ? 'Aucune quete assignee'
      : ongoingQuestCount === 0
        ? 'Toutes les quetes sont terminees'
        : undefined;
    items.push({
      id: 'quest',
      icon: <Scroll size={18} />,
      label: 'Quete disponible',
      description: questDisabled
        ? (questDisabledReason || '')
        : `${ongoingQuestCount} quete${ongoingQuestCount > 1 ? 's' : ''} en cours`,
      disabled: questDisabled,
      disabledReason: questDisabledReason,
      message: '\u2694\uFE0F Vous avez une quete a accomplir\u00A0!',
    });

    return items;
  }, [player, state, isNight, role]);

  const handleSendOption = (option: NotifyOption) => {
    if (option.disabled) return;
    onSend(option.message);
  };

  const handleSendCustom = () => {
    const trimmed = customMessage.trim();
    if (!trimmed) return;
    onSend(`\uD83D\uDCDC Message du MJ\u00A0: ${trimmed}`);
  };

  const accentColor = isNight ? '#d4a843' : '#b8860b';
  const bgCard = isNight ? 'rgba(15, 23, 42, 0.98)' : 'rgba(245, 240, 230, 0.98)';
  const textColor = isNight ? '#e2dcc8' : '#1a1a2e';
  const textMuted = isNight ? 'rgba(226,220,200,0.5)' : 'rgba(26,26,46,0.5)';
  const borderColor = isNight ? 'rgba(212,168,67,0.2)' : 'rgba(184,134,11,0.2)';
  const hoverBg = isNight ? 'rgba(212,168,67,0.08)' : 'rgba(184,134,11,0.06)';
  const disabledBg = isNight ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)';
  const disabledText = isNight ? 'rgba(226,220,200,0.25)' : 'rgba(26,26,46,0.25)';

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal — centered fullscreen card */}
        <motion.div
          className="relative w-full rounded-2xl sm:max-w-sm overflow-hidden flex flex-col max-h-[85dvh]"
          style={{
            background: bgCard,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 25px 50px rgba(0,0,0,0.4), 0 0 30px ${isNight ? 'rgba(212,168,67,0.08)' : 'rgba(184,134,11,0.06)'}`,
          }}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 sm:py-3"
            style={{ borderBottom: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: '1rem' }}>{role?.emoji || '\uD83D\uDC64'}</span>
              <div className="min-w-0">
                <h3
                  className="text-sm font-semibold truncate"
                  style={{ color: textColor, fontFamily: '"Cinzel", serif' }}
                >
                  Notifier {player.name}
                </h3>
                <p className="text-xs truncate" style={{ color: textMuted }}>
                  Choisir le type de notification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={14} style={{ color: textMuted }} />
            </button>
          </div>

          {/* Options */}
          <div className="p-3 sm:p-3 space-y-2 sm:space-y-1.5 flex-1 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.id}
                disabled={opt.disabled}
                onClick={() => handleSendOption(opt)}
                className="w-full flex items-center gap-3 px-4 sm:px-3 py-4 sm:py-2.5 rounded-xl sm:rounded-lg text-left transition-all"
                style={{
                  background: opt.disabled ? disabledBg : 'transparent',
                  border: `1px solid ${opt.disabled ? 'transparent' : borderColor}`,
                  opacity: opt.disabled ? 0.45 : 1,
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!opt.disabled) e.currentTarget.style.background = hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!opt.disabled) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    color: opt.disabled ? disabledText : accentColor,
                    background: opt.disabled ? 'transparent' : `${accentColor}12`,
                  }}
                >
                  {opt.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm sm:text-xs font-medium truncate"
                    style={{ color: opt.disabled ? disabledText : textColor }}
                  >
                    {opt.label}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: opt.disabled ? disabledText : textMuted, fontSize: '0.7rem' }}
                  >
                    {opt.description}
                  </p>
                </div>
                {!opt.disabled && (
                  <Send size={14} style={{ color: accentColor, opacity: 0.6 }} />
                )}
              </button>
            ))}

            {/* Custom message */}
            <div
              className="rounded-xl sm:rounded-lg p-4 sm:p-3 mt-3 sm:mt-2"
              style={{ border: `1px solid ${borderColor}`, background: disabledBg }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={16} style={{ color: accentColor }} />
                <p className="text-sm sm:text-xs font-medium" style={{ color: textColor }}>
                  Message personnalise
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCustom(); }}
                  placeholder="Ecrire un message..."
                  className="flex-1 min-w-0 px-3 sm:px-2.5 py-2.5 sm:py-1.5 rounded-lg sm:rounded-md text-sm sm:text-xs outline-none"
                  style={{
                    background: isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                  }}
                  maxLength={200}
                />
                <button
                  disabled={!customMessage.trim()}
                  onClick={handleSendCustom}
                  className="px-4 sm:px-3 py-2.5 sm:py-1.5 rounded-lg sm:rounded-md text-sm sm:text-xs font-medium transition-all flex items-center gap-1.5 shrink-0"
                  style={{
                    background: customMessage.trim() ? accentColor : 'transparent',
                    color: customMessage.trim() ? (isNight ? '#0f172a' : '#fff') : disabledText,
                    border: `1px solid ${customMessage.trim() ? accentColor : borderColor}`,
                    cursor: customMessage.trim() ? 'pointer' : 'not-allowed',
                    opacity: customMessage.trim() ? 1 : 0.5,
                  }}
                >
                  <Send size={10} />
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
});