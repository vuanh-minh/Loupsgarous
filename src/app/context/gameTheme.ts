/**
 * Game Theme — provides day/night color tokens for inline styles.
 *
 * Night = dark medieval blue-violet palette (original)
 * Day   = warm parchment/sunlit palette
 *
 * Usage: const t = gameTheme(state.phase);
 */

export interface GameThemeTokens {
  /* ── Backgrounds ── */
  pageBg: string;           // full-page gradient
  pageBgSolid: string;      // solid fallback
  cardBg: string;           // default card / section bg
  cardBgHover: string;      // hover state for cards
  cardBorder: string;       // default card border
  surfaceBg: string;        // subtle surface
  surfaceBorder: string;    // subtle surface border
  headerBg: string;         // header / status bar
  headerBorder: string;

  /* ── Text ── */
  text: string;             // primary text
  textSecondary: string;    // secondary text
  textMuted: string;        // muted / dim text
  textDim: string;          // very dim text (labels, hints)

  /* ── Accents (kept consistent but adapted for contrast) ── */
  gold: string;
  goldMuted: string;
  goldBg: string;
  goldBorder: string;

  /* ── Overlays & modals ── */
  overlayBg: string;
  modalBg: string;
  modalBorder: string;

  /* ── Night-specific elements ── */
  nightSky: string;
  nightGlow: string;

  /* ── Day-specific elements ── */
  daySky: string;
  dayGlow: string;

  /* ── Status indicators (badge dot border to blend with bg) ── */
  dotBorderColor: string;

  /* ── Input & interactive ── */
  inputBg: string;
  inputBorder: string;
  inputText: string;

  /* ── White/black channel for opacity patterns ── */
  /** Use for rgba overlays: e.g. `${t.overlayChannel}, 0.06)` */
  overlayChannel: string;     // "255,255,255" or "0,0,0"

  /* ── Phase indicator ── */
  isDay: boolean;
}

const nightTheme: GameThemeTokens = {
  pageBg: 'linear-gradient(180deg, #070b1a 0%, #0f1629 100%)',
  pageBgSolid: '#070b1a',
  cardBg: 'rgba(255,255,255,0.02)',
  cardBgHover: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.06)',
  surfaceBg: 'rgba(255,255,255,0.03)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  headerBg: 'rgba(7,11,26,0.95)',
  headerBorder: 'rgba(212,168,67,0.12)',

  text: '#c0c8d8',
  textSecondary: '#8090b0',
  textMuted: '#6b7b9b',
  textDim: '#4a5568',

  gold: '#d4a843',
  goldMuted: 'rgba(212,168,67,0.5)',
  goldBg: 'rgba(212,168,67,0.08)',
  goldBorder: 'rgba(212,168,67,0.2)',

  overlayBg: 'rgba(0,0,0,0.7)',
  modalBg: '#0f1629',
  modalBorder: 'rgba(212,168,67,0.2)',

  nightSky: '#7c8db5',
  nightGlow: 'radial-gradient(circle at 50% 0%, #7c8db5, transparent 70%)',

  daySky: '#f0c55b',
  dayGlow: 'radial-gradient(circle at 50% 0%, #f0c55b, transparent 70%)',

  dotBorderColor: '#0a1020',

  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputText: '#c0c8d8',

  overlayChannel: '255,255,255',

  isDay: false,
};

const dayTheme: GameThemeTokens = {
  pageBg: 'linear-gradient(180deg, #f5f0e4 0%, #ebe4d2 50%, #e3dac6 100%)',
  pageBgSolid: '#f0ead8',
  cardBg: 'rgba(255,255,255,0.55)',
  cardBgHover: 'rgba(255,255,255,0.7)',
  cardBorder: 'rgba(120,100,60,0.12)',
  surfaceBg: 'rgba(255,255,255,0.4)',
  surfaceBorder: 'rgba(120,100,60,0.1)',
  headerBg: 'rgba(245,240,228,0.95)',
  headerBorder: 'rgba(180,140,50,0.2)',

  text: '#2a1f10',
  textSecondary: '#5a4a30',
  textMuted: '#7a6a4a',
  textDim: '#9a8a6a',

  gold: '#a07808',
  goldMuted: 'rgba(160,120,8,0.5)',
  goldBg: 'rgba(160,120,8,0.08)',
  goldBorder: 'rgba(160,120,8,0.25)',

  overlayBg: 'rgba(0,0,0,0.4)',
  modalBg: '#f5f0e4',
  modalBorder: 'rgba(160,120,8,0.3)',

  nightSky: '#7c8db5',
  nightGlow: 'radial-gradient(circle at 50% 0%, #7c8db5, transparent 70%)',

  daySky: '#d4a030',
  dayGlow: 'radial-gradient(circle at 50% 0%, #f0c55b, transparent 70%)',

  dotBorderColor: '#ebe4d2',

  inputBg: 'rgba(255,255,255,0.5)',
  inputBorder: 'rgba(120,100,60,0.15)',
  inputText: '#2a1f10',

  overlayChannel: '0,0,0',

  isDay: true,
};

export function gameTheme(phase: 'night' | 'day'): GameThemeTokens {
  return phase === 'day' ? dayTheme : nightTheme;
}

/** Desaturated grey/black/white theme for dead players */
const deadTheme: GameThemeTokens = {
  pageBg: 'linear-gradient(180deg, #0a0a0a 0%, #111111 50%, #0d0d0d 100%)',
  pageBgSolid: '#0a0a0a',
  cardBg: 'rgba(255,255,255,0.03)',
  cardBgHover: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  surfaceBg: 'rgba(255,255,255,0.03)',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  headerBg: 'rgba(10,10,10,0.95)',
  headerBorder: 'rgba(255,255,255,0.08)',

  text: '#a0a0a0',
  textSecondary: '#777777',
  textMuted: '#555555',
  textDim: '#3a3a3a',

  gold: '#888888',
  goldMuted: 'rgba(136,136,136,0.5)',
  goldBg: 'rgba(136,136,136,0.06)',
  goldBorder: 'rgba(136,136,136,0.15)',

  overlayBg: 'rgba(0,0,0,0.8)',
  modalBg: '#111111',
  modalBorder: 'rgba(255,255,255,0.1)',

  nightSky: '#666666',
  nightGlow: 'radial-gradient(circle at 50% 0%, #555555, transparent 70%)',

  daySky: '#777777',
  dayGlow: 'radial-gradient(circle at 50% 0%, #666666, transparent 70%)',

  dotBorderColor: '#0a0a0a',

  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.08)',
  inputText: '#a0a0a0',

  overlayChannel: '255,255,255',

  isDay: false,
};

/** Returns the dead theme (greyscale) when the current player is eliminated */
export function gameThemeDead(): GameThemeTokens {
  return deadTheme;
}