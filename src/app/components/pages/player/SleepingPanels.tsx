import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RotateCcw,
  Search,
  X,
  RefreshCw,
  Skull,
  CircleCheck,
  Scroll,
} from "lucide-react";
import {
  type Player,
  type GameState,
} from "../../../context/GameContext";
import {
  getRoleById,
  type RoleDefinition,
} from "../../../data/roles";
import { type GameThemeTokens } from "../../../context/gameTheme";
import { PAvatar } from "./PAvatar";

/* ---- Discovery Recap Panel (Night 1 — shows discovery-phase action summary) ---- */
export function DiscoveryRecapPanel({
  currentPlayer,
  state,
  allPlayers,
  alivePlayers,
  onDismiss,
  onWerewolfVote,
  t,
}: {
  currentPlayer: Player;
  state: GameState;
  allPlayers: Player[];
  alivePlayers: Player[];
  onDismiss: () => void;
  onWerewolfVote?: (wolfId: number, targetId: number, message?: string) => void;
  t: GameThemeTokens;
}) {
  const [showChangeTarget, setShowChangeTarget] =
    useState(false);
  const [recapWolfSearch, setRecapWolfSearch] = useState("");
  const [wolfChangedTarget, setWolfChangedTarget] =
    useState(false);
  const role = getRoleById(currentPlayer.role);
  let recapIcon = "\u2705";
  let recapTitle = "Action effectuee";
  let recapDescription: React.ReactNode = null;

  const isWolf = currentPlayer.role === "loup-garou";
  const currentWolfTargetId = isWolf
    ? state.werewolfVotes[currentPlayer.id]
    : undefined;
  const currentWolfTarget =
    currentWolfTargetId !== undefined
      ? allPlayers.find((p) => p.id === currentWolfTargetId)
      : null;

  // Available targets for wolves: alive non-wolf players
  const wolfTargets = isWolf
    ? alivePlayers.filter(
        (p) =>
          p.role !== "loup-garou" && p.id !== currentPlayer.id,
      )
    : [];

  // Tally wolf votes and compute kill zone for sorting/highlighting
  const recapTally: Record<number, number> = {};
  if (isWolf) {
    Object.values(state.werewolfVotes).forEach(
      (tid: number) => {
        recapTally[tid] = (recapTally[tid] || 0) + 1;
      },
    );
  }
  const recapMaxKills = Math.max(
    1,
    state.wolfKillsPerNight || 1,
  );
  const recapKillZoneIds = new Set(
    Object.entries(recapTally)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, recapMaxKills)
      .map(([id]) => parseInt(id)),
  );

  if (isWolf) {
    recapIcon = "\uD83D\uDC3A";
    recapTitle = "Vote des loups";
    recapDescription = currentWolfTarget ? (
      <span>
        Vous avez vot\u00e9 pour{" "}
        <strong style={{ color: "#c41e3a" }}>
          {currentWolfTarget.name}
        </strong>
      </span>
    ) : (
      "Aucun vote enregistre"
    );
  } else if (currentPlayer.role === "voyante") {
    const targetId = state.seerTargets?.[currentPlayer.id];
    const result = state.seerResults?.[currentPlayer.id];
    const target = allPlayers.find((p) => p.id === targetId);
    const resultRole = result
      ? (getRoleById(result.id ?? (result as any).name) ??
        result)
      : null;
    recapIcon = "\uD83D\uDD2E";
    recapTitle = "Vision nocturne";
    recapDescription =
      target && resultRole ? (
        <span>
          <strong style={{ color: "#8b5cf6" }}>
            {target.name}
          </strong>{" "}
          est{" "}
          <strong
            style={{
              color:
                (resultRole as RoleDefinition).color ?? t.gold,
            }}
          >
            {(resultRole as RoleDefinition).emoji ?? ""}{" "}
            {(resultRole as RoleDefinition).name ?? "Inconnu"}
          </strong>
        </span>
      ) : (
        "Aucune vision"
      );
  } else if (currentPlayer.role === "garde") {
    const targetId = state.guardTargets?.[currentPlayer.id];
    const target = allPlayers.find((p) => p.id === targetId);
    recapIcon = "\uD83D\uDEE1\uFE0F";
    recapTitle = "Protection";
    recapDescription = target ? (
      <span>
        Vous protegez{" "}
        <strong style={{ color: "#3b82f6" }}>
          {target.name}
        </strong>{" "}
        cette nuit
      </span>
    ) : (
      "Aucune protection"
    );
  } else if (currentPlayer.role === "cupidon") {
    const pairs = state.loverPairs ?? [];
    recapIcon = "\uD83D\uDC98";
    recapTitle = "Lien d'amour";
    if (pairs.length > 0) {
      const lastPair = pairs[pairs.length - 1];
      const p1 = allPlayers.find((p) => p.id === lastPair[0]);
      const p2 = allPlayers.find((p) => p.id === lastPair[1]);
      recapDescription =
        p1 && p2 ? (
          <span>
            <strong style={{ color: "#ec4899" }}>
              {p1.name}
            </strong>{" "}
            {"\u2764\uFE0F"}{" "}
            <strong style={{ color: "#ec4899" }}>
              {p2.name}
            </strong>
          </span>
        ) : (
          "Couple lie"
        );
    } else {
      recapDescription = "Aucun couple lie";
    }
  } else if (currentPlayer.role === "corbeau") {
    const targetId = (state.corbeauTargets ?? {})[
      currentPlayer.id
    ];
    const target = allPlayers.find((p) => p.id === targetId);
    recapIcon = "\uD83D\uDC26\u200D\u2B1B";
    recapTitle = "Indice envoye";
    recapDescription = target ? (
      <span>
        Indice corrompu envoye a{" "}
        <strong style={{ color: "#4a3660" }}>
          {target.name}
        </strong>
      </span>
    ) : (
      "Aucun indice envoye"
    );
  } else if (currentPlayer.role === "renard") {
    const foxTargetIds =
      (state.foxTargets ?? {})[currentPlayer.id] ?? [];
    const foxResult = (state.foxResults ?? {})[
      currentPlayer.id
    ];
    const foxPlayers = foxTargetIds
      .map((id: number) => allPlayers.find((p) => p.id === id))
      .filter(Boolean);
    recapIcon = "\uD83E\uDD8A";
    recapTitle = "Flair nocturne";
    if (foxPlayers.length > 0) {
      recapDescription = (
        <span>
          Groupe flaire :{" "}
          {foxPlayers.map((p: any, i: number) => (
            <span key={p.id}>
              {i > 0 && ", "}
              <strong style={{ color: "#f97316" }}>
                {p.name}
              </strong>
            </span>
          ))}
          {" \u2014 "}
          <strong
            style={{ color: foxResult ? "#ef4444" : "#22c55e" }}
          >
            {foxResult
              ? "\uD83D\uDC3A Loup detecte !"
              : "\u2705 Aucun loup"}
          </strong>
        </span>
      );
    } else {
      recapDescription = "Aucun flair effectue";
    }
  } else if (currentPlayer.role === "oracle") {
    const oracleUsed = !!(state.oracleUsed || {})[currentPlayer.id];
    recapIcon = "\uD83C\uDF19";
    recapTitle = "Issue de la nuit";
    recapDescription = oracleUsed
      ? "Vous avez consulte les etoiles"
      : "Aucune consultation";
  } else if (currentPlayer.role === "empoisonneur") {
    const targetId = (state.empoisonneurTargets ?? {})[currentPlayer.id];
    const target = allPlayers.find((p) => p.id === targetId);
    recapIcon = "\uD83E\uDDEA";
    recapTitle = "Poison";
    recapDescription = target ? (
      <span>
        Vous avez empoisonn\u00e9{" "}
        <strong style={{ color: "#65a30d" }}>
          {target.name}
        </strong>
      </span>
    ) : (
      "Aucune cible empoisonnee"
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col items-center justify-center">
        <div className="p-6 text-center w-full flex flex-col items-center justify-center flex-1 relative overflow-hidden">
          {/* Subtle pulsing stars */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2 + Math.random() * 2,
                height: 2 + Math.random() * 2,
                background: `${role?.color ?? t.gold}44`,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              animate={{ opacity: [0.2, 0.7, 0.2] }}
              transition={{
                duration: 2.5 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}

          <div className="relative z-10 flex flex-col items-center">
            {/* Recap badge */}
            <div
              className="inline-block px-3 py-1 rounded-full mb-4"
              style={{
                background: `${role?.color ?? t.gold}15`,
                border: `1px solid ${role?.color ?? t.gold}30`,
              }}
            >
              <span
                style={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: "0.55rem",
                  color: role?.color ?? t.gold,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Nuit 1 {"\u2014"} Recap
              </span>
            </div>

            {/* Icon */}
            <motion.span
              className="text-5xl block mb-3"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
              }}
            >
              {recapIcon}
            </motion.span>

            {/* Title */}
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{
                fontFamily: '"Cinzel", serif',
                color: role?.color ?? t.gold,
                fontSize: "1rem",
                marginBottom: "0.5rem",
              }}
            >
              {recapTitle}
            </motion.h3>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                color: t.textSecondary,
                fontSize: "0.75rem",
                lineHeight: 1.6,
              }}
            >
              {recapDescription}
            </motion.p>

            {/* Wolf change target section */}
            {isWolf && onWerewolfVote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="w-full mt-4"
              >
                <AnimatePresence mode="wait">
                  {!showChangeTarget ? (
                    <motion.button
                      key="change-btn"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowChangeTarget(true)}
                      className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(196,30,58,0.08)",
                        border: "1px solid rgba(196,30,58,0.2)",
                        color: "#c41e3a",
                        fontSize: "0.6rem",
                        fontFamily: '"Cinzel", serif',
                        letterSpacing: "0.03em",
                      }}
                    >
                      <RefreshCw size={11} />
                      Changer de cible
                    </motion.button>
                  ) : (
                    <motion.div
                      key="target-list"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1 max-h-48 overflow-y-auto"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <p
                        style={{
                          color: t.textMuted,
                          fontSize: "0.55rem",
                          marginBottom: "0.4rem",
                          textAlign: "center",
                        }}
                      >
                        Choisir une nouvelle cible :
                      </p>
                      {wolfTargets.length > 5 && (
                        <div className="relative mb-1">
                          <Search
                            size={12}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: t.textMuted }}
                          />
                          <input
                            type="text"
                            placeholder="Rechercher..."
                            value={recapWolfSearch}
                            onChange={(e) =>
                              setRecapWolfSearch(e.target.value)
                            }
                            className="w-full pl-7 pr-7 py-1.5 rounded-lg text-sm outline-none transition-all"
                            style={{
                              background: `rgba(${t.overlayChannel}, 0.04)`,
                              border: `1px solid ${recapWolfSearch ? "rgba(196,30,58,0.3)" : `rgba(${t.overlayChannel}, 0.08)`}`,
                              color: t.text,
                              fontSize: "0.65rem",
                            }}
                          />
                          {recapWolfSearch && (
                            <button
                              onClick={() =>
                                setRecapWolfSearch("")
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
                            >
                              <X
                                size={10}
                                style={{ color: t.textMuted }}
                              />
                            </button>
                          )}
                        </div>
                      )}
                      {(recapWolfSearch
                        ? wolfTargets.filter((tgt) =>
                            tgt.name
                              .toLowerCase()
                              .includes(
                                recapWolfSearch.toLowerCase(),
                              ),
                          )
                        : wolfTargets
                      )
                        .slice()
                        .sort(
                          (a, b) =>
                            (recapTally[b.id] || 0) -
                            (recapTally[a.id] || 0),
                        )
                        .map((tgt) => {
                          const isCurrentTarget =
                            tgt.id === currentWolfTargetId;
                          const recapVotes =
                            recapTally[tgt.id] || 0;
                          const inKillZone =
                            recapKillZoneIds.has(tgt.id);
                          return (
                            <motion.button
                              key={tgt.id}
                              layout
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                if (!isCurrentTarget) {
                                  onWerewolfVote(
                                    currentPlayer.id,
                                    tgt.id,
                                  );
                                  setWolfChangedTarget(true);
                                }
                              }}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors"
                              style={{
                                background: inKillZone
                                  ? "rgba(196,30,58,0.12)"
                                  : isCurrentTarget
                                    ? "rgba(196,30,58,0.08)"
                                    : `rgba(${t.overlayChannel}, 0.02)`,
                                borderWidth: "1px",
                                borderStyle: "solid",
                                borderColor: inKillZone
                                  ? "rgba(196,30,58,0.35)"
                                  : isCurrentTarget
                                    ? "rgba(196,30,58,0.25)"
                                    : `rgba(${t.overlayChannel}, 0.06)`,
                                boxShadow: inKillZone
                                  ? "0 0 10px rgba(196,30,58,0.12), inset 0 0 10px rgba(196,30,58,0.04)"
                                  : "none",
                              }}
                            >
                              <PAvatar
                                player={tgt}
                                size="text-base"
                              />
                              <span
                                className="flex-1 text-left truncate"
                                style={{
                                  color: inKillZone
                                    ? "#e8c8c8"
                                    : isCurrentTarget
                                      ? "#e8c8c8"
                                      : t.text,
                                  fontSize: "0.7rem",
                                  fontWeight:
                                    inKillZone ||
                                    isCurrentTarget
                                      ? 600
                                      : 400,
                                }}
                              >
                                {tgt.name}
                              </span>
                              {recapVotes > 0 && (
                                <span
                                  className="px-1.5 py-0.5 rounded-full flex items-center gap-1"
                                  style={{
                                    background: inKillZone
                                      ? "rgba(196,30,58,0.2)"
                                      : "rgba(196,30,58,0.1)",
                                    border: `1px solid ${inKillZone ? "rgba(196,30,58,0.4)" : "rgba(196,30,58,0.2)"}`,
                                    color: "#c41e3a",
                                    fontSize: "0.55rem",
                                    fontFamily:
                                      '"Cinzel", serif',
                                    fontWeight: inKillZone
                                      ? 700
                                      : 400,
                                  }}
                                >
                                  {inKillZone && (
                                    <Skull size={8} />
                                  )}
                                  {recapVotes}
                                </span>
                              )}
                              {isCurrentTarget && (
                                <CircleCheck
                                  size={14}
                                  style={{ color: "#c41e3a" }}
                                />
                              )}
                            </motion.button>
                          );
                        })}
                      {recapWolfSearch &&
                        wolfTargets.filter((tgt) =>
                          tgt.name
                            .toLowerCase()
                            .includes(
                              recapWolfSearch.toLowerCase(),
                            ),
                        ).length === 0 && (
                          <p
                            style={{
                              color: t.textMuted,
                              fontSize: "0.6rem",
                              textAlign: "center",
                              padding: "0.4rem 0",
                            }}
                          >
                            Aucun joueur ne correspond.
                          </p>
                        )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setShowChangeTarget(false);
                          setRecapWolfSearch("");
                        }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg mt-1"
                        style={{
                          background: `rgba(${t.overlayChannel}, 0.03)`,
                          border: `1px solid rgba(${t.overlayChannel}, 0.06)`,
                          color: t.textMuted,
                          fontSize: "0.55rem",
                          fontFamily: '"Cinzel", serif',
                        }}
                      >
                        <X size={10} />
                        Annuler
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Sleep transition hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{
                color: t.textDim,
                fontSize: "0.55rem",
                marginTop: "1.5rem",
                fontStyle: "italic",
              }}
            >
              Retournez la carte {"\u2014"} vous dormez le reste
              de la nuit.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Flip back button */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{
          background:
            "linear-gradient(to top, rgba(5,8,16,1), rgba(5,8,16,0.9) 70%, transparent)",
        }}
      >
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={onDismiss}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: `1px solid rgba(${t.overlayChannel}, 0.08)`,
            color: t.textMuted,
            fontFamily: '"Cinzel", serif',
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
          }}
        >
          <RotateCcw size={13} />
          {wolfChangedTarget
            ? "Valider et retourner la carte"
            : "Retourner la carte"}
        </motion.button>
      </div>
    </div>
  );
}

