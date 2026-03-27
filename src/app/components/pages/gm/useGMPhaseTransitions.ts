import { useCallback } from 'react';
import {
  type Player, type GameState, type GamePhase,
  type NightStep, type DayStep, type PhaseDeathRecord,
} from '../../../context/gameTypes';
import { computeEndAt } from '../../PhaseTimer';
import { sendPushNotifications } from '../../../context/useNotifications';
import { distributeQuestRound, distributeVillagerP2Clues } from './gmPureHelpers';
import { nextEventId } from '../../../context/gameContextConstants';

/* ================================================================
   useGMPhaseTransitions — hook that builds the four main GM
   phase-transition callbacks: leverLeSoleil, handleAdvanceTurn,
   handleStartNight1, handleResolveMaireElection.
   Extracted from useGMGameLogic.ts.
   ================================================================ */

export interface GMPhaseTransitionDeps {
  state: GameState;
  setPhase: (p: GamePhase) => void;
  setNightStep: (s: NightStep) => void;
  setDayStep: (s: DayStep) => void;
  addEvent: (msg: string) => void;
  eliminatePlayer: (id: number) => void;
  setWerewolfTarget: (id: number | null) => void;
  confirmWerewolfKill: () => void;
  nextTurn: () => void;
  updateState: (updater: (s: GameState) => GameState) => void;
  setRoleRevealDone: (v: boolean) => void;
  clearServerMidGameJoins?: () => void;
}

