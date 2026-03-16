/**
 * actionRoutes.tsx
 * Hono sub-app: all player action endpoints + timer auto-transition.
 */
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { resolveGameKey, gameTimerLockKey } from "./serverHelpers.tsx";
import { sendPushToPlayers } from "./push.tsx";

export const actionRoutes = new Hono();

// ── Per-game action lock with optimistic versioning ──
const LOCK_TTL = 4000;
const MAX_LOCK_RETRIES = 8;
const RETRY_BASE = 25;

function actionLockKey(gameKey: string) { return `action-lock:${gameKey}`; }

/**
 * Wraps a read-modify-write operation with a KV-based per-game lock
 * and optimistic version checking. Each game state carries a `_kvVersion`
 * counter that is incremented on every write. If the version changes
 * between read and write (another request snuck in), we retry.
 *
 * Returns null if game state not found, otherwise { state, result }.
 */
async function withGameLock(
  gameKey: string,
  mutate: (state: any) => any,
): Promise<{ state: any; result: any } | null> {
  const lk = actionLockKey(gameKey);
  for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
    const lock: any = await kv.get(lk);
    if (lock && typeof lock === 'object' && lock.ts && Date.now() - lock.ts < LOCK_TTL) {
      // Jitter: 25-105ms base + 20ms per attempt
      await new Promise(r => setTimeout(r, RETRY_BASE + Math.random() * 80 + attempt * 20));
      continue;
    }
    // Acquire lock with unique owner for safer release
    const lockOwner = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await kv.set(lk, { ts: Date.now(), owner: lockOwner });
    try {
      const state = await kv.get(gameKey);
      if (!state) return null;

      // Read the current version
      const readVersion = state._kvVersion || 0;

      const result = mutate(state);

      // Optimistic check: re-read version to detect concurrent writes
      const freshState = await kv.get(gameKey);
      const freshVersion = freshState?._kvVersion || 0;
      if (freshVersion !== readVersion) {
        // Concurrent write detected — retry with fresh state
        console.log(`withGameLock: optimistic conflict for ${gameKey} (v${readVersion} != v${freshVersion}), retrying...`);
        continue;
      }

      // Increment version and write
      state._kvVersion = readVersion + 1;
      await kv.set(gameKey, state);
      return { state, result };
    } finally {
      // Only release if we still own the lock
      try {
        const currentLock: any = await kv.get(lk);
        if (currentLock?.owner === lockOwner) {
          await kv.del(lk);
        }
      } catch { /* best-effort release */ }
    }
  }
  // Fallback: proceed without lock (last resort)
  console.log(`withGameLock: max retries exceeded for ${gameKey}, proceeding unlocked`);
  const state = await kv.get(gameKey);
  if (!state) return null;
  const result = mutate(state);
  state._kvVersion = (state._kvVersion || 0) + 1;
  await kv.set(gameKey, state);
  return { state, result };
}

// ── Village vote ──
actionRoutes.post("/make-server-2c00868b/game/action/vote", async (c) => {
  try {
    const body = await c.req.json();
    const { voterId, targetId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const isMaireElection = state.phase === 'day' && state.dayStep === 'vote' && !state.maireElectionDone && state.turn === 1 && state.roleRevealDone;
      if (isMaireElection && state.maireCandidates && state.maireCandidates.length > 0) {
        if (!state.maireCandidates.includes(targetId)) {
          return { error: "Ce joueur n'est pas candidat" };
        }
      }
      state.votes = { ...state.votes, [voterId]: targetId };
      if (!state.nominations) state.nominations = {};
      if (!(targetId in state.nominations)) {
        state.nominations[targetId] = voterId;
      }
      return null;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    if (res.result?.error) return c.json({ error: res.result.error }, 400);
    return c.json({ success: true });
  } catch (err) {
    console.log("Vote action error:", err);
    return c.json({ error: `Erreur vote: ${err}` }, 500);
  }
});

// ── Cancel village vote ──
actionRoutes.post("/make-server-2c00868b/game/action/cancel-vote", async (c) => {
  try {
    const body = await c.req.json();
    const { voterId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const votes = { ...state.votes };
      delete votes[voterId];
      state.votes = votes;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Cancel vote action error:", err);
    return c.json({ error: `Erreur annulation vote: ${err}` }, 500);
  }
});

// ── Declare candidacy for Maire ──
actionRoutes.post("/make-server-2c00868b/game/action/declare-candidacy", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId, message } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const candidates = state.maireCandidates || [];
      if (!candidates.includes(playerId)) {
        state.maireCandidates = [...candidates, playerId];
      }
      if (message !== undefined) {
        if (!state.maireCampaignMessages) state.maireCampaignMessages = {};
        state.maireCampaignMessages[playerId] = String(message).slice(0, 100);
      }
      if (!state.votes) state.votes = {};
      state.votes[playerId] = playerId;
      if (!state.nominations) state.nominations = {};
      if (!(playerId in state.nominations)) {
        state.nominations[playerId] = playerId;
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Declare candidacy error:", err);
    return c.json({ error: `Erreur candidature: ${err}` }, 500);
  }
});

// ── Withdraw candidacy ──
actionRoutes.post("/make-server-2c00868b/game/action/withdraw-candidacy", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      state.maireCandidates = (state.maireCandidates || []).filter((id: number) => id !== playerId);
      if (state.maireCampaignMessages) {
        delete state.maireCampaignMessages[playerId];
      }
      if (state.votes) {
        const updatedVotes: Record<string, number> = {};
        for (const [voterId, targetId] of Object.entries(state.votes)) {
          if ((targetId as number) !== playerId) {
            updatedVotes[voterId] = targetId as number;
          }
        }
        state.votes = updatedVotes;
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Withdraw candidacy error:", err);
    return c.json({ error: `Erreur retrait candidature: ${err}` }, 500);
  }
});

// ── Werewolf vote ──
actionRoutes.post("/make-server-2c00868b/game/action/werewolf-vote", async (c) => {
  try {
    const body = await c.req.json();
    const { wolfId, targetId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (state.werewolfVotes && state.werewolfVotes[wolfId] === targetId) {
        const votes = { ...state.werewolfVotes };
        delete votes[wolfId];
        state.werewolfVotes = votes;
      } else {
        state.werewolfVotes = { ...state.werewolfVotes, [wolfId]: targetId };
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Werewolf vote action error:", err);
    return c.json({ error: `Erreur vote loup: ${err}` }, 500);
  }
});

// ── Seer target ──
actionRoutes.post("/make-server-2c00868b/game/action/seer-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.seerTargets) state.seerTargets = {};
      if (!state.seerResults) state.seerResults = {};

      if (playerId === null) {
        delete state.seerTargets[actorId];
        delete state.seerResults[actorId];
      } else {
        const target = state.players?.find((p: any) => p.id === playerId);
        state.seerTargets[actorId] = playerId;
        if (target) {
          state.seerResults[actorId] = { id: target.role };
        }
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Seer target action error:", err);
    return c.json({ error: `Erreur voyante: ${err}` }, 500);
  }
});

// ── Guard target ──
actionRoutes.post("/make-server-2c00868b/game/action/guard-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.guardTargets) state.guardTargets = {};
      if (playerId != null) {
        state.guardTargets[actorId] = playerId;
      } else {
        delete state.guardTargets[actorId];
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Guard target action error:", err);
    return c.json({ error: `Erreur garde: ${err}` }, 500);
  }
});

