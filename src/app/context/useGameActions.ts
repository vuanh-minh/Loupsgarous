/**
 * useGameActions.ts
 * All game-action callbacks for GameContext.
 * Each receives `setState` + `stateRef` from the provider.
 * (cache-bust: v2 — lastWillUsed voteHistory filter)
 */
import { useCallback } from 'react';
import { getRoleById } from '../data/roles';
import type { Player, GamePhase, GameState, GameEvent } from './gameTypes';
import {
  AVATARS, generateShortCode, nextEventId,
  defaultRoleConfig, initialState,
  localSaveState,
} from './gameContextConstants';
import { API_BASE, publicAnonKey } from './apiConfig';

type SetState = React.Dispatch<React.SetStateAction<GameState>>;

interface ActionsDeps {
  setState: SetState;
  stateRef: React.MutableRefObject<GameState>;
  localModeRef: React.MutableRefObject<boolean>;
}

export function useGameActions({ setState, stateRef, localModeRef }: ActionsDeps) {

  /** Check if a player is "away" (not present in the village). */
  const isAway = (s: GameState, playerId: number): boolean => {
    if (!s.villagePresentIds) return false;
    return !s.villagePresentIds.includes(playerId);
  };

  const setScreen = useCallback((screen: GameState['screen']) => {
    setState((s) => ({ ...s, screen }));
  }, [setState]);

  const updateRoleConfig = useCallback((roleId: string, count: number) => {
    setState((s) => ({
      ...s,
      roleConfig: { ...s.roleConfig, [roleId]: Math.max(0, count) },
    }));
  }, [setState]);

  const setupPlayers = useCallback((count: number, names?: string[], avatarUrls?: (string | undefined)[], shortCodes?: (string | undefined)[]) => {
    const existingCodes = new Set<string>();
    // Pre-register any provided shortCodes to avoid collisions
    if (shortCodes) {
      shortCodes.forEach((c) => { if (c) existingCodes.add(c); });
    }
    const players: Player[] = Array.from({ length: count }, (_, i) => {
      const playerName = names?.[i] || `Joueur ${i + 1}`;
      const code = shortCodes?.[i] || generateShortCode(playerName, existingCodes);
      existingCodes.add(code);
      return {
        id: i,
        shortCode: code,
        name: playerName,
        role: '',
        alive: true,
        avatar: AVATARS[i % AVATARS.length],
        avatarUrl: avatarUrls?.[i] || undefined,
        votesReceived: 0,
      };
    });
    setState((s) => ({ ...s, players }));
  }, [setState]);

  const assignRoles = useCallback((preAssignments?: Record<number, string>) => {
    setState((s) => {
      // Build the full role pool from config
      const rolePool: string[] = [];
      Object.entries(s.roleConfig).forEach(([roleId, count]) => {
        for (let i = 0; i < count; i++) rolePool.push(roleId);
      });

      // Remove pre-assigned roles from the pool (one instance per assignment)
      const remainingPool = [...rolePool];
      const validAssignments: Record<number, string> = {};
      if (preAssignments) {
        for (const [idxStr, roleId] of Object.entries(preAssignments)) {
          const idx = Number(idxStr);
          const poolIdx = remainingPool.indexOf(roleId);
          if (poolIdx !== -1) {
            remainingPool.splice(poolIdx, 1);
            validAssignments[idx] = roleId;
          }
        }
      }

      // Shuffle the remaining pool for unassigned players
      for (let i = remainingPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingPool[i], remainingPool[j]] = [remainingPool[j], remainingPool[i]];
      }

      // Assign roles: pre-assigned first, then fill from shuffled remaining
      let poolCursor = 0;
      const players = s.players.map((p, idx) => {
        if (validAssignments[idx]) {
          return { ...p, role: validAssignments[idx] };
        }
        const role = remainingPool[poolCursor] || 'villageois';
        poolCursor++;
        return { ...p, role };
      });
      return { ...s, players };
    });
  }, [setState]);

  const setPhase = useCallback((phase: GamePhase) => {
    setState((s) => ({ ...s, phase, timerRunning: false }));
  }, [setState]);

  const setNightStep = useCallback((step: GameState['nightStep']) => {
    setState((s) => ({ ...s, nightStep: step }));
  }, [setState]);

  const setDayStep = useCallback((step: GameState['dayStep']) => {
    setState((s) => ({ ...s, dayStep: step }));
  }, [setState]);

  const addEvent = useCallback((message: string) => {
    setState((s) => ({
      ...s,
      events: [
        ...s.events,
        {
          id: nextEventId(),
          turn: s.turn,
          phase: s.phase,
          message,
          timestamp: new Date().toISOString(),
        },
      ],
    }));
  }, [setState]);

  const setTimer = useCallback((seconds: number) => {
    setState((s) => ({ ...s, timer: seconds }));
  }, [setState]);

  const toggleTimer = useCallback(() => {
    setState((s) => ({ ...s, timerRunning: !s.timerRunning }));
  }, [setState]);

  const tickTimer = useCallback(() => {
    setState((s) => {
      if (!s.timerRunning || s.timer <= 0) return { ...s, timerRunning: false };
      return { ...s, timer: s.timer - 1 };
    });
  }, [setState]);

  const eliminatePlayer = useCallback((playerId: number) => {
    setState((s) => {
      // Away players can only be eliminated by the GM (manual action).
      // Game-mechanic callers (wolf vote, witch kill, etc.) already guard
      // against targeting away players upstream, so no check is needed here.

      let newPlayers = s.players.map((p) =>
        p.id === playerId ? { ...p, alive: false, justRevived: false } : p
      );
      const events = [...s.events];
      let hunterPending = s.hunterPending;
      let hunterShooterId = s.hunterShooterId;

      if (s.loverPairs) {
        for (const [l1, l2] of s.loverPairs) {
          let loverId: number | null = null;
          if (playerId === l1) loverId = l2;
          if (playerId === l2) loverId = l1;
          if (loverId !== null) {
            const lover = newPlayers.find((p) => p.id === loverId);
            if (lover && lover.alive) {
              newPlayers = newPlayers.map((p) =>
                p.id === loverId ? { ...p, alive: false } : p
              );
              events.push({
                id: nextEventId(), turn: s.turn, phase: s.phase,
                message: `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`,
                timestamp: new Date().toISOString(),
              });
              if (lover.role === 'chasseur') { hunterPending = true; hunterShooterId = loverId; }
            }
          }
        }
      }

      const eliminated = s.players.find((p) => p.id === playerId);
      if (eliminated?.role === 'chasseur' && eliminated.alive) {
        hunterPending = true;
        hunterShooterId = playerId;
      }

      // Mayor succession: if any newly dead player was the Maire
      let maireSuccessionPending = s.maireSuccessionPending;
      let maireSuccessionFromId = s.maireSuccessionFromId;
      let maireSuccessionPhase = s.maireSuccessionPhase;
      let newMaireId = s.maireId;
      for (const p of newPlayers) {
        if (!p.alive && s.players.find(op => op.id === p.id)?.alive && newMaireId === p.id) {
          const mp = s.players.find(pl => pl.id === newMaireId);
          maireSuccessionPending = true;
          maireSuccessionFromId = newMaireId;
          maireSuccessionPhase = s.phase;
          events.push({
            id: nextEventId(), turn: s.turn, phase: s.phase,
            message: `👑 Le Maire ${mp?.name || 'inconnu'} est mort. Un successeur doit etre designe.`,
            timestamp: new Date().toISOString(),
          });
          newMaireId = null;
          break;
        }
      }

      return { ...s, players: newPlayers, events, hunterPending, hunterShooterId, maireSuccessionPending, maireSuccessionFromId, maireSuccessionPhase, maireId: newMaireId };
    });
  }, [setState]);

  const revivePlayer = useCallback((playerId: number, newRole?: string) => {
    setState((s) => {
      const newPlayers = s.players.map((p) =>
        p.id === playerId ? { ...p, alive: true, ...(newRole ? { role: newRole } : {}), justRevived: true } : p
      );
      return { ...s, players: newPlayers };
    });
  }, [setState]);

  const setWerewolfTarget = useCallback((playerId: number | null) => {
    setState((s) => ({
      ...s,
      werewolfTarget: playerId,
      ...(playerId === null ? { werewolfVotes: {}, werewolfVoteMessages: {}, werewolfTargets: [] } : {}),
    }));
  }, [setState]);

  const castWerewolfVote = useCallback((wolfId: number, targetId: number, message?: string) => {
    setState((s) => {
      // Cannot target an away player
      if (isAway(s, targetId)) return s;
      if (s.werewolfVotes[wolfId] === targetId) {
        const { [wolfId]: _, ...rest } = s.werewolfVotes;
        const { [wolfId]: _m, ...restMsg } = (s.werewolfVoteMessages || {});
        return { ...s, werewolfVotes: rest, werewolfVoteMessages: restMsg };
      }
      const msgs = { ...(s.werewolfVoteMessages || {}) };
      if (message && message.trim()) {
        msgs[wolfId] = message.trim();
      } else {
        delete msgs[wolfId];
      }
      return { ...s, werewolfVotes: { ...s.werewolfVotes, [wolfId]: targetId }, werewolfVoteMessages: msgs };
    });
  }, [setState]);

  const setSeerTarget = useCallback((seerPlayerId: number, targetPlayerId: number | null) => {
    setState((s) => {
      if (targetPlayerId === null) {
        const { [seerPlayerId]: _, ...restTargets } = s.seerTargets;
        const { [seerPlayerId]: __, ...restResults } = s.seerResults;
        return { ...s, seerTargets: restTargets, seerResults: restResults };
      }
      const target = s.players.find((p) => p.id === targetPlayerId);
      const role = target ? getRoleById(target.role) : null;
      const hypotheses = { ...s.hypotheses };
      if (target) {
        hypotheses[seerPlayerId] = { ...(hypotheses[seerPlayerId] || {}), [targetPlayerId]: target.role };
      }
      return {
        ...s,
        seerTargets: { ...s.seerTargets, [seerPlayerId]: targetPlayerId },
        seerResults: { ...s.seerResults, [seerPlayerId]: role || null },
        hypotheses,
      };
    });
  }, [setState]);

  const confirmWerewolfKill = useCallback(() => {
    setState((s) => {
      const votes = s.werewolfVotes;
      if (Object.keys(votes).length === 0) return s;

      const voteCounts: Record<number, number> = {};
      Object.values(votes).forEach((targetId) => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      });

      const maxKills = Math.max(1, s.wolfKillsPerNight || 1);
      const sortedTargets = Object.entries(voteCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKills)
        .map(([id]) => parseInt(id));

      const primaryTarget = sortedTargets[0] ?? null;
      const primaryPlayer = s.players.find((p) => p.id === primaryTarget);

      const wasHealed = Object.keys(s.witchHealedThisNight || {}).length > 0;
      const finalTargets = wasHealed
        ? sortedTargets.filter((id) => id !== primaryTarget)
        : [...sortedTargets];
      const finalPrimary = wasHealed ? null : primaryTarget;

      const targetNames = sortedTargets
        .map((id) => s.players.find((p) => p.id === id)?.name || 'une victime')
        .join(' et ');
      const message = wasHealed
        ? sortedTargets.length === 1
          ? `Les Loups-Garous ont choisi ${primaryPlayer?.name || 'une victime'}, mais la Sorciere l'a sauvee.`
          : `Les Loups-Garous ont choisi ${targetNames}. La Sorciere a sauve ${primaryPlayer?.name || 'la victime principale'}.`
        : `Les Loups-Garous ont choisi ${targetNames}.`;

      return {
        ...s,
        werewolfTarget: finalPrimary,
        werewolfTargets: sortedTargets,
        witchHealTarget: primaryTarget,
        events: [
          ...s.events,
          { id: nextEventId(), turn: s.turn, phase: 'night' as GamePhase, message, timestamp: new Date().toISOString() },
        ],
      };
    });
  }, [setState]);

  const confirmSeerReveal = useCallback(() => {
    // No-op: seer reveal is now handled per-player in setSeerTarget
  }, []);

  const useWitchHeal = useCallback((witchPlayerId: number) => {
    setState((s) => ({
      ...s,
      witchHealUsedBy: [...s.witchHealUsedBy, witchPlayerId],
      werewolfTarget: null,
      witchHealedThisNight: { ...s.witchHealedThisNight, [witchPlayerId]: true },
    }));
  }, [setState]);

  const useWitchKill = useCallback((witchPlayerId: number, targetPlayerId: number) => {
    setState((s) => {
      // Cannot target an away player
      if (isAway(s, targetPlayerId)) return s;
      return {
        ...s,
        witchKillUsedBy: [...s.witchKillUsedBy, witchPlayerId],
        witchKillTargets: { ...s.witchKillTargets, [witchPlayerId]: targetPlayerId },
      };
    });
  }, [setState]);

  const cancelWitchKill = useCallback((witchPlayerId: number) => {
    setState((s) => {
      const newUsedBy = s.witchKillUsedBy.filter((id) => id !== witchPlayerId);
      const { [witchPlayerId]: _, ...restTargets } = s.witchKillTargets;
      return { ...s, witchKillUsedBy: newUsedBy, witchKillTargets: restTargets };
    });
  }, [setState]);

  const castVote = useCallback((voterId: number, targetId: number) => {
    setState((s) => {
      // Cannot vote for an away player
      if (isAway(s, targetId)) return s;

      const newNominations = { ...s.nominations };
      // Track who first nominated this target
      if (!(targetId in newNominations)) {
        newNominations[targetId] = voterId;
      }
      return { ...s, votes: { ...s.votes, [voterId]: targetId }, nominations: newNominations };
    });
  }, [setState]);

  const cancelVote = useCallback((voterId: number) => {
    setState((s) => {
      const { [voterId]: _, ...rest } = s.votes;
      return { ...s, votes: rest };
    });
  }, [setState]);

  const resolveVote = useCallback(() => {
    setState((s) => {
      // Exclude away players from the active voter/target pool
      const awaySet = s.villagePresentIds ? new Set(s.players.filter((p) => p.alive && !s.villagePresentIds!.includes(p.id)).map((p) => p.id)) : new Set<number>();
      const alivePlayers = s.players.filter((p) => p.alive && !awaySet.has(p.id));
      const aliveIds = alivePlayers.map((p) => p.id);
      const aliveIdSet = new Set(aliveIds);
      const abstainerSet = new Set(alivePlayers.filter((p) => !(p.id in s.votes)).map((p) => p.id));
      const updatedVotes = { ...s.votes };
      const abstentionEvents: GameEvent[] = [];

      // Assign random vote for abstainers only if the setting is enabled
      const shouldRandomVote = s.randomVoteIfInactive !== false;
      if (shouldRandomVote) {
        for (const abstainer of alivePlayers.filter((p) => abstainerSet.has(p.id))) {
          const candidates = aliveIds.filter((id) => id !== abstainer.id);
          if (candidates.length === 0) continue;
          const randomTarget = candidates[Math.floor(Math.random() * candidates.length)];
          updatedVotes[abstainer.id] = randomTarget;
          const targetPlayer = s.players.find((p) => p.id === randomTarget);
          abstentionEvents.push({
            id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
            message: `[Abstention] ${abstainer.name} n'a pas vote → ${targetPlayer?.name || 'Joueur ' + randomTarget} (vote aleatoire)`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // ── Villager inactivity tracking ──
      const villagerThreshold = s.villagerInactivityThreshold ?? 2;
      const newVillagerMissed = { ...(s.villagerMissedVotes || {}) };
      let newPlayers = [...s.players];
      let hunterPending = s.hunterPending;
      let hunterShooterId = s.hunterShooterId;
      const inactivityEvents: GameEvent[] = [];

      if (villagerThreshold > 0) {
        for (const p of alivePlayers) {
          if (abstainerSet.has(p.id)) {
            newVillagerMissed[p.id] = (newVillagerMissed[p.id] || 0) + 1;
            if (newVillagerMissed[p.id] >= villagerThreshold) {
              newPlayers = newPlayers.map((pl) => pl.id === p.id ? { ...pl, alive: false } : pl);
              inactivityEvents.push({
                id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
                message: `🚪 ${p.name} a fui le village\u2026`,
                timestamp: new Date().toISOString(),
              });
              newVillagerMissed[p.id] = 0;
              // Remove from alive tracking so their vote doesn't count
              aliveIdSet.delete(p.id);
              // Handle lover pair death
              if (s.loverPairs) {
                for (const [l1, l2] of s.loverPairs) {
                  let loverId: number | null = null;
                  if (p.id === l1) loverId = l2;
                  if (p.id === l2) loverId = l1;
                  if (loverId !== null) {
                    const lover = newPlayers.find((pl) => pl.id === loverId);
                    if (lover && lover.alive) {
                      newPlayers = newPlayers.map((pl) => pl.id === loverId ? { ...pl, alive: false } : pl);
                      inactivityEvents.push({
                        id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
                        message: `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`,
                        timestamp: new Date().toISOString(),
                      });
                      aliveIdSet.delete(loverId!);
                      if (lover.role === 'chasseur') { hunterPending = true; hunterShooterId = loverId; }
                    }
                  }
                }
              }
              if (p.role === 'chasseur') { hunterPending = true; hunterShooterId = p.id; }
            }
          } else {
            newVillagerMissed[p.id] = 0;
          }
        }
      }

      // Count votes: alive players + dead players who used dernière volonté
      const lastWillUsed = s.lastWillUsed ?? {};
      const voteCounts: Record<number, number> = {};
      Object.entries(updatedVotes).forEach(([voterId, targetId]) => {
        const vid = parseInt(voterId);
        // Skip dead players UNLESS they used dernière volonté; also skip inactivity-eliminated
        if (!aliveIdSet.has(vid) && !lastWillUsed[vid]) return;
        const weight = (s.maireId !== null && vid === s.maireId) ? 2 : 1;
        voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
      });

      let maxVotes = 0;
      const topCandidates: number[] = [];
      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          topCandidates.length = 0;
          topCandidates.push(parseInt(id));
        } else if (count === maxVotes) {
          topCandidates.push(parseInt(id));
        }
      });

      // ── Multi-elimination support ──
      const maxEliminations = Math.max(1, s.dayEliminationsCount || 1);
      const allEliminated: number[] = [];

      if (maxEliminations === 1) {
        // Original single-elimination logic
        let eliminated: number | null = null;
        if (topCandidates.length === 1) {
          eliminated = topCandidates[0];
        } else if (topCandidates.length > 1 && s.maireId !== null) {
          const maireChoice = updatedVotes[s.maireId];
          if (maireChoice !== undefined && topCandidates.includes(maireChoice)) {
            eliminated = maireChoice;
          } else {
            eliminated = topCandidates[0];
          }
        } else if (topCandidates.length > 1) {
          eliminated = topCandidates[0];
        }
        if (eliminated !== null) {
          const target = newPlayers.find((p) => p.id === eliminated);
          if (target?.alive) {
            allEliminated.push(eliminated);
          }
        }
      } else {
        // Multi-elimination: take top N by vote count
        const sorted = Object.entries(voteCounts)
          .map(([id, count]) => ({ id: parseInt(id), count }))
          .sort((a, b) => b.count - a.count);
        
        for (const entry of sorted) {
          if (allEliminated.length >= maxEliminations) break;
          if (entry.count === 0) break;
          const target = newPlayers.find((p) => p.id === entry.id);
          if (target?.alive) {
            allEliminated.push(entry.id);
          }
        }
        // Handle tie at the cutoff: if the last included and next excluded have the same count,
        // use Maire's choice to break tie, or keep as-is
        if (allEliminated.length > 0 && sorted.length > allEliminated.length) {
          const cutoffCount = voteCounts[allEliminated[allEliminated.length - 1]];
          const nextCount = sorted[allEliminated.length]?.count || 0;
          if (cutoffCount === nextCount && s.maireId !== null) {
            // Maire breaks the tie — keep the one the Maire voted for
            const maireChoice = updatedVotes[s.maireId];
            const tiedIds = sorted.filter((e) => e.count === cutoffCount).map((e) => e.id);
            if (maireChoice !== undefined && tiedIds.includes(maireChoice)) {
              // Make sure Maire's choice is included in the last slot
              const lastIdx = allEliminated.length - 1;
              if (!allEliminated.includes(maireChoice)) {
                allEliminated[lastIdx] = maireChoice;
              }
            }
          }
        }
      }

      // Apply eliminations
      for (const elimId of allEliminated) {
        const votes4player = voteCounts[elimId] || 0;
        newPlayers = newPlayers.map((p) =>
          p.id === elimId ? { ...p, alive: false, votesReceived: votes4player } : p
        );
      }

      const events: GameEvent[] = [
        ...s.events,
        ...inactivityEvents,
        ...abstentionEvents,
      ];

      if (allEliminated.length === 0) {
        events.push({
          id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
          message: 'Aucune elimination - egalite des votes.',
          timestamp: new Date().toISOString(),
        });
      } else {
        for (const elimId of allEliminated) {
          const target = s.players.find((p) => p.id === elimId);
          const votes4player = voteCounts[elimId] || 0;
          events.push({
            id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
            message: `${target?.name || 'Un joueur'} a ete elimine par le village avec ${votes4player} vote(s).`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Lover pair deaths for all eliminated
      for (const elimId of allEliminated) {
        if (s.loverPairs) {
          for (const [l1, l2] of s.loverPairs) {
            let loverId: number | null = null;
            if (elimId === l1) loverId = l2;
            if (elimId === l2) loverId = l1;
            if (loverId !== null) {
              const lover = newPlayers.find((p) => p.id === loverId);
              if (lover && lover.alive) {
                newPlayers = newPlayers.map((p) =>
                  p.id === loverId ? { ...p, alive: false } : p
                );
                events.push({
                  id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
                  message: `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`,
                  timestamp: new Date().toISOString(),
                });
                if (lover.role === 'chasseur') { hunterPending = true; hunterShooterId = loverId; }
              }
            }
          }
        }
      }

      // Hunter trigger for all eliminated
      for (const elimId of allEliminated) {
        const eliminatedPlayer = newPlayers.find((p) => p.id === elimId);
        if (eliminatedPlayer?.role === 'chasseur' && !eliminatedPlayer.alive) {
          hunterPending = true;
          hunterShooterId = elimId;
        }
      }

      // Mayor succession in resolveVote: check if any newly dead player was the Maire
      let maireSuccessionPending = s.maireSuccessionPending;
      let maireSuccessionFromId = s.maireSuccessionFromId;
      let maireSuccessionPhase = s.maireSuccessionPhase;
      let resolvedMaireId = s.maireId;
      for (const p of newPlayers) {
        if (!p.alive && s.players.find(op => op.id === p.id)?.alive && resolvedMaireId === p.id) {
          const mairePlayer = s.players.find(pl => pl.id === resolvedMaireId);
          maireSuccessionPending = true;
          maireSuccessionFromId = resolvedMaireId;
          maireSuccessionPhase = s.phase;
          events.push({
            id: nextEventId(), turn: s.turn, phase: 'day' as GamePhase,
            message: `👑 Le Maire ${mairePlayer?.name || 'inconnu'} est mort. Un successeur doit etre designe.`,
            timestamp: new Date().toISOString(),
          });
          resolvedMaireId = null;
          break;
        }
      }

      const primaryEliminated = allEliminated.length > 0 ? allEliminated[0] : null;

      return {
        ...s,
        players: newPlayers,
        votes: updatedVotes,
        voteResult: primaryEliminated,
        voteResults: allEliminated,
        events,
        hunterPending,
        hunterShooterId,
        maireSuccessionPending,
        maireSuccessionFromId,
        maireSuccessionPhase,
        maireId: resolvedMaireId,
        villagerMissedVotes: newVillagerMissed,
        voteHistory: [
          ...s.voteHistory,
          {
            turn: s.turn,
            // Only store votes from alive players or dead players who used dernière volonté
            votes: Object.fromEntries(
              Object.entries(updatedVotes).filter(([vid]) => {
                const id = parseInt(vid);
                return aliveIdSet.has(id) || lastWillUsed[id];
              })
            ) as Record<number, number>,
            eliminated: primaryEliminated,
            nominations: { ...s.nominations },
          },
        ],
      };
    });
  }, [setState]);

  const checkWinCondition = useCallback((): 'village' | 'werewolf' | 'lovers' | null => {
    const state = stateRef.current;
    if (state.screen !== 'game') return null;
    if (state.players.length === 0) return null;
    if (state.winner) return null;

    const alivePlayers = state.players.filter((p) => p.alive);
    const isEvilTeam = (role: string) => { const def = getRoleById(role); return def?.team === 'werewolf'; };
    const aliveWerewolves = alivePlayers.filter((p) => isEvilTeam(p.role));
    const aliveVillagers = alivePlayers.filter((p) => !isEvilTeam(p.role));

    if (state.hunterPending) return null;
    if (!state.players.some((p) => p.role === 'loup-garou')) return null;

    if (
      state.loverPairs &&
      state.loverPairs.length > 0 &&
      alivePlayers.length === 2
    ) {
      for (const pair of state.loverPairs) {
        const [id1, id2] = pair;
        if (alivePlayers.some((p) => p.id === id1) && alivePlayers.some((p) => p.id === id2)) {
          const p1 = state.players.find((p) => p.id === id1);
          const p2 = state.players.find((p) => p.id === id2);
          if (p1 && p2 && p1.role !== p2.role) return 'lovers';
        }
      }
    }

    if (aliveWerewolves.length === 0) return 'village';
    if (aliveWerewolves.length >= aliveVillagers.length) return 'werewolf';
    return null;
  }, [stateRef]);

  const endGame = useCallback(async (winner: 'village' | 'werewolf' | 'lovers') => {
    // Fetch all player hypotheses from the server before finalizing end-game state
    const gameId = stateRef.current.gameId;
    let allHypotheses: Record<number, Record<number, string>> = {};
    if (gameId && !localModeRef.current) {
      try {
        const res = await fetch(
          `${API_BASE}/game/all-hypotheses?gameId=${encodeURIComponent(gameId)}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (res.ok) {
          const data = await res.json();
          allHypotheses = data.hypotheses || {};
        }
      } catch (err) {
        console.log('endGame: fetch all hypotheses error:', err);
      }
    }
    setState((s) => ({ ...s, winner, screen: 'end', phaseTimerEndAt: null, hypotheses: allHypotheses }));
  }, [setState, stateRef, localModeRef]);

  const resetGame = useCallback(() => {
    const currentGameId = stateRef.current.gameId;
    const freshState = { ...initialState, gameId: currentGameId, roleConfig: { ...defaultRoleConfig } };
    setState(freshState);
    stateRef.current = freshState;
    if (localModeRef.current) {
      if (currentGameId) localSaveState(currentGameId, freshState);
      return;
    }
    // Clear hypotheses from KV store
    if (currentGameId) {
      fetch(`${API_BASE}/game/clear-hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ password: 'loupgarou', gameId: currentGameId }),
      }).catch((err) => console.log('Clear hypotheses error on reset:', err));
    }
    fetch(`${API_BASE}/game/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ password: 'loupgarou', gameState: freshState, gameId: currentGameId || undefined }),
    }).catch((err) => console.log('Reset sync error:', err));
  }, [setState, stateRef, localModeRef]);

  /** Relaunch: keep players (reset alive/role), preserve roleConfig & settings, return to setup screen */
  const relaunchGame = useCallback(() => {
    const s = stateRef.current;

    // Reset players: alive, clear role, reset votesReceived
    const resetPlayers = s.players.map((p) => ({
      ...p,
      alive: true,
      role: '',
      votesReceived: 0,
      justRevived: undefined,
    }));

    const relaunchedState: GameState = {
      ...initialState,
      gameId: s.gameId,
      players: resetPlayers,
      roleConfig: { ...s.roleConfig },
      screen: 'setup',
      // Preserve GM settings
      wolfKillsPerNight: s.wolfKillsPerNight,
      wolfInactivityThreshold: s.wolfInactivityThreshold,
      villagerInactivityThreshold: s.villagerInactivityThreshold,
      randomVoteIfInactive: s.randomVoteIfInactive,
      dayEliminationsCount: s.dayEliminationsCount,
      phaseTimerDuration: s.phaseTimerDuration,
      phaseTimerDayDuration: s.phaseTimerDayDuration,
      phaseTimerNightDuration: s.phaseTimerNightDuration,
      // Preserve tags
      playerTags: s.playerTags,
      availableTags: s.availableTags,
      // Preserve lobby
      lobbyPlayers: s.lobbyPlayers,
      // Clear "Vu" status (role reveal)
      roleRevealDone: false,
      roleRevealedBy: [],
      // Reset presence tracking — undefined = all players present
      villagePresentIds: undefined,
      // Clear all hints (dynamic, standard, playerHints)
      dynamicHints: [],
      hints: [],
      playerHints: [],
      // Clear hypotheses & suspect lists
      hypotheses: {},
      suspectLists: {},
    };

    setState(relaunchedState);
    stateRef.current = relaunchedState;

    if (localModeRef.current) {
      if (s.gameId) localSaveState(s.gameId, relaunchedState);
      return;
    }
    // Clear hypotheses from KV store
    if (s.gameId) {
      fetch(`${API_BASE}/game/clear-hypotheses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ password: 'loupgarou', gameId: s.gameId }),
      }).catch((err) => console.log('Clear hypotheses error on relaunch:', err));
    }
    fetch(`${API_BASE}/game/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ password: 'loupgarou', gameState: relaunchedState, gameId: s.gameId || undefined }),
    }).catch((err) => console.log('Relaunch sync error:', err));
  }, [setState, stateRef, localModeRef]);

  const getTotalRoles = useCallback(() => {
    return Object.values(stateRef.current.roleConfig).reduce((a, b) => a + b, 0);
  }, [stateRef]);

  const nextTurn = useCallback(() => {
    setState((s) => ({
      ...s,
      turn: s.turn + 1,
      players: s.players.map((p) => p.justRevived ? { ...p, justRevived: false } : p),
      votes: {},
      voteResult: null,
      voteResults: [],
      werewolfVotes: {},
      werewolfVoteMessages: {},
      werewolfTarget: null,
      werewolfTargets: [],
      seerTargets: {},
      seerResults: {},
      witchHealTarget: null,
      witchKillTargets: {},
      witchHealedThisNight: {},
      hunterPending: false,
      hunterShooterId: null,
      guardLastTargets: { ...s.guardTargets },
      guardTargets: {},
      corbeauLastTargets: { ...s.corbeauTargets },
      corbeauTargets: {},
      corbeauMessages: {},
      earlyVotes: {},
      foxTargets: {},
      foxResults: {},
      conciergeTargets: {},
      oracleUsed: {},
      oracleResults: {},
      nominations: {},
      // Apply empoisonneur targets as poisoned, then clear
      poisonedPlayers: {
        ...(s.poisonedPlayers || {}),
        ...Object.fromEntries(
          Object.values(s.empoisonneurTargets || {})
            .filter((pid) => s.players.find((p) => p.id === pid)?.alive)
            .map((pid) => [pid, true])
        ),
      },
      empoisonneurTargets: {},
    }));
  }, [setState]);

  const setCupidLink = useCallback((cupidPlayerId: number, id1: number, id2: number) => {
    setState((s) => {
      const p1 = s.players.find((p) => p.id === id1);
      const p2 = s.players.find((p) => p.id === id2);
      return {
        ...s,
        loverPairs: [...s.loverPairs, [id1, id2]],
        cupidLinkedBy: [...s.cupidLinkedBy, cupidPlayerId],
        events: [
          ...s.events,
          {
            id: nextEventId(), turn: s.turn, phase: 'night' as GamePhase,
            message: `💘 Cupidon a uni ${p1?.name || '?'} et ${p2?.name || '?'} — ils sont desormais Amoureux.`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    });
  }, [setState]);

  const confirmHunterShot = useCallback((targetId: number) => {
    setState((s) => {
      // Cannot target an away player
      if (isAway(s, targetId)) return s;

      const target = s.players.find((p) => p.id === targetId);
      const hunter = s.hunterShooterId !== null ? s.players.find((p) => p.id === s.hunterShooterId) : null;
      let chainHunterPending = false;
      let chainHunterShooterId: number | null = null;
      let newPlayers = s.players.map((p) =>
        p.id === targetId ? { ...p, alive: false } : p
      );
      const events: GameEvent[] = [
        ...s.events,
        {
          id: nextEventId(), turn: s.turn, phase: s.phase,
          message: `🏹 ${hunter?.name || 'Le Chasseur'} tire sur ${target?.name || 'un joueur'} dans son dernier souffle !`,
          timestamp: new Date().toISOString(),
        },
      ];

      if (s.loverPairs) {
        for (const [l1, l2] of s.loverPairs) {
          let loverId: number | null = null;
          if (targetId === l1) loverId = l2;
          if (targetId === l2) loverId = l1;
          if (loverId !== null) {
            const lover = newPlayers.find((p) => p.id === loverId);
            if (lover && lover.alive) {
              newPlayers = newPlayers.map((p) =>
                p.id === loverId ? { ...p, alive: false } : p
              );
              events.push({
                id: nextEventId(), turn: s.turn, phase: s.phase,
                message: `💔 ${lover.name} meurt de chagrin — son amoureux a ete elimine.`,
                timestamp: new Date().toISOString(),
              });
              // Chain-hunter: if the heartbroken lover is also a chasseur, trigger their last shot
              if (lover.role === 'chasseur') { chainHunterPending = true; chainHunterShooterId = loverId; }
            }
          }
        }
      }

      // Mayor succession: if the hunter shot or a lover cascade killed the Maire
      let maireSuccessionPending = s.maireSuccessionPending;
      let maireSuccessionFromId = s.maireSuccessionFromId;
      let maireSuccessionPhase = s.maireSuccessionPhase;
      let newMaireId = s.maireId;
      for (const p of newPlayers) {
        if (!p.alive && s.players.find(op => op.id === p.id)?.alive && newMaireId === p.id) {
          const mp = s.players.find(pl => pl.id === newMaireId);
          maireSuccessionPending = true;
          maireSuccessionFromId = newMaireId;
          maireSuccessionPhase = s.phase;
          events.push({
            id: nextEventId(), turn: s.turn, phase: s.phase,
            message: `👑 Le Maire ${mp?.name || 'inconnu'} est mort. Un successeur doit etre designe.`,
            timestamp: new Date().toISOString(),
          });
          newMaireId = null;
          break;
        }
      }

      // If a chain-hunter was triggered (lover of the target was also a chasseur),
      // keep hunterPending active for the next chasseur instead of clearing it.
      const finalHunterPending = chainHunterPending ? true : false;
      const finalHunterShooterId = chainHunterPending ? chainHunterShooterId : null;

      return { ...s, players: newPlayers, hunterPending: finalHunterPending, hunterShooterId: finalHunterShooterId, events, maireSuccessionPending, maireSuccessionFromId, maireSuccessionPhase, maireId: newMaireId };
    });
  }, [setState]);

  const setHunterPreTarget = useCallback((hunterId: number, targetId: number | null) => {
    setState((s) => ({
      ...s,
      hunterPreTargets: targetId !== null
        ? { ...s.hunterPreTargets, [hunterId]: targetId }
        : (() => { const { [hunterId]: _, ...rest } = s.hunterPreTargets; return rest; })(),
    }));
  }, [setState]);

  const setHypothesis = useCallback((viewerId: number, targetId: number, roleId: string | null) => {
    setState((s) => {
      const hypotheses = { ...s.hypotheses };
      hypotheses[viewerId] = { ...(hypotheses[viewerId] || {}), [targetId]: roleId || '' };
      return { ...s, hypotheses };
    });
  }, [setState]);

  const addPlayerMidGame = useCallback((name: string, chosenRoleId?: string) => {
    setState((s) => {
      let finalRole: string;
      if (chosenRoleId) {
        finalRole = chosenRoleId;
      } else {
        const assignedCounts: Record<string, number> = {};
        s.players.forEach((p) => { if (p.role) assignedCounts[p.role] = (assignedCounts[p.role] || 0) + 1; });
        const availableRoles: string[] = [];
        Object.entries(s.roleConfig).forEach(([rid, count]) => {
          const assigned = assignedCounts[rid] || 0;
          for (let i = 0; i < count - assigned; i++) availableRoles.push(rid);
        });
        finalRole = availableRoles.length > 0
          ? availableRoles[Math.floor(Math.random() * availableRoles.length)]
          : 'villageois';
      }

      const newId = s.players.length > 0 ? Math.max(...s.players.map((p) => p.id)) + 1 : 0;
      const existingCodes = new Set(s.players.map((p) => p.shortCode));
      const shortCode = generateShortCode(name, existingCodes);

      const newPlayer: Player = {
        id: newId, shortCode, name, role: finalRole,
        alive: true, avatar: AVATARS[newId % AVATARS.length], votesReceived: 0,
        ...(s.roleRevealDone ? { joinedMidGame: true } : {}),
      };

      const roleDef = getRoleById(finalRole);

      return {
        ...s,
        players: [...s.players, newPlayer],
        ...(s.roleRevealDone ? { midGameJoinIds: [...(s.midGameJoinIds || []), newId] } : {}),
        events: [
          ...s.events,
          {
            id: nextEventId(), turn: s.turn, phase: s.phase,
            message: `${newPlayer.name} rejoint la partie en tant que ${roleDef?.emoji || ''} ${roleDef?.name || finalRole}.`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    });
  }, [setState]);

  const setPlayerAvatar = useCallback((playerId: number, avatarUrl: string) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => p.id === playerId ? { ...p, avatarUrl } : p),
    }));
  }, [setState]);

  const setRoleRevealDone = useCallback((done: boolean) => {
    setState((s) => ({
      ...s,
      roleRevealDone: done,
      ...(done === false ? { roleRevealedBy: [] } : {}),
    }));
  }, [setState]);

  const clearJustRevived = useCallback((playerId: number) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => p.id === playerId ? { ...p, justRevived: false } : p),
    }));
  }, [setState]);

  const setGuardTarget = useCallback((guardPlayerId: number, targetPlayerId: number | null) => {
    setState((s) => ({
      ...s,
      guardTargets: targetPlayerId !== null
        ? { ...s.guardTargets, [guardPlayerId]: targetPlayerId }
        : (() => { const { [guardPlayerId]: _, ...rest } = s.guardTargets; return rest; })(),
    }));
  }, [setState]);

  const updateState = useCallback((updater: (s: GameState) => GameState) => {
    setState((s) => updater(s));
  }, [setState]);

  return {
    setScreen, updateRoleConfig, setupPlayers, assignRoles,
    setPhase, setNightStep, setDayStep, addEvent,
    setTimer, toggleTimer, tickTimer,
    eliminatePlayer, revivePlayer,
    setWerewolfTarget, castWerewolfVote, setSeerTarget,
    confirmWerewolfKill, confirmSeerReveal,
    useWitchHeal, useWitchKill, cancelWitchKill,
    castVote, cancelVote, resolveVote,
    checkWinCondition, endGame, resetGame, getTotalRoles,
    nextTurn, setCupidLink, confirmHunterShot,
    setHunterPreTarget, setHypothesis,
    addPlayerMidGame, setPlayerAvatar,
    setRoleRevealDone, clearJustRevived,
    setGuardTarget, updateState,
    relaunchGame,
  };
}