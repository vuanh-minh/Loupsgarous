/**
 * gameRoutes.tsx
 * Hono sub-app: health, auth, games CRUD, game state GET/POST/DELETE.
 */
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import {
  GM_PASSWORD, GAMES_LIST_KEY,
  gameStateKey, gameHeartbeatsKey, shortcodeKey,
  generateGameId,
  capEvents, batchSaveShortCodes,
  getCachedShortCode, setCachedShortCode,
} from "./serverHelpers.tsx";

export const gameRoutes = new Hono();

// Health check
gameRoutes.get("/make-server-2c00868b/health", (c) => {
  return c.json({ status: "ok" });
});

// Verify GM password
gameRoutes.post("/make-server-2c00868b/game/auth", async (c) => {
  try {
    const body = await c.req.json();
    const { password } = body;
    if (password === GM_PASSWORD) {
      return c.json({ success: true });
    }
    return c.json({ success: false, error: "Mot de passe incorrect" }, 401);
  } catch (err) {
    console.log("Auth error:", err);
    return c.json({ success: false, error: `Erreur d'authentification: ${err}` }, 500);
  }
});

// ── Multi-game management ──

// List all games
gameRoutes.get("/make-server-2c00868b/games", async (c) => {
  try {
    const list = (await kv.get(GAMES_LIST_KEY)) || [];
    return c.json({ games: list });
  } catch (err) {
    console.log("List games error:", err);
    return c.json({ error: `Erreur liste des parties: ${err}` }, 500);
  }
});

// Create a new game
gameRoutes.post("/make-server-2c00868b/games", async (c) => {
  try {
    const body = await c.req.json();
    const { password, name } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    const gameId = generateGameId();
    const now = new Date().toISOString();
    const entry = {
      id: gameId,
      name: name || `Partie ${gameId}`,
      createdAt: now,
      playerCount: 0,
      aliveCount: 0,
      phase: 'night',
      turn: 1,
      screen: 'home',
    };
    const list = (await kv.get(GAMES_LIST_KEY)) || [];
    list.push(entry);
    await kv.set(GAMES_LIST_KEY, list);
    return c.json({ success: true, game: entry });
  } catch (err) {
    console.log("Create game error:", err);
    return c.json({ error: `Erreur creation partie: ${err}` }, 500);
  }
});

// Delete a game
gameRoutes.delete("/make-server-2c00868b/games/:gameId", async (c) => {
  try {
    const body = await c.req.json();
    const { password } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    const gameId = c.req.param("gameId");
    const list = (await kv.get(GAMES_LIST_KEY)) || [];
    const newList = list.filter((g: any) => g.id !== gameId);
    await kv.set(GAMES_LIST_KEY, newList);
    try { await kv.del(gameStateKey(gameId)); } catch {}
    try { await kv.del(gameHeartbeatsKey(gameId)); } catch {}
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete game error:", err);
    return c.json({ error: `Erreur suppression partie: ${err}` }, 500);
  }
});

// ── Game state endpoints ──