export function useGMPhaseTransitions(deps: GMPhaseTransitionDeps) {
  const {
    state, setPhase, setNightStep, setDayStep,
    addEvent, eliminatePlayer, setWerewolfTarget,
    confirmWerewolfKill, nextTurn, updateState, setRoleRevealDone,
    clearServerMidGameJoins,
  } = deps;

  /** Helper: start night phase timer if enabled */
  const startNightTimer = useCallback((s: GameState) => {
    const dur = (s.phaseTimerDuration > 0) ? (s.phaseTimerNightDuration || s.phaseTimerDuration) : 0;
    if (dur > 0) {
      updateState((prev) => ({ ...prev, phaseTimerEndAt: computeEndAt(dur) }));
    }
  }, [updateState]);

  /** Helper: send phase notification to all alive players */
  const notifyAlive = useCallback((title: string, body: string, tag: string) => {
    if (state.gameId) {
      const targets = state.players.filter((p) => p.alive).map((p) => p.shortCode);
      sendPushNotifications(state.gameId, targets, title, body, tag);
    }
  }, [state.gameId, state.players]);

  /** Helper: snapshot alive state */
  const snapshotAlive = useCallback(() => {
    updateState((s) => ({
      ...s,
      aliveAtPhaseStart: Object.fromEntries(s.players.map((p) => [p.id, p.alive])),
    }));
  }, [updateState]);

  /** Helper: auto-assign mayor successor if still pending at phase transition */
  const autoAssignMaireSuccessor = useCallback(() => {
    let chosenName: string | null = null;
    updateState((s) => {
      if (!s.maireSuccessionPending) return s;
      const vpSet = s.villagePresentIds ? new Set(s.villagePresentIds) : null;
      const eligible = s.players.filter((p) => p.alive && p.id !== s.maireSuccessionFromId && (!vpSet || vpSet.has(p.id)));
      if (eligible.length === 0) return { ...s, maireSuccessionPending: false, maireSuccessionFromId: null, maireSuccessionPhase: null };
      const chosen = eligible[Math.floor(Math.random() * eligible.length)];
      chosenName = chosen.name;
      return {
        ...s,
        maireId: chosen.id,
        maireSuccessionPending: false,
        maireSuccessionFromId: null,
        maireSuccessionPhase: null,
        events: [...s.events, {
          id: nextEventId(), turn: s.turn, phase: s.phase,
          message: `👑 ${chosen.name} a ete designe(e) Maire par le destin.`,
          timestamp: new Date().toISOString(),
        }],
      };
    });
    if (chosenName && state.gameId) {
      const targets = state.players.filter((p) => p.alive).map((p) => p.shortCode);
      sendPushNotifications(state.gameId, targets, 'Loup-Garou', `👑 ${chosenName} est le nouveau Maire !`, 'maire-succession');
    }
  }, [updateState, state.gameId, state.players]);

  // ── handleStartNight1 ──
  const handleStartNight1 = useCallback(() => {
    setRoleRevealDone(true);

    // Initialize villagePresentIds with players who already revealed their role —
    // they were on the app during the transition and are considered present.
    // Players who haven't revealed yet must still join via JoinVillageScreen.
    updateState((s) => {
      const alreadyPresent = Array.isArray(s.roleRevealedBy) ? s.roleRevealedBy : [];
      return { ...s, villagePresentIds: alreadyPresent };
    });

    // If maire election not done, transition to election phase instead of night
    if (!state.maireElectionDone) {
      setPhase('day');
      setDayStep('vote');
      addEvent('--- Election du Maire ---');
      addEvent('Le village vote pour elire son Maire. Le Maire aura un vote double et tranchera les egalites.');
      const durMaire = (state.phaseTimerDuration > 0)
        ? (state.phaseTimerMaireDuration || state.phaseTimerDayDuration || state.phaseTimerDuration) : 0;
      if (durMaire > 0) {
        updateState((s) => ({ ...s, phaseTimerEndAt: computeEndAt(durMaire) }));
      }
      notifyAlive('Loup-Garou', '\uD83C\uDFDB\uFE0F Election du Maire !', 'phase-maire');
      snapshotAlive();
      return;
    }

    setPhase('night');
    setNightStep('active');
    addEvent('--- Nuit 1 ---');
    addEvent("Le village s'endort... Tous les roles agissent simultanement.");
    startNightTimer(state);
    notifyAlive('Loup-Garou', '\uD83C\uDF19 La nuit est tomb\u00e9e.', 'phase-night');
    snapshotAlive();

    // Auto-distribute quests at phase start
    updateState((s) => {
      const afterQuests = distributeQuestRound(s).state;
      return s.villagerP2AutoDistrib !== false ? distributeVillagerP2Clues(afterQuests).state : afterQuests;
    });
  }, [
    state.maireElectionDone, state.phaseTimerDuration,
    state.phaseTimerDayDuration, state.phaseTimerNightDuration, state.phaseTimerMaireDuration,
    setRoleRevealDone, setPhase, setDayStep, setNightStep,
    addEvent, updateState, notifyAlive, snapshotAlive, startNightTimer, state,
  ]);

  // ── handleResolveMaireElection ──
  const handleResolveMaireElection = useCallback(() => {
    const electionVotes = state.votes || {};
    const voteCounts: Record<number, number> = {};
    Object.values(electionVotes).forEach((targetId: number) => {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    });
    let maxVotes = 0;
    let electedMaireId: number | null = null;
    Object.entries(voteCounts).forEach(([id, count]) => {
      if (count > maxVotes) { maxVotes = count; electedMaireId = parseInt(id); }
    });
    if (electedMaireId !== null) {
      const mairePlayer = state.players.find((p) => p.id === electedMaireId);
      addEvent(`\uD83C\uDFDB\uFE0F ${mairePlayer?.name || 'Un joueur'} a ete elu Maire avec ${maxVotes} vote(s) !`);
    } else {
      addEvent('\uD83C\uDFDB\uFE0F Aucun Maire n\'a ete elu.');
    }
    // Transition directly to Night 1 — the success screen is shown client-side as an overlay
    updateState((s) => {
      const durNight = (s.phaseTimerDuration > 0)
        ? (s.phaseTimerNightDuration || s.phaseTimerDuration) : 0;
      return {
        ...s,
        maireId: electedMaireId,
        maireElectionDone: true,
        maireSuccessScreen: true,
        maireVotes: {},
        votes: {},
        maireCandidates: [],
        maireCampaignMessages: {},
        phase: 'night' as GamePhase,
        nightStep: 'active' as NightStep,
        dayStep: 'discussion' as DayStep,
        werewolfVotes: {},
        werewolfVoteMessages: {},
        werewolfTarget: null,
        witchHealedThisNight: {},
        witchKillTargets: {},
        guardTargets: {},
        corbeauTargets: {},
        corbeauMessages: {},
        earlyVotes: {},
        foxTargets: {},
        foxResults: {},
        conciergeTargets: {},
        oracleUsed: {},
        oracleResults: {},
        empoisonneurTargets: {},
        phaseTimerEndAt: durNight > 0 ? computeEndAt(durNight) : null,
        aliveAtPhaseStart: Object.fromEntries(s.players.map((p) => [p.id, p.alive])),
        questCompletionsThisPhase: {},
      };
    });
    addEvent('--- Nuit 1 ---');
    addEvent("Le village s'endort... Tous les roles agissent simultanement.");
    notifyAlive('Loup-Garou', electedMaireId !== null
      ? `\uD83D\uDC51 ${state.players.find((p) => p.id === electedMaireId)?.name || 'Un joueur'} est le nouveau Maire !`
      : '\uD83C\uDFDB\uFE0F Aucun Maire n\'a ete elu.', 'phase-maire-result');

    // Auto-distribute quests at phase start
    updateState((s) => {
      const afterQuests = distributeQuestRound(s).state;
      return s.villagerP2AutoDistrib !== false ? distributeVillagerP2Clues(afterQuests).state : afterQuests;
    });
  }, [
    state.votes, state.players,
    addEvent, updateState,
    notifyAlive,
  ]);

  // ── leverLeSoleil ──
  const leverLeSoleil = useCallback(() => {
    // Capture whether maire succession was already pending BEFORE this function processes deaths.
    // Only auto-assign if it was pending from a previous phase — new successions triggered here
    // must show the modal first before being auto-resolved.
    const wasSuccessionPendingBefore = state.maireSuccessionPending;

    // 1. Resolve night actions (werewolf consensus)
    confirmWerewolfKill();

    // 2. Compute resolved werewolf targets inline (state not yet updated)
    let resolvedWolfTargets: number[] = [];
    const wolfVotes = state.werewolfVotes;
    if (Object.keys(wolfVotes).length > 0) {
      const voteCounts: Record<number, number> = {};
      Object.values(wolfVotes).forEach((targetId) => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });
      const maxKills = Math.max(1, state.wolfKillsPerNight || 1);
      resolvedWolfTargets = Object.entries(voteCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKills)
        .map(([id]) => parseInt(id));
      // Witch heal saves the primary (most-voted) target
      if (Object.keys(state.witchHealedThisNight || {}).length > 0 && resolvedWolfTargets.length > 0) {
        resolvedWolfTargets = resolvedWolfTargets.slice(1);
      }
    }

    // 2a. Filter out away players — they cannot be eliminated
    const vpSet = state.villagePresentIds ? new Set(state.villagePresentIds) : null;
    if (vpSet) {
      resolvedWolfTargets = resolvedWolfTargets.filter((id) => vpSet.has(id));
    }

    // 2b. Guard protection check
    const guardProtectedIds = new Set<number>(Object.values(state.guardTargets || {}));
    let guardBlocked = false;
    let nightDeathCount = 0;

    // 3. Apply wolf kills
    addEvent('La nuit se termine. Les actions sont resolues.');
    for (const resolvedWolfTarget of resolvedWolfTargets) {
      if (guardProtectedIds.has(resolvedWolfTarget)) {
        if (!guardBlocked) {
          guardBlocked = true;
          addEvent('Quelque chose a interfere pendant la nuit.');
        }
      } else {
        eliminatePlayer(resolvedWolfTarget);
        nightDeathCount++;
        const target = state.players.find((p) => p.id === resolvedWolfTarget);
        addEvent(`${target?.name || 'Un joueur'} a ete devore par les loups cette nuit.`);
      }
    }

    // Apply ALL witch kill targets
    const witchKillTargetIds = new Set<number>(Object.values(state.witchKillTargets || {}));
    // Filter out away players from witch kills
    if (vpSet) {
      for (const id of witchKillTargetIds) {
        if (!vpSet.has(id)) witchKillTargetIds.delete(id);
      }
    }
    for (const witchKillTargetId of witchKillTargetIds) {
      if (guardProtectedIds.has(witchKillTargetId)) {
        if (!guardBlocked) {
          addEvent('Quelque chose a interfere pendant la nuit.');
          guardBlocked = true;
        }
      } else {
        eliminatePlayer(witchKillTargetId);
        nightDeathCount++;
        const target = state.players.find((p) => p.id === witchKillTargetId);
        addEvent(`${target?.name || 'Un joueur'} a ete empoisonne cette nuit.`);
      }
    }

    // 3c. Wolf inactivity: track wolves who didn't vote, kill at 2 consecutive misses
    {
      const wolfVotesThisNight = state.werewolfVotes || {};
      const vpSet = state.villagePresentIds ? new Set(state.villagePresentIds) : null;
      const aliveWolves = state.players.filter((p) => p.alive && p.role === 'loup-garou' && (!vpSet || vpSet.has(p.id)));
      const missed = state.wolfMissedVotes || {};
      const threshold = state.wolfInactivityThreshold ?? 2;
      if (threshold > 0) {
        for (const wolf of aliveWolves) {
          if (wolfVotesThisNight[wolf.id] === undefined) {
            const newCount = (missed[wolf.id] || 0) + 1;
            if (newCount >= threshold) {
              eliminatePlayer(wolf.id);
              addEvent(`🩸 ${wolf.name} — Devore par les siens`);
            }
          }
        }
      }
    }

    updateState((s) => {
      const wolfVotesThisNight = s.werewolfVotes || {};
      const vpSet = s.villagePresentIds ? new Set(s.villagePresentIds) : null;
      const aliveWolves = s.players.filter((p) => p.role === 'loup-garou' && (!vpSet || vpSet.has(p.id)));
      const missed: Record<number, number> = { ...(s.wolfMissedVotes || {}) };
      const threshold = s.wolfInactivityThreshold ?? 2;

      if (threshold > 0) {
        for (const wolf of aliveWolves) {
          if (!wolf.alive) continue; // skip already dead wolves
          if (wolfVotesThisNight[wolf.id] !== undefined) {
            missed[wolf.id] = 0;
          } else {
            missed[wolf.id] = (missed[wolf.id] || 0) + 1;
            if (missed[wolf.id] >= threshold) {
              missed[wolf.id] = 0; // reset after kill
            }
          }
        }
      }

      return { ...s, wolfMissedVotes: missed };
    });

    // 4. Transition to day + vote
    setNightStep('done');
    setPhase('day');
    setDayStep('vote');
    addEvent(`--- Jour ${state.turn} ---`);
    addEvent('Le village se reveille. Le vote commence !');
    setWerewolfTarget(null);
    updateState((s) => ({
      ...s,
      seerTargets: {},
      seerResults: {},
      corbeauLastTargets: { ...(s.corbeauTargets || {}) },
      corbeauTargets: {},
      corbeauMessages: {},
      oracleUsed: {},
      oracleResults: {},
      questCompletionsThisPhase: {},
      // Apply empoisonneur targets: mark victims as poisoned, then clear night targets
      poisonedPlayers: {
        ...(s.poisonedPlayers || {}),
        ...Object.fromEntries(
          Object.values(s.empoisonneurTargets || {})
            .filter((pid) => s.players.find((p) => p.id === pid)?.alive)
            .map((pid) => [pid, true])
        ),
      },
      empoisonneurTargets: {},
    }));

    // Apply early votes as real votes, then clear them
    updateState((s) => {
      const ev = s.earlyVotes || {};
      if (Object.keys(ev).length === 0) return s;
      const aliveIds = new Set(s.players.filter((p) => p.alive).map((p) => p.id));
      const appliedVotes: Record<number, number> = { ...s.votes };
      const lastWillUsed = s.lastWillUsed ?? {};
      for (const [voterId, targetId] of Object.entries(ev)) {
        const vid = Number(voterId);
        // Only apply if: voter is alive (regular early vote) OR voter used dernière volonté
        // Discard early votes from players who voted while alive but died during the night
        if (!aliveIds.has(vid) && !lastWillUsed[vid]) continue;
        // Target must still be alive
        if (aliveIds.has(targetId)) {
          appliedVotes[vid] = targetId;
        }
      }
      return { ...s, votes: appliedVotes, earlyVotes: {} };
    });

    // Start phase timer for day
    const durDay = (state.phaseTimerDuration > 0)
      ? (state.phaseTimerDayDuration || state.phaseTimerDuration) : 0;
    if (durDay > 0) {
      updateState((s) => ({ ...s, phaseTimerEndAt: computeEndAt(durDay) }));
    } else {
      updateState((s) => ({ ...s, phaseTimerEndAt: null }));
    }

    // Push notifications: dawn + night victims
    const victimMsg = nightDeathCount === 0
      ? '\u2600\uFE0F Nuit paisible, personne n\'est mort.'
      : `\uD83D\uDC80 La nuit a \u00e9t\u00e9 cruelle... ${nightDeathCount} victime${nightDeathCount > 1 ? 's' : ''}.`;
    notifyAlive('Loup-Garou', victimMsg, 'phase-day');

    // Record dawn death announcement — MUST be last updateState
    updateState((s) => {
      const prevAlive = s.aliveAtPhaseStart || {};
      const hasPrev = Object.keys(prevAlive).length > 0;
      const deadPlayerIds = s.players
        .filter((p) => (hasPrev ? prevAlive[p.id] === true : true) && !p.alive)
        .map((p) => p.id);
      const pendingJoins = s.midGameJoinIds && s.midGameJoinIds.length > 0 ? s.midGameJoinIds : undefined;
      const record: PhaseDeathRecord = {
        phaseKey: `dawn-${s.turn}`,
        transition: 'dawn' as const,
        turn: s.turn,
        deadPlayerIds,
        ...(pendingJoins ? { newPlayerJoinIds: pendingJoins } : {}),
      };
      return {
        ...s,
        lastPhaseDeaths: record,
        phaseDeathHistory: [...(s.phaseDeathHistory || []), record],
        aliveAtPhaseStart: Object.fromEntries(s.players.map((p) => [p.id, p.alive])),
        midGameJoinIds: [],
      };
    });
    // Clear server's midGameJoinIds so stale values don't resurface via state sync
    clearServerMidGameJoins?.();

    // Auto-resolve maire succession ONLY if it was already pending before this phase transition
    if (wasSuccessionPendingBefore) {
      autoAssignMaireSuccessor();
    }

    // Auto-distribute quests at phase start (dawn → day)
    updateState((s) => {
      const afterQuests = distributeQuestRound(s).state;
      return s.villagerP2AutoDistrib !== false ? distributeVillagerP2Clues(afterQuests).state : afterQuests;
    });
  }, [
    state, confirmWerewolfKill, addEvent, eliminatePlayer,
    setNightStep, setPhase, setDayStep, setWerewolfTarget,
    updateState, notifyAlive, autoAssignMaireSuccessor,
  ]);

  // ── handleAdvanceTurn ──
  const handleAdvanceTurn = useCallback(() => {
    // Capture whether maire succession was already pending BEFORE this transition
    const wasSuccessionPendingBefore = state.maireSuccessionPending;

    const newTurn = state.turn + 1;
    nextTurn();
    setPhase('night');
    setNightStep('active');
    setDayStep('discussion');
    addEvent(`--- Nuit ${newTurn} ---`);
    addEvent("Le village s'endort... Tous les roles agissent simultanement.");

    // Reset quest completions counter for new phase
    updateState((s) => ({ ...s, questCompletionsThisPhase: {} }));

    // Start phase timer for night
    const durNight = (state.phaseTimerDuration > 0)
      ? (state.phaseTimerNightDuration || state.phaseTimerDuration) : 0;
    if (durNight > 0) {
      updateState((s) => ({ ...s, phaseTimerEndAt: computeEndAt(durNight) }));
    } else {
      updateState((s) => ({ ...s, phaseTimerEndAt: null }));
    }

    // Push notification
    notifyAlive('Loup-Garou', '\uD83C\uDF19 La nuit est tomb\u00e9e.', 'phase-night');

    // Record dusk death announcement
    const dayTurn = state.turn; // the day that just ended
    updateState((s) => {
      const prevAlive = s.aliveAtPhaseStart || {};
      const hasPrev = Object.keys(prevAlive).length > 0;
      const deadPlayerIds = s.players
        .filter((p) => (hasPrev ? prevAlive[p.id] === true : true) && !p.alive)
        .map((p) => p.id);
      const pendingJoins = s.midGameJoinIds && s.midGameJoinIds.length > 0 ? s.midGameJoinIds : undefined;
      const record: PhaseDeathRecord = {
        phaseKey: `dusk-${dayTurn}`,
        transition: 'dusk' as const,
        turn: dayTurn,
        deadPlayerIds,
        ...(pendingJoins ? { newPlayerJoinIds: pendingJoins } : {}),
      };
      return {
        ...s,
        lastPhaseDeaths: record,
        phaseDeathHistory: [...(s.phaseDeathHistory || []), record],
        aliveAtPhaseStart: Object.fromEntries(s.players.map((p) => [p.id, p.alive])),
        midGameJoinIds: [],
      };
    });
    // Clear server's midGameJoinIds so stale values don't resurface via state sync
    clearServerMidGameJoins?.();

    // Auto-resolve maire succession ONLY if it was already pending before this phase transition
    if (wasSuccessionPendingBefore) {
      autoAssignMaireSuccessor();
    }

    // Auto-distribute quests at phase start (dusk → night)
    updateState((s) => {
      const afterQuests = distributeQuestRound(s).state;
      return s.villagerP2AutoDistrib !== false ? distributeVillagerP2Clues(afterQuests).state : afterQuests;
    });
  }, [
    state.turn, state.phaseTimerDuration, state.phaseTimerNightDuration,
    state.maireSuccessionPending,
    nextTurn, setPhase, setNightStep, setDayStep, addEvent,
    updateState, notifyAlive, autoAssignMaireSuccessor,
  ]);

  return {
    leverLeSoleil,
    handleAdvanceTurn,
    handleStartNight1,
    handleResolveMaireElection,
  };
}