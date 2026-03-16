/**
 * useNotifications — Browser + Web Push Notification system for Loup-Garou.
 *
 * Notifications (in-app + push):
 *  - Phase change to night:  "La nuit est tombee."
 *  - Phase change to day:    "Le jour se leve."
 *  - Timer at 1 minute:      "Plus qu'une minute pour voter !"
 *  - New hint received:      "Vous avez recu un Indice."
 *  - New nomination:         "{nominateur} a nominé {cible}"
 *  - Collab member voted:    "{joueur} a voté pour {quête}"
 *
 * Push subscription flow:
 *  1. Permission is requested via `requestPermission()`
 *  2. After permission granted, PushManager.subscribe() is called with the VAPID key
 *  3. The subscription is sent to the server for storage
 *  4. The server can then send push notifications even when the app is closed
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import type { GamePhase, PlayerHint } from './GameContext';
import { computeRemaining } from '../components/PhaseTimer';
import { API_BASE, publicAnonKey } from './apiConfig';

/* ── Permission state ── */
type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function getPermissionState(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

/* ── Send a browser notification (in-app, when tab is open) ── */
function sendNotification(title: string, body: string, tag?: string) {
  if (getPermissionState() !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: tag ?? body,       // tag deduplicates if same notif fires twice
      icon: '/favicon.ico',   // fallback; ignored if missing
      silent: false,
    });
  } catch {
    // Notification constructor can throw in some contexts (e.g. service worker only on mobile)
    // Silently ignore
  }
}

/* ── VAPID key cache ── */
let vapidKeyCache: string | null = null;

async function fetchVAPIDKey(): Promise<string | null> {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const res = await fetch(`${API_BASE}/push/vapid-key`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.publicKey) {
      vapidKeyCache = data.publicKey;
      return data.publicKey;
    }
  } catch (err) {
    console.log('[Push] Failed to fetch VAPID key:', err);
  }
  return null;
}

/* ── URL-safe base64 → Uint8Array (for applicationServerKey) ── */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* ── Subscribe to Web Push ── */
async function subscribeToPush(shortCode: string, gameId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] PushManager not supported');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Already subscribed — just re-register with the server
      await sendSubscriptionToServer(existing, shortCode, gameId);
      console.log('[Push] Re-registered existing push subscription');
      return true;
    }

    // Get VAPID public key
    const vapidKey = await fetchVAPIDKey();
    if (!vapidKey) {
      console.log('[Push] No VAPID key available');
      return false;
    }

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // Send subscription to server
    await sendSubscriptionToServer(subscription, shortCode, gameId);
    console.log('[Push] Successfully subscribed to push notifications');
    return true;
  } catch (err) {
    console.log('[Push] Subscribe error:', err);
    return false;
  }
}

async function sendSubscriptionToServer(
  subscription: PushSubscription,
  shortCode: string,
  gameId: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({
        shortCode,
        gameId,
        subscription: subscription.toJSON(),
      }),
    });
  } catch (err) {
    console.log('[Push] Failed to send subscription to server:', err);
  }
}

