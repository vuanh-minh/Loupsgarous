import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { GameState } from './GameContext';
import { getRoleById } from '../data/roles';
import {
  type StateDelta,
  computeDelta,
  buildFullPayload,
  applyDelta,
  estimatePayloadSize,
  nextBroadcastVersion,
} from './deltaSync';

// Events
const GM_STATE_EVENT = 'gm:state';
const GM_DELTA_EVENT = 'gm:delta';
const PLAYER_ACTION_EVENT = 'player:action-notify';
const PLAYER_HEARTBEAT_EVENT = 'player:heartbeat';
const GM_TEST_NOTIF_EVENT = 'gm:test-notif';
const LOBBY_JOIN_EVENT = 'player:lobby-join';
const LOBBY_RESPONSE_EVENT = 'gm:lobby-response';
const PLAYER_RESYNC_REQUEST_EVENT = 'player:resync-request';

// ── Broadcast metrics (exposed for GM monitoring) ──
export interface BroadcastMetrics {
  totalBroadcasts: number;
  deltaBroadcasts: number;
  fullBroadcasts: number;
  totalBytesSent: number;
  avgDeltaSize: number;
  avgFullSize: number;
  lastBroadcastSize: number;
  savedBytes: number;
}

let _metrics: BroadcastMetrics = {
  totalBroadcasts: 0, deltaBroadcasts: 0, fullBroadcasts: 0,
  totalBytesSent: 0, avgDeltaSize: 0, avgFullSize: 0,
  lastBroadcastSize: 0, savedBytes: 0,
};
let _deltaSizeSum = 0;
let _fullSizeSum = 0;

export function getBroadcastMetrics(): BroadcastMetrics { return { ..._metrics }; }
export function resetBroadcastMetrics(): void {
  _metrics = { totalBroadcasts: 0, deltaBroadcasts: 0, fullBroadcasts: 0, totalBytesSent: 0, avgDeltaSize: 0, avgFullSize: 0, lastBroadcastSize: 0, savedBytes: 0 };
  _deltaSizeSum = 0; _fullSizeSum = 0;
}

function trackBroadcast(isDelta: boolean, size: number, fullSize: number) {
  _metrics.totalBroadcasts++;
  _metrics.totalBytesSent += size;
  _metrics.lastBroadcastSize = size;
  if (isDelta) {
    _metrics.deltaBroadcasts++;
    _deltaSizeSum += size;
    _metrics.avgDeltaSize = Math.round(_deltaSizeSum / _metrics.deltaBroadcasts);
    _metrics.savedBytes += Math.max(0, fullSize - size);
  } else {
    _metrics.fullBroadcasts++;
    _fullSizeSum += size;
    _metrics.avgFullSize = Math.round(_fullSizeSum / _metrics.fullBroadcasts);
  }
}