/* ---- Villager Sleeping Panel (back of card for villagers) ---- */
export function VillagerSleepingPanel({
  onFlipBack,
  onInvestigate,
  onQuests,
  t,
}: {
  onFlipBack: () => void;
  onInvestigate: () => void;
  onQuests?: () => void;
  t: GameThemeTokens;
}) {
  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col items-center justify-center"
        style={{ background: "rgba(12,13,21,0.7)" }}
      >
        <div className="p-6 text-center w-full flex flex-col items-center justify-center flex-1 relative overflow-hidden">
          {/* Subtle stars background */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 2 + Math.random() * 2,
                height: 2 + Math.random() * 2,
                background: "rgba(124,141,181,0.4)",
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              animate={{ opacity: [0.22, 0.44, 0.22] }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}

          <div className="relative z-10 flex flex-col items-center">
            {/* Sleeping emoji with gentle float animation */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <motion.span
                className="text-6xl block"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {"\uD83D\uDE34"}
              </motion.span>
            </motion.div>

            {/* Zzz floating up */}
            <div className="relative h-8 w-full mt-1">
              {["z", "Z", "z"].map((letter, i) => (
                <motion.span
                  key={i}
                  className="absolute"
                  style={{
                    fontFamily: '"Cinzel", serif',
                    color: t.nightSky,
                    fontSize: `${0.6 + i * 0.15}rem`,
                    left: `${48 + i * 8}%`,
                    opacity: 0.6,
                  }}
                  animate={{
                    y: [0, -14, -22],
                    opacity: [0, 0.7, 0],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut",
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            <h2
              style={{
                fontFamily: '"Cinzel", serif',
                color: t.nightSky,
                fontSize: "1.2rem",
                marginTop: "0.75rem",
              }}
            >
              Vous dormez...
            </h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                color: "#6b7b9b",
                fontSize: "0.7rem",
                marginTop: "0.5rem",
                lineHeight: 1.6,
                maxWidth: "16rem",
              }}
            >
              Observez, analysez...
              {"\n"}Fermez les yeux et attendez le jour.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              style={{
                color: "rgba(107,123,155,0.6)",
                fontSize: "0.55rem",
                marginTop: "0.75rem",
                fontStyle: "italic",
              }}
            >
              Votre force, c'est votre vote au village !
            </motion.p>

            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileTap={{ scale: 0.95 }}
              onClick={onInvestigate}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg transition-all duration-200"
              style={{
                marginTop: "1rem",
                background: "rgba(124,141,181,0.13)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: "rgba(124,141,181,0.27)",
                color: t.nightSky,
                fontFamily: '"Cinzel", serif',
                fontSize: "0.7rem",
                letterSpacing: "0.05em",
              }}
            >
              <Search size={14} />
              Enqueter
            </motion.button>

            {onQuests && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                whileTap={{ scale: 0.95 }}
                onClick={onQuests}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg transition-all duration-200"
                style={{
                  marginTop: "0.5rem",
                  background: "rgba(212,168,67,0.1)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  borderColor: "rgba(212,168,67,0.25)",
                  color: "#d4a843",
                  fontFamily: '"Cinzel", serif',
                  fontSize: "0.7rem",
                  letterSpacing: "0.05em",
                }}
              >
                <Scroll size={14} />
                Quêtes
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom button */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onFlipBack}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#8090b0",
            fontFamily: '"Cinzel", serif',
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
          }}
        >
          <RotateCcw size={13} />
          Retourner la carte
        </motion.button>
      </div>
    </div>
  );
}

/* ---- Guard Sleeping Panel (back of card for guard who has acted) ---- */
export function GuardSleepingPanel({
  guardTargetName,
  onFlipBack,
  t,
}: {
  guardTargetName: string;
  onFlipBack: () => void;
  t: GameThemeTokens;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col items-center justify-center">
        <div className="p-6 text-center w-full flex flex-col items-center justify-center flex-1 relative overflow-hidden">
          {/* Subtle shield glow background */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{ opacity: [0.03, 0.08, 0.03] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(59,130,246,0.2), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Shield + Sword emojis with gentle animation */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex items-center gap-2"
            >
              <motion.span
                className="text-5xl block"
                animate={{ rotate: [-3, 3, -3] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {"\uD83D\uDEE1\uFE0F"}
              </motion.span>
              <motion.span
                className="text-4xl block"
                animate={{ rotate: [3, -3, 3] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.3,
                }}
              >
                {"\u2694\uFE0F"}
              </motion.span>
            </motion.div>

            <h2
              style={{
                fontFamily: '"Cinzel", serif',
                color: "#60a5fa",
                fontSize: "1.1rem",
                marginTop: "1rem",
              }}
            >
              Vous gardez la porte
            </h2>

            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.2)",
              }}
            >
              <span style={{ fontSize: "0.85rem" }}>
                {"\uD83C\uDFE0"}
              </span>
              <span
                style={{
                  fontFamily: '"Cinzel", serif',
                  color: "#93c5fd",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {guardTargetName}
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                color: t.textMuted,
                fontSize: "0.65rem",
                marginTop: "0.75rem",
                lineHeight: 1.6,
                maxWidth: "16rem",
              }}
            >
              Personne ne passera tant que vous veillez.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{
                color: `${t.textMuted}99`,
                fontSize: "0.55rem",
                marginTop: "0.75rem",
                fontStyle: "italic",
              }}
            >
              Fermez les yeux {"\u2014"} votre protection est
              active.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Sticky bottom button */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{
          background: `linear-gradient(to top, ${t.pageBg}, ${t.pageBg}ee 70%, transparent)`,
        }}
      >
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onFlipBack}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: "1px solid rgba(59,130,246,0.15)",
            color: "#93c5fd",
            fontFamily: '"Cinzel", serif',
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
          }}
        >
          <RotateCcw size={13} />
          Retourner la carte
        </motion.button>
      </div>
    </div>
  );
}

