/**
 * InAppNotifications — In-app toast notifications for the Loup-Garou player view.
 *
 * Tracks state changes and shows animated toast banners for:
 *  - New quest assigned
 *  - Collaborative quest finished (success or fail)
 *  - New hint available
 *  - GM alerts
 *  - New nomination during vote phase
 *  - Collaborative quest group member voted
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Lightbulb, CheckCircle, XCircle, Handshake, X as XIcon, Bell, UserCheck, Users } from 'lucide-react';
import type { GameState, Quest, QuestStatus } from '../../../context/gameTypes';
import type { GameThemeTokens } from '../../../context/gameTheme';

/* ── Toast Types ── */
export type ToastType = 'new-quest' | 'quest-success' | 'quest-fail' | 'new-hint' | 'gm-alert' | 'nomination' | 'collab-member-voted';

export interface InAppToast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  questId?: number;
  createdAt: number;
}

/* ── Hook: useInAppNotifications ── */
export function useInAppNotifications({
  state,
  currentPlayerId,
  enabled,
  shortCode,
}: {
  state: GameState;
  currentPlayerId: number | null;
  enabled: boolean;
  shortCode?: string | null;
}) {
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  // Refs for tracking previous state
  const prevQuestIdsRef = useRef<Set<number> | null>(null);
  const prevCollabStatusesRef = useRef<Map<number, QuestStatus> | null>(null);
  const prevHintCountRef = useRef<number | null>(null);
  const prevGmAlertTsRef = useRef<number | null>(null);
  const prevNominationKeysRef = useRef<Set<string> | null>(null);
  const prevCollabVotesRef = useRef<Map<string, Set<number>> | null>(null);
  const isFirstRenderRef = useRef(true);

  const addToast = useCallback((toast: Omit<InAppToast, 'id' | 'createdAt'>) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { ...toast, id, createdAt: Date.now() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.createdAt < 5000));
    }, 500);
    return () => clearInterval(interval);
  }, [toasts.length]);

  // Get the quests visible to this player
  const myAssignedQuestIds = currentPlayerId !== null
    ? (state.questAssignments || {})[currentPlayerId] || []
    : [];
  const myVisibleQuests = (state.quests || []).filter(q => {
    if (!myAssignedQuestIds.includes(q.id)) return false;
    if ((q.questType || 'individual') === 'collaborative') {
      const myGroup = (q.collaborativeGroups || []).find(g => currentPlayerId !== null && g.includes(currentPlayerId));
      if (!myGroup || myGroup.length < 2) return false;
    }
    return true;
  });

  // Count this player's hints
  const myHintCount = currentPlayerId !== null
    ? (state.playerHints ?? []).filter(ph => ph.playerId === currentPlayerId).length
    : 0;

  useEffect(() => {
    if (!enabled || currentPlayerId === null) return;

    // Build current state snapshots
    const currentQuestIds = new Set(myVisibleQuests.map(q => q.id));
    const currentCollabStatuses = new Map<number, QuestStatus>();
    myVisibleQuests.forEach(q => {
      if ((q.questType || 'individual') === 'collaborative') {
        const status = q.playerStatuses?.[currentPlayerId] || 'active';
        currentCollabStatuses.set(q.id, status);
      }
    });

    // Skip first render — just record baseline
    if (isFirstRenderRef.current) {
      prevQuestIdsRef.current = currentQuestIds;
      prevCollabStatusesRef.current = currentCollabStatuses;
      prevHintCountRef.current = myHintCount;
      if (shortCode) {
        prevGmAlertTsRef.current = (state.gmAlerts || {})[shortCode] || 0;
      }
      // Baseline: nominations
      const nominationKeys = new Set(Object.keys(state.nominations || {}).map(String));
      prevNominationKeysRef.current = nominationKeys;
      // Baseline: collab votes (quest -> set of voter IDs in my group, excluding myself)
      const collabVotesMap = new Map<string, Set<number>>();
      myVisibleQuests.forEach(q => {
        if ((q.questType || 'individual') === 'collaborative' && q.collaborativeVotes) {
          const myGroup = (q.collaborativeGroups || []).find(g => currentPlayerId !== null && g.includes(currentPlayerId));
          if (myGroup) {
            const voterIds = new Set(
              Object.keys(q.collaborativeVotes)
                .map(Number)
                .filter(id => id !== currentPlayerId && myGroup.includes(id))
            );
            collabVotesMap.set(String(q.id), voterIds);
          }
        }
      });
      prevCollabVotesRef.current = collabVotesMap;
      isFirstRenderRef.current = false;
      return;
    }

    // 1. New quests
    if (prevQuestIdsRef.current !== null) {
      for (const qId of currentQuestIds) {
        if (!prevQuestIdsRef.current.has(qId)) {
          const quest = myVisibleQuests.find(q => q.id === qId);
          if (quest) {
            const isCollab = (quest.questType || 'individual') === 'collaborative';
            addToast({
              type: 'new-quest',
              title: isCollab ? 'Nouvelle quête collaborative' : 'Nouvelle quête',
              message: quest.title,
              questId: quest.id,
            });
          }
        }
      }
    }

    // 2. Collaborative quest finished
    if (prevCollabStatusesRef.current !== null) {
      for (const [qId, status] of currentCollabStatuses) {
        const prevStatus = prevCollabStatusesRef.current.get(qId);
        if (prevStatus && prevStatus !== status) {
          if (status === 'success' || status === 'fail') {
            const quest = myVisibleQuests.find(q => q.id === qId);
            addToast({
              type: status === 'success' ? 'quest-success' : 'quest-fail',
              title: status === 'success' ? 'Quête réussie !' : 'Quête échouée',
              message: quest?.title || 'Quête collaborative',
              questId: qId,
            });
          }
        }
      }
    }

    // 3. New hints
    if (prevHintCountRef.current !== null && myHintCount > prevHintCountRef.current) {
      const diff = myHintCount - prevHintCountRef.current;
      addToast({
        type: 'new-hint',
        title: diff === 1 ? 'Nouvel indice' : `${diff} nouveaux indices`,
        message: diff === 1 ? 'Un indice a été révélé pour toi.' : `${diff} indices ont été révélés.`,
      });
    }

    // 4. GM alerts
    if (shortCode && prevGmAlertTsRef.current !== null) {
      const currentGmAlertTs = (state.gmAlerts || {})[shortCode] || 0;
      if (currentGmAlertTs > prevGmAlertTsRef.current) {
        const customMsg = (state.gmAlertMessages || {})[shortCode] || '🔔 Vous avez une action à réaliser.';
        addToast({
          type: 'gm-alert',
          title: 'Alerte du Maître du Jeu',
          message: customMsg,
        });
        // Vibrate the device if available
        try { navigator.vibrate?.([200, 100, 200]); } catch {}
      }
    }

    // 5. New nominations (state.nominations: Record<number, number> = targetId -> nominatorId)
    const currentNominationKeys = new Set(Object.keys(state.nominations || {}).map(String));
    if (prevNominationKeysRef.current !== null) {
      const players = state.players || [];
      for (const key of currentNominationKeys) {
        if (!prevNominationKeysRef.current.has(key)) {
          const targetId = Number(key);
          const nominatorId = (state.nominations || {})[targetId];
          // Skip if I'm the one who nominated
          if (nominatorId === currentPlayerId) continue;
          const targetPlayer = players.find(p => p.id === targetId);
          const nominatorPlayer = nominatorId !== undefined ? players.find(p => p.id === nominatorId) : null;
          const nominatorName = nominatorPlayer?.name || 'Quelqu\'un';
          if (targetId === currentPlayerId) {
            // I was nominated
            addToast({
              type: 'nomination',
              title: 'Vous êtes nominé !',
              message: `🫵 Vous avez été nominé par ${nominatorName}`,
            });
          }
        }
      }
    }

    // 6. Collaborative quest group member voted
    const currentCollabVotesMap = new Map<string, Set<number>>();
    myVisibleQuests.forEach(q => {
      if ((q.questType || 'individual') === 'collaborative' && q.collaborativeVotes) {
        const myGroup = (q.collaborativeGroups || []).find(g => currentPlayerId !== null && g.includes(currentPlayerId));
        if (myGroup) {
          const voterIds = new Set(
            Object.keys(q.collaborativeVotes)
              .map(Number)
              .filter(id => id !== currentPlayerId && myGroup.includes(id))
          );
          currentCollabVotesMap.set(String(q.id), voterIds);
        }
      }
    });
    if (prevCollabVotesRef.current !== null) {
      const players = state.players || [];
      for (const [qId, currentVoters] of currentCollabVotesMap) {
        const prevVoters = prevCollabVotesRef.current.get(qId);
        if (prevVoters) {
          for (const voterId of currentVoters) {
            if (!prevVoters.has(voterId)) {
              const voterPlayer = players.find(p => p.id === voterId);
              const voterName = voterPlayer?.name || `Joueur #${voterId}`;
              const quest = myVisibleQuests.find(q => q.id === Number(qId));
              if (quest) {
                const vote = quest.collaborativeVotes?.[voterId];
                const voteLabel = vote ? '✅ Succès' : '❌ Échec';
                addToast({
                  type: 'collab-member-voted',
                  title: `${voterName} a voté`,
                  message: `${voteLabel} — ${quest.title}`,
                  questId: quest.id,
                });
              }
            }
          }
        }
      }
    }

    // Update refs
    prevQuestIdsRef.current = currentQuestIds;
    prevCollabStatusesRef.current = currentCollabStatuses;
    prevHintCountRef.current = myHintCount;
    if (shortCode) {
      prevGmAlertTsRef.current = (state.gmAlerts || {})[shortCode] || 0;
    }
    prevNominationKeysRef.current = currentNominationKeys;
    prevCollabVotesRef.current = currentCollabVotesMap;
  }, [
    enabled,
    currentPlayerId,
    // Stringify to detect deep changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(myAssignedQuestIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify((state.quests || []).map(q => ({
      id: q.id,
      h: q.hidden,
      ps: currentPlayerId !== null ? q.playerStatuses?.[currentPlayerId] : undefined,
      cv: q.collaborativeVotes,
    }))),
    myHintCount,
    addToast,
    shortCode,
    state.gmAlerts,
    state.gmAlertMessages,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(state.nominations),
  ]);

  return { toasts, dismissToast };
}

