import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Star,
  ChevronRight,
  Scroll,
  Hourglass,
  Eye,
  Lightbulb,
  Handshake,
  ThumbsUp,
  ThumbsDown,
  X,
  ShieldAlert,
  Swords,
  ImageIcon,
  Sun,
  Moon,
  Repeat,
  HelpCircle,
} from "lucide-react";
import type {
  GameState,
  Quest,
  QuestStatus,
} from "../../../context/gameTypes";
import type { GameThemeTokens } from "../../../context/gameTheme";
import { PhaseTimerDisplay } from "../../PhaseTimer";
import { PAvatar } from "./PAvatar";

interface PlayerQuestsPanelProps {
  state: GameState;
  currentPlayerId: number | null;
  onAnswerTask: (
    questId: number,
    taskId: number,
    answer: string,
  ) => void;
  onCollabVote?: (questId: number, vote: boolean) => void;
  onCancelCollabVote?: (questId: number) => void;
  onOpenQuest?: (questId: number) => void;
  readQuestIds?: Set<number>;
  isActive?: boolean;
  onNavigateToPlayer?: (playerId: number) => void;
  t: GameThemeTokens;
}

// ── Phase-aware card palettes ──
type CardPalette = {
  bg: string;
  bgOverlay: string;
  headerBg: string;
  border: string;
  borderLight: string;
  borderDark: string;
  title: string;
  text: string;
  textDim: string;
  divider: string;
  insetBg: string;
  insetBorder: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentDark: string;
  decorLine: string;
  cardShadow: string;
  collabBg: string;
  collabBorder: string;
  collabText: string;
};

const DAY_PALETTE: CardPalette = {
  bg: "#f5eed9",
  bgOverlay: "none",
  headerBg: "#c9b48a",
  border: "#d8ccac",
  borderLight: "#c8b890",
  borderDark: "#b8a880",
  title: "#2a2010",
  text: "#4a3f30",
  textDim: "#8a7e65",
  divider: "rgba(180,155,85,0.35)",
  insetBg: "rgba(0,0,0,0.025)",
  insetBorder: "rgba(160,140,90,0.18)",
  accent: "#9a8045",
  accentBg: "rgba(154,128,69,0.1)",
  accentBorder: "rgba(154,128,69,0.4)",
  accentDark: "#2a2010",
  decorLine:
    "linear-gradient(90deg, transparent, rgba(180,150,70,0.5), transparent)",
  cardShadow:
    "0 2px 10px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)",
  collabBg: "rgba(80,105,155,0.08)",
  collabBorder: "rgba(80,105,155,0.2)",
  collabText: "#556a90",
};

const NIGHT_PALETTE: CardPalette = {
  bg: "linear-gradient(165deg, #222640 0%, #1c2038 30%, #171a32 70%, #11132a 100%)",
  bgOverlay:
    "linear-gradient(180deg, rgba(140,160,220,0.05) 0%, rgba(100,120,200,0.01) 100%)",
  headerBg: "rgba(14,16,32,0.65)",
  border: "#4a5280",
  borderLight: "#5a6498",
  borderDark: "#14162a",
  title: "#d0daf5",
  text: "#b0bdd8",
  textDim: "#7a88b5",
  divider: "rgba(140,160,220,0.12)",
  insetBg: "rgba(10,12,30,0.35)",
  insetBorder: "rgba(140,160,220,0.08)",
  accent: "#8aa4d8",
  accentBg: "rgba(138,164,216,0.12)",
  accentBorder: "rgba(138,164,216,0.25)",
  accentDark: "#0e1020",
  decorLine:
    "linear-gradient(90deg, transparent, rgba(140,160,220,0.2), transparent)",
  cardShadow:
    "inset 0 1px 0 rgba(140,160,220,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 0 20px rgba(80,100,180,0.06), 0 1px 3px rgba(0,0,0,0.3)",
  collabBg: "rgba(120,140,200,0.15)",
  collabBorder: "rgba(120,140,200,0.3)",
  collabText: "#a8b8e0",
};

