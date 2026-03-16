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
} from "./serverHelpers.tsx";

export const miscRoutes = new Hono();

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
    const heartbeats = (await kv.get(hbKey)) || {};
    heartbeats[shortCode] = Date.now();
    await kv.set(hbKey, heartbeats);
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
    const heartbeats = (await kv.get(hbKey)) || {};
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