// Build a channel name scoped to a specific game (or global fallback)
function channelName(gameId?: string | null): string {
  return gameId ? `game-room-${gameId}` : 'game-room';
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// shortCode -> timestamp
export type HeartbeatMap = Record<string, number>;

// Rehydrate seerResult from server format { id: "role-id" } to full RoleDefinition
function rehydrateState(gs: GameState): GameState {
  if (gs.seerResult && typeof gs.seerResult === 'object' && 'id' in gs.seerResult) {
    const fullRole = getRoleById((gs.seerResult as any).id);
    gs.seerResult = fullRole || null;
  }
  // Rehydrate seerResults (multi-seer map)
  if (gs.seerResults) {
    const rehydrated: Record<number, any> = {};
    for (const [key, val] of Object.entries(gs.seerResults)) {
      if (val && typeof val === 'object' && 'id' in (val as any)) {
        rehydrated[Number(key)] = getRoleById((val as any).id) || null;
      } else {
        rehydrated[Number(key)] = val;
      }
    }
    gs.seerResults = rehydrated;
  }
  return gs;
}

interface UseRealtimeSyncOptions {
  /** Called when a full game state is received from the GM broadcast */
  onStateReceived?: (state: GameState) => void;
  /** Called when a delta patch is received from the GM broadcast */
  onDeltaReceived?: (delta: StateDelta) => void;
  /** Called when a player action notification arrives (GM should merge) */
  onActionNotify?: () => void;
  /** Called when a player heartbeat arrives (GM collects presence) */
  onHeartbeat?: (shortCode: string, ts: number) => void;
  /** Called when a GM test notification targets this player */
  onTestNotification?: (targetShortCode: string) => void;
  /** Called when a player lobby-join request arrives (GM only) */
  onLobbyJoin?: (player: { id: string; name: string; shortCode: string }) => void;
  /** Called when the GM sends a lobby response (player only) */
  onLobbyResponse?: (response: { playerId: string; accepted: boolean; gameName?: string }) => void;
  /** Called when a player requests a full resync (GM only) */
  onResyncRequest?: () => void;
  /** Whether this client is the GM */
  isGM?: boolean;
  /** Game ID — each game gets its own Realtime channel */
  gameId?: string | null;
  /** Disable realtime sync entirely (e.g. local mode) */
  disabled?: boolean;
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}) {
  const { onStateReceived, onDeltaReceived, onActionNotify, onHeartbeat, onTestNotification, onLobbyJoin, onLobbyResponse, onResyncRequest, isGM = false, gameId = null, disabled = false } = options;
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<RealtimeStatus>('connecting');
  const callbacksRef = useRef({ onStateReceived, onDeltaReceived, onActionNotify, onHeartbeat, onTestNotification, onLobbyJoin, onLobbyResponse, onResyncRequest });
  callbacksRef.current = { onStateReceived, onDeltaReceived, onActionNotify, onHeartbeat, onTestNotification, onLobbyJoin, onLobbyResponse, onResyncRequest };

  // Setup channel subscription — re-subscribe when gameId changes
  useEffect(() => {
    if (disabled) {
      setStatus('disconnected');
      return;
    }
    const chName = channelName(gameId);
    const channel = supabase.channel(chName, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
      },
    });

    // Listen for GM state broadcasts (players/spectators)
    if (!isGM) {
      channel.on('broadcast', { event: GM_STATE_EVENT }, ({ payload }) => {
        if (payload?.gameState && callbacksRef.current.onStateReceived) {
          const gs = rehydrateState(payload.gameState as GameState);
          callbacksRef.current.onStateReceived(gs);
        }
      });

      // Listen for GM delta broadcasts (players/spectators)
      channel.on('broadcast', { event: GM_DELTA_EVENT }, ({ payload }) => {
        if (payload?.delta && callbacksRef.current.onDeltaReceived) {
          callbacksRef.current.onDeltaReceived(payload.delta as StateDelta);
        }
      });

      // Listen for GM test notifications (players)
      channel.on('broadcast', { event: GM_TEST_NOTIF_EVENT }, ({ payload }) => {
        if (payload?.targetShortCode && callbacksRef.current.onTestNotification) {
          callbacksRef.current.onTestNotification(payload.targetShortCode);
        }
      });

      // Listen for lobby responses (player only)
      channel.on('broadcast', { event: LOBBY_RESPONSE_EVENT }, ({ payload }) => {
        if (payload?.playerId && callbacksRef.current.onLobbyResponse) {
          callbacksRef.current.onLobbyResponse(payload);
        }
      });
    }

    // Listen for player action notifications (GM only)
    if (isGM) {
      channel.on('broadcast', { event: PLAYER_ACTION_EVENT }, () => {
        if (callbacksRef.current.onActionNotify) {
          callbacksRef.current.onActionNotify();
        }
      });

      // Listen for player heartbeats (GM only)
      channel.on('broadcast', { event: PLAYER_HEARTBEAT_EVENT }, ({ payload }) => {
        if (payload?.shortCode && callbacksRef.current.onHeartbeat) {
          callbacksRef.current.onHeartbeat(payload.shortCode, payload.ts || Date.now());
        }
      });

      // Listen for lobby join requests (GM only)
      channel.on('broadcast', { event: LOBBY_JOIN_EVENT }, ({ payload }) => {
        if (payload?.id && payload?.name && callbacksRef.current.onLobbyJoin) {
          callbacksRef.current.onLobbyJoin(payload);
        }
      });

      // Listen for resync requests (GM only)
      channel.on('broadcast', { event: PLAYER_RESYNC_REQUEST_EVENT }, () => {
        if (callbacksRef.current.onResyncRequest) {
          callbacksRef.current.onResyncRequest();
        }
      });
    }

    channel.subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        setStatus('connected');
        statusRef.current = 'connected';
      } else if (st === 'CHANNEL_ERROR') {
        setStatus('error');
        statusRef.current = 'error';
      } else if (st === 'CLOSED') {
        setStatus('disconnected');
        statusRef.current = 'disconnected';
      } else {
        setStatus('connecting');
        statusRef.current = 'connecting';
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isGM, gameId, disabled]);

  // GM broadcasts full state to all subscribers
  const broadcastState = useCallback((gameState: GameState) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    const size = estimatePayloadSize(gameState);
    ch.send({
      type: 'broadcast',
      event: GM_STATE_EVENT,
      payload: { gameState },
    }).then((status: string) => {
      if (status !== 'ok') {
        console.log('Broadcast state status:', status);
      }
    }).catch((err: any) => {
      console.log('Broadcast state error:', err);
    });
    trackBroadcast(false, size, size);
  }, []);

  // GM broadcasts a delta state to all subscribers
  const broadcastDelta = useCallback((delta: StateDelta, fullStateSize: number) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    const size = estimatePayloadSize(delta);
    ch.send({
      type: 'broadcast',
      event: GM_DELTA_EVENT,
      payload: { delta },
    }).then((status: string) => {
      if (status !== 'ok') {
        console.log('Broadcast delta status:', status);
      }
    }).catch((err: any) => {
      console.log('Broadcast delta error:', err);
    });
    trackBroadcast(true, size, fullStateSize);
  }, []);

  // Player broadcasts an action notification (lightweight signal)
  const broadcastActionNotify = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: PLAYER_ACTION_EVENT,
      payload: { ts: Date.now() },
    }).then((status: string) => {
      if (status !== 'ok') {
        console.log('Broadcast action notify status:', status);
      }
    }).catch((err: any) => {
      console.log('Broadcast action notify error:', err);
    });
  }, []);

  // Player broadcasts a heartbeat (presence signal)
  const broadcastHeartbeat = useCallback((shortCode: string) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: PLAYER_HEARTBEAT_EVENT,
      payload: { shortCode, ts: Date.now() },
    }).catch((err: any) => {
      console.log('Broadcast heartbeat error:', err);
    });
  }, []);

  // GM sends a test notification targeted at a specific player
  const broadcastTestNotification = useCallback((targetShortCode: string) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: GM_TEST_NOTIF_EVENT,
      payload: { targetShortCode, ts: Date.now() },
    }).then((status: string) => {
      if (status !== 'ok') {
        console.log('Broadcast test notification status:', status);
      }
    }).catch((err: any) => {
      console.log('Broadcast test notification error:', err);
    });
  }, []);

  // Player broadcasts a lobby join request
  const broadcastLobbyJoin = useCallback((player: { id: string; name: string; shortCode: string }) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: LOBBY_JOIN_EVENT,
      payload: { id: player.id, name: player.name, shortCode: player.shortCode, ts: Date.now() },
    }).catch((err: any) => {
      console.log('Broadcast lobby join error:', err);
    });
  }, []);

  // GM broadcasts a lobby response (accepted/rejected)
  const broadcastLobbyResponse = useCallback((response: { playerId: string; accepted: boolean; gameName?: string }) => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: LOBBY_RESPONSE_EVENT,
      payload: response,
    }).catch((err: any) => {
      console.log('Broadcast lobby response error:', err);
    });
  }, []);

  // Player broadcasts a resync request
  const broadcastResyncRequest = useCallback(() => {
    const ch = channelRef.current;
    if (!ch || statusRef.current !== 'connected') return;
    ch.send({
      type: 'broadcast',
      event: PLAYER_RESYNC_REQUEST_EVENT,
      payload: { ts: Date.now() },
    }).catch((err: any) => {
      console.log('Broadcast resync request error:', err);
    });
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    broadcastState,
    broadcastDelta,
    broadcastActionNotify,
    broadcastHeartbeat,
    broadcastTestNotification,
    broadcastLobbyJoin,
    broadcastLobbyResponse,
    broadcastResyncRequest,
  };
}