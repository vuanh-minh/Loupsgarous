/**
 * Web Push Notifications for Loup-Garou.
 *
 * Implements the full Web Push protocol using Web Crypto API (no Node.js deps):
 *  - VAPID key generation & storage (P-256 / ES256)
 *  - Push subscription management (per player per game)
 *  - Payload encryption (aes128gcm, RFC 8291)
 *  - Push message delivery
 *
 * Routes (all prefixed with /make-server-2c00868b):
 *  GET  /push/vapid-key          — returns the VAPID public key
 *  POST /push/subscribe          — stores a push subscription
 *  POST /push/unsubscribe        — removes a push subscription
 *  POST /push/send               — sends push notifications to target players
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const push = new Hono();

// ─── Base64url helpers ───

function base64urlEncode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ─── VAPID Key Management ───

const VAPID_KV_KEY = 'push:vapid-keys';
const VAPID_SUBJECT = 'mailto:loup-garou-app@example.com';

interface VAPIDKeys {
  publicKeyRaw: string;   // base64url of 65-byte uncompressed P-256 point
  privateKeyJwk: JsonWebKey;
}

async function getOrCreateVAPIDKeys(): Promise<VAPIDKeys> {
  // Try loading from KV
  const existing = await kv.get(VAPID_KV_KEY);
  if (existing && existing.publicKeyRaw && existing.privateKeyJwk) {
    return existing as VAPIDKeys;
  }

  // Generate new P-256 key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  );

  const publicKeyRaw = base64urlEncode(
    await crypto.subtle.exportKey('raw', keyPair.publicKey),
  );
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const keys: VAPIDKeys = { publicKeyRaw, privateKeyJwk };
  await kv.set(VAPID_KV_KEY, keys);
  console.log('[Push] Generated and stored new VAPID keys');
  return keys;
}

async function importVAPIDPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// ─── VAPID JWT (ES256) ───

/**
 * DER-encoded ECDSA signatures (from Web Crypto) use variable-length integers.
 * JWS/JWT requires raw P1363 format (r || s, 32 bytes each).
 * Web Crypto API on most platforms already returns P1363, but let's ensure.
 */
function ensureP1363(sig: ArrayBuffer): Uint8Array {
  const bytes = new Uint8Array(sig);
  // P1363 is always exactly 64 bytes for P-256
  if (bytes.length === 64) return bytes;

  // If it's DER, convert
  // DER: 0x30 <len> 0x02 <rlen> <r> 0x02 <slen> <s>
  if (bytes[0] === 0x30) {
    let offset = 2;
    // r
    const rLen = bytes[offset + 1];
    offset += 2;
    const rBytes = bytes.slice(offset, offset + rLen);
    offset += rLen;
    // s
    const sLen = bytes[offset + 1];
    offset += 2;
    const sBytes = bytes.slice(offset, offset + sLen);

    const r = new Uint8Array(32);
    const s = new Uint8Array(32);
    r.set(rBytes.length > 32 ? rBytes.slice(rBytes.length - 32) : rBytes, 32 - Math.min(rBytes.length, 32));
    s.set(sBytes.length > 32 ? sBytes.slice(sBytes.length - 32) : sBytes, 32 - Math.min(sBytes.length, 32));
    return concat(r, s);
  }

  return bytes;
}