// Save game state (GM only)
gameRoutes.post("/make-server-2c00868b/game/state", async (c) => {
  try {
    const body = await c.req.json();
    const { password, gameState, gameId } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    const key = gameId ? gameStateKey(gameId) : "game:current";
    // Preserve optimistic version counter from withGameLock
    const existing = await kv.get(key);
    if (existing && existing._kvVersion) {
      gameState._kvVersion = existing._kvVersion;
    } else if (!gameState._kvVersion) {
      gameState._kvVersion = 0;
    }

    // ── Merge player-driven fields from existing server state ──
    // The GM's syncToServer does a full-state write, but player actions
    // (role-revealed, join-village, votes, etc.) are written to the server
    // independently via actionRoutes. If the GM hasn't polled yet, its local
    // state may be stale for these fields → the sync would overwrite them.
    // Fix: union/merge these append-only fields so player actions are never lost.
    if (existing) {
      // roleRevealedBy: union (player reveals accumulate, never shrink during a round)
      const srvRevealed: number[] = Array.isArray(existing.roleRevealedBy) ? existing.roleRevealedBy : [];
      const gmRevealed: number[] = Array.isArray(gameState.roleRevealedBy) ? gameState.roleRevealedBy : [];
      if (srvRevealed.length > 0 || gmRevealed.length > 0) {
        gameState.roleRevealedBy = [...new Set([...srvRevealed, ...gmRevealed])];
      }

      // villagePresentIds: union (players join the village progressively)
      const srvPresent: number[] = Array.isArray(existing.villagePresentIds) ? existing.villagePresentIds : [];
      const gmPresent: number[] = Array.isArray(gameState.villagePresentIds) ? gameState.villagePresentIds : [];
      if (srvPresent.length > 0 || gmPresent.length > 0) {
        gameState.villagePresentIds = [...new Set([...srvPresent, ...gmPresent])];
      }

      // midGameJoinIds: union (tracks which players joined mid-game)
      const srvJoinIds: number[] = Array.isArray(existing.midGameJoinIds) ? existing.midGameJoinIds : [];
      const gmJoinIds: number[] = Array.isArray(gameState.midGameJoinIds) ? gameState.midGameJoinIds : [];
      if (srvJoinIds.length > 0 || gmJoinIds.length > 0) {
        gameState.midGameJoinIds = [...new Set([...srvJoinIds, ...gmJoinIds])];
      }

      // hints: union by id (GM creates hints, server may also create via quests/corbeau)
      const srvHints: any[] = Array.isArray(existing.hints) ? existing.hints : [];
      const gmHints: any[] = Array.isArray(gameState.hints) ? gameState.hints : [];
      if (srvHints.length > 0 || gmHints.length > 0) {
        const hintMap = new Map<number, any>();
        for (const h of gmHints) hintMap.set(h.id, h);
        for (const h of srvHints) {
          if (!hintMap.has(h.id)) {
            hintMap.set(h.id, h);
          } else {
            // Merge: server may have extra fields (e.g. from quest rewards)
            hintMap.set(h.id, { ...hintMap.get(h.id), ...h });
          }
        }
        gameState.hints = Array.from(hintMap.values());
      }

      // playerHints: union by (hintId, playerId), prefer revealed=true
      const srvPH: any[] = Array.isArray(existing.playerHints) ? existing.playerHints : [];
      const gmPH: any[] = Array.isArray(gameState.playerHints) ? gameState.playerHints : [];
      if (srvPH.length > 0 || gmPH.length > 0) {
        const phKey = (ph: any) => `${ph.hintId}:${ph.playerId}`;
        const phMap = new Map<string, any>();
        for (const ph of gmPH) phMap.set(phKey(ph), ph);
        for (const ph of srvPH) {
          const k = phKey(ph);
          const existing_ph = phMap.get(k);
          if (!existing_ph) {
            phMap.set(k, ph);
          } else {
            // Prefer revealed=true (player reveals should never be lost)
            if (ph.revealed && !existing_ph.revealed) {
              phMap.set(k, { ...existing_ph, ...ph });
            }
          }
        }
        gameState.playerHints = Array.from(phMap.values());
      }

      // dynamicHints: merge by id, prefer revealed=true (quest rewards mark hints as revealed)
      const srvDH: any[] = Array.isArray(existing.dynamicHints) ? existing.dynamicHints : [];
      const gmDH: any[] = Array.isArray(gameState.dynamicHints) ? gameState.dynamicHints : [];
      if (srvDH.length > 0 || gmDH.length > 0) {
        const dhMap = new Map<number, any>();
        for (const dh of gmDH) dhMap.set(dh.id, dh);
        for (const dh of srvDH) {
          const existing_dh = dhMap.get(dh.id);
          if (!existing_dh) {
            dhMap.set(dh.id, dh);
          } else {
            // Merge: prefer revealed=true + union grantedToPlayerIds arrays
            const merged = { ...existing_dh, ...dh };
            // Union grantedToPlayerIds from both sides
            const gmIds: number[] = existing_dh.grantedToPlayerIds || (existing_dh.revealed && existing_dh.grantedToPlayerId != null ? [existing_dh.grantedToPlayerId] : []);
            const srvIds: number[] = dh.grantedToPlayerIds || (dh.revealed && dh.grantedToPlayerId != null ? [dh.grantedToPlayerId] : []);
            merged.grantedToPlayerIds = [...new Set([...gmIds, ...srvIds])];
            if (dh.revealed || existing_dh.revealed) merged.revealed = true;
            dhMap.set(dh.id, merged);
          }
        }
        gameState.dynamicHints = Array.from(dhMap.values());
      }

      // quests: merge by ID — preserve player-driven fields (playerStatuses, playerAnswers,
      // playerResults, collaborativeVotes, rewardHintIds) from server, use GM for structural fields.
      const srvQuests: any[] = Array.isArray(existing.quests) ? existing.quests : [];
      const gmQuests: any[] = Array.isArray(gameState.quests) ? gameState.quests : [];
      if (srvQuests.length > 0 || gmQuests.length > 0) {
        const srvQuestMap = new Map<number, any>();
        for (const q of srvQuests) srvQuestMap.set(q.id, q);
        gameState.quests = gmQuests.map((gmQ: any) => {
          const srvQ = srvQuestMap.get(gmQ.id);
          if (!srvQ) return gmQ;
          // Merge player-driven fields from server into GM quest
          const mergedTasks = (gmQ.tasks || []).map((gmTask: any) => {
            const srvTask = (srvQ.tasks || []).find((t: any) => t.id === gmTask.id);
            if (!srvTask) return gmTask;
            // Union playerAnswers and playerResults from both
            const mergedAnswers = { ...(gmTask.playerAnswers || {}), ...(srvTask.playerAnswers || {}) };
            const mergedResults = { ...(gmTask.playerResults || {}), ...(srvTask.playerResults || {}) };
            return { ...gmTask, playerAnswers: mergedAnswers, playerResults: mergedResults };
          });
          // Merge playerStatuses: prefer more advanced statuses (success/fail > pending > active)
          const statusPriority: Record<string, number> = { 'active': 0, 'pending-resolution': 1, 'fail': 2, 'success': 3 };
          const mergedStatuses = { ...(gmQ.playerStatuses || {}) };
          for (const [pid, status] of Object.entries(srvQ.playerStatuses || {})) {
            const gmPriority = statusPriority[mergedStatuses[pid] || 'active'] ?? 0;
            const srvPriority = statusPriority[status as string] ?? 0;
            if (srvPriority > gmPriority) mergedStatuses[pid] = status;
          }
          return {
            ...gmQ,
            tasks: mergedTasks,
            playerStatuses: mergedStatuses,
            collaborativeVotes: { ...(gmQ.collaborativeVotes || {}), ...(srvQ.collaborativeVotes || {}) },
            rewardHintIds: { ...(gmQ.rewardHintIds || {}), ...(srvQ.rewardHintIds || {}) },
            playerResolvedInPhase: { ...(gmQ.playerResolvedInPhase || {}), ...(srvQ.playerResolvedInPhase || {}) },
            // Preserve hidden=false from server if server unhid (e.g. auto-assign chain quest)
            hidden: gmQ.hidden === false || srvQ.hidden === false ? false : gmQ.hidden,
            // Preserve collaborative groups from server (groups may have been created by auto-assign)
            collaborativeGroups: (srvQ.collaborativeGroups || []).length >= (gmQ.collaborativeGroups || []).length
              ? srvQ.collaborativeGroups
              : gmQ.collaborativeGroups,
          };
        });
        // Add any server-only quests (e.g. auto-unhidden chain quests not in GM state)
        for (const srvQ of srvQuests) {
          if (!gmQuests.some((gq: any) => gq.id === srvQ.id)) {
            gameState.quests.push(srvQ);
          }
        }
      }

      // questAssignments: union per player (server may have auto-assigned quests)
      const srvAssignments: Record<string, number[]> = existing.questAssignments || {};
      const gmAssignments: Record<string, number[]> = gameState.questAssignments || {};
      const mergedAssignments: Record<string, number[]> = {};
      const allPlayerIds = new Set([...Object.keys(srvAssignments), ...Object.keys(gmAssignments)]);
      for (const pid of allPlayerIds) {
        const srvIds = srvAssignments[pid] || [];
        const gmIds = gmAssignments[pid] || [];
        mergedAssignments[pid] = [...new Set([...gmIds, ...srvIds])];
      }
      gameState.questAssignments = mergedAssignments;

      // questCompletionsThisPhase: take max per player (server increments on quest success)
      const srvCompletions: Record<string, number> = existing.questCompletionsThisPhase || {};
      const gmCompletions: Record<string, number> = gameState.questCompletionsThisPhase || {};
      const mergedCompletions: Record<string, number> = { ...gmCompletions };
      for (const [pid, count] of Object.entries(srvCompletions)) {
        mergedCompletions[pid] = Math.max(mergedCompletions[pid] || 0, count as number);
      }
      gameState.questCompletionsThisPhase = mergedCompletions;
    }
    // Increment version to signal a write occurred (used by withGameLock optimistic check)
    gameState._kvVersion = (gameState._kvVersion || 0) + 1;
    // Cap events array to prevent unbounded growth
    capEvents(gameState);
    // Warn if state is getting large (helps detect unbounded growth early)
    const stateSize = JSON.stringify(gameState).length;
    if (stateSize > 500_000) {
      console.log(`⚠️ Game state for ${gameId} is ${Math.round(stateSize / 1024)}KB — consider pruning voteHistory/phaseDeathHistory`);
    }
    await kv.set(key, gameState);
    // Update shortcode → gameId mappings (batched single write instead of N sequential)
    if (gameId && gameState?.players) {
      const shortcodes = await batchSaveShortCodes(
        gameState.players,
        gameState.lobbyPlayers,
        gameId,
      );
      console.log(`Saved ${shortcodes.length} shortcode mappings for game ${gameId} (batched):`, shortcodes.join(', '));
    } else {
      console.log(`POST /game/state: gameId=${gameId}, players count=${gameState?.players?.length ?? 0} — skipped shortcode mappings`);
    }
    // Update game list entry with latest metadata
    if (gameId) {
      const list = (await kv.get(GAMES_LIST_KEY)) || [];
      const idx = list.findIndex((g: any) => g.id === gameId);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          playerCount: gameState?.players?.length || 0,
          aliveCount: gameState?.players?.filter((p: any) => p.alive).length || 0,
          phase: gameState?.phase || 'night',
          turn: gameState?.turn || 1,
          screen: gameState?.screen || 'home',
        };
        await kv.set(GAMES_LIST_KEY, list);
      }
    }
    return c.json({ success: true });
  } catch (err) {
    console.log("Save state error:", err);
    return c.json({ error: `Erreur lors de la sauvegarde: ${err}` }, 500);
  }
});

