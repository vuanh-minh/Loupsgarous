/**
 * serverHelpers.tsx
 * Shared constants, KV key helpers, Supabase client, bucket init,
 * and resolveGameKey for all server route modules.
 */
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

// ── Supabase client (storage) ──
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Constants ──
export const GM_PASSWORD = Deno.env.get('GM_PASSWORD') || "loupgarou";
export const GAMES_LIST_KEY = "games:list";
export const AVATAR_BUCKET = 'make-2c00868b-avatars';

// ── Event cap: prevent unbounded growth ──
export const MAX_EVENTS = 200;
export function capEvents(state: any): void {
  if (Array.isArray(state.events) && state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS);
  }
  // Also cap voteHistory (grows every turn — keep last 30 turns)
  if (Array.isArray(state.voteHistory) && state.voteHistory.length > 30) {
    state.voteHistory = state.voteHistory.slice(-30);
  }
  // Cap phaseDeathHistory (keep last 20 phases)
  if (Array.isArray(state.phaseDeathHistory) && state.phaseDeathHistory.length > 20) {
    state.phaseDeathHistory = state.phaseDeathHistory.slice(-20);
  }
}

// ── In-memory shortCode → gameId cache (prevents N+1 KV scans) ──
const shortCodeCache = new Map<string, { gameId: string; ts: number }>();
const SHORTCODE_CACHE_TTL = 300_000; // 5 minutes

export function getCachedShortCode(code: string): string | null {
  const entry = shortCodeCache.get(code);
  if (!entry) return null;
  if (Date.now() - entry.ts > SHORTCODE_CACHE_TTL) {
    shortCodeCache.delete(code);
    return null;
  }
  return entry.gameId;
}

export function setCachedShortCode(code: string, gameId: string): void {
  shortCodeCache.set(code, { gameId, ts: Date.now() });
}

// ── Batch shortCode → gameId mapping (single mset instead of N sequential writes) ──
export async function batchSaveShortCodes(
  players: Array<{ shortCode?: string }>,
  lobbyPlayers: Array<{ shortCode?: string }> | undefined,
  gameId: string,
): Promise<string[]> {
  const seen = new Set<string>();
  const keys: string[] = [];
  const values: any[] = [];
  for (const p of players) {
    if (p.shortCode && !seen.has(p.shortCode)) {
      seen.add(p.shortCode);
      keys.push(shortcodeKey(p.shortCode));
      values.push(gameId);
      setCachedShortCode(p.shortCode, gameId);
    }
  }
  if (lobbyPlayers) {
    for (const lp of lobbyPlayers) {
      if (lp.shortCode && !seen.has(lp.shortCode)) {
        seen.add(lp.shortCode);
        keys.push(shortcodeKey(lp.shortCode));
        values.push(gameId);
        setCachedShortCode(lp.shortCode, gameId);
      }
    }
  }
  if (keys.length > 0) {
    await kv.mset(keys, values);
  }
  return Array.from(seen);
}

// ── Idempotent bucket creation on startup ──
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: { name: string }) => bucket.name === AVATAR_BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(AVATAR_BUCKET, { public: false });
      console.log(`Created storage bucket: ${AVATAR_BUCKET}`);
    }
  } catch (err) {
    console.log(`Bucket creation check error (non-fatal): ${err}`);
  }
})();

// ── KV key helpers ──
export function gameStateKey(gameId: string) { return `game:${gameId}:state`; }
export function gameHeartbeatsKey(gameId: string) { return `game:${gameId}:heartbeats`; }
export function shortcodeKey(code: string) { return `shortcode:${code}`; }
export function gameHypothesesKey(gameId: string, shortCode: string) { return `game:${gameId}:hypotheses:${shortCode}`; }
export function gameTimerLockKey(gameId: string) { return `game:${gameId}:timer-lock`; }
export const GALLERY_HINTS_KEY = 'global:gallery-hints';
export const GALLERY_TASKS_KEY = 'global:gallery-tasks';
export const GALLERY_ROLES_KEY = 'global:gallery-roles';
export const GALLERY_QUESTS_KEY = 'global:gallery-quests';
export const GALLERY_PRETASKS_KEY = 'global:gallery-pretasks';
export const GALLERY_DELETED_KEY = 'global:gallery-deleted';

// ── Random game ID ──
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateGameId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return id;
}

// ── Resolve game KV key from request body ──
export async function resolveGameKey(body: { gameId?: string; shortCode?: string }): Promise<string> {
  if (body.gameId) return gameStateKey(body.gameId);
  if (body.shortCode) {
    const gid = await kv.get(shortcodeKey(body.shortCode));
    if (gid) return gameStateKey(gid as string);
  }
  return "game:current"; // legacy fallback
}