/* ---- Empoisonneur Sleeping Panel (back of card for empoisonneur who has acted) ---- */
export function EmpoisonneurSleepingPanel({
  targetName,
  onFlipBack,
  t,
}: {
  targetName: string;
  onFlipBack: () => void;
  t: GameThemeTokens;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col items-center justify-center">
        <div className="p-6 text-center w-full flex flex-col items-center justify-center flex-1 relative overflow-hidden">
          {/* Subtle poison glow background */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{ opacity: [0.03, 0.08, 0.03] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: "radial-gradient(ellipse at center, rgba(101,163,13,0.2), transparent 70%)" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-2"
            >
              <motion.span
                className="text-5xl block"
                animate={{ rotate: [-3, 3, -3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                🧪
              </motion.span>
              <motion.span
                className="text-4xl block"
                animate={{ rotate: [3, -3, 3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                💀
              </motion.span>
            </motion.div>

            <h2 style={{ fontFamily: '"Cinzel", serif', color: "#65a30d", fontSize: "1.1rem", marginTop: "1rem" }}>
              Le poison coule...
            </h2>

            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ background: "rgba(101,163,13,0.08)", border: "1px solid rgba(101,163,13,0.2)" }}
            >
              <span style={{ fontSize: "0.85rem" }}>🎯</span>
              <span style={{ fontFamily: '"Cinzel", serif', color: "#a3e635", fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.02em" }}>
                {targetName}
              </span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ color: t.textMuted, fontSize: "0.65rem", marginTop: "0.75rem", lineHeight: 1.6, maxWidth: "16rem" }}
            >
              Sa prochaine quete sera automatiquement sabotee.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{ color: `${t.textMuted}99`, fontSize: "0.55rem", marginTop: "0.75rem", fontStyle: "italic" }}
            >
              Fermez les yeux {"\u2014"} votre poison agira bientot.
            </motion.p>
          </div>
        </div>
      </div>

      {/* Sticky bottom button */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        style={{ background: `linear-gradient(to top, ${t.pageBg}, ${t.pageBg}ee 70%, transparent)` }}
      >
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={onFlipBack}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200"
          style={{
            background: `rgba(${t.overlayChannel}, 0.04)`,
            border: "1px solid rgba(101,163,13,0.15)",
            color: "#a3e635",
            fontFamily: '"Cinzel", serif',
            fontSize: "0.65rem",
            letterSpacing: "0.05em",
          }}
        >
          <RotateCcw size={13} />
          Retourner la carte
        </motion.button>
      </div>
    </div>
  );
}