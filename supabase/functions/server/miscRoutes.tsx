/**
 * miscRoutes.tsx
 * Hono sub-app: heartbeat, hypothesis, and avatar upload endpoints.
 */
import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import {
  GM_PASSWORD, AVATAR_BUCKET,
  gameHeartbeatsKey, shortcodeKey, gameHypothesesKey, gameStateKey,
  supabase,
  GALLERY_HINTS_KEY,
  GALLERY_TASKS_KEY,
  GALLERY_ROLES_KEY,
  GALLERY_QUESTS_KEY,
  GALLERY_PRETASKS_KEY,
  GALLERY_DELETED_KEY,
} from "./serverHelpers.tsx";

export const miscRoutes = new Hono();

// ── In-memory heartbeat buffer: accumulate heartbeats and flush to KV periodically ──
// This reduces KV read+write pressure from 4 ops/sec (40 players × 30s) to 1 write every 15s.
const heartbeatBuffer = new Map<string, Record<string, number>>(); // hbKey → { shortCode: ts }
const HEARTBEAT_FLUSH_INTERVAL = 15_000; // 15 seconds

async function flushHeartbeats(): Promise<void> {
  if (heartbeatBuffer.size === 0) return;
  const snapshot = new Map(heartbeatBuffer);
  heartbeatBuffer.clear();
  for (const [hbKey, pending] of snapshot) {
    try {
      const existing = (await kv.get(hbKey)) || {};
      Object.assign(existing, pending);
      await kv.set(hbKey, existing);
    } catch (err) {
      console.log(`Heartbeat flush error for ${hbKey}:`, err);
    }
  }
}

// Periodic flush
setInterval(flushHeartbeats, HEARTBEAT_FLUSH_INTERVAL);

// ── Player heartbeat ──
miscRoutes.post("/make-server-2c00868b/game/heartbeat", async (c) => {
  try {
    const body = await c.req.json();
    const { shortCode, gameId: bodyGameId } = body;
    if (!shortCode) return c.json({ error: "shortCode requis" }, 400);
    let gid = bodyGameId;
    if (!gid) {
      gid = await kv.get(shortcodeKey(shortCode));
    }
    const hbKey = gid ? gameHeartbeatsKey(gid) : "game:heartbeats";
    // Buffer in memory instead of immediate KV write
    if (!heartbeatBuffer.has(hbKey)) heartbeatBuffer.set(hbKey, {});
    heartbeatBuffer.get(hbKey)![shortCode] = Date.now();
    return c.json({ success: true });
  } catch (err) {
    console.log("Heartbeat error:", err);
    return c.json({ error: `Erreur heartbeat: ${err}` }, 500);
  }
});

// ── GM reads all heartbeats ──
miscRoutes.get("/make-server-2c00868b/game/heartbeats", async (c) => {
  try {
    const gameId = c.req.query("gameId");
    const hbKey = gameId ? gameHeartbeatsKey(gameId) : "game:heartbeats";
    // Merge persisted + buffered heartbeats for fresh data
    const persisted = (await kv.get(hbKey)) || {};
    const buffered = heartbeatBuffer.get(hbKey) || {};
    const heartbeats = { ...persisted, ...buffered };
    return c.json({ heartbeats });
  } catch (err) {
    console.log("Get heartbeats error:", err);
    return c.json({ error: `Erreur lecture heartbeats: ${err}` }, 500);
  }
});

// ── Load hypotheses for a single player ──
miscRoutes.get("/make-server-2c00868b/game/hypothesis", async (c) => {
  try {
    const shortCode = c.req.query("shortCode");
    const gameId = c.req.query("gameId");
    if (!shortCode || !gameId) {
      return c.json({ error: "shortCode et gameId requis" }, 400);
    }
    const key = gameHypothesesKey(gameId, shortCode);
    const hypotheses = (await kv.get(key)) || {};
    return c.json({ hypotheses });
  } catch (err) {
    console.log("Load player hypotheses error:", err);
    return c.json({ error: `Erreur lecture hypotheses: ${err}` }, 500);
  }
});

// ── Save hypotheses for a player ──
miscRoutes.post("/make-server-2c00868b/game/hypothesis", async (c) => {
  try {
    const body = await c.req.json();
    const { shortCode, gameId, hypotheses } = body;
    if (!shortCode || !gameId) {
      return c.json({ error: "shortCode et gameId requis" }, 400);
    }
    const key = gameHypothesesKey(gameId, shortCode);
    await kv.set(key, hypotheses || {});
    return c.json({ success: true });
  } catch (err) {
    console.log("Save hypothesis error:", err);
    return c.json({ error: `Erreur sauvegarde hypotheses: ${err}` }, 500);
  }
});