// ── Hunter pre-target ──
actionRoutes.post("/make-server-2c00868b/game/action/hunter-pre-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.hunterPreTargets) state.hunterPreTargets = {};
      if (playerId != null) {
        state.hunterPreTargets[actorId] = playerId;
      } else {
        delete state.hunterPreTargets[actorId];
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Hunter pre-target action error:", err);
    return c.json({ error: `Erreur chasseur: ${err}` }, 500);
  }
});

// ── Fox target ──
actionRoutes.post("/make-server-2c00868b/game/action/fox-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerIds } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.foxTargets) state.foxTargets = {};
      if (!state.foxResults) state.foxResults = {};

      const ids = Array.isArray(playerIds) ? playerIds : [];
      state.foxTargets[actorId] = ids;

      const hasWolf = ids.some((pid: number) => {
        const p = (state.players || []).find((pl: any) => pl.id === pid);
        return p?.role === 'loup-garou';
      });
      state.foxResults[actorId] = hasWolf;

      return { foxResult: hasWolf };
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true, foxResult: res.result?.foxResult });
  } catch (err) {
    console.log("Fox target action error:", err);
    return c.json({ error: `Erreur renard: ${err}` }, 500);
  }
});

// ── Concierge target ──
actionRoutes.post("/make-server-2c00868b/game/action/concierge-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, targetId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.conciergeTargets) state.conciergeTargets = {};
      state.conciergeTargets[actorId] = targetId;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Concierge target action error:", err);
    return c.json({ error: `Erreur concierge: ${err}` }, 500);
  }
});

// ── Corbeau target ──
actionRoutes.post("/make-server-2c00868b/game/action/corbeau-target", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerId, message } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.corbeauTargets) state.corbeauTargets = {};
      if (!state.corbeauMessages) state.corbeauMessages = {};
      if (!state.corbeauLastTargets) state.corbeauLastTargets = {};
      if (!state.hints) state.hints = [];
      if (!state.playerHints) state.playerHints = [];

      state.corbeauTargets[actorId] = playerId;
      if (message) state.corbeauMessages[actorId] = message;

      const hintId = Date.now() + Math.floor(Math.random() * 10000);
      state.hints.push({
        id: hintId,
        text: message || "D'une source mysterieuse...",
        createdAt: new Date().toISOString(),
      });
      state.playerHints.push({
        hintId,
        playerId,
        sentAt: new Date().toISOString(),
        revealed: false,
      });

      return { hintId };
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Corbeau target action error:", err);
    return c.json({ error: `Erreur corbeau: ${err}` }, 500);
  }
});

// ── Witch heal ──
actionRoutes.post("/make-server-2c00868b/game/action/witch-heal", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.witchHealUsedBy) state.witchHealUsedBy = [];
      if (!state.witchHealUsedBy.includes(actorId)) {
        state.witchHealUsedBy.push(actorId);
      }
      state.werewolfTarget = null;
      if (!state.witchHealedThisNight || typeof state.witchHealedThisNight === 'boolean') state.witchHealedThisNight = {};
      state.witchHealedThisNight[actorId] = true;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Witch heal action error:", err);
    return c.json({ error: `Erreur sorciere guerison: ${err}` }, 500);
  }
});

// ── Witch kill ──
actionRoutes.post("/make-server-2c00868b/game/action/witch-kill", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.witchKillUsedBy) state.witchKillUsedBy = [];
      if (!state.witchKillTargets) state.witchKillTargets = {};
      if (!state.witchKillUsedBy.includes(actorId)) {
        state.witchKillUsedBy.push(actorId);
      }
      state.witchKillTargets[actorId] = playerId;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Witch kill action error:", err);
    return c.json({ error: `Erreur sorciere poison: ${err}` }, 500);
  }
});

// ── Cancel witch kill ──
actionRoutes.post("/make-server-2c00868b/game/action/cancel-witch-kill", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (state.witchKillUsedBy) {
        state.witchKillUsedBy = state.witchKillUsedBy.filter((id: number) => id !== actorId);
      }
      if (state.witchKillTargets) {
        delete state.witchKillTargets[actorId];
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Cancel witch kill action error:", err);
    return c.json({ error: `Erreur annulation poison: ${err}` }, 500);
  }
});

// ── Cupid link ──
actionRoutes.post("/make-server-2c00868b/game/action/cupid-link", async (c) => {
  try {
    const body = await c.req.json();
    const { actorId, id1, id2 } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.loverPairs) state.loverPairs = [];
      if (!state.cupidLinkedBy) state.cupidLinkedBy = [];
      state.loverPairs.push([id1, id2]);
      if (!state.cupidLinkedBy.includes(actorId)) {
        state.cupidLinkedBy.push(actorId);
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Cupid link action error:", err);
    return c.json({ error: `Erreur cupidon: ${err}` }, 500);
  }
});

// ── Role revealed ──
actionRoutes.post("/make-server-2c00868b/game/action/role-revealed", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const existing: number[] = Array.isArray(state.roleRevealedBy) ? state.roleRevealedBy : [];
      if (!existing.includes(playerId)) {
        state.roleRevealedBy = [...existing, playerId];
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Role revealed action error:", err);
    return c.json({ error: `Erreur role-revealed: ${err}` }, 500);
  }
});

// ── Reveal hint ──
actionRoutes.post("/make-server-2c00868b/game/action/reveal-hint", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId, hintId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const playerHints: any[] = Array.isArray(state.playerHints) ? state.playerHints : [];
      const idx = playerHints.findIndex(
        (ph: any) => ph.hintId === hintId && ph.playerId === playerId
      );
      if (idx !== -1 && !playerHints[idx].revealed) {
        playerHints[idx] = { ...playerHints[idx], revealed: true, revealedAt: new Date().toISOString() };
        state.playerHints = playerHints;
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Reveal hint action error:", err);
    return c.json({ error: `Erreur reveal-hint: ${err}` }, 500);
  }
});

// ── Join village (away player becomes present) ──
actionRoutes.post("/make-server-2c00868b/game/action/join-village", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const existing: number[] = Array.isArray(state.villagePresentIds)
        ? state.villagePresentIds
        : (state.players || []).map((p: any) => p.id);
      if (!existing.includes(playerId)) {
        state.villagePresentIds = [...existing, playerId];
        // Track as mid-game join so the next phase announcement shows it
        const joinIds: number[] = Array.isArray(state.midGameJoinIds) ? state.midGameJoinIds : [];
        if (!joinIds.includes(playerId)) {
          state.midGameJoinIds = [...joinIds, playerId];
        }
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Join village action error:", err);
    return c.json({ error: `Erreur join-village: ${err}` }, 500);
  }
});