/* ── Toast Icons ── */
const TOAST_CONFIG: Record<ToastType, {
  icon: React.ReactNode;
  gradient: string;
  borderColor: string;
  iconBg: string;
}> = {
  'new-quest': {
    icon: <Swords size={16} />,
    gradient: 'linear-gradient(135deg, rgba(212,168,67,0.20) 0%, rgba(180,140,50,0.12) 100%)',
    borderColor: 'rgba(212,168,67,0.40)',
    iconBg: 'rgba(212,168,67,0.20)',
  },
  'quest-success': {
    icon: <CheckCircle size={16} />,
    gradient: 'linear-gradient(135deg, rgba(90,180,70,0.20) 0%, rgba(70,140,55,0.12) 100%)',
    borderColor: 'rgba(90,180,70,0.40)',
    iconBg: 'rgba(90,180,70,0.20)',
  },
  'quest-fail': {
    icon: <XCircle size={16} />,
    gradient: 'linear-gradient(135deg, rgba(220,70,70,0.20) 0%, rgba(180,50,50,0.12) 100%)',
    borderColor: 'rgba(220,70,70,0.40)',
    iconBg: 'rgba(220,70,70,0.20)',
  },
  'new-hint': {
    icon: <Lightbulb size={16} />,
    gradient: 'linear-gradient(135deg, rgba(160,130,220,0.20) 0%, rgba(130,100,190,0.12) 100%)',
    borderColor: 'rgba(160,130,220,0.40)',
    iconBg: 'rgba(160,130,220,0.20)',
  },
  'gm-alert': {
    icon: <Bell size={16} />,
    gradient: 'linear-gradient(135deg, rgba(255,165,0,0.20) 0%, rgba(255,140,0,0.12) 100%)',
    borderColor: 'rgba(255,165,0,0.40)',
    iconBg: 'rgba(255,165,0,0.20)',
  },
  'nomination': {
    icon: <UserCheck size={16} />,
    gradient: 'linear-gradient(135deg, rgba(255,215,0,0.20) 0%, rgba(255,190,0,0.12) 100%)',
    borderColor: 'rgba(255,215,0,0.40)',
    iconBg: 'rgba(255,215,0,0.20)',
  },
  'collab-member-voted': {
    icon: <Users size={16} />,
    gradient: 'linear-gradient(135deg, rgba(100,149,237,0.20) 0%, rgba(70,120,200,0.12) 100%)',
    borderColor: 'rgba(100,149,237,0.40)',
    iconBg: 'rgba(100,149,237,0.20)',
  },
};

