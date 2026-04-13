import type { TraqueProgress } from '../../../../context/gameTypes';

// ── Progression en cours ─────────────────────────────────────────────────────

function progressKey(gameId: string, selfPlayerId: number): string {
  return `traque-${gameId}-${selfPlayerId}`;
}

export function loadTraque(gameId: string, selfPlayerId: number): TraqueProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(gameId, selfPlayerId));
    return raw ? (JSON.parse(raw) as TraqueProgress) : null;
  } catch {
    return null;
  }
}

export function saveTraque(progress: TraqueProgress): void {
  try {
    localStorage.setItem(progressKey(progress.gameId, progress.selfPlayerId), JSON.stringify(progress));
  } catch {}
}

export function clearTraque(gameId: string, selfPlayerId: number): void {
  try {
    localStorage.removeItem(progressKey(gameId, selfPlayerId));
  } catch {}
}

// ── Scores per-tag (première tentative verrouillée) ──────────────────────────

interface TagScore {
  selfPlayerId: number;
  tag: string;
  correct: number;
  total: number;
}

function firstTagKey(selfPlayerId: number, tag: string): string {
  return `traque-first-${selfPlayerId}-${tag}`;
}

/**
 * Sauvegarde le score de la première tentative pour ce tag.
 * Retourne true si sauvegardé (première fois), false si déjà verrouillé.
 */
export function saveFirstTagScore(selfPlayerId: number, tag: string, correct: number, total: number): boolean {
  try {
    const k = firstTagKey(selfPlayerId, tag);
    if (localStorage.getItem(k) !== null) return false; // déjà verrouillé
    localStorage.setItem(k, JSON.stringify({ selfPlayerId, tag, correct, total }));
    return true;
  } catch {
    return false;
  }
}

/** Charge tous les scores per-tag d'un joueur (première tentative). */
export function loadPlayerTagScores(selfPlayerId: number): Record<string, { correct: number; total: number }> {
  const scores: Record<string, { correct: number; total: number }> = {};
  try {
    const prefix = `traque-first-${selfPlayerId}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw) as TagScore;
      scores[data.tag] = { correct: data.correct, total: data.total };
    }
  } catch {}
  return scores;
}

/** Agrège les scores de tous les joueurs pour le leaderboard (somme des premiers scores). */
export function loadAllPlayersLeaderboard(): Array<{ selfPlayerId: number; totalCorrect: number }> {
  const byPlayer: Record<number, number> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('traque-first-')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const data = JSON.parse(raw) as TagScore;
      byPlayer[data.selfPlayerId] = (byPlayer[data.selfPlayerId] ?? 0) + data.correct;
    }
  } catch {}
  return Object.entries(byPlayer).map(([id, total]) => ({
    selfPlayerId: Number(id),
    totalCorrect: total,
  }));
}
