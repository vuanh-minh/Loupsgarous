import { useCallback } from 'react';
import { API_BASE, publicAnonKey } from './apiConfig';
import { useGame, type GameState } from './GameContext';
import { getRoleById } from '../data/roles';
import type { DynamicHint } from './gameTypes';

/**
 * Client-side dynamic hint reward: pick an unrevealed dynamic hint
 * matching the player's team, reveal it, create a standard hint +
 * playerHint for just that player. Returns the updated state pieces.
 */
function grantDynamicHintRewardClient(
  s: GameState,
  rewardPlayerId: number,
): { dynamicHints: DynamicHint[]; hints: GameState['hints']; playerHints: GameState['playerHints']; rewardHintId: number | null } {
  const dynamicHints = [...(s.dynamicHints ?? [])];
  const hints = [...(s.hints ?? [])];
  const playerHints = [...(s.playerHints ?? [])];
  const players = s.players;

  const player = players.find((p) => p.id === rewardPlayerId);
  if (!player?.role) return { dynamicHints, hints, playerHints, rewardHintId: null };

  const role = getRoleById(player.role);
  const playerTeam = role?.team === 'werewolf' ? 'werewolf' : 'village';

  // Pre-compute hint texts already owned by this player (for deduplication)
  const ownedHintIds = new Set(
    playerHints.filter((ph) => ph.playerId === rewardPlayerId).map((ph) => ph.hintId)
  );
  const ownedHintTexts = new Set(
    hints
      .filter((h) => ownedHintIds.has(h.id) && h.text)
      .map((h) => (h.text as string).trim().toLowerCase())
  );

  // Helper: compute recipientTeam for a target
  const getRecipientTeam = (targetRole: { team: string; id: string }): 'village' | 'wolves' | 'villageois' | null => {
    if (targetRole.team === 'werewolf') return 'village';
    if (targetRole.id === 'villageois') return 'villageois';
    if (targetRole.id !== 'cupidon') return 'wolves';
    return null;
  };

  // ── Village alternation: alternate between wolf hints ('village') and special role hints ('wolves') ──
  let orderedSearchTeams: string[][];
  if (playerTeam === 'village') {
    // Count hints already granted to this player by type
    let wolfHintCount = 0;
    let specialHintCount = 0;
    for (const dh of dynamicHints) {
      if (!dh.revealed || (dh as any).grantedToPlayerId !== rewardPlayerId) continue;
      const target = players.find((p) => p.id === dh.targetPlayerId);
      if (!target?.role) continue;
      const targetRole = getRoleById(target.role);
      if (!targetRole) continue;
      const team = getRecipientTeam(targetRole);
      if (team === 'village') wolfHintCount++;
      else if (team === 'wolves') specialHintCount++;
    }
    const preferWolf = wolfHintCount <= specialHintCount;
    const preferred = preferWolf ? ['village'] : ['wolves'];
    const secondary = preferWolf ? ['wolves'] : ['village'];
    orderedSearchTeams = [preferred, secondary, ['village', 'wolves'], ['village', 'wolves', 'villageois']];
  } else {
    orderedSearchTeams = [['wolves'], ['wolves', 'villageois']];
  }

  // ── Multi-pass candidate search with alternation ──
  let candidateIndices: number[] = [];
  for (const wantedTeams of orderedSearchTeams) {
    candidateIndices = [];
    for (let i = 0; i < dynamicHints.length; i++) {
      const dh = dynamicHints[i];
      if (dh.revealed) continue;
      const target = players.find((p) => p.id === dh.targetPlayerId);
      if (!target?.role || !target.alive) continue;
      const targetRole = getRoleById(target.role);
      if (!targetRole) continue;
      const recipientTeam = getRecipientTeam(targetRole);
      if (recipientTeam === null || !wantedTeams.includes(recipientTeam)) continue;
      // Deduplication: skip if resolved text matches a hint the player already owns
      const resolvedCandidate = dh.text.replace(/\{role\}/gi, getRoleById(target.role)?.name ?? target.role);
      if (ownedHintTexts.has(resolvedCandidate.trim().toLowerCase())) continue;
      candidateIndices.push(i);
    }
    if (candidateIndices.length > 0) break;
  }

  if (candidateIndices.length === 0) return { dynamicHints, hints, playerHints, rewardHintId: null };

  const pickedIdx = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
  const picked = { ...dynamicHints[pickedIdx], revealed: true, revealedAt: new Date().toISOString() };
  dynamicHints[pickedIdx] = picked;

  const target = players.find((p) => p.id === picked.targetPlayerId);
  const resolvedText = target ? picked.text.replace(/\{role\}/gi, getRoleById(target.role)?.name ?? target.role) : picked.text;

  const maxHintId = hints.length > 0 ? Math.max(...hints.map((h) => h.id)) : 0;
  const newHintId = maxHintId + 1;
  hints.push({ id: newHintId, text: resolvedText, createdAt: new Date().toISOString() });
  playerHints.push({ hintId: newHintId, playerId: rewardPlayerId, sentAt: new Date().toISOString(), revealed: false });

  return { dynamicHints, hints, playerHints, rewardHintId: newHintId };
}

