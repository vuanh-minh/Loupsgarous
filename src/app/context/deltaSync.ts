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