async function createVAPIDJWT(audience: string, privateKey: CryptoKey): Promise<string> {
  const header = base64urlEncode(encodeText(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(encodeText(JSON.stringify({
    aud: audience,
    exp: now + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));

  const signingInput = `${header}.${payload}`;
  const rawSig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encodeText(signingInput),
  );

  const sig = base64urlEncode(ensureP1363(rawSig));
  return `${signingInput}.${sig}`;
}

// ─── Payload Encryption (RFC 8291 — aes128gcm) ───

async function hkdfDerive(
  ikm: ArrayBuffer,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  );
}

async function encryptPayload(
  clientPublicKeyB64: string,
  authSecretB64: string,
  payload: string,
): Promise<Uint8Array> {
  const clientPublicKey = base64urlDecode(clientPublicKeyB64);
  const authSecret = base64urlDecode(authSecretB64);
  const plaintext = encodeText(payload);

  // 1. Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );

  // 2. Import client's public key for ECDH
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // 3. ECDH shared secret
  const ecdhSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256,
  );

  // 4. Export local public key (65 bytes uncompressed)
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeyPair.publicKey),
  );

  // 5. Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. Derive IKM using HKDF
  //    IKM = HKDF(salt=authSecret, ikm=ecdhSecret, info="WebPush: info\0" || ua_public || as_public, L=32)
  const keyInfoData = concat(
    encodeText('WebPush: info\0'),
    clientPublicKey,
    localPublicKeyRaw,
  );
  const ikm = await hkdfDerive(ecdhSecret, authSecret, keyInfoData, 32);

  // 7. Derive CEK (16 bytes) and nonce (12 bytes) from IKM using salt
  const cekInfo = encodeText('Content-Encoding: aes128gcm\0');
  const nonceInfo = encodeText('Content-Encoding: nonce\0');

  const cekBits = await hkdfDerive(ikm, salt, cekInfo, 16);
  const nonceBits = await hkdfDerive(ikm, salt, nonceInfo, 12);

  // 8. Pad plaintext: payload || 0x02 (single-record delimiter)
  const padded = concat(plaintext, new Uint8Array([2]));

  // 9. Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cekBits,
    'AES-GCM',
    false,
    ['encrypt'],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: new Uint8Array(nonceBits), tagLength: 128 },
      aesKey,
      padded,
    ),
  );

  // 10. Build aes128gcm body
  //   Header: salt (16) || rs (4, uint32be) || idlen (1) || keyid (idlen = 65 for P-256)
  const rs = 4096; // record size
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);
  const idlen = new Uint8Array([localPublicKeyRaw.length]);

  return concat(salt, rsBytes, idlen, localPublicKeyRaw, ciphertext);
}

// ─── Send a single push notification ───

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

async function sendWebPush(
  subscription: PushSubscription,
  payload: string,
  vapidKeys: VAPIDKeys,
): Promise<{ success: boolean; status?: number; gone?: boolean }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const privateKey = await importVAPIDPrivateKey(vapidKeys.privateKeyJwk);
    const jwt = await createVAPIDJWT(audience, privateKey);

    const encrypted = await encryptPayload(
      subscription.keys.p256dh,
      subscription.keys.auth,
      payload,
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKeyRaw}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: encrypted,
    });

    if (response.status === 410 || response.status === 404) {
      // Subscription expired or invalid
      return { success: false, status: response.status, gone: true };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log(`[Push] Push service error ${response.status}: ${text}`);
      return { success: false, status: response.status };
    }

    return { success: true, status: response.status };
  } catch (err) {
    console.log(`[Push] sendWebPush error: ${err}`);
    return { success: false };
  }
}

// ─── Subscription KV helpers ───

function subKey(gameId: string, shortCode: string): string {
  return `push-sub:${gameId}:${shortCode}`;
}

// ─── Routes ───

// GET /make-server-2c00868b/push/vapid-key
push.get('/make-server-2c00868b/push/vapid-key', async (c) => {
  try {
    const vapid = await getOrCreateVAPIDKeys();
    return c.json({ publicKey: vapid.publicKeyRaw });
  } catch (err) {
    console.log('[Push] Error getting VAPID key:', err);
    return c.json({ error: `Erreur VAPID: ${err}` }, 500);
  }
});