// ── Early vote ──
actionRoutes.post("/make-server-2c00868b/game/action/early-vote", async (c) => {
  try {
    const body = await c.req.json();
    const { voterId, targetId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.earlyVotes) state.earlyVotes = {};
      if (targetId != null) {
        state.earlyVotes[voterId] = targetId;
      } else {
        delete state.earlyVotes[voterId];
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Early vote action error:", err);
    return c.json({ error: `Erreur vote anticipe: ${err}` }, 500);
  }
});

// ── Last will used ──
actionRoutes.post("/make-server-2c00868b/game/action/last-will-used", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.lastWillUsed) state.lastWillUsed = {};
      state.lastWillUsed[playerId] = true;
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.log("Last will used action error:", err);
    return c.json({ error: `Erreur derniere volonte: ${err}` }, 500);
  }
});

// ══════════════════════════════════════════════════════
// Timer auto-transition (any client can call)
// ══════════════════════════════════════════════════════
actionRoutes.post("/make-server-2c00868b/game/action/timer-transition", async (c) => {
  try {
    const body = await c.req.json();
    const key = await resolveGameKey(body);
    const state = await kv.get(key);
    if (!state) return c.json({ error: "Aucune partie en cours" }, 404);

    // Guard: timer must be set and expired
    if (!state.phaseTimerEndAt) {
      return c.json({ skipped: true, reason: "no timer" });
    }
    const remaining = new Date(state.phaseTimerEndAt).getTime() - Date.now();
    if (remaining > 0) {
      return c.json({ skipped: true, reason: "timer not expired" });
    }
    if (state.winner) {
      return c.json({ skipped: true, reason: "game over" });
    }

    // ── Distributed lock ──
    const gameId = body.gameId || '';
    const lockKey = gameTimerLockKey(gameId);
    const existingLock = await kv.get(lockKey);
    const now = Date.now();
    if (existingLock && existingLock.endAt === state.phaseTimerEndAt && (now - existingLock.lockedAt) < 15000) {
      console.log(`Timer transition: lock already held for endAt=${state.phaseTimerEndAt}, skipping`);
      const freshState = await kv.get(key);
      return c.json({ skipped: true, reason: "locked", gameState: freshState });
    }
    await kv.set(lockKey, { endAt: state.phaseTimerEndAt, lockedAt: now });

    // Helper: next event ID
    let maxEventId = 0;
    if (Array.isArray(state.events)) {
      for (const e of state.events) { if (e.id > maxEventId) maxEventId = e.id; }
    }
    const nextEid = () => ++maxEventId;
    const computeNewEndAt = (dur: number) => new Date(Date.now() + dur * 1000).toISOString();
    const addEvt = (msg: string, phase: string) => {
      if (!state.events) state.events = [];
      state.events.push({ id: nextEid(), turn: state.turn, phase, message: msg, timestamp: new Date().toISOString() });
    };

    if (state.phase === 'night') {
      // ═══ NIGHT → DAY ═══
      let resolvedWolfTargets: number[] = [];
      const wolfVotes = state.werewolfVotes || {};
      if (Object.keys(wolfVotes).length > 0) {
        const voteCounts: Record<number, number> = {};
        Object.values(wolfVotes).forEach((targetId: any) => { voteCounts[targetId] = (voteCounts[targetId] || 0) + 1; });
        const maxKills = Math.max(1, state.wolfKillsPerNight || 1);
        resolvedWolfTargets = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, maxKills)
          .map(([id]) => parseInt(id));
        if (state.witchHealedThisNight && typeof state.witchHealedThisNight === 'object' && Object.keys(state.witchHealedThisNight).length > 0 && resolvedWolfTargets.length > 0) {
          resolvedWolfTargets = resolvedWolfTargets.slice(1);
        }
      }

      const guardProtectedIds = new Set<number>(Object.values(state.guardTargets || {}) as number[]);
      let guardBlocked = false;

      addEvt('La nuit se termine. Les actions sont resolues.', 'night');
      for (const resolvedWolfTarget of resolvedWolfTargets) {
        if (guardProtectedIds.has(resolvedWolfTarget)) {
          if (!guardBlocked) { guardBlocked = true; addEvt('🛡️ Quelque chose a interfere pendant la nuit.', 'night'); }
        } else {
          state.players = state.players.map((p: any) => p.id === resolvedWolfTarget ? { ...p, alive: false } : p);
          const target = state.players.find((p: any) => p.id === resolvedWolfTarget);
          addEvt(`${target?.name || 'Un joueur'} a ete devore par les loups cette nuit.`, 'night');
          if (state.loverPairs) {
            for (const [l1, l2] of state.loverPairs) {
              let loverId: number | null = null;
              if (resolvedWolfTarget === l1) loverId = l2;
              if (resolvedWolfTarget === l2) loverId = l1;
              if (loverId !== null) {
                const lover = state.players.find((p: any) => p.id === loverId);
                if (lover && lover.alive) {
                  state.players = state.players.map((p: any) => p.id === loverId ? { ...p, alive: false } : p);
                  addEvt(`💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`, 'night');
                  if (lover.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = loverId; }
                }
              }
            }
          }
          if (target?.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = resolvedWolfTarget; }
        }
      }

      // Witch kills
      const witchKillTargetIds = new Set<number>(Object.values(state.witchKillTargets || {}) as number[]);
      for (const wkId of witchKillTargetIds) {
        if (guardProtectedIds.has(wkId)) {
          if (!guardBlocked) { addEvt('🛡️ Quelque chose a interfere pendant la nuit.', 'night'); guardBlocked = true; }
        } else {
          state.players = state.players.map((p: any) => p.id === wkId ? { ...p, alive: false } : p);
          const target = state.players.find((p: any) => p.id === wkId);
          addEvt(`${target?.name || 'Un joueur'} a ete empoisonne cette nuit.`, 'night');
        }
      }

      if (Object.keys(state.corbeauTargets || {}).length > 0) {
        addEvt('🐦‍⬛ Un corbeau a envoye des indices corrompus cette nuit.', 'night');
      }

      // Wolf inactivity: track wolves who didn't vote, kill at threshold consecutive misses
      {
        const wolfVotesThisNight = state.werewolfVotes || {};
        const wolfVpSet = Array.isArray(state.villagePresentIds) ? new Set(state.villagePresentIds) : null;
        const aliveWolves = (state.players as any[]).filter((p: any) => p.alive && p.role === 'loup-garou' && (!wolfVpSet || wolfVpSet.has(p.id)));
        if (!state.wolfMissedVotes) state.wolfMissedVotes = {};
        const threshold = state.wolfInactivityThreshold ?? 2;
        if (threshold > 0) {
          for (const wolf of aliveWolves) {
            if (wolfVotesThisNight[wolf.id] !== undefined) {
              state.wolfMissedVotes[wolf.id] = 0;
            } else {
              state.wolfMissedVotes[wolf.id] = (state.wolfMissedVotes[wolf.id] || 0) + 1;
              if (state.wolfMissedVotes[wolf.id] >= threshold) {
                state.players = state.players.map((p: any) => p.id === wolf.id ? { ...p, alive: false } : p);
                addEvt(`🩸 ${wolf.name} — Devore par les siens`, 'night');
                state.wolfMissedVotes[wolf.id] = 0;
                // Handle lover pair death
                if (state.loverPairs) {
                  for (const [l1, l2] of state.loverPairs) {
                    let loverId: number | null = null;
                    if (wolf.id === l1) loverId = l2;
                    if (wolf.id === l2) loverId = l1;
                    if (loverId !== null) {
                      const lover = state.players.find((p: any) => p.id === loverId);
                      if (lover && lover.alive) {
                        state.players = state.players.map((p: any) => p.id === loverId ? { ...p, alive: false } : p);
                        addEvt(`💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`, 'night');
                        if (lover.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = loverId; }
                      }
                    }
                  }
                }
                if (wolf.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = wolf.id; }
              }
            }
          }
        }
      }

      // Transition to day
      state.nightStep = 'done';
      state.phase = 'day';
      state.dayStep = 'vote';
      addEvt(`--- Jour ${state.turn} ---`, 'day');
      addEvt('Le village se reveille. Le vote commence !', 'day');
      state.werewolfTarget = null;
      state.seerTargets = {};
      state.seerResults = {};
      state.corbeauLastTargets = { ...(state.corbeauTargets || {}) };
      state.corbeauTargets = {};
      state.corbeauMessages = {};
      state.foxTargets = {};
      state.foxResults = {};
      state.conciergeTargets = {};

      // Apply early votes
      const earlyVotes = state.earlyVotes || {};
      if (Object.keys(earlyVotes).length > 0) {
        const aliveIds = new Set(state.players.filter((p: any) => p.alive).map((p: any) => p.id));
        if (!state.votes) state.votes = {};
        for (const [voterId, targetId] of Object.entries(earlyVotes)) {
          const vid = Number(voterId);
          // Allow both alive voters (regular early vote) and dead voters (dernière volonté)
          if (aliveIds.has(targetId as number)) {
            state.votes[vid] = targetId;
          }
        }
      }
      state.earlyVotes = {};

      const durDay = (state.phaseTimerDuration > 0) ? (state.phaseTimerDayDuration || state.phaseTimerDuration) : 0;
      state.phaseTimerEndAt = durDay > 0 ? computeNewEndAt(durDay) : null;

      // Dawn death record
      const prevAlive = state.aliveAtPhaseStart || {};
      const hasPrev = Object.keys(prevAlive).length > 0;
      const dawnDeadIds = (state.players as any[])
        .filter((p: any) => (hasPrev ? prevAlive[p.id] === true : true) && !p.alive)
        .map((p: any) => p.id);
      const dawnRecord = { phaseKey: `dawn-${state.turn}`, transition: 'dawn', turn: state.turn, deadPlayerIds: dawnDeadIds };
      state.lastPhaseDeaths = dawnRecord;
      state.phaseDeathHistory = [...(state.phaseDeathHistory || []), dawnRecord];
      state.aliveAtPhaseStart = Object.fromEntries((state.players as any[]).map((p: any) => [p.id, p.alive]));
      state.questCompletionsThisPhase = {};
      distributeQuestsToAlivePlayers(state);

      console.log(`Timer auto-transition: night → day (turn ${state.turn})`);

    } else if (state.phase === 'day') {
      // ═══ DAY transition ═══

      {
        const isMaireElection = !state.maireElectionDone && state.turn === 1 && state.roleRevealDone;

        if (isMaireElection && (state.dayStep === 'vote')) {
          // Resolve Maire election
          const candidates: number[] = state.maireCandidates || [];
          const votes = state.votes || {};
          if (candidates.length > 0) {
            const voteCounts: Record<number, number> = {};
            for (const cId of candidates) voteCounts[cId] = 0;
            Object.values(votes).forEach((targetId: any) => {
              if (candidates.includes(targetId)) { voteCounts[targetId] = (voteCounts[targetId] || 0) + 1; }
            });
            let maxVotes = 0;
            const topCandidates: number[] = [];
            Object.entries(voteCounts).forEach(([id, count]) => {
              if (count > maxVotes) { maxVotes = count; topCandidates.length = 0; topCandidates.push(parseInt(id)); }
              else if (count === maxVotes) { topCandidates.push(parseInt(id)); }
            });
            const winnerId = topCandidates.length === 1 ? topCandidates[0] : topCandidates[Math.floor(Math.random() * topCandidates.length)];
            if (winnerId != null) {
              state.maireId = winnerId;
              const mairePlayer = state.players.find((p: any) => p.id === winnerId);
              addEvt(`🏛️ ${mairePlayer?.name || 'Un joueur'} est elu Maire du village !`, 'day');
            }
          } else {
            addEvt('🏛️ Aucun candidat ne s\'est presente. Pas de Maire pour le moment.', 'day');
          }
          state.maireElectionDone = true;
          state.maireSuccessScreen = true;
          state.votes = {};
          state.maireCandidates = [];
          state.maireCampaignMessages = {};
          // Transition directly to Night 1 — success screen is shown client-side as overlay
          state.phase = 'night';
          state.nightStep = 'active';
          state.dayStep = 'discussion';
          state.werewolfVotes = {};
          state.werewolfTarget = null;
          state.witchHealedThisNight = {};
          state.witchKillTargets = {};
          state.guardTargets = {};
          state.corbeauTargets = {};
          state.corbeauMessages = {};
          state.earlyVotes = {};
          state.foxTargets = {};
          state.foxResults = {};
          state.conciergeTargets = {};
          addEvt('--- Nuit 1 ---', 'night');
          addEvt("Le village s'endort... Tous les roles agissent simultanement.", 'night');
          const durNightMaire = (state.phaseTimerDuration > 0) ? (state.phaseTimerNightDuration || state.phaseTimerDuration) : 0;
          state.phaseTimerEndAt = durNightMaire > 0 ? computeNewEndAt(durNightMaire) : null;
          state.aliveAtPhaseStart = Object.fromEntries((state.players as any[]).map((p: any) => [p.id, p.alive]));
          state.questCompletionsThisPhase = {};
          distributeQuestsToAlivePlayers(state);
          console.log(`Timer auto-transition: maire election resolved → night 1 (turn ${state.turn})`);

        } else if (state.dayStep === 'vote' || state.dayStep === 'result') {
          // Resolve village vote then advance to night
          const vpSet = Array.isArray(state.villagePresentIds) ? new Set(state.villagePresentIds) : null;
          const alivePlayers = state.players.filter((p: any) => p.alive && (!vpSet || vpSet.has(p.id)));
          const aliveIds = alivePlayers.map((p: any) => p.id);
          const aliveIdSet = new Set(aliveIds);
          const abstainerIds = new Set(alivePlayers.filter((p: any) => !(p.id in (state.votes || {}))).map((p: any) => p.id));
          const updatedVotes: Record<number, number> = { ...(state.votes || {}) };
          for (const p of alivePlayers) {
            if (!(p.id in updatedVotes)) {
              const candidates = aliveIds.filter((id: number) => id !== p.id);
              if (candidates.length === 0) continue;
              const randomTarget = candidates[Math.floor(Math.random() * candidates.length)];
              updatedVotes[p.id] = randomTarget;
              const targetPlayer = state.players.find((pl: any) => pl.id === randomTarget);
              addEvt(`[Abstention] ${p.name} n'a pas vote → ${targetPlayer?.name || 'Joueur ' + randomTarget} (vote aleatoire)`, 'day');
            }
          }

          // ── Villager inactivity tracking ──
          const villagerThreshold = state.villagerInactivityThreshold ?? 2;
          if (!state.villagerMissedVotes) state.villagerMissedVotes = {};
          if (villagerThreshold > 0) {
            for (const p of alivePlayers) {
              if (abstainerIds.has(p.id)) {
                state.villagerMissedVotes[p.id] = (state.villagerMissedVotes[p.id] || 0) + 1;
                if (state.villagerMissedVotes[p.id] >= villagerThreshold) {
                  state.players = state.players.map((pl: any) => pl.id === p.id ? { ...pl, alive: false } : pl);
                  addEvt(`🚪 ${p.name} a fui le village\u2026`, 'day');
                  state.villagerMissedVotes[p.id] = 0;
                  aliveIdSet.delete(p.id);
                  // Handle lover pair death
                  if (state.loverPairs) {
                    for (const [l1, l2] of state.loverPairs) {
                      let loverId: number | null = null;
                      if (p.id === l1) loverId = l2;
                      if (p.id === l2) loverId = l1;
                      if (loverId !== null) {
                        const lover = state.players.find((pl: any) => pl.id === loverId);
                        if (lover && lover.alive) {
                          state.players = state.players.map((pl: any) => pl.id === loverId ? { ...pl, alive: false } : pl);
                          addEvt(`💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`, 'day');
                          aliveIdSet.delete(loverId!);
                          if (lover.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = loverId; }
                        }
                      }
                    }
                  }
                  if (p.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = p.id; }
                }
              } else {
                state.villagerMissedVotes[p.id] = 0;
              }
            }
          }

          // Count only alive players' votes (dernière volonté excluded from tally)
          const voteCounts: Record<number, number> = {};
          Object.entries(updatedVotes).forEach(([voterId, targetId]) => {
            if (!aliveIdSet.has(parseInt(voterId))) return; // skip dead players (dernière volonté + inactivity)
            const weight = (state.maireId !== null && parseInt(voterId) === state.maireId) ? 2 : 1;
            voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
          });
          let maxVotes = 0;
          const topCandidates: number[] = [];
          Object.entries(voteCounts).forEach(([id, count]) => {
            if (count > maxVotes) { maxVotes = count; topCandidates.length = 0; topCandidates.push(parseInt(id)); }
            else if (count === maxVotes) { topCandidates.push(parseInt(id)); }
          });
          let eliminated: number | null = null;
          if (topCandidates.length === 1) {
            eliminated = topCandidates[0];
          } else if (topCandidates.length > 1 && state.maireId !== null) {
            const maireChoice = updatedVotes[state.maireId];
            if (maireChoice !== undefined && topCandidates.includes(maireChoice)) { eliminated = maireChoice; }
            else { eliminated = topCandidates[0]; }
          } else if (topCandidates.length > 1) {
            eliminated = topCandidates[0];
          }

          if (eliminated !== null) {
            const target = state.players.find((p: any) => p.id === eliminated);
            if (target && target.alive) {
              state.players = state.players.map((p: any) => p.id === eliminated ? { ...p, alive: false, votesReceived: maxVotes } : p);
              addEvt(`Le vote est clos (temps ecoule). Decompte des voix...`, 'day');
              addEvt(`${target?.name || 'Un joueur'} a ete elimine par le village avec ${maxVotes} vote(s).`, 'day');

              if (state.loverPairs) {
                for (const [l1, l2] of state.loverPairs) {
                  let loverId: number | null = null;
                  if (eliminated === l1) loverId = l2;
                  if (eliminated === l2) loverId = l1;
                  if (loverId !== null) {
                    const lover = state.players.find((p: any) => p.id === loverId);
                    if (lover && lover.alive) {
                      state.players = state.players.map((p: any) => p.id === loverId ? { ...p, alive: false } : p);
                      addEvt(`💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`, 'day');
                      if (lover.role === 'chasseur') { state.hunterPending = true; state.hunterShooterId = loverId; }
                    }
                  }
                }
              }
              if (target?.role === 'chasseur' && target.alive) { state.hunterPending = true; state.hunterShooterId = eliminated; }
            } else {
              // Already dead from inactivity
              eliminated = null;
              addEvt('Le vote est clos (temps ecoule). Aucune elimination - egalite des votes.', 'day');
            }
          } else {
            addEvt('Le vote est clos (temps ecoule). Aucune elimination - egalite des votes.', 'day');
          }

          // Advance to next night
          const newTurn = state.turn + 1;
          state.turn = newTurn;
          state.phase = 'night';
          state.nightStep = 'active';
          state.dayStep = 'discussion';
          state.votes = {};
          state.werewolfVotes = {};
          state.werewolfTarget = null;
          state.witchHealedThisNight = {};
          state.witchKillTargets = {};
          state.guardTargets = {};
          state.corbeauTargets = {};
          state.corbeauMessages = {};
          state.earlyVotes = {};
          state.foxTargets = {};
          state.foxResults = {};
          state.conciergeTargets = {};
          addEvt(`--- Nuit ${newTurn} ---`, 'night');
          addEvt("Le village s'endort... Tous les roles agissent simultanement.", 'night');

          const durNight = (state.phaseTimerDuration > 0) ? (state.phaseTimerNightDuration || state.phaseTimerDuration) : 0;
          state.phaseTimerEndAt = durNight > 0 ? computeNewEndAt(durNight) : null;

          // Dusk death record
          const duskPrevAlive = state.aliveAtPhaseStart || {};
          const duskHasPrev = Object.keys(duskPrevAlive).length > 0;
          const duskDeadIds = (state.players as any[])
            .filter((p: any) => (duskHasPrev ? duskPrevAlive[p.id] === true : true) && !p.alive)
            .map((p: any) => p.id);
          const duskRecord = { phaseKey: `dusk-${newTurn - 1}`, transition: 'dusk', turn: newTurn - 1, deadPlayerIds: duskDeadIds };
          state.lastPhaseDeaths = duskRecord;
          state.phaseDeathHistory = [...(state.phaseDeathHistory || []), duskRecord];
          state.aliveAtPhaseStart = Object.fromEntries((state.players as any[]).map((p: any) => [p.id, p.alive]));
          state.questCompletionsThisPhase = {};
          distributeQuestsToAlivePlayers(state);

          console.log(`Timer auto-transition: day vote → night (turn ${newTurn})`);
        }
      }
    }

    await kv.set(key, state);
    return c.json({ success: true, gameState: state });
  } catch (err) {
    console.log("Timer transition error:", err);
    return c.json({ error: `Erreur timer-transition: ${err}` }, 500);
  }
});