const DEAD_PALETTE: CardPalette = {
  bg: "linear-gradient(165deg, #2a2a2e 0%, #232327 30%, #1e1e22 70%, #18181c 100%)",
  bgOverlay:
    "linear-gradient(180deg, rgba(160,160,170,0.04) 0%, rgba(130,130,140,0.01) 100%)",
  headerBg: "rgba(20,20,24,0.65)",
  border: "#4a4a52",
  borderLight: "#5a5a62",
  borderDark: "#18181c",
  title: "#a0a0a8",
  text: "#858590",
  textDim: "#606068",
  divider: "rgba(140,140,150,0.12)",
  insetBg: "rgba(10,10,14,0.35)",
  insetBorder: "rgba(140,140,150,0.08)",
  accent: "#7a7a85",
  accentBg: "rgba(130,130,140,0.12)",
  accentBorder: "rgba(130,130,140,0.25)",
  accentDark: "#111114",
  decorLine:
    "linear-gradient(90deg, transparent, rgba(140,140,150,0.2), transparent)",
  cardShadow:
    "inset 0 1px 0 rgba(140,140,150,0.06), 0 4px 14px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)",
  collabBg: "rgba(120,120,130,0.15)",
  collabBorder: "rgba(120,120,130,0.3)",
  collabText: "#8a8a95",
};

/** Get phase-aware card palette */
function getCardPalette(phase: string, isDead?: boolean): CardPalette {
  if (isDead) return DEAD_PALETTE;
  return phase === "night" ? NIGHT_PALETTE : DAY_PALETTE;
}

/** Get this player's status for a quest */
function playerQuestStatus(
  quest: Quest,
  playerId: number,
): QuestStatus {
  return quest.playerStatuses?.[playerId] || "active";
}

// ── Status icon for card header ──
const QuestStatusIcon = React.memo(
  ({ status, phase, isCollaborative, isDead }: { status: string; phase?: string; isCollaborative?: boolean; isDead?: boolean }) => {
    if (isDead) {
      // Grey tones for dead players
      if (status === "success") return <CheckCircle size={18} style={{ color: "#6a6a70" }} />;
      if (status === "fail") return <XCircle size={18} style={{ color: "#6a6a70" }} />;
      return isCollaborative
        ? <Handshake size={18} style={{ color: "#5a5a62" }} />
        : <Swords size={18} style={{ color: "#5a5a62" }} />;
    }
    if (status === "success")
      return (
        <CheckCircle
          size={18}
          style={{ color: phase === "night" ? "#90E070" : "#709560" }}
        />
      );
    if (status === "fail")
      return <XCircle size={18} style={{ color: "#c44" }} />;
    const swordsColor =
      phase === "night" ? "#d4a843" : "#836825";
    if (status === "pending-resolution")
      return <Clock size={18} style={{ color: swordsColor }} />;
    return isCollaborative ? (
      <Handshake size={18} style={{ color: swordsColor }} />
    ) : (
      <Swords size={18} style={{ color: swordsColor }} />
    );
  },
);
QuestStatusIcon.displayName = "QuestStatusIcon";