// POST /make-server-2c00868b/push/subscribe
push.post('/make-server-2c00868b/push/subscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { shortCode, gameId, subscription } = body;
    if (!shortCode || !gameId || !subscription) {
      return c.json({ error: 'shortCode, gameId et subscription requis' }, 400);
    }
    const key = subKey(gameId, shortCode);
    await kv.set(key, subscription);
    console.log(`[Push] Subscription stored: ${key}`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[Push] Subscribe error:', err);
    return c.json({ error: `Erreur subscribe: ${err}` }, 500);
  }
});

// POST /make-server-2c00868b/push/unsubscribe
push.post('/make-server-2c00868b/push/unsubscribe', async (c) => {
  try {
    const body = await c.req.json();
    const { shortCode, gameId } = body;
    if (!shortCode || !gameId) {
      return c.json({ error: 'shortCode et gameId requis' }, 400);
    }
    const key = subKey(gameId, shortCode);
    try { await kv.del(key); } catch {}
    console.log(`[Push] Subscription removed: ${key}`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[Push] Unsubscribe error:', err);
    return c.json({ error: `Erreur unsubscribe: ${err}` }, 500);
  }
});

// POST /make-server-2c00868b/push/send
// Body: { gameId, targets: string[] (shortCodes), title, body, tag? }
push.post('/make-server-2c00868b/push/send', async (c) => {
  try {
    const reqBody = await c.req.json();
    const { gameId, targets, title, body: notifBody, tag } = reqBody;
    if (!gameId || !targets || !title) {
      return c.json({ error: 'gameId, targets et title requis' }, 400);
    }

    const vapidKeys = await getOrCreateVAPIDKeys();
    const payload = JSON.stringify({ title, body: notifBody || '', tag: tag || 'loup-garou' });

    const results: Record<string, { success: boolean; status?: number }> = {};
    const keysToDelete: string[] = [];

    // Send to each target in parallel
    const promises = (targets as string[]).map(async (shortCode: string) => {
      const key = subKey(gameId, shortCode);
      const subscription = await kv.get(key);
      if (!subscription) {
        results[shortCode] = { success: false, status: 0 };
        return;
      }

      const result = await sendWebPush(subscription as PushSubscription, payload, vapidKeys);
      results[shortCode] = { success: result.success, status: result.status };

      // Clean up expired subscriptions
      if (result.gone) {
        keysToDelete.push(key);
      }
    });

    await Promise.all(promises);

    // Remove expired subscriptions
    if (keysToDelete.length > 0) {
      try { await kv.mdel(keysToDelete); } catch {}
    }

    const sent = Object.values(results).filter(r => r.success).length;
    console.log(`[Push] Sent ${sent}/${targets.length} push notifications for game ${gameId}`);

    return c.json({ success: true, results });
  } catch (err) {
    console.log('[Push] Send error:', err);
    return c.json({ error: `Erreur envoi push: ${err}` }, 500);
  }
});

export { push };

/**
 * Server-side helper: send push notifications to specific players by shortCode.
 * Can be called from other server modules (e.g. actionRoutes) without HTTP.
 */
export async function sendPushToPlayers(
  gameId: string,
  targets: string[],
  title: string,
  body: string,
  tag?: string,
): Promise<void> {
  try {
    if (!gameId || targets.length === 0) return;
    const vapidKeys = await getOrCreateVAPIDKeys();
    const payload = JSON.stringify({ title, body, tag: tag || 'loup-garou' });
    const keysToDelete: string[] = [];

    await Promise.all(targets.map(async (shortCode) => {
      const key = subKey(gameId, shortCode);
      const subscription = await kv.get(key);
      if (!subscription) return;
      const result = await sendWebPush(subscription as PushSubscription, payload, vapidKeys);
      if (result.gone) keysToDelete.push(key);
    }));

    if (keysToDelete.length > 0) {
      try { await kv.mdel(keysToDelete); } catch {}
    }
    console.log(`[Push] sendPushToPlayers: sent to ${targets.length} target(s) for game ${gameId}`);
  } catch (err) {
    console.log(`[Push] sendPushToPlayers error: ${err}`);
  }
}