// ── Dynamic Hint reward helpers (used by quest resolution) ──
const WOLF_ROLE_IDS = new Set(['loup-garou', 'corbeau']);
const NEUTRAL_ROLE_IDS = new Set(['cupidon']);
const ROLE_DISPLAY_NAMES: Record<string, { name: string; article: string }> = {
  'loup-garou': { name: 'Loup-Garou', article: 'le' },
  'corbeau': { name: 'Corbeau', article: 'le' },
  'voyante': { name: 'Voyante', article: 'la' },
  'sorciere': { name: 'Sorcière', article: 'la' },
  'chasseur': { name: 'Chasseur', article: 'le' },
  'cupidon': { name: 'Cupidon', article: 'le' },
  'garde': { name: 'Garde', article: 'le' },
  'villageois': { name: 'Villageois', article: 'le' },
  'renard': { name: 'Renard', article: 'le' },
  'concierge': { name: 'Concierge', article: 'le' },
  'petite-fille': { name: 'Petite Fille', article: 'la' },
};

function getPlayerTeam(roleId: string): 'werewolf' | 'village' {
  return WOLF_ROLE_IDS.has(roleId) ? 'werewolf' : 'village';
}

/** Which team should receive a hint about a given target player? */
function computeRecipientTeamServer(targetRoleId: string): 'village' | 'wolves' | 'villageois' | null {
  if (!targetRoleId) return null;
  if (WOLF_ROLE_IDS.has(targetRoleId)) return 'village'; // hint about a wolf → village receives
  if (NEUTRAL_ROLE_IDS.has(targetRoleId)) return null;   // no specific team
  if (targetRoleId === 'villageois') return 'villageois'; // hint about a simple villager → separate category
  return 'wolves'; // hint about a special role → wolves receive
}

