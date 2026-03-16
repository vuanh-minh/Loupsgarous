/**
 * useGameSync.ts
 * Server synchronisation, local-mode detection, auto-persist,
 * loadFromServer, mergePlayerActions and setFullState for GameContext.
 */
import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { getRoleById, type RoleDefinition } from '../data/roles';
import { API_BASE, publicAnonKey } from './apiConfig';
import type { GameState } from './gameTypes';
import {
  localSaveState, localLoadState, localLoadGamesList, syncEventCounter,
} from './gameContextConstants';
import { type StateDelta, applyDelta } from './deltaSync';

type SetState = React.Dispatch<React.SetStateAction<GameState>>;

interface SyncDeps {
  setState: SetState;
  state: GameState;
  stateRef: React.MutableRefObject<GameState>;
}

export function useGameSync({ setState, state, stateRef }: SyncDeps) {
  // ── Local mode: detect if server is unreachable ──
  const [localMode, setLocalMode] = useState(false);
  const localModeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE}/health`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!cancelled) {
          const isLocal = !res.ok;
          setLocalMode(isLocal);
          localModeRef.current = isLocal;
          if (isLocal) console.log('Server health check failed — running in local mode');
        }
      } catch {
        if (!cancelled) {
          console.log('Server unreachable — running in local mode');
          setLocalMode(true);
          localModeRef.current = true;
        }
      }
    };
    checkHealth();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-persist in local mode ──
  useLayoutEffect(() => {
    if (!localMode || !state.gameId) return;
    try {
      localSaveState(state.gameId, state);
    } catch (err) {
      console.log('Auto-persist error:', err);
    }
  }, [localMode, state]);

  // ── Sync state to server (GM only) ──
  const syncToServer = useCallback(async () => {
    if (localModeRef.current) {
      const current = stateRef.current;
      if (current.gameId) localSaveState(current.gameId, current);
      return;
    }
    try {
      const current = stateRef.current;
      const res = await fetch(`${API_BASE}/game/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          password: 'loupgarou',
          gameState: current,
          gameId: current.gameId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.log('Sync error:', err);
      }
    } catch (err) {
      console.log('Network sync error:', err);
    }
  }, [stateRef]);

  // ── Load state from server ──
  const loadFromServer = useCallback(async (opts?: { gameId?: string; shortCode?: string }): Promise<GameState | null> => {
    if (localModeRef.current) {
      const gid = opts?.gameId || stateRef.current.gameId;
      if (gid) {
        const cached = localLoadState(gid);
        if (cached) { syncEventCounter(cached.events || []); return cached; }
      }
      if (opts?.shortCode && !gid) {
        const games = localLoadGamesList();
        for (const game of games) {
          const gs = localLoadState(game.id);
          if (gs && gs.players) {
            const found = (gs.players as { shortCode?: string }[]).some((p) => p.shortCode === opts.shortCode);
            if (found) { syncEventCounter(gs.events || []); return gs; }
          }
        }
      }
      return null;
    }
    try {
      const params = new URLSearchParams();
      if (opts?.gameId) params.set('gameId', opts.gameId);
      else if (opts?.shortCode) params.set('shortCode', opts.shortCode);
      else if (stateRef.current.gameId) params.set('gameId', stateRef.current.gameId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/game/state${qs}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) { console.log('Load state error:', res.status); return null; }
      const data = await res.json();
      if (data.gameState) {
        const gs = data.gameState as GameState;
        if (data.gameId && !gs.gameId) gs.gameId = data.gameId;
        // Rehydrate seerResults
        if (gs.seerResults) {
          const rehydrated: Record<number, RoleDefinition | null> = {};
          for (const [key, val] of Object.entries(gs.seerResults)) {
            if (val && typeof val === 'object' && 'id' in val) {
              rehydrated[Number(key)] = getRoleById((val as { id: string }).id) || null;
            } else {
              rehydrated[Number(key)] = val as RoleDefinition | null;
            }
          }
          gs.seerResults = rehydrated;
        }
        // Backward compat migrations
        const gsAny = gs as Record<string, unknown>;
        if (gsAny.seerTarget !== undefined && !gs.seerTargets) { gs.seerTargets = {}; gs.seerResults = {}; }
        if (gsAny.guardTarget !== undefined && !gs.guardTargets) { gs.guardTargets = {}; gs.guardLastTargets = {}; }
        if (gsAny.lovers !== undefined && !gs.loverPairs) {
          gs.loverPairs = gsAny.lovers ? [gsAny.lovers as [number, number]] : [];
          gs.cupidLinkedBy = (gsAny.cupidLinked as boolean) ? [-1] : [];
        }
        if (gsAny.witchHealUsed !== undefined && !gs.witchHealUsedBy) {
          gs.witchHealUsedBy = (gsAny.witchHealUsed as boolean) ? [-1] : [];
          gs.witchKillUsedBy = (gsAny.witchKillUsed as boolean) ? [-1] : [];
          gs.witchKillTargets = (gsAny.witchKillTarget as number | null) != null ? { [-1]: gsAny.witchKillTarget as number } : {};
        }
        if (!gs.hunterPreTargets) gs.hunterPreTargets = {};
        if (typeof (gsAny.witchHealedThisNight) === 'boolean') {
          gs.witchHealedThisNight = (gsAny.witchHealedThisNight as boolean) ? { [-1]: true } : {};
        }
        if (!gs.witchHealedThisNight || typeof gs.witchHealedThisNight !== 'object') gs.witchHealedThisNight = {};
        if (!gs.seerTargets) gs.seerTargets = {};
        if (!gs.seerResults) gs.seerResults = {};
        if (!gs.witchHealUsedBy) gs.witchHealUsedBy = [];
        if (!gs.witchKillUsedBy) gs.witchKillUsedBy = [];
        if (!gs.witchKillTargets) gs.witchKillTargets = {};
        if (!gs.guardTargets) gs.guardTargets = {};
        if (!gs.guardLastTargets) gs.guardLastTargets = {};
        if (!gs.loverPairs) gs.loverPairs = [];
        if (!gs.cupidLinkedBy) gs.cupidLinkedBy = [];
        if (!gs.corbeauTargets) gs.corbeauTargets = {};
        if (!gs.corbeauMessages) gs.corbeauMessages = {};
        if (!gs.corbeauLastTargets) gs.corbeauLastTargets = {};
        if (!gs.earlyVotes) gs.earlyVotes = {};
        if (!gs.foxTargets) gs.foxTargets = {};
        if (!gs.foxResults) gs.foxResults = {};
        if (!gs.conciergeTargets) gs.conciergeTargets = {};
        if (!gs.nominations) gs.nominations = {};
        if (!gs.lastWillUsed) gs.lastWillUsed = {};
        if (!gs.wolfMissedVotes) gs.wolfMissedVotes = {};
        if (!gs.villagerMissedVotes) gs.villagerMissedVotes = {};
        if (!gs.quests) gs.quests = [];
        if (!gs.questAssignments) gs.questAssignments = {};
        if (gs.questsPerPhase === undefined) gs.questsPerPhase = 1;
        if (!gs.questCompletionsThisPhase) gs.questCompletionsThisPhase = {};
        if (!gs.playerTags) gs.playerTags = {};
        if (!gs.availableTags) gs.availableTags = [];
        if (!gs.gameMode) gs.gameMode = 'classic';
        if (!gs.suspectLists) gs.suspectLists = {};
        if (!gs.gmAlerts) gs.gmAlerts = {};
        syncEventCounter(gs.events);
        return gs;
      }
      return null;
    } catch (err) {
      console.log('Network load error:', err);
      return null;
    }
  }, [stateRef]);

  // ── Merge player-driven actions from server ──
  const mergePlayerActions = useCallback(async (): Promise<boolean> => {
    try {
      const serverState = await loadFromServer();
      if (!serverState) return false;
      const s = stateRef.current;

      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

      // ── Merge helpers for hints & playerHints (union, never lose data) ──
      const mergeHints = (local: any[], server: any[]): any[] => {
        const map = new Map<number, any>();
        for (const h of local) map.set(h.id, h);
        for (const h of server) {
          if (!map.has(h.id)) {
            map.set(h.id, h);
          } else {
            // Keep whichever has more data (e.g. imageUrl added later)
            const existing = map.get(h.id);
            map.set(h.id, { ...existing, ...h });
          }
        }
        return Array.from(map.values());
      };

      const mergePlayerHints = (local: any[], server: any[]): any[] => {
        const key = (ph: any) => `${ph.hintId}:${ph.playerId}`;
        const map = new Map<string, any>();
        for (const ph of local) map.set(key(ph), ph);
        for (const ph of server) {
          const k = key(ph);
          const existing = map.get(k);
          if (!existing) {
            map.set(k, ph);
          } else {
            // Prefer revealed=true over revealed=false
            if (ph.revealed && !existing.revealed) {
              map.set(k, { ...existing, ...ph });
            }
          }
        }
        return Array.from(map.values());
      };

      const mergedHints = mergeHints(s.hints ?? [], serverState.hints ?? []);
      const mergedPlayerHints = mergePlayerHints(s.playerHints ?? [], serverState.playerHints ?? []);

      // ── Merge dynamicHints: prefer revealed=true from server (quest rewards) ──
      const mergeDynamicHints = (local: any[], server: any[]): any[] => {
        const map = new Map<number, any>();
        for (const dh of local) map.set(dh.id, dh);
        for (const dh of server) {
          const existing = map.get(dh.id);
          if (!existing) {
            map.set(dh.id, dh);
          } else {
            // Prefer revealed=true (quest rewards should never be lost)
            if (dh.revealed && !existing.revealed) {
              map.set(dh.id, { ...existing, ...dh });
            }
          }
        }
        return Array.from(map.values());
      };

      const mergedDynamicHints = mergeDynamicHints(s.dynamicHints ?? [], serverState.dynamicHints ?? []);

      // ── Merge quests: keep local quest list as structural authority ──
      // GM is the only creator/editor of quests. Only merge player-driven
      // fields (playerStatuses, task playerAnswers/playerResults, collaborativeVotes)
      // from the server so that newly-created quests aren't wiped by a stale read.
      const mergeQuests = (local: any[], server: any[]): any[] => {
        const serverMap = new Map<number, any>();
        for (const q of server) serverMap.set(q.id, q);
        // Start from local (preserves quests not yet synced)
        const merged = local.map((lq: any) => {
          const sq = serverMap.get(lq.id);
          if (!sq) return lq; // quest exists locally only — keep as-is
          // Merge player-driven data from server into local quest structure
          const mergedTasks = lq.tasks.map((lt: any, idx: number) => {
            const st = sq.tasks?.[idx];
            if (!st) return lt;
            return {
              ...lt,
              playerAnswers: { ...lt.playerAnswers, ...st.playerAnswers },
              playerResults: { ...lt.playerResults, ...st.playerResults },
            };
          });
          return {
            ...lq,
            playerStatuses: { ...lq.playerStatuses, ...sq.playerStatuses },
            collaborativeVotes: { ...lq.collaborativeVotes, ...sq.collaborativeVotes },
            rewardHintIds: { ...(lq.rewardHintIds || {}), ...(sq.rewardHintIds || {}) },
            tasks: mergedTasks,
          };
        });
        // Also add any server-only quests (e.g. restored from another GM session)
        for (const sq of server) {
          if (!local.some((lq: any) => lq.id === sq.id)) {
            merged.push(sq);
          }
        }
        return merged;
      };

      // ── Merge questAssignments: union of local + server ──
      const mergeQuestAssignments = (
        local: Record<number, number[]>,
        server: Record<number, number[]>,
      ): Record<number, number[]> => {
        const result: Record<number, number[]> = {};
        const allKeys = new Set([
          ...Object.keys(local).map(Number),
          ...Object.keys(server).map(Number),
        ]);
        for (const pid of allKeys) {
          const lq = local[pid] || [];
          const sq = server[pid] || [];
          const union = [...new Set([...lq, ...sq])];
          result[pid] = union;
        }
        return result;
      };

      const mergedQuests = mergeQuests(s.quests ?? [], serverState.quests ?? []);
      const mergedQuestAssignments = mergeQuestAssignments(
        s.questAssignments ?? {},
        serverState.questAssignments ?? {},
      );

      // ── Union merge villagePresentIds & midGameJoinIds (append-only, never lose a join) ──
      const mergedVillagePresentIds: number[] = [
        ...new Set([
          ...(Array.isArray(s.villagePresentIds) ? s.villagePresentIds : []),
          ...(Array.isArray(serverState.villagePresentIds) ? serverState.villagePresentIds : []),
        ]),
      ];
      const mergedMidGameJoinIds: number[] = [
        ...new Set([
          ...(Array.isArray(s.midGameJoinIds) ? s.midGameJoinIds : []),
          ...(Array.isArray(serverState.midGameJoinIds) ? serverState.midGameJoinIds : []),
        ]),
      ];

      const unchanged =
        same(serverState.votes, s.votes) &&
        same(serverState.werewolfVotes, s.werewolfVotes) &&
        same(serverState.seerTargets, s.seerTargets) &&
        same(serverState.witchHealUsedBy, s.witchHealUsedBy) &&
        same(serverState.witchHealedThisNight ?? {}, s.witchHealedThisNight ?? {}) &&
        same(serverState.witchKillUsedBy, s.witchKillUsedBy) &&
        same(serverState.witchKillTargets, s.witchKillTargets) &&
        same(serverState.loverPairs, s.loverPairs) &&
        same(serverState.cupidLinkedBy, s.cupidLinkedBy) &&
        same(serverState.roleRevealedBy ?? [], s.roleRevealedBy ?? []) &&
        same(serverState.guardTargets, s.guardTargets) &&
        same(mergedPlayerHints, s.playerHints ?? []) &&
        same(mergedHints, s.hints ?? []) &&
        same(mergedDynamicHints, s.dynamicHints ?? []) &&
        same(serverState.corbeauTargets ?? {}, s.corbeauTargets ?? {}) &&
        same(serverState.corbeauMessages ?? {}, s.corbeauMessages ?? {}) &&
        same(serverState.corbeauLastTargets ?? {}, s.corbeauLastTargets ?? {}) &&
        same(serverState.maireVotes ?? {}, s.maireVotes ?? {}) &&
        same(serverState.maireCandidates ?? [], s.maireCandidates ?? []) &&
        same(serverState.maireCampaignMessages ?? {}, s.maireCampaignMessages ?? {}) &&
        same(serverState.hunterPreTargets ?? {}, s.hunterPreTargets ?? {}) &&
        same(serverState.earlyVotes ?? {}, s.earlyVotes ?? {}) &&
        same(serverState.foxTargets ?? {}, s.foxTargets ?? {}) &&
        same(serverState.foxResults ?? {}, s.foxResults ?? {}) &&
        same(serverState.conciergeTargets ?? {}, s.conciergeTargets ?? {}) &&
        same(serverState.nominations ?? {}, s.nominations ?? {}) &&
        same(serverState.lastWillUsed ?? {}, s.lastWillUsed ?? {}) &&
        same(serverState.wolfMissedVotes ?? {}, s.wolfMissedVotes ?? {}) &&
        same(serverState.villagerMissedVotes ?? {}, s.villagerMissedVotes ?? {}) &&
        same(mergedQuests.map((q: any) => ({ pa: q.tasks?.map((t: any) => t.playerAnswers), ps: q.playerStatuses, cv: q.collaborativeVotes })),
             (s.quests ?? []).map((q: any) => ({ pa: q.tasks?.map((t: any) => t.playerAnswers), ps: q.playerStatuses, cv: q.collaborativeVotes }))) &&
        same(mergedQuestAssignments, s.questAssignments ?? {}) &&
        same(mergedVillagePresentIds, s.villagePresentIds ?? []) &&
        same(mergedMidGameJoinIds, s.midGameJoinIds ?? []);

      if (unchanged) return false;

      setState((s) => ({
        ...s,
        votes: serverState.votes ?? s.votes,
        werewolfVotes: serverState.werewolfVotes ?? s.werewolfVotes,
        seerTargets: serverState.seerTargets ?? s.seerTargets,
        seerResults: serverState.seerResults ?? s.seerResults,
        witchHealUsedBy: serverState.witchHealUsedBy || s.witchHealUsedBy,
        witchKillUsedBy: serverState.witchKillUsedBy !== undefined ? serverState.witchKillUsedBy : s.witchKillUsedBy,
        witchKillTargets: serverState.witchKillTargets !== undefined ? serverState.witchKillTargets : s.witchKillTargets,
        witchHealedThisNight: { ...(s.witchHealedThisNight || {}), ...(serverState.witchHealedThisNight || {}) },
        loverPairs: serverState.loverPairs ?? s.loverPairs,
        cupidLinkedBy: serverState.cupidLinkedBy || s.cupidLinkedBy,
        roleRevealedBy: serverState.roleRevealedBy ?? s.roleRevealedBy ?? [],
        guardTargets: serverState.guardTargets !== undefined ? serverState.guardTargets : s.guardTargets,
        corbeauTargets: serverState.corbeauTargets !== undefined ? serverState.corbeauTargets : s.corbeauTargets,
        corbeauMessages: serverState.corbeauMessages !== undefined ? serverState.corbeauMessages : s.corbeauMessages,
        corbeauLastTargets: serverState.corbeauLastTargets !== undefined ? serverState.corbeauLastTargets : s.corbeauLastTargets,
        maireVotes: serverState.maireVotes ?? s.maireVotes,
        maireCandidates: serverState.maireCandidates ?? s.maireCandidates ?? [],
        maireCampaignMessages: serverState.maireCampaignMessages ?? s.maireCampaignMessages ?? {},
        hints: mergedHints,
        playerHints: mergedPlayerHints,
        dynamicHints: mergedDynamicHints,
        hunterPreTargets: serverState.hunterPreTargets !== undefined ? serverState.hunterPreTargets : s.hunterPreTargets,
        earlyVotes: serverState.earlyVotes !== undefined ? serverState.earlyVotes : s.earlyVotes,
        foxTargets: serverState.foxTargets !== undefined ? serverState.foxTargets : s.foxTargets,
        foxResults: serverState.foxResults !== undefined ? serverState.foxResults : s.foxResults,
        conciergeTargets: serverState.conciergeTargets !== undefined ? serverState.conciergeTargets : s.conciergeTargets,
        nominations: serverState.nominations !== undefined ? serverState.nominations : s.nominations,
        lastWillUsed: serverState.lastWillUsed !== undefined ? serverState.lastWillUsed : s.lastWillUsed,
        wolfMissedVotes: serverState.wolfMissedVotes !== undefined ? serverState.wolfMissedVotes : s.wolfMissedVotes,
        villagerMissedVotes: serverState.villagerMissedVotes !== undefined ? serverState.villagerMissedVotes : s.villagerMissedVotes,
        quests: mergedQuests,
        questAssignments: mergedQuestAssignments,
        questsPerPhase: serverState.questsPerPhase !== undefined ? serverState.questsPerPhase : s.questsPerPhase,
        questCompletionsThisPhase: serverState.questCompletionsThisPhase !== undefined ? serverState.questCompletionsThisPhase : s.questCompletionsThisPhase,
        playerTags: serverState.playerTags !== undefined ? serverState.playerTags : s.playerTags,
        availableTags: serverState.availableTags !== undefined ? serverState.availableTags : s.availableTags,
        gameMode: serverState.gameMode !== undefined ? serverState.gameMode : s.gameMode,
        suspectLists: serverState.suspectLists !== undefined ? serverState.suspectLists : s.suspectLists,
        gmAlerts: serverState.gmAlerts !== undefined ? serverState.gmAlerts : s.gmAlerts,
        villagePresentIds: mergedVillagePresentIds,
        midGameJoinIds: mergedMidGameJoinIds,
      }));
      return true;
    } catch (err) {
      console.log('Merge player actions error:', err);
      return false;
    }
  }, [loadFromServer, stateRef, setState]);

  // ── setFullState: used by player polling ──
  const setFullState = useCallback((incoming: GameState) => {
    syncEventCounter(incoming.events);
    setState((prev) => {
      const next = { ...incoming, hypotheses: prev.hypotheses };

      // Safety net: preserve villagePresentIds membership for players already present.
      // A stale GM broadcast could omit a player who just joined — union merge prevents
      // a player from being silently moved back to "away".
      if (Array.isArray(prev.villagePresentIds) && prev.villagePresentIds.length > 0) {
        const incomingPresent: number[] = Array.isArray(next.villagePresentIds) ? next.villagePresentIds : [];
        const merged = [...new Set([...incomingPresent, ...prev.villagePresentIds])];
        if (merged.length !== incomingPresent.length) {
          next.villagePresentIds = merged;
        }
      }

      try {
        const { hypotheses: _h1, ...prevRest } = prev;
        const { hypotheses: _h2, ...nextRest } = next;
        if (JSON.stringify(prevRest) === JSON.stringify(nextRest)) return prev;
      } catch { /* fall through */ }
      return next;
    });
    // Full state resets the delta version tracker
    lastDeltaVersionRef.current = -1;
    recoveryNeededRef.current = false;
  }, [setState]);

  // ── Delta version tracking for gap detection ──
  const lastDeltaVersionRef = useRef(-1); // -1 = no delta received yet
  const recoveryNeededRef = useRef(false);

  // ── applyStateDelta: used by player/spectator realtime delta ──
  const applyStateDelta = useCallback((delta: StateDelta) => {
    const version = delta._v;

    // Version gap detection: if we've received deltas before and there's a gap, flag recovery
    if (lastDeltaVersionRef.current >= 0 && version > lastDeltaVersionRef.current + 1) {
      console.log(`[deltaSync] Version gap detected: expected ${lastDeltaVersionRef.current + 1}, got ${version}. Flagging recovery.`);
      recoveryNeededRef.current = true;
    }
    lastDeltaVersionRef.current = version;

    setState((prev) => {
      const next = applyDelta(prev, delta);
      // Rehydrate seerResults in the delta if present
      if (delta.seerResults && next.seerResults) {
        const rehydrated: Record<number, RoleDefinition | null> = {};
        for (const [key, val] of Object.entries(next.seerResults)) {
          if (val && typeof val === 'object' && 'id' in val) {
            rehydrated[Number(key)] = getRoleById((val as { id: string }).id) || null;
          } else {
            rehydrated[Number(key)] = val as RoleDefinition | null;
          }
        }
        next.seerResults = rehydrated;
      }
      // Safety net: if delta contains villagePresentIds, union-merge with previous
      // so that a stale GM delta cannot remove a player who already joined.
      if (delta.villagePresentIds && Array.isArray(prev.villagePresentIds) && prev.villagePresentIds.length > 0) {
        const incoming: number[] = Array.isArray(next.villagePresentIds) ? next.villagePresentIds : [];
        const merged = [...new Set([...incoming, ...prev.villagePresentIds])];
        if (merged.length !== incoming.length) {
          next.villagePresentIds = merged;
        }
      }
      if (next.events) syncEventCounter(next.events);
      return next;
    });
  }, [setState]);

  /** Check if delta recovery is needed (version gap detected) */
  const isDeltaRecoveryNeeded = useCallback(() => recoveryNeededRef.current, []);
  /** Clear the recovery flag (after full state refresh) */
  const clearDeltaRecovery = useCallback(() => { recoveryNeededRef.current = false; lastDeltaVersionRef.current = -1; }, []);

  return {
    localMode,
    localModeRef,
    syncToServer,
    loadFromServer,
    mergePlayerActions,
    setFullState,
    applyStateDelta,
    isDeltaRecoveryNeeded,
    clearDeltaRecovery,
  };
}