// ── Load ALL hypotheses for a game (for end-game scoring) ──
miscRoutes.get("/make-server-2c00868b/game/all-hypotheses", async (c) => {
  try {
    const gameId = c.req.query("gameId");
    if (!gameId) {
      return c.json({ error: "gameId requis" }, 400);
    }
    // Read game state to get all player shortCodes
    const stateKey = gameStateKey(gameId);
    const state = await kv.get(stateKey) as any;
    if (!state || !state.players || !Array.isArray(state.players)) {
      return c.json({ hypotheses: {} });
    }
    // Fetch hypotheses individually for each player (mget doesn't preserve order for missing keys)
    const players = state.players as Array<{ id: number; shortCode: string }>;
    const allHypotheses: Record<number, Record<number, string>> = {};
    await Promise.all(players.map(async (p) => {
      try {
        const key = gameHypothesesKey(gameId, p.shortCode);
        const h = await kv.get(key);
        if (h && typeof h === 'object' && Object.keys(h as object).length > 0) {
          allHypotheses[p.id] = h as Record<number, string>;
        }
      } catch {
        // skip individual player errors
      }
    }));
    return c.json({ hypotheses: allHypotheses });
  } catch (err) {
    console.log("Load all hypotheses error:", err);
    return c.json({ error: `Erreur chargement hypotheses globales: ${err}` }, 500);
  }
});

// ── Clear all hypotheses for a game (called on reset/relaunch) ──
miscRoutes.post("/make-server-2c00868b/game/clear-hypotheses", async (c) => {
  try {
    const body = await c.req.json();
    const { gameId, password } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!gameId) {
      return c.json({ error: "gameId requis" }, 400);
    }
    // Read game state to get all player shortCodes
    const stateKey = gameStateKey(gameId);
    const state = await kv.get(stateKey) as any;
    if (state?.players && Array.isArray(state.players)) {
      const keys = (state.players as Array<{ shortCode?: string }>)
        .filter((p) => p.shortCode)
        .map((p) => gameHypothesesKey(gameId, p.shortCode!));
      if (keys.length > 0) {
        await kv.mdel(keys);
        console.log(`Cleared ${keys.length} hypothesis entries for game ${gameId}`);
      }
    }
    return c.json({ success: true });
  } catch (err) {
    console.log("Clear hypotheses error:", err);
    return c.json({ error: `Erreur suppression hypotheses: ${err}` }, 500);
  }
});

// ── Avatar upload ──
miscRoutes.post("/make-server-2c00868b/game/avatar", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const gameId = formData.get('gameId') as string || '';
    const playerId = formData.get('playerId') as string || '';
    const password = formData.get('password') as string || '';

    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    if (!file) {
      return c.json({ error: "Aucun fichier fourni" }, 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "Fichier trop volumineux (max 5 Mo)" }, 400);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${gameId || 'pregame'}/player-${playerId}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.log("Avatar upload storage error:", uploadError);
      return c.json({ error: `Erreur upload: ${uploadError.message}` }, 500);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 604800);

    if (signedError || !signedData?.signedUrl) {
      console.log("Avatar signed URL error:", signedError);
      return c.json({ error: `Erreur signed URL: ${signedError?.message}` }, 500);
    }

    return c.json({ success: true, avatarUrl: signedData.signedUrl });
  } catch (err) {
    console.log("Avatar upload error:", err);
    return c.json({ error: `Erreur avatar: ${err}` }, 500);
  }
});

// ── Quest task image upload ──
miscRoutes.post("/make-server-2c00868b/game/quest-image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const gameId = formData.get('gameId') as string || '';
    const password = formData.get('password') as string || '';

    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    if (!file) {
      return c.json({ error: "Aucun fichier fourni" }, 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "Fichier trop volumineux (max 5 Mo)" }, 400);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${gameId || 'pregame'}/quest-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.log("Quest image upload storage error:", uploadError);
      return c.json({ error: `Erreur upload: ${uploadError.message}` }, 500);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 604800);

    if (signedError || !signedData?.signedUrl) {
      console.log("Quest image signed URL error:", signedError);
      return c.json({ error: `Erreur signed URL: ${signedError?.message}` }, 500);
    }

    return c.json({ success: true, imageUrl: signedData.signedUrl });
  } catch (err) {
    console.log("Quest image upload error:", err);
    return c.json({ error: `Erreur upload image quete: ${err}` }, 500);
  }
});