function resolveHintTextServer(text: string, roleId: string): string {
  const entry = ROLE_DISPLAY_NAMES[roleId];
  const name = entry ? entry.name : roleId;
  const article = entry ? entry.article : 'le';
  return text.replace(/\{role\}/gi, (_match: string, offset: number) => {
    const cap = offset === 0
      ? article.charAt(0).toUpperCase() + article.slice(1)
      : article;
    return `${cap} ${name}`;
  });
}

/**
 * Grant a dynamic hint reward to a player after a successful quest.
 * Picks an unrevealed dynamic hint matching the player's team, reveals it,
 * creates a standard hint + playerHint for just that player.
 * Returns the reward hintId or null if no dynamic hint was available.
 */
function grantDynamicHintReward(state: any, playerId: number): number | null {
  const dynamicHints = state.dynamicHints || [];
  const players = state.players || [];
  const player = players.find((p: any) => p.id === playerId);
  if (!player || !player.role) return null;
  // Dead or away players should not receive hint rewards
  if (!player.alive) return null;
  const vpIds: number[] | undefined = state.villagePresentIds;
  const isPlayerAway = vpIds ? !vpIds.includes(playerId) : false;
  if (isPlayerAway) return null;

  const playerTeam = getPlayerTeam(player.role);
  // Village player → wants hints about wolves AND special village roles (recipientTeam 'village' + 'wolves')
  // Wolf player   → wants hints about special roles only (not villageois, not wolves, not cupidon)
  // Fallback: if no more special/wolf hints, distribute simple villager hints

  // Pre-compute revealed priorities per target player for priority gating
  const revealedPrioritiesByTarget = new Map<number, Set<number>>();
  for (const dh of dynamicHints) {
    if (dh.revealed) {
      if (!revealedPrioritiesByTarget.has(dh.targetPlayerId)) {
        revealedPrioritiesByTarget.set(dh.targetPlayerId, new Set());
      }
      revealedPrioritiesByTarget.get(dh.targetPlayerId)!.add(dh.priority ?? 1);
    }
  }

  // Pre-compute hints granted to this player (used for target-lock in each pass)
  const hintsGrantedToPlayer = dynamicHints.filter(
    (dh: any) => dh.revealed && dh.grantedToPlayerId === playerId
  );
  const grantedTargets = new Map<number, Set<number>>();
  for (const dh of hintsGrantedToPlayer) {
    if (!grantedTargets.has(dh.targetPlayerId)) {
      grantedTargets.set(dh.targetPlayerId, new Set());
    }
    grantedTargets.get(dh.targetPlayerId)!.add(dh.priority ?? 1);
  }

  // ── Village alternation: alternate between wolf hints ('village') and special role hints ('wolves') ──
  let orderedSearchTeams: string[][];
  if (playerTeam === 'village') {
    let wolfHintCount = 0;
    let specialHintCount = 0;
    for (const dh of hintsGrantedToPlayer) {
      const target = players.find((p: any) => p.id === dh.targetPlayerId);
      if (!target?.role) continue;
      const team = computeRecipientTeamServer(target.role);
      if (team === 'village') wolfHintCount++;
      else if (team === 'wolves') specialHintCount++;
    }
    // Prefer the type with fewer grants (wolf first if equal)
    const preferWolf = wolfHintCount <= specialHintCount;
    const preferred = preferWolf ? ['village'] : ['wolves'];
    const secondary = preferWolf ? ['wolves'] : ['village'];
    // Search order: preferred → secondary → both combined → add villageois fallback
    orderedSearchTeams = [preferred, secondary, ['village', 'wolves'], ['village', 'wolves', 'villageois']];
  } else {
    orderedSearchTeams = [['wolves'], ['wolves', 'villageois']];
  }

  // ── Multi-pass candidate search with alternation ──
  let candidates: any[] = [];
  for (const wantedRecipientTeams of orderedSearchTeams) {
    // ── Target-lock: once a player starts receiving hints about a target,
    //    they must complete the full P1→P2→P3 sequence before getting hints
    //    from another target. ──
    let lockedTargetId: number | null = null;
    for (const [targetId] of grantedTargets) {
      const targetPlayer = players.find((p: any) => p.id === targetId);
      if (!targetPlayer || !targetPlayer.role || !targetPlayer.alive) continue;
      // Skip away targets
      if (vpIds && !vpIds.includes(targetId)) continue;
      const team = computeRecipientTeamServer(targetPlayer.role);
      if (team === null || !wantedRecipientTeams.includes(team)) continue;
      const hasUnrevealed = dynamicHints.some(
        (dh: any) => !dh.revealed && dh.targetPlayerId === targetId
      );
      if (hasUnrevealed) {
        lockedTargetId = targetId;
        break;
      }
    }

    // Find unrevealed dynamic hints matching team AND respecting priority gating
    candidates = dynamicHints.filter((dh: any) => {
      if (dh.revealed) return false;
      const target = players.find((p: any) => p.id === dh.targetPlayerId);
      if (!target || !target.role || !target.alive) return false;
      // Skip away targets
      if (vpIds && !vpIds.includes(dh.targetPlayerId)) return false;
      const team = computeRecipientTeamServer(target.role);
      if (team === null || !wantedRecipientTeams.includes(team)) return false;
      // Priority gating: P2 requires revealed P1 on same target, P3 requires revealed P2
      const priority = dh.priority ?? 1;
      const revealedSet = revealedPrioritiesByTarget.get(dh.targetPlayerId);
      if (priority === 2 && !revealedSet?.has(1)) return false;
      if (priority === 3 && !revealedSet?.has(2)) return false;
      // Target-lock: if this player has an in-progress sequence, only allow that target
      if (lockedTargetId !== null && dh.targetPlayerId !== lockedTargetId) return false;
      return true;
    });

    if (candidates.length > 0) break; // Found candidates, no need for fallback
  }

  if (candidates.length === 0) return null;

  // Prefer lower priority hints first (P1 > P2 > P3) to enforce natural progression
  const minPriority = Math.min(...candidates.map((c: any) => c.priority ?? 1));
  const topCandidates = candidates.filter((c: any) => (c.priority ?? 1) === minPriority);
  const picked = topCandidates[Math.floor(Math.random() * topCandidates.length)];
  const target = players.find((p: any) => p.id === picked.targetPlayerId);
  const resolvedText = target ? resolveHintTextServer(picked.text, target.role) : picked.text;

  // Mark dynamic hint as revealed + record who received it (for target-lock tracking)
  picked.revealed = true;
  picked.revealedAt = new Date().toISOString();
  picked.grantedToPlayerId = playerId;

  // Create a standard hint
  const allHints = state.hints || [];
  const maxHintId = allHints.length > 0 ? Math.max(...allHints.map((h: any) => h.id)) : 0;
  const newHintId = maxHintId + 1;
  if (!state.hints) state.hints = [];
  state.hints.push({
    id: newHintId,
    text: resolvedText,
    ...(picked.imageUrl ? { imageUrl: picked.imageUrl } : {}),
    createdAt: new Date().toISOString(),
  });

  // Create playerHint for just this player
  if (!state.playerHints) state.playerHints = [];
  state.playerHints.push({
    hintId: newHintId,
    playerId,
    sentAt: new Date().toISOString(),
    revealed: false,
  });

  return newHintId;
}

