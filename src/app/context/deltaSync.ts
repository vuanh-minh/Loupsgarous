/**
 * deltaSync.ts — Delta computation & application for GameState broadcasts.
 *
 * Instead of broadcasting the full ~50-100KB GameState on every change,
 * the GM computes a shallow diff and sends only the changed top-level keys.
 * Receivers apply the patch on top of their current state.
 *
 * Protocol:
 *   { _v: number, _full?: boolean, ...changedFields }
 *
 * _v   — monotonically increasing version counter (sequence gap = missed delta)
 * _full — if true, payload is the entire state (initial sync / recovery)
 */

import type { GameState } from './gameTypes';

// Keys that are very large and rarely change — only include if actually modified
// (kept as documentation; delta computation already handles this via JSON comparison)
const _HEAVY_KEYS: (keyof GameState)[] = ['events', 'voteHistory', 'hints', 'playerHints', 'quests'];

// Keys to never broadcast (local-only or derived)
const EXCLUDED_KEYS: (keyof GameState)[] = ['hypotheses'];

export interface StateDelta {
  _v: number;
  _full?: boolean;
  [key: string]: unknown;
}

/**
 * Compute a shallow delta between prev and next GameState.
 * Returns null if no changes detected.
 */
export function computeDelta(prev: GameState, next: GameState, version: number): StateDelta | null {
  const delta: StateDelta = { _v: version };
  let hasChanges = false;

  const allKeys = new Set([
    ...Object.keys(prev),
    ...Object.keys(next),
  ]) as Set<keyof GameState>;

  for (const key of allKeys) {
    if (EXCLUDED_KEYS.includes(key)) continue;

    const prevVal = prev[key];
    const nextVal = next[key];

    // Fast path: reference equality
    if (prevVal === nextVal) continue;

    // Deep comparison via JSON (efficient enough for individual fields)
    try {
      if (JSON.stringify(prevVal) === JSON.stringify(nextVal)) continue;
    } catch {
      // If JSON fails, consider changed
    }

    (delta as Record<string, unknown>)[key] = nextVal;
    hasChanges = true;
  }

  return hasChanges ? delta : null;
}

/**
 * Build a full-state payload (for initial sync / recovery).
 */
export function buildFullPayload(state: GameState, version: number): StateDelta {
  const payload: StateDelta = { _v: version, _full: true };
  for (const [key, value] of Object.entries(state)) {
    if (EXCLUDED_KEYS.includes(key as keyof GameState)) continue;
    payload[key] = value;
  }
  return payload;
}

/**
 * Apply a delta patch to an existing GameState.
 * Returns the merged state. If _full, replaces entirely (except excluded keys).
 */
export function applyDelta(current: GameState, delta: StateDelta): GameState {
  if (delta._full) {
    // Full replacement — preserve local-only keys
    const next = { ...current };
    for (const [key, value] of Object.entries(delta)) {
      if (key === '_v' || key === '_full') continue;
      if (EXCLUDED_KEYS.includes(key as keyof GameState)) continue;
      (next as Record<string, unknown>)[key] = value;
    }
    return next;
  }

  // Partial merge
  const next = { ...current };
  for (const [key, value] of Object.entries(delta)) {
    if (key === '_v' || key === '_full') continue;
    if (EXCLUDED_KEYS.includes(key as keyof GameState)) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

/**
 * Estimate the byte size of a payload (for monitoring).
 */
export function estimatePayloadSize(payload: unknown): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
}

/**
 * Maximum broadcast payload size (bytes). Supabase Realtime has a ~256KB limit.
 * We set a conservative threshold and strip heavy fields if exceeded.
 */
const MAX_BROADCAST_SIZE = 200_000; // 200KB

/**
 * Strip heavy fields from a full-state payload to fit within broadcast limits.
 * Removes old events and resolved quest data progressively.
 */
export function fitBroadcastPayload(state: GameState): GameState {
  let size = estimatePayloadSize(state);
  if (size <= MAX_BROADCAST_SIZE) return state;

  // Clone to avoid mutating the original
  const slim = { ...state };

  // 1. Trim events to last 50 (from 200 cap)
  if (Array.isArray(slim.events) && slim.events.length > 50) {
    slim.events = slim.events.slice(-50);
    size = estimatePayloadSize(slim);
    if (size <= MAX_BROADCAST_SIZE) return slim;
  }

  // 2. Strip voteHistory (can be reconstructed from events)
  if (slim.voteHistory && Array.isArray(slim.voteHistory) && slim.voteHistory.length > 0) {
    slim.voteHistory = [];
    size = estimatePayloadSize(slim);
    if (size <= MAX_BROADCAST_SIZE) return slim;
  }

  // 3. Strip phaseDeathHistory (keep only last 3)
  if (Array.isArray(slim.phaseDeathHistory) && slim.phaseDeathHistory.length > 3) {
    slim.phaseDeathHistory = slim.phaseDeathHistory.slice(-3);
    size = estimatePayloadSize(slim);
    if (size <= MAX_BROADCAST_SIZE) return slim;
  }

  // 4. Trim events even further
  if (Array.isArray(slim.events) && slim.events.length > 20) {
    slim.events = slim.events.slice(-20);
  }

  return slim;
}

// ── Version tracker (GM side) ──
let _broadcastVersion = 0;
export function nextBroadcastVersion(): number {
  return ++_broadcastVersion;
}
export function currentBroadcastVersion(): number {
  return _broadcastVersion;
}
export function resetBroadcastVersion(): void {
  _broadcastVersion = 0;
}