// ── Gallery hint templates (persistent across games) ──

// GET: Load all gallery hint templates
miscRoutes.get("/make-server-2c00868b/gallery/hints", async (c) => {
  try {
    const data = (await kv.get(GALLERY_HINTS_KEY)) || {};
    return c.json({ hints: data });
  } catch (err) {
    console.log("Load gallery hints error:", err);
    return c.json({ error: `Erreur chargement indices galerie: ${err}` }, 500);
  }
});

// POST: Save gallery hint templates
miscRoutes.post("/make-server-2c00868b/gallery/hints", async (c) => {
  try {
    const body = await c.req.json();
    const { password, hints } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    await kv.set(GALLERY_HINTS_KEY, hints || {});
    return c.json({ success: true });
  } catch (err) {
    console.log("Save gallery hints error:", err);
    return c.json({ error: `Erreur sauvegarde indices galerie: ${err}` }, 500);
  }
});

// ── Gallery task templates (persistent across games) ──

// GET: Load all gallery task templates
miscRoutes.get("/make-server-2c00868b/gallery/tasks", async (c) => {
  try {
    const data = (await kv.get(GALLERY_TASKS_KEY)) || {};
    return c.json({ tasks: data });
  } catch (err) {
    console.log("Load gallery tasks error:", err);
    return c.json({ error: `Erreur chargement taches galerie: ${err}` }, 500);
  }
});

// POST: Save gallery task templates
miscRoutes.post("/make-server-2c00868b/gallery/tasks", async (c) => {
  try {
    const body = await c.req.json();
    const { password, tasks } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    await kv.set(GALLERY_TASKS_KEY, tasks || {});
    return c.json({ success: true });
  } catch (err) {
    console.log("Save gallery tasks error:", err);
    return c.json({ error: `Erreur sauvegarde taches galerie: ${err}` }, 500);
  }
});

// ── Gallery role templates (persistent across games) ──

// GET: Load all gallery role templates
miscRoutes.get("/make-server-2c00868b/gallery/roles", async (c) => {
  try {
    const data = (await kv.get(GALLERY_ROLES_KEY)) || {};
    return c.json({ roles: data });
  } catch (err) {
    console.log("Load gallery roles error:", err);
    return c.json({ error: `Erreur chargement roles galerie: ${err}` }, 500);
  }
});

// POST: Save gallery role templates
miscRoutes.post("/make-server-2c00868b/gallery/roles", async (c) => {
  try {
    const body = await c.req.json();
    const { password, roles } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    await kv.set(GALLERY_ROLES_KEY, roles || {});
    return c.json({ success: true });
  } catch (err) {
    console.log("Save gallery roles error:", err);
    return c.json({ error: `Erreur sauvegarde roles galerie: ${err}` }, 500);
  }
});

// ── Gallery quest templates (persistent across games) ──

// GET: Load all gallery quest templates
miscRoutes.get("/make-server-2c00868b/gallery/quests", async (c) => {
  try {
    const data = (await kv.get(GALLERY_QUESTS_KEY)) || {};
    return c.json({ quests: data });
  } catch (err) {
    console.log("Load gallery quests error:", err);
    return c.json({ error: `Erreur chargement quetes galerie: ${err}` }, 500);
  }
});

// POST: Save gallery quest templates
miscRoutes.post("/make-server-2c00868b/gallery/quests", async (c) => {
  try {
    const body = await c.req.json();
    const { password, quests } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    await kv.set(GALLERY_QUESTS_KEY, quests || {});
    return c.json({ success: true });
  } catch (err) {
    console.log("Save gallery quests error:", err);
    return c.json({ error: `Erreur sauvegarde quetes galerie: ${err}` }, 500);
  }
});

// ── Gallery general pre-tasks (persistent, not player-specific) ──

// GET: Load all gallery pre-tasks
miscRoutes.get("/make-server-2c00868b/gallery/pretasks", async (c) => {
  try {
    const data = (await kv.get(GALLERY_PRETASKS_KEY)) || { list: [] };
    return c.json({ pretasks: data });
  } catch (err) {
    console.log("Load gallery pretasks error:", err);
    return c.json({ error: `Erreur chargement pre-taches galerie: ${err}` }, 500);
  }
});