const TOAST_ICON_COLOR: Record<ToastType, string> = {
  'new-quest': '#d4a843',
  'quest-success': '#7ac462',
  'quest-fail': '#e06060',
  'new-hint': '#a888d8',
  'gm-alert': '#ff9900',
  'nomination': '#ffd700',
  'collab-member-voted': '#6495ed',
};

/* ── Toast Renderer ── */
export const InAppNotificationToasts = React.memo(function InAppNotificationToasts({
  toasts,
  onDismiss,
  onTapQuest,
}: {
  toasts: InAppToast[];
  onDismiss: (id: string) => void;
  onTapQuest?: (questId: number) => void;
}) {
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = TOAST_CONFIG[toast.type];
          const iconColor = TOAST_ICON_COLOR[toast.type];
          const isQuestToast = toast.questId !== undefined;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -40, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.9 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full max-w-md pointer-events-auto"
              onClick={() => {
                if (isQuestToast && onTapQuest && toast.questId !== undefined) {
                  onTapQuest(toast.questId);
                  onDismiss(toast.id);
                }
              }}
              style={{ cursor: isQuestToast ? 'pointer' : 'default' }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: config.gradient,
                  border: `1px solid ${config.borderColor}`,
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                {/* Icon */}
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                  style={{
                    background: config.iconBg,
                    color: iconColor,
                  }}
                >
                  {config.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontFamily: '"Cinzel", serif',
                      color: iconColor,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {toast.title}
                  </p>
                  <p
                    className="truncate"
                    style={{
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: '0.68rem',
                      fontFamily: '"MedievalSharp", serif',
                      lineHeight: 1.3,
                      marginTop: '1px',
                    }}
                  >
                    {toast.message}
                  </p>
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(toast.id);
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 active:scale-90 transition-transform"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <XIcon size={12} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
});