// ── Status badge ──
const QuestStatusBadge = React.memo(
  ({
    status,
    answeredCount,
    totalTasks,
  }: {
    status: string;
    answeredCount: number;
    totalTasks: number;
  }) => {
    const configs: Record<
      string,
      {
        icon: React.ReactNode;
        label: string;
        bg: string;
        border: string;
        color: string;
      }
    > = {
      active: {
        icon: <Hourglass size={11} />,
        label: `En cours`,
        bg: "rgba(30,60,110,0.85)",
        border: "rgba(90,150,220,0.5)",
        color: "#a8d4ff",
      },
      "pending-resolution": {
        icon: <Clock size={11} />,
        label: "En attente...",
        bg: "rgba(100,70,10,0.85)",
        border: "rgba(245,179,66,0.5)",
        color: "#ffd06a",
      },
      success: {
        icon: <CheckCircle size={11} />,
        label: "Reussie",
        bg: "rgba(30,80,25,0.85)",
        border: "rgba(90,170,70,0.5)",
        color: "#90e070",
      },
      fail: {
        icon: <XCircle size={11} />,
        label: "Sabotee",
        bg: "rgba(100,25,25,0.85)",
        border: "rgba(220,70,70,0.5)",
        color: "#ff8a8a",
      },
    };
    const c = configs[status] || configs.active;

    return (
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded-md"
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          color: c.color,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        {c.icon}
        <span
          style={{
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {c.label}
        </span>
      </div>
    );
  },
);
QuestStatusBadge.displayName = "QuestStatusBadge";

export function PlayerQuestsPanel({
  state,
  currentPlayerId,
  onAnswerTask,
  onCollabVote,
  onCancelCollabVote,
  onOpenQuest,
  readQuestIds,
  isActive,
  onNavigateToPlayer,
  t,
}: PlayerQuestsPanelProps) {
  const [activeTab, setActiveTab] = useState<'ongoing' | 'finished'>('ongoing');
  const [confirmFailQuestId, setConfirmFailQuestId] = useState<number | null>(null);
  const allQuests = state.quests || [];

  // Dismiss modal when leaving the Quêtes tab
  useEffect(() => {
    if (!isActive) setConfirmFailQuestId(null);
  }, [isActive]);

  const pid = currentPlayerId ?? -1;
  const allHints = state.hints || [];

  // Only show quests assigned to this player via questAssignments
  const myAssignedIds =
    (state.questAssignments || {})[pid] || [];
  const quests = allQuests.filter((q) => {
    if (!myAssignedIds.includes(q.id)) return false;
    // Hide collaborative quests until the group is complete
    if ((q.questType || "individual") === "collaborative") {
      const myGroup = (q.collaborativeGroups || []).find((g) =>
        g.includes(pid),
      );
      if (!myGroup || myGroup.length < 2) return false;
    }
    return true;
  });

  // Sort newest first (highest id = newest)
  const sortedQuests = [...quests].sort((a, b) => b.id - a.id);

  const activeCount = quests.filter((q) => {
    const s = playerQuestStatus(q, pid);
    return s === "active" || s === "pending-resolution";
  }).length;

  // Split quests into ongoing vs finished
  const ongoingQuests = sortedQuests.filter((q) => {
    const s = playerQuestStatus(q, pid);
    return s === "active" || s === "pending-resolution";
  });
  const finishedQuests = sortedQuests.filter((q) => {
    const s = playerQuestStatus(q, pid);
    return s === "success" || s === "fail";
  });

  const displayedQuests = activeTab === 'ongoing' ? ongoingQuests : finishedQuests;

  if (quests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(212,168,67,0.08)",
            border: "1px solid rgba(212,168,67,0.15)",
          }}
        >
          <Scroll
            size={28}
            style={{ color: DAY_PALETTE.textDim }}
          />
        </div>
        <p
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: DAY_PALETTE.text,
            fontSize: "0.85rem",
          }}
        >
          Aucune quete disponible
        </p>
        <p
          style={{
            color: DAY_PALETTE.textDim,
            fontSize: "0.7rem",
            textAlign: "center",
            maxWidth: "16rem",
          }}
        >
          Le Maitre du Jeu n'a pas encore revele de missions
          pour vous. Restez a l'ecoute !
        </p>
      </div>
    );
  }

  const renderQuest = (quest: Quest, _idx?: number, _arr?: Quest[], isDead?: boolean) => {
    const myStatus = playerQuestStatus(quest, pid);
    const isResolved =
      myStatus === "success" || myStatus === "fail";
    const isUnread = readQuestIds ? !readQuestIds.has(quest.id) : false;
    const totalTasks = quest.tasks.length;
    const answeredCount = quest.tasks.filter((tk) => {
      const a = tk.playerAnswers?.[pid];
      return a !== undefined && a !== "";
    }).length;
    const hasRewardHint =
      myStatus === "success" && !!quest.rewardHintIds?.[pid];
    const rewardHintId = quest.rewardHintIds?.[pid];
    const rewardHint =
      rewardHintId != null
        ? allHints.find((h) => h.id === rewardHintId)
        : null;
    const isCollaborative =
      (quest.questType || "individual") === "collaborative";
    const hasVoted =
      isCollaborative &&
      quest.collaborativeVotes?.[pid] !== undefined;

    // Find player's group for collaborative quests
    const myGroup = isCollaborative
      ? (quest.collaborativeGroups || []).find((g) =>
          g.includes(pid),
        ) || []
      : [];
    const groupMates = myGroup.filter((id) => id !== pid);

    // Phase-aware card palette
    const cp = getCardPalette(state.phase, isDead);
    const isNight = state.phase === "night";

    // Border color per status
    const borderColor = isDead
      ? "#3a3a40"
      : myStatus === "success"
        ? isNight
          ? "#5a8a46"
          : "#a0b890"
        : myStatus === "fail"
          ? isNight
            ? "#8a3a3a"
            : "#c49090"
          : isCollaborative
            ? isNight
              ? "#6a7ab0"
              : "#a0aac8"
            : cp.border;
    const borderTopColor = isDead
      ? "#48484f"
      : myStatus === "success"
        ? isNight
          ? "#6ea854"
          : "#b0c8a0"
        : myStatus === "fail"
          ? isNight
            ? "#a04545"
            : "#d0a0a0"
          : isCollaborative
            ? isNight
              ? "#7b8ec8"
              : "#b0b8d0"
            : cp.borderLight;

    const cardStyle = {
      background: cp.bg,
      border: `${isNight ? "2px" : "1px"} solid ${borderColor}`,
      borderTopColor: borderTopColor,
      boxShadow: cp.cardShadow,
    };

    return (
      <motion.div
        key={quest.id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        {/* ═══ CARD (no flip) ═══ */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="rounded-xl overflow-hidden relative cursor-pointer"
          style={{
            ...cardStyle,
            border: "none",
            borderTopColor: undefined,
          }}
          onClick={() => onOpenQuest?.(quest.id)}
        >
          {/* Parchment texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{ background: cp.bgOverlay }}
          />

          {/* Top decorative border line */}
          <div
            className="absolute top-0 left-3 right-3 h-px"
            style={{ background: cp.decorLine }}
          />

          {/* Quest card header — title only */}
          <div
            className="relative z-10 px-3.5 py-2.5 flex items-start gap-2.5"
            style={{ background: cp.headerBg }}
          >
            <div className="shrink-0 mt-0.5">
              <QuestStatusIcon
                status={myStatus}
                phase={state.phase}
                isCollaborative={isCollaborative}
                isDead={isDead}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className="flex items-center gap-1.5"
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: cp.title,
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    textShadow: isNight
                      ? "0 1px 2px rgba(0,0,0,0.4)"
                      : "none",
                    letterSpacing: "0.02em",
                  }}
                >
                  {quest.title}
                  {isUnread && (
                    <span
                      className="shrink-0 inline-block rounded-full"
                      style={{
                        width: '8px',
                        height: '8px',
                        background: 'linear-gradient(135deg, #e53e3e, #c53030)',
                        boxShadow: '0 0 6px rgba(229,62,62,0.5)',
                      }}
                    />
                  )}
                </h3>
                {isCollaborative && (
                  null
                )}
              </div>
            </div>
            <div className="shrink-0 ml-auto">
              <QuestStatusBadge
                status={myStatus}
                answeredCount={answeredCount}
                totalTasks={totalTasks}
              />
            </div>
          </div>

          {/* Card body — description, progress, collaborative info */}
          <div className="relative z-10 px-3.5 pt-2.5 pb-2">
            {/* Description */}
            <p
              style={{
                color: cp.text,
                fontSize: "0.72rem",
                lineHeight: 1.5,
                paddingLeft: "1.75rem",
              }}
            >
              {quest.description}
            </p>

            {/* Progress line */}
            {!isResolved && !isCollaborative && (
              <p
                style={{
                  color: cp.textDim,
                  fontSize: "0.65rem",
                  marginTop: "0.35rem",
                  paddingLeft: "1.75rem",
                  fontStyle: "italic",
                }}
              >
                Progression : {answeredCount} / {totalTasks}{" "}
                repondues
              </p>
            )}

            {/* Collaborative: waiting message */}
            {isCollaborative && !isResolved && hasVoted && (
              <p
                style={{
                  color: "#f5b342",
                  fontSize: "0.65rem",
                  marginTop: "0.35rem",
                  paddingLeft: "1.75rem",
                  fontStyle: "italic",
                }}
              >
                En attente des autres joueurs...
              </p>
            )}

            {/* Collaborative: group members with vote status */}
            {isCollaborative &&
              myGroup.length > 0 &&
              !isResolved &&
              (() => {
                const votedCount = myGroup.filter(
                  (id) =>
                    quest.collaborativeVotes?.[id] !==
                    undefined,
                ).length;
                const remainingCount =
                  myGroup.length - votedCount;
                return (
                  <div
                    className="flex flex-col gap-1.5 mt-2"
                    style={{ paddingLeft: "1.75rem" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Users
                        size={11}
                        style={{ color: "#9aabda" }}
                      />
                      <span
                        style={{
                          color: "#9aabda",
                          fontSize: "0.6rem",
                          fontWeight: 600,
                        }}
                      >
                        Ton groupe
                      </span>
                      <span
                        style={{
                          color: cp.textDim,
                          fontSize: "0.55rem",
                        }}
                      >
                        — {votedCount}/{myGroup.length} ont vote
                        {remainingCount > 0
                          ? `, ${remainingCount} restant${remainingCount > 1 ? "s" : ""}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {myGroup.map((mateId) => {
                        const mate = state.players.find(
                          (p) => p.id === mateId,
                        );
                        if (!mate) return null;
                        const mateHasVoted =
                          quest.collaborativeVotes?.[mateId] !==
                          undefined;
                        const isMe = mateId === pid;
                        return (
                          <span
                            key={mateId}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                            style={{
                              background: mateHasVoted
                                ? isNight
                                  ? "rgba(90,150,70,0.12)"
                                  : "rgba(90,150,70,0.15)"
                                : isNight
                                  ? "rgba(106,122,176,0.12)"
                                  : "rgba(80,105,155,0.1)",
                              border: `1px solid ${
                                mateHasVoted
                                  ? isNight
                                    ? "rgba(90,150,70,0.25)"
                                    : "rgba(90,150,70,0.35)"
                                  : isNight
                                    ? "rgba(106,122,176,0.2)"
                                    : "rgba(80,105,155,0.25)"
                              }`,
                              color: mateHasVoted
                                ? isNight
                                  ? "#7ac462"
                                  : "#4a8a3a"
                                : isNight
                                  ? "#c5d0ee"
                                  : "#556a90",
                              fontSize: "0.6rem",
                              cursor: !isMe && onNavigateToPlayer ? "pointer" : undefined,
                            }}
                            onClick={!isMe && onNavigateToPlayer ? (e) => { e.stopPropagation(); onNavigateToPlayer(mateId); } : undefined}
                          >
                            {mateHasVoted ? (
                              <CheckCircle
                                size={10}
                                style={{
                                  color: isNight
                                    ? "#7ac462"
                                    : "#4a8a3a",
                                }}
                              />
                            ) : (
                              <Hourglass
                                size={10}
                                style={{
                                  color: isNight
                                    ? "#9aabda"
                                    : "#7085b0",
                                  opacity: 0.7,
                                }}
                              />
                            )}
                            <span
                              className="w-5 h-5 shrink-0 rounded-full overflow-hidden inline-flex"
                            >
                              <PAvatar player={mate} size="text-xs" />
                            </span>
                            {mate.name}
                            {isMe ? " (toi)" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            {/* Collaborative resolved: group members (no vote indicators) */}
            {isCollaborative &&
              groupMates.length > 0 &&
              isResolved && (() => {
                const isSabotaged = myStatus === "fail";
                return (
                <div
                  className="flex items-center gap-1.5 flex-wrap mt-2"
                  style={{ paddingLeft: "1.75rem" }}
                >
                  <Users
                    size={11}
                    style={{
                      color: isSabotaged
                        ? (isNight ? "#7a7a85" : "#9a9a9a")
                        : (isNight ? "#9aabda" : "#7085b0"),
                    }}
                  />
                  <span
                    style={{
                      color: isSabotaged
                        ? (isNight ? "#7a7a85" : "#9a9a9a")
                        : (isNight ? "#9aabda" : "#7085b0"),
                      fontSize: "0.6rem",
                      fontWeight: 600,
                    }}
                  >
                    Groupe :
                  </span>
                  {groupMates.map((mateId) => {
                    const mate = state.players.find(
                      (p) => p.id === mateId,
                    );
                    if (!mate) return null;
                    return (
                      <span
                        key={mateId}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                        style={{
                          background: isSabotaged
                            ? (isNight ? "rgba(120,120,130,0.1)" : "rgba(120,120,130,0.06)")
                            : (isNight
                              ? "rgba(106,122,176,0.12)"
                              : "rgba(80,105,155,0.1)"),
                          border: `1px solid ${isSabotaged
                            ? (isNight ? "rgba(120,120,130,0.2)" : "rgba(120,120,130,0.2)")
                            : (isNight ? "rgba(106,122,176,0.2)" : "rgba(80,105,155,0.25)")}`,
                          color: isSabotaged
                            ? (isNight ? "#8a8a95" : "#9a9a9a")
                            : (isNight
                              ? "#c5d0ee"
                              : "#556a90"),
                          fontSize: "0.6rem",
                          cursor: onNavigateToPlayer ? "pointer" : undefined,
                        }}
                        onClick={onNavigateToPlayer ? (e) => { e.stopPropagation(); onNavigateToPlayer(mateId); } : undefined}
                      >
                        <HelpCircle
                          size={10}
                          style={{
                            color: isSabotaged
                              ? (isNight ? "#7a7a85" : "#9a9a9a")
                              : (isNight ? "#9aabda" : "#7085b0"),
                            opacity: isSabotaged ? 1 : 0.7,
                          }}
                        />
                        <span
                          className="w-5 h-5 shrink-0 rounded-full overflow-hidden inline-flex"
                          style={isSabotaged ? { opacity: 0.5, filter: "grayscale(0.7)" } : undefined}
                        >
                          <PAvatar player={mate} size="text-xs" />
                        </span>
                        {mate.name}
                      </span>
                    );
                  })}
                </div>
                );
              })()}
          </div>

          {/* Divider */}
          <div
            className="relative z-10 mx-3"
            style={{ height: 1, background: cp.divider }}
          />

          {/* Bottom row */}
          <div className="relative z-10 px-3.5 py-2.5 flex items-center justify-between gap-2">
            {/* ── Collaborative active: vote buttons ── */}
            {isCollaborative &&
            myStatus === "active" &&
            !hasVoted &&
            onCollabVote ? (
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-2 w-full">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmFailQuestId(quest.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(140,80,80,0.2), rgba(120,90,90,0.1))",
                      border:
                        "1px solid rgba(160,100,100,0.35)",
                      color: "#a08080",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    <ThumbsDown size={13} />
                    Échec
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => { e.stopPropagation(); onCollabVote(quest.id, true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(184,134,11,0.3), rgba(212,168,67,0.15))",
                      border: "1px solid rgba(212,168,67,0.5)",
                      color: "#d4a843",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      fontFamily: '"Cinzel", serif',
                    }}
                  >
                    <ThumbsUp size={13} />
                    Succès
                  </motion.button>
                </div>
                <p
                  style={{
                    color: cp.textDim,
                    fontSize: "0.58rem",
                    textAlign: "center",
                    fontStyle: "italic",
                    lineHeight: 1.4,
                  }}
                >
                  1 échec pour échouer la mission. Le résultat
                  est anonyme.
                </p>
              </div>
            ) : isCollaborative && hasVoted && !isResolved ? (
              <div className="flex items-center gap-2 ml-auto">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
                  style={{
                    background: "rgba(245,179,66,0.12)",
                    border: "1px solid rgba(245,179,66,0.25)",
                    color: "#f5b342",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  <CheckCircle size={13} />
                  Vote envoye
                </div>
                {onCancelCollabVote && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); onCancelCollabVote(quest.id); }}
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 28,
                      height: 28,
                      background: "rgba(160,100,100,0.15)",
                      border: "1px solid rgba(160,100,100,0.3)",
                      color: "#b07070",
                    }}
                    title="Annuler mon vote"
                    aria-label="Annuler mon vote"
                  >
                    <X size={14} />
                  </motion.button>
                )}
              </div>
            ) : (
              <>
                {/* Hint inline for succeeded quests */}
                {hasRewardHint && rewardHint ? (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md flex-1 min-w-0"
                    style={{
                      background: "rgba(212,168,67,0.08)",
                      border: "1px solid rgba(212,168,67,0.2)",
                    }}
                  >
                    {rewardHint.imageUrl ? (
                      <ImageIcon
                        size={13}
                        className="shrink-0"
                        style={{ color: "#d4a843" }}
                      />
                    ) : (
                      <Lightbulb
                        size={13}
                        className="shrink-0"
                        style={{ color: "#d4a843" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {rewardHint.text && (
                        <p
                          className="truncate"
                          style={{
                            color: cp.title,
                            fontSize: "0.72rem",
                            fontFamily: '"MedievalSharp", serif',
                            fontStyle: "italic",
                            lineHeight: 1.4,
                          }}
                        >
                          {rewardHint.text}
                        </p>
                      )}
                      {rewardHint.imageUrl && (
                        <img
                          src={rewardHint.imageUrl}
                          alt="Indice"
                          className="rounded max-h-12 object-contain mt-0.5"
                        />
                      )}
                    </div>
                  </div>
                ) : myStatus === "fail" ? (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md flex-1 min-w-0"
                    style={{
                      background: "rgba(180,60,60,0.08)",
                      border: "1px solid rgba(180,60,60,0.22)",
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{ fontSize: "0.8rem", lineHeight: 1 }}
                      aria-hidden="true"
                    >
                      🐺
                    </span>
                    <p
                      className="truncate"
                      style={{
                        color: state.phase === "night" ? "#e08080" : "#9a4040",
                        fontSize: "0.72rem",
                        fontFamily: '"MedievalSharp", serif',
                        fontStyle: "italic",
                        lineHeight: 1.4,
                      }}
                    >
                      Indice saboté
                    </p>
                  </div>
                ) : (
                  <div />
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => { e.stopPropagation(); onOpenQuest?.(quest.id); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${cp.accentBg}, ${cp.accentBg}88)`,
                    border: `1px solid ${cp.accentBorder}`,
                    color: cp.accent,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: '"Cinzel", serif',
                  }}
                >
                  Détails
                  <ChevronRight size={13} />
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col gap-4 px-3 py-3">
      {/* Day/Night header with timer */}
      <div className="mb-1">
        <div className="flex items-center gap-2 mb-2">
          {state.phase === 'night' ? (
            <Moon size={18} style={{ color: '#7c8db5' }} />
          ) : (
            <Sun size={18} style={{ color: '#d4a843' }} />
          )}
          <h1
            style={{
              fontFamily: '"Cinzel Decorative", "Cinzel", serif',
              color: state.phase === 'night' ? '#7c8db5' : '#d4a843',
              fontSize: '1.1rem',
              fontWeight: 700,
            }}
          >
            {state.phase === 'night' ? `Nuit ${state.turn}` : `Jour ${state.turn}`}
          </h1>
        </div>
        {state.phaseTimerEndAt && (
          <div className="flex justify-start">
            <PhaseTimerDisplay
              endAt={state.phaseTimerEndAt}
              isNight={state.phase === 'night'}
              t={t}
              size="mini"
            />
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Scroll size={20} style={{ color: "#d4a843" }} />
        <h2
          style={{
            fontFamily: '"Cinzel Decorative", "Cinzel", serif',
            color: "#d4a843",
            fontSize: "1rem",
            fontWeight: 700,
          }}
        >
          Quetes
        </h2>
        {activeCount > 0 && (
          <span
            className="px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(212,168,67,0.1)",
              color: "#d4a843",
              fontSize: "0.6rem",
              border: "1px solid rgba(212,168,67,0.25)",
              fontWeight: 600,
            }}
          >
            {activeCount} en cours
          </span>
        )}
      </div>

      {/* Tab navigation */}
      <div
        className="flex rounded-lg overflow-hidden"
        style={{
          background: 'rgba(212,168,67,0.06)',
          border: '1px solid rgba(212,168,67,0.15)',
        }}
      >
        {([
          { key: 'ongoing' as const, label: 'En cours', count: ongoingQuests.length, icon: <Hourglass size={13} /> },
          { key: 'finished' as const, label: 'Terminées', count: finishedQuests.length, icon: <CheckCircle size={13} /> },
        ]).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 transition-all duration-200"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(212,168,67,0.2), rgba(184,134,11,0.12))'
                  : 'transparent',
                color: isActive ? '#d4a843' : 'rgba(212,168,67,0.45)',
                fontFamily: '"Cinzel", serif',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                borderBottom: isActive ? '2px solid #d4a843' : '2px solid transparent',
                letterSpacing: '0.02em',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="px-1.5 py-0 rounded-full"
                  style={{
                    background: isActive ? 'rgba(212,168,67,0.15)' : 'rgba(212,168,67,0.08)',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    minWidth: '1.2rem',
                    textAlign: 'center',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phase limit info */}
      {(() => {
        const limit = state.questsPerPhase ?? 1;
        const completions = (state.questCompletionsThisPhase || {})[pid] || 0;
        if (limit === 0) return null; // unlimited
        const remaining = Math.max(0, limit - completions);
        const phaseLabel = state.phase === 'night' ? 'cette nuit' : 'ce jour';
        return (
          <div
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg"
            style={{
              background: remaining > 0 ? 'rgba(160,170,180,0.08)' : 'rgba(160,170,180,0.08)',
              border: `1px solid ${remaining > 0 ? 'rgba(160,170,180,0.2)' : 'rgba(160,170,180,0.2)'}`,
            }}
          >
            <Repeat size={11} style={{ color: remaining > 0 ? '#9ca3af' : '#9ca3af' }} />
            <span style={{
              color: remaining > 0 ? '#9ca3af' : '#9ca3af',
              fontSize: '0.6rem',
              fontWeight: 600,
            }}>
              {remaining > 0
                ? `${remaining} quete${remaining > 1 ? 's' : ''} à débloquer ${phaseLabel}`
                : `Limite atteinte ${phaseLabel}`
              }
            </span>
          </div>
        );
      })()}

      {/* Quest list */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: activeTab === 'ongoing' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeTab === 'ongoing' ? 12 : -12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex flex-col gap-3"
        >
          {(() => {
            const currentPlayer = state.players.find((p) => p.id === pid);
            const isPlayerDead = currentPlayer ? !currentPlayer.alive : false;

            if (isPlayerDead) {
              return (
                <>
                  {/* Dead player banner */}
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(80,20,20,0.25), rgba(60,15,15,0.15))',
                      border: '1px solid rgba(160,60,60,0.3)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(160,60,60,0.08)',
                    }}
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: 'rgba(160,60,60,0.15)',
                        border: '1px solid rgba(160,60,60,0.25)',
                      }}
                    >
                      <ShieldAlert size={18} style={{ color: '#c06060' }} />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p style={{
                        fontFamily: '"Cinzel", serif',
                        color: '#c06060',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                      }}>
                        Vous etes mort
                      </p>
                      <p style={{
                        color: 'rgba(180,120,120,0.7)',
                        fontSize: '0.6rem',
                        fontStyle: 'italic',
                        lineHeight: 1.3,
                      }}>
                        Vos quetes restent visibles mais ne peuvent plus etre completees.
                      </p>
                    </div>
                  </div>

                  {displayedQuests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(160,60,60,0.06)',
                          border: '1px solid rgba(160,60,60,0.12)',
                        }}
                      >
                        {activeTab === 'ongoing'
                          ? <Hourglass size={22} style={{ color: 'rgba(160,120,120,0.5)' }} />
                          : <Star size={22} style={{ color: 'rgba(160,120,120,0.5)' }} />
                        }
                      </div>
                      <p style={{
                        color: 'rgba(160,120,120,0.5)',
                        fontSize: '0.75rem',
                        fontFamily: '"Microsoft Sans Serif", sans-serif',
                        textAlign: 'center',
                      }}>
                        {activeTab === 'ongoing'
                          ? 'Aucune quete en cours'
                          : 'Aucune quete terminee'
                        }
                      </p>
                    </div>
                  ) : (
                    <div style={{ pointerEvents: 'none' }}>
                      <div className="flex flex-col gap-3">
                        {displayedQuests.map((quest) => renderQuest(quest, undefined, undefined, true))}
                      </div>
                    </div>
                  )}
                </>
              );
            }

            // ── Alive player: normal view ──
            return displayedQuests.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: 'rgba(212,168,67,0.06)',
                    border: '1px solid rgba(212,168,67,0.12)',
                  }}
                >
                  {activeTab === 'ongoing'
                    ? <Hourglass size={22} style={{ color: DAY_PALETTE.textDim }} />
                    : <Star size={22} style={{ color: DAY_PALETTE.textDim }} />
                  }
                </div>
                <p style={{
                  color: DAY_PALETTE.textDim,
                  fontSize: '0.75rem',
                  fontFamily: '"Microsoft Sans Serif", sans-serif',
                  textAlign: 'center',
                }}>
                  {activeTab === 'ongoing'
                    ? 'Aucune quete en cours'
                    : 'Aucune quete terminee'
                  }
                </p>
              </div>
            ) : (
              displayedQuests.map(renderQuest)
            );
          })()}
        </motion.div>
      </AnimatePresence>

      {/* ── Confirm Fail Modal (portaled to body to escape transform context) ── */}
      {createPortal(
        <AnimatePresence>
          {confirmFailQuestId !== null && isActive !== false && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] flex items-center justify-center px-6"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              onClick={() => setConfirmFailQuestId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full max-w-sm rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(165deg, #2a1520 0%, #1e1228 50%, #18132a 100%)',
                  border: '1px solid rgba(180,80,80,0.3)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(160,80,80,0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top decorative line */}
                <div
                  className="absolute top-0 left-4 right-4 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(180,80,80,0.4), transparent)' }}
                />

                <div className="flex flex-col items-center gap-4 px-6 py-6">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(180,80,80,0.2), rgba(140,60,60,0.1))',
                      border: '1px solid rgba(180,80,80,0.3)',
                    }}
                  >
                    <ShieldAlert size={26} style={{ color: '#c87070' }} />
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontFamily: '"Cinzel", serif',
                      color: '#e8c0c0',
                      fontSize: '1rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      letterSpacing: '0.02em',
                    }}
                  >
                    Saboter la mission ?
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      color: '#b0a0a8',
                      fontSize: '0.78rem',
                      textAlign: 'center',
                      lineHeight: 1.6,
                    }}
                  >
                    Tu es sur le point de faire echouer cette mission.
                  </p>

                  {/* Anonymous guarantee */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg w-full"
                    style={{
                      background: 'rgba(140,160,220,0.08)',
                      border: '1px solid rgba(140,160,220,0.15)',
                    }}
                  >
                    <Eye size={15} style={{ color: '#9aabda', flexShrink: 0 }} />
                    <p
                      style={{
                        color: '#b8c8e8',
                        fontSize: '0.72rem',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}
                    >
                      Ton choix est <strong style={{ color: '#d0daf5' }}>totalement anonyme</strong>. Personne ne saura que c'est toi qui as fait echouer la mission.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 w-full mt-1">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setConfirmFailQuestId(null)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#b0a8b0',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        fontFamily: '"Cinzel", serif',
                      }}
                    >
                      Annuler
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (onCollabVote && confirmFailQuestId !== null) {
                          onCollabVote(confirmFailQuestId, false);
                        }
                        setConfirmFailQuestId(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(180,70,70,0.35), rgba(140,50,50,0.2))',
                        border: '1px solid rgba(180,80,80,0.5)',
                        color: '#e8a0a0',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: '"Cinzel", serif',
                      }}
                    >
                      <ThumbsDown size={14} />
                      Confirmer
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}