// POST: Save gallery pre-tasks
miscRoutes.post("/make-server-2c00868b/gallery/pretasks", async (c) => {
  try {
    const body = await c.req.json();
    const { password, pretasks } = body;
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    await kv.set(GALLERY_PRETASKS_KEY, pretasks || { list: [] });
    return c.json({ success: true });
  } catch (err) {
    console.log("Save gallery pretasks error:", err);
    return c.json({ error: `Erreur sauvegarde pre-taches galerie: ${err}` }, 500);
  }
});

// ── Gallery image upload (persistent, not game-specific) ──
miscRoutes.post("/make-server-2c00868b/gallery/image", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const password = formData.get('password') as string || '';
    const galleryId = formData.get('galleryId') as string || '';
    const type = formData.get('type') as string || 'hint'; // 'hint' or 'task'

    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    if (!file) {
      return c.json({ error: "Aucun fichier fourni" }, 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "Fichier trop volumineux (max 5 Mo)" }, 400);
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `gallery/${galleryId}/${type}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.log("Gallery image upload storage error:", uploadError);
      return c.json({ error: `Erreur upload: ${uploadError.message}` }, 500);
    }

    // Signed URL valid for 10 years (gallery images are persistent)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filePath, 315360000);

    if (signedError || !signedData?.signedUrl) {
      console.log("Gallery image signed URL error:", signedError);
      return c.json({ error: `Erreur signed URL: ${signedError?.message}` }, 500);
    }

    return c.json({ success: true, imageUrl: signedData.signedUrl });
  } catch (err) {
    console.log("Gallery image upload error:", err);
    return c.json({ error: `Erreur upload image galerie: ${err}` }, 500);
  }
});

// ── Delete a gallery player's data (hints, tasks, role, storage images) ──
miscRoutes.delete("/make-server-2c00868b/gallery/player/:id", async (c) => {
  try {
    const { password } = await c.req.json();
    if (password !== GM_PASSWORD) {
      return c.json({ error: "Non autorise" }, 401);
    }
    const galleryId = c.req.param("id");
    if (!galleryId) {
      return c.json({ error: "ID joueur manquant" }, 400);
    }

    // Remove hints for this player
    const hints = ((await kv.get(GALLERY_HINTS_KEY)) || {}) as Record<string, unknown>;
    delete hints[galleryId];
    await kv.set(GALLERY_HINTS_KEY, hints);

    // Remove tasks for this player
    const tasks = ((await kv.get(GALLERY_TASKS_KEY)) || {}) as Record<string, unknown>;
    delete tasks[galleryId];
    await kv.set(GALLERY_TASKS_KEY, tasks);

    // Remove role for this player
    const roles = ((await kv.get(GALLERY_ROLES_KEY)) || {}) as Record<string, unknown>;
    delete roles[galleryId];
    await kv.set(GALLERY_ROLES_KEY, roles);

    // Remove quests for this player
    const quests = ((await kv.get(GALLERY_QUESTS_KEY)) || {}) as Record<string, unknown>;
    delete quests[galleryId];
    await kv.set(GALLERY_QUESTS_KEY, quests);

    // Delete uploaded images in storage (gallery/{id}/ folder)
    try {
      const { data: files } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(`gallery/${galleryId}`);
      if (files && files.length > 0) {
        const filePaths = files.map((f: { name: string }) => `gallery/${galleryId}/${f.name}`);
        await supabase.storage.from(AVATAR_BUCKET).remove(filePaths);
      }
    } catch (storageErr) {
      console.log(`Gallery player ${galleryId} storage cleanup warning:`, storageErr);
      // Non-blocking: data already deleted from KV
    }

    // Add to deleted avatars list
    const deleted = ((await kv.get(GALLERY_DELETED_KEY)) || []) as number[];
    const numId = Number(galleryId);
    if (!deleted.includes(numId)) {
      deleted.push(numId);
      await kv.set(GALLERY_DELETED_KEY, deleted);
    }

    console.log(`Gallery player ${galleryId} deleted successfully`);
    return c.json({ success: true });
  } catch (err) {
    console.log("Delete gallery player error:", err);
    return c.json({ error: `Erreur suppression joueur galerie: ${err}` }, 500);
  }
});

// ── Deleted gallery avatars list ──
miscRoutes.get("/make-server-2c00868b/gallery/deleted", async (c) => {
  try {
    const data = ((await kv.get(GALLERY_DELETED_KEY)) || []) as number[];
    return c.json({ deleted: data });
  } catch (err) {
    console.log("Load gallery deleted error:", err);
    return c.json({ error: `Erreur chargement avatars supprimes: ${err}` }, 500);
  }
});