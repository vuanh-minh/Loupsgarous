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
export const GM_PASSWORD = "loupgarou";
export const GAMES_LIST_KEY = "games:list";
export const AVATAR_BUCKET = 'make-2c00868b-avatars';

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