/* ── Send push notifications via server (called by GM) ── */
export async function sendPushNotifications(
  gameId: string,
  targets: string[],
  title: string,
  body: string,
  tag?: string,
): Promise<void> {
  if (!targets.length) return;
  try {
    await fetch(`${API_BASE}/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ gameId, targets, title, body, tag: tag || 'loup-garou' }),
    });
  } catch (err) {
    console.log('[Push] Failed to send push notifications:', err);
  }
}

/* ── The hook ── */
export function useNotifications({
  enabled,
  phase,
  phaseTimerEndAt,
  phaseTimerDuration,
  playerHints,
  playerId,
  shortCode,
  gameId,
  quests,
  questAssignments,
  nominations,
  players,
  gmAlerts,
  gmAlertMessages,
}: {
  /** Master switch — set to false during practice / GM preview */
  enabled: boolean;
  phase: GamePhase;
  phaseTimerEndAt: string | null;
  phaseTimerDuration: number;
  playerHints: PlayerHint[];
  playerId: number | null;
  shortCode?: string | null;
  gameId?: string | null;
  quests?: any[];
  questAssignments?: Record<number, number[]>;
  nominations?: Record<number, number>;
  players?: Array<{ id: number; name: string; [key: string]: any }>;
  gmAlerts?: Record<string, number>;
  gmAlertMessages?: Record<string, string>;
}) {
  const [permission, setPermission] = useState<PermissionState>(getPermissionState);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  /* ── Request permission (call once after lobby entry) ── */
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    // Re-read the live browser state (user may have changed it via browser settings)
    const current = Notification.permission;
    if (current === 'granted') {
      setPermission('granted');
      return;
    }
    // Always attempt to request — even if previously 'denied', the user
    // may have reset permissions in browser settings.
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
    } catch {
      setPermission(current as PermissionState);
    }
  }, []);

  /* ── Subscribe to Web Push when permission is granted ── */
  const pushSubscribedRef = useRef(false);
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    if (!shortCode || !gameId) return;
    if (pushSubscribedRef.current) return;
    pushSubscribedRef.current = true;

    subscribeToPush(shortCode, gameId).then((ok) => {
      if (ok) setPushSubscribed(true);
    });
  }, [enabled, permission, shortCode, gameId]);

  /* ── Track previous values via refs ── */
  const prevPhaseRef = useRef<GamePhase | null>(null);
  const prevHintCountRef = useRef<number>(-1); // -1 = not yet initialized
  const oneMinuteFiredRef = useRef(false);
  const isFirstRenderRef = useRef(true);

  // Count this player's hints
  const myHintCount = playerId !== null
    ? playerHints.filter(ph => ph.playerId === playerId).length
    : 0;

  /* ── Phase change notifications ── */
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    // Skip first render (initial load shouldn't trigger a notif)
    if (isFirstRenderRef.current) {
      prevPhaseRef.current = phase;
      isFirstRenderRef.current = false;
      return;
    }
    if (prevPhaseRef.current !== null && prevPhaseRef.current !== phase) {
      if (phase === 'night') {
        sendNotification('Loup-Garou', '\uD83C\uDF19 La nuit est tomb\u00e9e.', 'phase-night');
      } else if (phase === 'day') {
        sendNotification('Loup-Garou', '\u2600\uFE0F Le jour se l\u00e8ve.', 'phase-day');
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, enabled, permission]);

  /* ── Reset one-minute flag when timer changes (new phase) ── */
  useEffect(() => {
    oneMinuteFiredRef.current = false;
  }, [phaseTimerEndAt]);

  /* ── Timer: 1 minute left notification ── */
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    if (!phaseTimerEndAt || phaseTimerDuration <= 0) return;

    const check = () => {
      if (oneMinuteFiredRef.current) return;
      const remaining = computeRemaining(phaseTimerEndAt);
      if (remaining > 0 && remaining <= 60) {
        oneMinuteFiredRef.current = true;
        sendNotification('Loup-Garou', '\u23F3 Plus qu\'une minute pour voter\u00A0!', 'timer-1min');
      }
    };

    // Check immediately
    check();
    // Then poll every second
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [phaseTimerEndAt, phaseTimerDuration, enabled, permission]);

  /* ── New hint received ── */
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    // First time seeing a count: just record it (don't notify on initial load)
    if (prevHintCountRef.current === -1) {
      prevHintCountRef.current = myHintCount;
      return;
    }
    if (myHintCount > prevHintCountRef.current) {
      const diff = myHintCount - prevHintCountRef.current;
      sendNotification(
        'Loup-Garou',
        diff === 1
          ? '\uD83D\uDC41\uFE0F Vous avez re\u00e7u un Indice.'
          : `\uD83D\uDC41\uFE0F Vous avez re\u00e7u ${diff} Indices.`,
        'new-hint',
      );
    }
    prevHintCountRef.current = myHintCount;
  }, [myHintCount, enabled, permission]);

  /* ── New quest assigned (browser notification) ── */
  const myQuestIds = playerId !== null && questAssignments
    ? (questAssignments[playerId] || [])
    : [];
  const prevQuestCountRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    const count = myQuestIds.length;
    if (prevQuestCountRef.current === -1) {
      prevQuestCountRef.current = count;
      return;
    }
    if (count > prevQuestCountRef.current) {
      const diff = count - prevQuestCountRef.current;
      sendNotification(
        'Loup-Garou',
        diff === 1
          ? '\u2694\uFE0F Nouvelle qu\u00eate disponible\u00A0!'
          : `\u2694\uFE0F ${diff} nouvelles qu\u00eates disponibles\u00A0!`,
        'new-quest',
      );
    }
    prevQuestCountRef.current = count;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myQuestIds.length, enabled, permission]);

  /* ── New nomination (browser notification) ── */
  const nominationKey = JSON.stringify(nominations || {});
  const prevNominationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    if (prevNominationKeyRef.current === null) {
      prevNominationKeyRef.current = nominationKey;
      return;
    }
    if (nominationKey !== prevNominationKeyRef.current) {
      const oldNoms: Record<string, number> = JSON.parse(prevNominationKeyRef.current);
      const newNoms: Record<string, number> = JSON.parse(nominationKey);
      const allPlayers = players || [];
      for (const targetIdStr of Object.keys(newNoms)) {
        if (!(targetIdStr in oldNoms)) {
          const targetId = Number(targetIdStr);
          const nominatorId = newNoms[targetIdStr];
          // Skip if I'm the one who nominated
          if (nominatorId === playerId) continue;
          const targetPlayer = allPlayers.find(p => p.id === targetId);
          const nominatorPlayer = allPlayers.find(p => p.id === nominatorId);
          const nominatorName = nominatorPlayer?.name || 'Quelqu\'un';
          if (targetId === playerId) {
            // I was nominated
            sendNotification(
              'Loup-Garou',
              `\uD83E\uDEF5 Vous avez \u00e9t\u00e9 nomin\u00e9 par ${nominatorName}`,
              `nomination-${targetId}`,
            );
          } else {
            const targetName = targetPlayer?.name || `Joueur #${targetId}`;
            sendNotification(
              'Loup-Garou',
              `\uD83D\uDDF3\uFE0F ${nominatorName} a nomin\u00e9 ${targetName}`,
              `nomination-${targetId}`,
            );
          }
        }
      }
    }
    prevNominationKeyRef.current = nominationKey;
  }, [nominationKey, enabled, permission, players]);

  /* ── Collaborative quest group member voted (browser notification) ── */
  const collabVotesKey = playerId !== null && quests
    ? quests
        .filter(q => (q.questType || 'individual') === 'collaborative' && myQuestIds.includes(q.id))
        .map(q => {
          const myGroup = (q.collaborativeGroups || []).find((g: number[]) => g.includes(playerId!));
          if (!myGroup) return null;
          const groupVotes = Object.entries(q.collaborativeVotes || {})
            .filter(([id]) => myGroup.includes(Number(id)) && Number(id) !== playerId)
            .map(([id, v]) => `${id}:${v}`)
            .sort()
            .join(';');
          return `${q.id}=${groupVotes}`;
        })
        .filter(Boolean)
        .join(',')
    : '';
  const prevCollabVotesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    if (prevCollabVotesKeyRef.current === null) {
      prevCollabVotesKeyRef.current = collabVotesKey;
      return;
    }
    if (collabVotesKey !== prevCollabVotesKeyRef.current) {
      // Parse old & new to find newly added votes
      const parseVotes = (key: string) => {
        const map = new Map<number, Set<number>>();
        if (!key) return map;
        key.split(',').forEach(part => {
          const [qIdStr, votesStr] = part.split('=');
          const qId = Number(qIdStr);
          const voterIds = new Set<number>();
          if (votesStr) {
            votesStr.split(';').forEach(v => {
              const [id] = v.split(':');
              if (id) voterIds.add(Number(id));
            });
          }
          map.set(qId, voterIds);
        });
        return map;
      };
      const oldMap = parseVotes(prevCollabVotesKeyRef.current);
      const newMap = parseVotes(collabVotesKey);
      const allPlayers = players || [];
      for (const [qId, newVoters] of newMap) {
        const oldVoters = oldMap.get(qId) || new Set<number>();
        for (const voterId of newVoters) {
          if (!oldVoters.has(voterId)) {
            const voterPlayer = allPlayers.find(p => p.id === voterId);
            const voterName = voterPlayer?.name || `Joueur #${voterId}`;
            const quest = quests?.find(q => q.id === qId);
            const vote = quest?.collaborativeVotes?.[voterId];
            const voteEmoji = vote ? '\u2705' : '\u274C';
            sendNotification(
              'Loup-Garou',
              `${voteEmoji} ${voterName} a vot\u00e9 pour "${quest?.title || 'qu\u00eate'}"`,
              `collab-vote-${qId}-${voterId}`,
            );
          }
        }
      }
    }
    prevCollabVotesKeyRef.current = collabVotesKey;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabVotesKey, enabled, permission, players]);

  /* ── GM Alert (browser notification) ── */
  const myGmAlertTs = shortCode ? (gmAlerts || {})[shortCode] || 0 : 0;
  const prevGmAlertTsRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || permission !== 'granted') return;
    if (!shortCode) return;
    if (prevGmAlertTsRef.current === -1) {
      prevGmAlertTsRef.current = myGmAlertTs;
      return;
    }
    if (myGmAlertTs > prevGmAlertTsRef.current) {
      const message = shortCode ? (gmAlertMessages || {})[shortCode] || 'Vous avez une action à réaliser.' : 'Vous avez une action à réaliser.';
      sendNotification(
        'Loup-Garou',
        `\uD83D\uDD14 ${message}`,
        'gm-alert',
      );
    }
    prevGmAlertTsRef.current = myGmAlertTs;
  }, [myGmAlertTs, enabled, permission, shortCode, gmAlertMessages]);

  /* ── Send a test notification (dev helper) ── */
  const sendTestNotification = useCallback(() => {
    sendNotification(
      'Loup-Garou — Test',
      '\uD83D\uDC3A Les notifications fonctionnent !',
      'test-notif',
    );
  }, []);

  return {
    permission,
    pushSubscribed,
    requestPermission,
    sendTestNotification,
  };
}