// ── Offline action queue: retry failed actions automatically ──
interface QueuedAction {
  endpoint: string;
  body: Record<string, any>;
  retries: number;
  queuedAt: number;
}

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;
const MAX_QUEUE_AGE_MS = 5 * 60 * 1000; // 5 minutes max age

let _actionQueue: QueuedAction[] = [];
let _retryTimerActive = false;

function enqueueAction(endpoint: string, body: Record<string, any>) {
  _actionQueue.push({ endpoint, body, retries: 0, queuedAt: Date.now() });
  if (!_retryTimerActive) {
    _retryTimerActive = true;
    scheduleRetry();
  }
}

function scheduleRetry() {
  setTimeout(async () => {
    if (_actionQueue.length === 0) {
      _retryTimerActive = false;
      return;
    }
    // Process queue — try oldest first
    const remaining: QueuedAction[] = [];
    for (const item of _actionQueue) {
      // Drop items that are too old or have exceeded retries
      if (Date.now() - item.queuedAt > MAX_QUEUE_AGE_MS || item.retries >= MAX_RETRIES) {
        console.log(`[actionQueue] Dropping expired/maxed action: ${item.endpoint} (retries: ${item.retries})`);
        continue;
      }
      const success = await rawPostAction(item.endpoint, item.body);
      if (success) {
        console.log(`[actionQueue] Retried action succeeded: ${item.endpoint}`);
      } else {
        item.retries++;
        remaining.push(item);
      }
    }
    _actionQueue = remaining;
    if (_actionQueue.length > 0) {
      scheduleRetry();
    } else {
      _retryTimerActive = false;
    }
  }, RETRY_INTERVAL_MS);
}

/** Get the current queue length (for monitoring) */
export function getActionQueueLength(): number {
  return _actionQueue.length;
}

async function rawPostAction(endpoint: string, body: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/game/action/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log(`Action ${endpoint} error:`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`Network error for action ${endpoint}:`, err);
    return false;
  }
}

async function postAction(endpoint: string, body: Record<string, any>) {
  const success = await rawPostAction(endpoint, body);
  if (!success) {
    // Queue for retry
    enqueueAction(endpoint, body);
    console.log(`[actionQueue] Action ${endpoint} queued for retry (queue size: ${_actionQueue.length})`);
  }
  return success;
}

