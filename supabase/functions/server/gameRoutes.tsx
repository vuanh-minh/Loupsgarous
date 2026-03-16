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
            // Prefer revealed=true (quest rewards should never be lost)
            if (dh.revealed && !existing_dh.revealed) {
              dhMap.set(dh.id, { ...existing_dh, ...dh });
            }
          }
        }
        gameState.dynamicHints = Array.from(dhMap.values());
      }
    }
    await kv.set(key, gameState);
    // Update shortcode → gameId mappings
    if (gameId && gameState?.players) {
      const shortcodes: string[] = [];
      for (const player of gameState.players) {
        if (player.shortCode) {
          await kv.set(shortcodeKey(player.shortCode), gameId);
          shortcodes.push(player.shortCode);
        }
      }
      // Also map lobby player shortCodes (pre-game join flow)
      if (gameState.lobbyPlayers) {
        for (const lp of gameState.lobbyPlayers) {
          if (lp.shortCode && !shortcodes.includes(lp.shortCode)) {
            await kv.set(shortcodeKey(lp.shortCode), gameId);
            shortcodes.push(lp.shortCode);
          }
        }
      }
      console.log(`Saved ${shortcodes.length} shortcode mappings for game ${gameId}:`, shortcodes.join(', '));
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
      const gid = await kv.get(shortcodeKey(shortCode));
      console.log(`GET /game/state: shortCode=${shortCode}, KV lookup key=${shortcodeKey(shortCode)}, resolved=${gid}`);
      if (gid) {
        key = gameStateKey(gid as string);
        resolvedGameId = gid as string;
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