// ── GM manually grants a dynamic hint to a player ──
actionRoutes.post("/make-server-2c00868b/game/action/grant-hint", async (c) => {
  try {
    const body = await c.req.json();
    const { playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      const hintId = grantDynamicHintReward(state, playerId);
      return { hintId };
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    if (res.hintId === null) {
      return c.json({ success: false, error: "Aucun indice disponible pour ce joueur" });
    }
    return c.json({ success: true, hintId: res.hintId });
  } catch (err) {
    console.log("Grant hint action error:", err);
    return c.json({ error: `Erreur grant-hint: ${err}` }, 500);
  }
});

/**
 * Auto-assign the next eligible quest to a player after they succeed one.
 * Picks the first unassigned quest by distribution order (ordered first, then random).
 * Returns the assigned quest ID or null.
 */
function autoAssignNextQuest(state: any, playerId: number): number | null {
  const quests: any[] = state.quests || [];
  const assignments: Record<number, number[]> = state.questAssignments || {};
  const myAssignedIds = assignments[playerId] || [];
  const player = (state.players || []).find((p: any) => p.id === playerId);
  if (!player) return null;

  const candidates = quests.filter((q: any) => {
    if (myAssignedIds.includes(q.id)) return false;
    if (q.distributionOrder === 'available') return false;
    if (q.targetTags && q.targetTags.length > 0) {
      const playerTags = (state.playerTags || {})[playerId] || [];
      if (!q.targetTags.some((tag: string) => playerTags.includes(tag))) return false;
    }
    if (!player.alive && (q.questType || 'individual') === 'collaborative') return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const ordered = candidates.filter((q: any) => typeof q.distributionOrder === 'number')
    .sort((a: any, b: any) => (a.distributionOrder as number) - (b.distributionOrder as number));
  const randomPool = candidates.filter((q: any) => q.distributionOrder === 'random' || q.distributionOrder === undefined);

  const picked = ordered.length > 0
    ? ordered[0]
    : randomPool.length > 0
      ? randomPool[Math.floor(Math.random() * randomPool.length)]
      : null;

  if (!picked) return null;

  if (!state.questAssignments) state.questAssignments = {};
  if (!state.questAssignments[playerId]) state.questAssignments[playerId] = [];
  state.questAssignments[playerId].push(picked.id);

  if ((picked.questType || 'individual') === 'collaborative') {
    if (!picked.collaborativeGroups) picked.collaborativeGroups = [];
    picked.collaborativeGroups.push([playerId]);
  }

  return picked.id;
}

/**
 * Distribute one quest to every alive player at the start of a new phase.
 * Calls autoAssignNextQuest for each alive player.
 */
function distributeQuestsToAlivePlayers(state: any): void {
  const players: any[] = state.players || [];
  const alivePlayers = players.filter((p: any) => p.alive);
  for (const p of alivePlayers) {
    autoAssignNextQuest(state, p.id);
  }
}

// ── Quest: answer a task ──
actionRoutes.post("/make-server-2c00868b/game/action/quest-answer", async (c) => {
  try {
    const body = await c.req.json();
    const { questId, taskId, answer, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.quests) state.quests = [];
      const quest = state.quests.find((q: any) => q.id === questId);
      if (!quest) return { error: "Quête introuvable" };

      // Check player's individual status
      if (!quest.playerStatuses) quest.playerStatuses = {};
      const playerStatus = quest.playerStatuses[playerId] || 'active';
      if (playerStatus !== 'active') return { error: "Cette quête n'est plus active pour ce joueur" };

      const task = quest.tasks.find((t: any) => t.id === taskId);
      if (!task) return { error: "Tâche introuvable" };

      if (!task.playerAnswers) task.playerAnswers = {};
      task.playerAnswers[playerId] = answer;

      // Check if all tasks are answered by THIS player → auto-resolve immediately
      const allAnswered = quest.tasks.every((t: any) => {
        if (!t.playerAnswers) return false;
        return t.playerAnswers[playerId] !== undefined && t.playerAnswers[playerId] !== '';
      });
      if (allAnswered) {
        // Evaluate each task for this player
        for (const t of quest.tasks) {
          if (!t.playerResults) t.playerResults = {};
          const playerAnswer = (t.playerAnswers?.[playerId] || '').trim().toLowerCase();
          const correctRaw = (t.correctAnswer || '').trim();
          // For player-select tasks, correctAnswer may be pipe-separated (multi-player)
          if (t.inputType === 'player-select' && correctRaw.includes('|')) {
            const validAnswers = correctRaw.split('|').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
            t.playerResults[playerId] = validAnswers.includes(playerAnswer);
          } else {
            t.playerResults[playerId] = playerAnswer === correctRaw.toLowerCase();
          }
        }
        // Determine overall quest status for this player
        const allCorrect = quest.tasks.every((t: any) => t.playerResults[playerId] === true);
        quest.playerStatuses[playerId] = allCorrect ? 'success' : 'fail';

        // ── Reward: grant 1 hint the player doesn't already have ──
        if (allCorrect) {
          const hintId = grantDynamicHintReward(state, playerId);
          if (hintId) {
            if (!quest.rewardHintIds) quest.rewardHintIds = {};
            quest.rewardHintIds[playerId] = hintId;
          }

          // ── Auto-assign next quest if under phase limit ──
          if (!state.questCompletionsThisPhase) state.questCompletionsThisPhase = {};
          const completions = state.questCompletionsThisPhase[playerId] || 0;
          const limit = state.questsPerPhase ?? 1;
          state.questCompletionsThisPhase[playerId] = completions + 1;
          // Auto-assign if unlimited (0) or not yet reached the limit
          let _autoAssignResult: any = null;
          if (limit === 0 || completions < limit) {
            const assignedQuestId = autoAssignNextQuest(state, playerId);
            if (assignedQuestId !== null) {
              const assignedQuest = state.quests.find((q: any) => q.id === assignedQuestId);
              const player = state.players.find((p: any) => p.id === playerId);
              _autoAssignResult = {
                autoAssigned: true,
                questTitle: assignedQuest?.title || 'Nouvelle quête',
                playerShortCode: player?.shortCode,
                gameId: state.gameId,
              };
            }
          }
          return _autoAssignResult;
        }
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    if (res.result?.error) return c.json({ error: res.result.error }, 400);

    // Fire push notification for auto-assigned quest (non-blocking)
    if (res.result?.autoAssigned && res.result.playerShortCode && res.result.gameId) {
      sendPushToPlayers(
        res.result.gameId,
        [res.result.playerShortCode],
        'Nouvelle quête !',
        `📜 ${res.result.questTitle}`,
        'quest-auto-assign',
      ).catch(() => {});
    }

    return c.json({ success: true });
  } catch (err) {
    console.log("Quest answer action error:", err);
    return c.json({ error: `Erreur quest-answer: ${err}` }, 500);
  }
});

// ── Quest: collaborative vote (success / fail) ──
actionRoutes.post("/make-server-2c00868b/game/action/quest-collab-vote", async (c) => {
  try {
    const body = await c.req.json();
    const { questId, playerId, vote } = body; // vote: boolean (true = success, false = fail)
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.quests) state.quests = [];
      const quest = state.quests.find((q: any) => q.id === questId);
      if (!quest) return { error: "Quête introuvable" };
      if ((quest.questType || 'individual') !== 'collaborative') {
        return { error: "Cette quête n'est pas collaborative" };
      }

      if (!quest.playerStatuses) quest.playerStatuses = {};
      const playerStatus = quest.playerStatuses[playerId] || 'active';
      if (playerStatus !== 'active') return { error: "Vous avez déjà voté pour cette quête" };

      // Record the vote
      if (!quest.collaborativeVotes) quest.collaborativeVotes = {};
      quest.collaborativeVotes[playerId] = !!vote;
      quest.playerStatuses[playerId] = 'pending-resolution';

      // Find which group this player belongs to
      const groups: number[][] = quest.collaborativeGroups || [];
      const playerGroup = groups.find((g: number[]) => g.includes(playerId));

      if (playerGroup && playerGroup.length > 0) {
        // Per-group resolution: check if all members of THIS group have voted
        const allGroupVoted = playerGroup.every(
          (pid: number) => quest.collaborativeVotes?.[pid] !== undefined
        );

        if (allGroupVoted) {
          // Resolve this group: fail if at least 1 member voted fail
          const hasFail = playerGroup.some(
            (pid: number) => quest.collaborativeVotes?.[pid] === false
          );
          const finalStatus = hasFail ? 'fail' : 'success';

          // Set all group members to the same final status
          for (const pid of playerGroup) {
            quest.playerStatuses[pid] = finalStatus;
          }

          // ── Reward: grant 1 hint per group member on success ──
          const _collabAutoAssigns: { shortCode: string; questTitle: string }[] = [];
          if (finalStatus === 'success') {
            if (!state.questCompletionsThisPhase) state.questCompletionsThisPhase = {};
            for (const pid of playerGroup) {
              const hintId = grantDynamicHintReward(state, pid);
              if (hintId) {
                if (!quest.rewardHintIds) quest.rewardHintIds = {};
                quest.rewardHintIds[pid] = hintId;
              }
              // Auto-assign next quest if under phase limit
              const completions = state.questCompletionsThisPhase[pid] || 0;
              const limit = state.questsPerPhase ?? 1;
              state.questCompletionsThisPhase[pid] = completions + 1;
              if (limit === 0 || completions < limit) {
                const assignedId = autoAssignNextQuest(state, pid);
                if (assignedId !== null) {
                  const p = state.players.find((pl: any) => pl.id === pid);
                  const aq = state.quests.find((q: any) => q.id === assignedId);
                  if (p?.shortCode) {
                    _collabAutoAssigns.push({
                      shortCode: p.shortCode,
                      questTitle: aq?.title || 'Nouvelle quête',
                    });
                  }
                }
              }
            }
          }

          // Check if ALL groups are resolved → mark quest as fully resolved
          const allGroupsResolved = groups.every((g: number[]) =>
            g.every((pid: number) => {
              const s = quest.playerStatuses?.[pid];
              return s === 'success' || s === 'fail';
            })
          );
          if (allGroupsResolved) {
            quest.resolvedAt = new Date().toISOString();
          }

          if (_collabAutoAssigns.length > 0) {
            return { collabAutoAssigns: _collabAutoAssigns, gameId: state.gameId };
          }
        }
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    if (res.result?.error) return c.json({ error: res.result.error }, 400);

    // Fire push notifications for collaborative auto-assigned quests (non-blocking)
    if (res.result?.collabAutoAssigns && res.result.gameId) {
      Promise.all(
        res.result.collabAutoAssigns.map((assign: any) =>
          sendPushToPlayers(
            res.result.gameId,
            [assign.shortCode],
            'Nouvelle quête !',
            `📜 ${assign.questTitle}`,
            'quest-auto-assign',
          )
        )
      ).catch(() => {});
    }

    return c.json({ success: true });
  } catch (err) {
    console.log("Quest collab vote action error:", err);
    return c.json({ error: `Erreur quest-collab-vote: ${err}` }, 500);
  }
});

// ── Quest: cancel collaborative vote ──
actionRoutes.post("/make-server-2c00868b/game/action/quest-collab-cancel", async (c) => {
  try {
    const body = await c.req.json();
    const { questId, playerId } = body;
    const key = await resolveGameKey(body);

    const res = await withGameLock(key, (state) => {
      if (!state.quests) state.quests = [];
      const quest = state.quests.find((q: any) => q.id === questId);
      if (!quest) return { error: "Quête introuvable" };
      if ((quest.questType || 'individual') !== 'collaborative') {
        return { error: "Cette quête n'est pas collaborative" };
      }

      // Only allow cancel if status is still 'pending-resolution' (group not yet resolved)
      const playerStatus = quest.playerStatuses?.[playerId];
      if (playerStatus === 'success' || playerStatus === 'fail') {
        return { error: "Le groupe a déjà été résolu, impossible d'annuler" };
      }

      // Remove the vote and reset status to active
      if (quest.collaborativeVotes) {
        delete quest.collaborativeVotes[playerId];
      }
      if (quest.playerStatuses) {
        quest.playerStatuses[playerId] = 'active';
      }
    });
    if (!res) return c.json({ error: "Aucune partie en cours" }, 404);
    if (res.result?.error) return c.json({ error: res.result.error }, 400);
    return c.json({ success: true });
  } catch (err) {
    console.log("Quest collab cancel action error:", err);
    return c.json({ error: `Erreur quest-collab-cancel: ${err}` }, 500);
  }
});