export function useServerActions() {
  const { state, localMode, updateState } = useGame();
  const gameId = state.gameId || undefined;

  // ── Helper: apply mutation locally and return true ──
  // Used ONLY for actions that don't have a direct local mutator called alongside
  const applyLocal = useCallback((mutator: (s: GameState) => GameState) => {
    try {
      updateState(mutator);
    } catch (err) {
      console.log('applyLocal error:', err);
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }, [updateState]);

  // ──────────────────────────────────────────────────────────────
  // Actions BELOW have a direct local mutator called alongside them
  // in PlayerPage (e.g. castVote, castWerewolfVote, setCupidLink…).
  // In local mode we just return true — the state is already updated
  // by the direct call. Applying again would cause double-mutations
  // (duplicated array pushes, toggled-back werewolf votes, etc.).
  // ────────────────────────────────────────────────────────────────

  const serverCastVote = useCallback((voterId: number, targetId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('vote', { voterId, targetId, gameId });
  }, [gameId, localMode]);

  const serverCancelVote = useCallback((voterId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('cancel-vote', { voterId, gameId });
  }, [gameId, localMode]);

  const serverCastWerewolfVote = useCallback((wolfId: number, targetId: number, message?: string) => {
    if (localMode) return Promise.resolve(true);
    return postAction('werewolf-vote', { wolfId, targetId, gameId, message: message || undefined });
  }, [gameId, localMode]);

  const serverSetSeerTarget = useCallback((actorId: number, playerId: number | null) => {
    if (localMode) return Promise.resolve(true);
    return postAction('seer-target', { actorId, playerId, gameId });
  }, [gameId, localMode]);

  const serverOracleUse = useCallback((actorId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('oracle-use', { actorId, gameId });
  }, [gameId, localMode]);

  const serverWitchHeal = useCallback((actorId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('witch-heal', { actorId, gameId });
  }, [gameId, localMode]);

  const serverWitchKill = useCallback((actorId: number, playerId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('witch-kill', { actorId, playerId, gameId });
  }, [gameId, localMode]);

  const serverCancelWitchKill = useCallback((actorId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('cancel-witch-kill', { actorId, gameId });
  }, [gameId, localMode]);

  const serverCupidLink = useCallback((actorId: number, id1: number, id2: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('cupid-link', { actorId, id1, id2, gameId });
  }, [gameId, localMode]);

  const serverSetGuardTarget = useCallback((actorId: number, playerId: number | null) => {
    if (localMode) return Promise.resolve(true);
    return postAction('guard-target', { actorId, playerId, gameId });
  }, [gameId, localMode]);

  const serverSetCorbeauTarget = useCallback((actorId: number, playerId: number, message: string, imageUrl?: string) => {
    if (localMode) return applyLocal((s) => {
      const targets = { ...s.corbeauTargets, [actorId]: playerId };
      const messages = { ...s.corbeauMessages };
      if (message) messages[actorId] = message;
      // Create hint (normally server-side only)
      const hintId = Date.now() + Math.floor(Math.random() * 10000);
      const hints = [...(s.hints || []), {
        id: hintId,
        text: message || "D'une source mystérieuse...",
        imageUrl,
        createdAt: new Date().toISOString(),
      }];
      const playerHints = [...(s.playerHints || []), {
        hintId,
        playerId,
        sentAt: new Date().toISOString(),
        revealed: false,
      }];
      return { ...s, corbeauTargets: targets, corbeauMessages: messages, hints, playerHints };
    });
    return postAction('corbeau-target', { actorId, playerId, message, imageUrl, gameId });
  }, [gameId, localMode, applyLocal]);

  const serverSetEmpoisonneurTarget = useCallback((actorId: number, playerId: number | null) => {
    if (localMode) return Promise.resolve(true);
    return postAction('empoisonneur-target', { actorId, playerId, gameId });
  }, [gameId, localMode]);

  const serverSetHunterPreTarget = useCallback((actorId: number, playerId: number | null) => {
    if (localMode) return Promise.resolve(true);
    return postAction('hunter-pre-target', { actorId, playerId, gameId });
  }, [gameId, localMode]);

  const serverConfirmHunterShot = useCallback((hunterId: number, targetId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('hunter-shot', { hunterId, targetId, gameId });
  }, [gameId, localMode]);

  // ── Early vote (vote anticipé) ──
  const serverSetEarlyVote = useCallback((voterId: number, targetId: number | null) => {
    if (localMode) return Promise.resolve(true);
    return postAction('early-vote', { voterId, targetId, gameId });
  }, [gameId, localMode]);

  // ── Last will used (dernière volonté) ──
  const serverSetLastWillUsed = useCallback((playerId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('last-will-used', { playerId, gameId });
  }, [gameId, localMode]);

  // ── Fox target (flaire 3 joueurs) ──
  const serverSetFoxTarget = useCallback((actorId: number, playerIds: number[]) => {
    if (localMode) return Promise.resolve(true);
    return postAction('fox-target', { actorId, playerIds, gameId });
  }, [gameId, localMode]);

  // ── Concierge target (observe 1 joueur) ──
  const serverSetConciergeTarget = useCallback((actorId: number, targetId: number) => {
    if (localMode) return Promise.resolve(true);
    return postAction('concierge-target', { actorId, targetId, gameId });
  }, [gameId, localMode]);

  // ── Answer quest task ──
  const serverAnswerQuestTask = useCallback((questId: number, taskId: number, answer: string, playerId: number) => {
    const mutator = (s: GameState): GameState => {
      const quests = (s.quests || []).map((q) => {
        if (q.id !== questId) return q;
        let tasks = q.tasks.map((t) => {
          if (t.id !== taskId) return t;
          return { ...t, playerAnswers: { ...t.playerAnswers, [playerId]: answer } };
        });
        // Check if ALL tasks are answered by THIS player
        const allAnswered = tasks.every((t) => {
          const pa = t.playerAnswers || {};
          return pa[playerId] !== undefined && pa[playerId] !== '';
        });
        const playerStatuses = { ...(q.playerStatuses || {}) };
        if (allAnswered) {
          // Evaluate each task for this player (mirrors server-side logic)
          tasks = tasks.map((t) => {
            const playerAnswer = (t.playerAnswers?.[playerId] || '').trim().toLowerCase();
            const correctRaw = (t.correctAnswer || '').trim();
            let isCorrect: boolean;
            if (t.inputType === 'player-select' && correctRaw.includes('|')) {
              const validAnswers = correctRaw.split('|').map((s) => s.trim().toLowerCase()).filter(Boolean);
              isCorrect = validAnswers.includes(playerAnswer);
            } else {
              isCorrect = playerAnswer === correctRaw.toLowerCase();
            }
            return { ...t, playerResults: { ...t.playerResults, [playerId]: isCorrect } };
          });
          // Check poison BEFORE determining status (mirrors server-side logic)
          const isPoisoned = !!(s.poisonedPlayers as Record<number, boolean> | undefined)?.[playerId];
          const allCorrect = !isPoisoned && tasks.every((t) => t.playerResults?.[playerId] === true);
          playerStatuses[playerId] = allCorrect ? 'success' : 'fail';
        }
        return { ...q, tasks, playerStatuses };
      });

      // If resolved as success, grant a dynamic hint reward
      const resolvedQuest = quests.find((q) => q.id === questId);
      if (resolvedQuest?.playerStatuses?.[playerId] === 'success') {
        const reward = grantDynamicHintRewardClient(s, playerId);
        return { ...s, quests, dynamicHints: reward.dynamicHints, hints: reward.hints, playerHints: reward.playerHints };
      }

      return { ...s, quests };
    };
    if (localMode) return applyLocal(mutator);
    // Optimistic update
    applyLocal(mutator);
    return postAction('quest-answer', { questId, taskId, answer, playerId, gameId });
  }, [gameId, localMode, applyLocal]);

  // ── Collaborative quest vote (success / fail) ──
  const serverCollabVote = useCallback((questId: number, playerId: number, vote: boolean) => {
    const mutator = (s: GameState): GameState => {
      let playerHints = [...(s.playerHints || [])];
      const quests = (s.quests || []).map((q) => {
        if (q.id !== questId) return q;
        const collaborativeVotes = { ...(q.collaborativeVotes || {}), [playerId]: vote };
        const playerStatuses = { ...(q.playerStatuses || {}), [playerId]: 'pending-resolution' as const };

        // Check if this player's group has all voted → auto-resolve group
        const groups: number[][] = q.collaborativeGroups || [];
        const playerGroup = groups.find((g) => g.includes(playerId));
        if (playerGroup && playerGroup.length > 0) {
          const allGroupVoted = playerGroup.every((pid) => collaborativeVotes[pid] !== undefined);
          if (allGroupVoted) {
            const hasFail = playerGroup.some((pid) => collaborativeVotes[pid] === false);
            // Check poison for any group member (mirrors server-side logic)
            const hasPoisoned = playerGroup.some((pid) => !!(s.poisonedPlayers as Record<number, boolean> | undefined)?.[pid]);
            const finalStatus = (hasFail || hasPoisoned) ? 'fail' : 'success';
            for (const pid of playerGroup) {
              playerStatuses[pid] = finalStatus;
            }
            // Grant dynamic hint rewards on success
            if (finalStatus === 'success') {
              for (const pid of playerGroup) {
                const reward = grantDynamicHintRewardClient(
                  { ...s, dynamicHints: [...(s.dynamicHints ?? [])], hints: [...(s.hints ?? [])], playerHints },
                  pid,
                );
                // Merge reward state back — dynamicHints/hints may have been mutated
                Object.assign(s, { dynamicHints: reward.dynamicHints, hints: reward.hints });
                playerHints = reward.playerHints;
              }
            }
          }
        }

        return { ...q, collaborativeVotes, playerStatuses };
      });
      return { ...s, quests, playerHints };
    };
    if (localMode) return applyLocal(mutator);
    applyLocal(mutator);
    return postAction('quest-collab-vote', { questId, playerId, vote, gameId });
  }, [gameId, localMode, applyLocal]);

  // ── Cancel collaborative quest vote ──
  const serverCancelCollabVote = useCallback((questId: number, playerId: number) => {
    const mutator = (s: GameState): GameState => {
      const quests = (s.quests || []).map((q) => {
        if (q.id !== questId) return q;
        const collaborativeVotes = { ...(q.collaborativeVotes || {}) };
        delete collaborativeVotes[playerId];
        const playerStatuses = { ...(q.playerStatuses || {}), [playerId]: 'active' as const };
        return { ...q, collaborativeVotes, playerStatuses };
      });
      return { ...s, quests };
    };
    if (localMode) return applyLocal(mutator);
    applyLocal(mutator);
    return postAction('quest-collab-cancel', { questId, playerId, gameId });
  }, [gameId, localMode, applyLocal]);

  // ────────────────────────────────────────────────────────────────
  // Actions BELOW do NOT have a direct local mutator in PlayerPage.
  // In local mode we must apply the mutation ourselves via applyLocal
  // so the state is actually updated.
  // ────────────────────────────────────────────────────────────────

  // ── Declare candidacy (Maire election) ──
  const serverDeclareCandidacy = useCallback((playerId: number, message?: string) => {
    if (localMode) return applyLocal((s) => {
      const candidates = [...(s.maireCandidates || [])];
      if (!candidates.includes(playerId)) candidates.push(playerId);
      const maireCampaignMessages = { ...(s.maireCampaignMessages || {}) };
      if (message !== undefined) maireCampaignMessages[playerId] = message.slice(0, 100);
      // Auto-vote for self when declaring candidacy
      const votes = { ...(s.votes || {}), [playerId]: playerId };
      const nominations = { ...(s.nominations || {}) };
      if (!(playerId in nominations)) nominations[playerId] = playerId;
      return { ...s, maireCandidates: candidates, maireCampaignMessages, votes, nominations };
    });
    // Optimistic update: reflect candidacy immediately in UI
    applyLocal((s) => {
      const candidates = [...(s.maireCandidates || [])];
      if (!candidates.includes(playerId)) candidates.push(playerId);
      const maireCampaignMessages = { ...(s.maireCampaignMessages || {}) };
      if (message !== undefined) maireCampaignMessages[playerId] = message.slice(0, 100);
      const votes = { ...(s.votes || {}), [playerId]: playerId };
      const nominations = { ...(s.nominations || {}) };
      if (!(playerId in nominations)) nominations[playerId] = playerId;
      return { ...s, maireCandidates: candidates, maireCampaignMessages, votes, nominations };
    });
    return postAction('declare-candidacy', { playerId, message, gameId });
  }, [gameId, localMode, applyLocal]);

  // ── Withdraw candidacy (Maire election) ──
  const serverWithdrawCandidacy = useCallback((playerId: number) => {
    if (localMode) return applyLocal((s) => {
      const candidates = (s.maireCandidates || []).filter((id) => id !== playerId);
      // Also remove votes targeting this player
      const votes: Record<number, number> = {};
      for (const [voterId, targetId] of Object.entries(s.votes || {})) {
        if (targetId !== playerId) votes[Number(voterId)] = targetId as number;
      }
      // Also remove campaign message
      const maireCampaignMessages = { ...(s.maireCampaignMessages || {}) };
      delete maireCampaignMessages[playerId];
      return { ...s, maireCandidates: candidates, votes, maireCampaignMessages };
    });
    // Optimistic update: reflect withdrawal immediately in UI
    applyLocal((s) => {
      const candidates = (s.maireCandidates || []).filter((id) => id !== playerId);
      const votes: Record<number, number> = {};
      for (const [voterId, targetId] of Object.entries(s.votes || {})) {
        if (targetId !== playerId) votes[Number(voterId)] = targetId as number;
      }
      const maireCampaignMessages = { ...(s.maireCampaignMessages || {}) };
      delete maireCampaignMessages[playerId];
      return { ...s, maireCandidates: candidates, votes, maireCampaignMessages };
    });
    return postAction('withdraw-candidacy', { playerId, gameId });
  }, [gameId, localMode, applyLocal]);

  // ── Mark role as revealed (discovery phase) ──
  const serverMarkRoleRevealed = useCallback((playerId: number) => {
    // Always apply optimistic local update (both local and server mode)
    updateState((s) => {
      const existing = Array.isArray(s.roleRevealedBy) ? [...s.roleRevealedBy] : [];
      if (!existing.includes(playerId)) existing.push(playerId);
      return { ...s, roleRevealedBy: existing };
    });
    if (localMode) return Promise.resolve(true);
    return postAction('role-revealed', { playerId, gameId });
  }, [gameId, localMode, updateState]);

  // ── Reveal a hint (Corbeau) ──
  const serverRevealHint = useCallback((playerId: number, hintId: number) => {
    if (localMode) return applyLocal((s) => {
      const playerHints = [...(s.playerHints || [])];
      const idx = playerHints.findIndex((ph: any) => ph.hintId === hintId && ph.playerId === playerId);
      if (idx !== -1 && !playerHints[idx].revealed) {
        playerHints[idx] = { ...playerHints[idx], revealed: true, revealedAt: new Date().toISOString() };
      }
      return { ...s, playerHints };
    });
    return postAction('reveal-hint', { playerId, hintId, gameId });
  }, [gameId, localMode, applyLocal]);

  // ── Join village (away player becomes present) ──
  const serverJoinVillage = useCallback((playerId: number) => {
    if (localMode) return applyLocal((s) => {
      const existing = Array.isArray(s.villagePresentIds) ? [...s.villagePresentIds] : s.players.map(p => p.id);
      if (!existing.includes(playerId)) existing.push(playerId);
      const joinIds = Array.isArray(s.midGameJoinIds) ? [...s.midGameJoinIds] : [];
      if (!joinIds.includes(playerId)) joinIds.push(playerId);
      return { ...s, villagePresentIds: existing, midGameJoinIds: joinIds };
    });
    return postAction('join-village', { playerId, gameId });
  }, [gameId, localMode, applyLocal]);

  return {
    serverCastVote,
    serverCancelVote,
    serverCastWerewolfVote,
    serverSetSeerTarget,
    serverOracleUse,
    serverWitchHeal,
    serverWitchKill,
    serverCancelWitchKill,
    serverCupidLink,
    serverMarkRoleRevealed,
    serverSetGuardTarget,
    serverSetCorbeauTarget,
    serverSetEmpoisonneurTarget,
    serverRevealHint,
    serverDeclareCandidacy,
    serverWithdrawCandidacy,
    serverSetHunterPreTarget,
    serverConfirmHunterShot,
    serverSetEarlyVote,
    serverSetLastWillUsed,
    serverSetFoxTarget,
    serverSetConciergeTarget,
    serverAnswerQuestTask,
    serverCollabVote,
    serverCancelCollabVote,
    serverJoinVillage,
  };
}