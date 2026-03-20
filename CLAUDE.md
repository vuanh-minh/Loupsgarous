# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i          # install dependencies
npm run dev    # start dev server (Vite)
npm run build  # production build
```

There is no lint or test script configured.

## Architecture Overview

### State Management

All game state lives in `src/app/context/GameContext.tsx`, which is a thin orchestrator that delegates to:
- `useGameActions.ts` — all game-action callbacks (role actions, phase transitions, vote tracking, etc.)
- `useGameSync.ts` — server sync with automatic localStorage fallback when server is unreachable
- `useRealtimeSync.ts` — Supabase Realtime channel subscriptions per game room
- `useServerAction.ts` — Edge Function API calls
- `gameContextConstants.ts` — initial state, constants, localStorage helpers

The GM is the source of truth: players broadcast actions, the GM merges them and broadcasts the authoritative full state.

### Real-time Multiplayer

- Backend: Supabase Edge Functions at `make-server-2c00868b`, Supabase Realtime for live sync
- Per-game channel: `game-room-{gameId}`
- Events: `gm:state` (full state broadcast), `player:action-notify`, `player:heartbeat`
- On startup, a 5-second health check determines if the server is reachable; if not, the app falls back to localStorage ("local mode") with a floating indicator in the UI

### Routing & Views

Three main user roles, each with dedicated page hierarchies:
- **GM** (`/master`) — `src/app/components/pages/gm/` (40+ files)
- **Player** (`/player/:shortCode`) — `src/app/components/pages/player/` (30+ files)
- **Spectator** (`/spectator/:gameId`) — `src/app/components/pages/spectator/`

Routes are defined statically in `src/app/routes.tsx` (no lazy loading, intentional for sandbox compatibility).

### Phase/Screen Flow

- `screen`: `'home' | 'setup' | 'game' | 'vote' | 'end'`
- `phase`: `'night' | 'day'` (drives CSS `data-phase` attribute on `<html>` for day/night theming)
- `nightStep` and `dayStep` track sub-phases within a night/day cycle

### Theming

Tailwind CSS v4 via `@tailwindcss/vite`. Day/night theme switching is done by setting `data-phase="day|night"` on `<html>` in `RootLayout.tsx` → `PhaseSync()`. Theme color variables are in `src/app/context/gameTheme.ts`. Typography: Cinzel (headings), IM Fell English (flavor text).

### Figma Integration

`vite.config.ts` includes a custom plugin that resolves `figma:asset/...` imports as transparent 1×1 PNG placeholders. Components in `src/imports/` are Figma-generated. The original Figma design is at `figma.com/design/U4q2bXpuy9n2wVoFsJvr22/Loups-garous-FR`.

### Key Data Files

- `src/app/data/roles.ts` — role definitions (11 roles: Villageois, Loup-Garou, Voyante, etc.)
- `src/app/data/scoring.ts` — scoring system
- `src/app/data/gamePresets.ts` — pre-configured game setups
- `src/app/components/ui/` — shadcn/ui components wrapping Radix UI primitives