// Get game state (anyone)
gameRoutes.get("/make-server-2c00868b/game/state", async (c) => {
  try {
    const gameId = c.req.query("gameId");
    const shortCode = c.req.query("shortCode");
    const gmCode = c.req.query("gmCode");
    let key: string | null = null;
    let resolvedGameId: string | null = null;
    let gameName: string | null = null;
    if (gameId) {
      key = gameStateKey(gameId);
      resolvedGameId = gameId;
    } else if (gmCode) {
      // GM access code: first 4 chars of gameId (stripped of dashes, uppercased)
      const gamesList = (await kv.get(GAMES_LIST_KEY)) || [];
      for (const game of gamesList as any[]) {
        const derived = game.id.replace(/-/g, '').slice(0, 4).toUpperCase();
        if (derived === gmCode.toUpperCase()) {
          key = gameStateKey(game.id);
          resolvedGameId = game.id;
          gameName = game.name || null;
          break;
        }
      }
      if (!key) {
        return c.json({ gameState: null, gameId: null });
      }
    } else if (shortCode) {
      // Check in-memory cache first (avoids KV read entirely)
      const cachedGid = getCachedShortCode(shortCode);
      const gid = cachedGid || await kv.get(shortcodeKey(shortCode));
      console.log(`GET /game/state: shortCode=${shortCode}, cached=${!!cachedGid}, resolved=${gid}`);
      if (gid) {
        key = gameStateKey(gid as string);
        resolvedGameId = gid as string;
        // Populate cache if it was a KV hit
        if (!cachedGid) setCachedShortCode(shortCode, gid as string);
      } else {
        console.log(`GET /game/state: shortCode=${shortCode} not in KV, scanning all games...`);
        const gamesList = (await kv.get(GAMES_LIST_KEY)) || [];
        for (const game of gamesList as any[]) {
          const gs = await kv.get(gameStateKey(game.id));
          if (gs && gs.players) {
            const found = gs.players.some((p: any) => p.shortCode === shortCode);
            if (found) {
              key = gameStateKey(game.id);
              resolvedGameId = game.id;
              console.log(`GET /game/state: Found shortCode=${shortCode} in game ${game.id} via scan`);
              await kv.set(shortcodeKey(shortCode), game.id);
              setCachedShortCode(shortCode, game.id);
              break;
            }
          }
          // Also check lobbyPlayers (pre-game join flow)
          if (gs && gs.lobbyPlayers) {
            const foundInLobby = gs.lobbyPlayers.some((lp: any) => lp.shortCode === shortCode);
            if (foundInLobby) {
              key = gameStateKey(game.id);
              resolvedGameId = game.id;
              console.log(`GET /game/state: Found shortCode=${shortCode} in lobbyPlayers of game ${game.id} via scan`);
              await kv.set(shortcodeKey(shortCode), game.id);
              setCachedShortCode(shortCode, game.id);
              break;
            }
          }
        }
        if (!key) {
          key = "game:current";
          console.log(`GET /game/state: shortCode=${shortCode} not found in any game, falling back to legacy key`);
        }
      }
    } else {
      key = "game:current";
    }
    const state = await kv.get(key);
    console.log(`GET /game/state: key=${key}, found=${!!state}`);
    if (!state) {
      return c.json({ gameState: null, gameId: resolvedGameId, gameName });
    }
    return c.json({ gameState: state, gameId: resolvedGameId, gameName });
  } catch (err) {
    console.log("Get state error:", err);
    return c.json({ error: `Erreur lors du chargement: ${err}` }, 500);
  }
});

// Delete game state (GM only, for reset)
gameRoutes.delete("/make-server-2c00868b/game/state", async (c) => {
  try {
    const body = await c.req.json();
    const { password, gameId } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    const key = gameId ? gameStateKey(gameId) : "game:current";
    await kv.del(key);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete state error:", err);
    return c.json({ error: `Erreur lors de la suppression: ${err}` }, 500);
  }
});