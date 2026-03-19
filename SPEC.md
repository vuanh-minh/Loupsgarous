# Loup-Garou (Werewolf) — Full Application Specification

## 1. Overview

A real-time multiplayer web application for playing the French party game "Loup-Garou" (Werewolf). Built with React 19 + Vite, Tailwind CSS v4, Motion (framer-motion successor), React Router v7 (data mode), and a Supabase Edge Functions backend (Hono server + KV store). The app supports multiple simultaneous games, real-time sync via Supabase Realtime channels, PWA install, and push notifications.

**Language**: French UI throughout.
**Typography**: Google Fonts — `Cinzel` (headings, labels, game UI), `Cinzel Decorative` (cinematic overlays), `IM Fell English` (flavor text).
**Design philosophy**: Medieval/dark fantasy aesthetic with day/night theme switching. Night = deep blue-violet dark palette. Day = warm parchment/sunlit palette. Dead players get a desaturated greyscale theme.

---

## 2. Architecture

### 2.1 Frontend (React SPA)
```
/src/app/App.tsx              — Entry point, renders <RouterProvider>
/src/app/routes.tsx            — React Router data mode with lazy-loaded pages
/src/app/context/              — State management (GameContext, hooks)
/src/app/data/roles.ts         — Role definitions
/src/app/components/pages/     — Page-level components
/src/app/components/ui/        — Shadcn/ui component library
/src/app/components/layout/    — RootLayout with GameProvider, Toaster, PWA
```

### 2.2 Backend (Supabase Edge Functions — Deno/Hono)
```
/supabase/functions/server/index.tsx        — Hono app entry
/supabase/functions/server/serverHelpers.tsx — Shared constants, Supabase client, KV keys
/supabase/functions/server/gameRoutes.tsx    — Game CRUD, auth, state management
/supabase/functions/server/actionRoutes.tsx  — Player action endpoints + timer auto-transition
/supabase/functions/server/miscRoutes.tsx    — Heartbeat, hypothesis, avatar upload
/supabase/functions/server/push.tsx          — Web push notification endpoints
/supabase/functions/server/kv_store.tsx      — KV store utility (protected, pre-existing)
```

### 2.3 Real-time Sync
- **Supabase Realtime channels** scoped per game: `game-room-{gameId}`
- Events: `gm:state` (GM broadcasts full state), `player:action-notify` (player notifies GM to merge), `player:heartbeat`, `gm:test-notif`
- GM is the single source of truth; players send actions to the server, then notify GM via Realtime to merge

### 2.4 State Persistence
- **Server mode**: Game state stored in Supabase KV (`game:{gameId}:state`)
- **Local mode**: Falls back to localStorage when server is unreachable
- Player avatars stored in Supabase Storage (private bucket `make-ed2f8415-avatars`, served via signed URLs)

---

## 3. Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `HomePage` | Landing page — join game (4-char code), GM access (password), rules link, PWA install |
| `/rules` | `RulesPage` | Game rules reference |
| `/master` | `GameMasterPage` | GM dashboard — multi-game lobby, setup, game control, spectator embed, hints |
| `/player/:shortCode` | `PlayerPage` | Individual player view (identified by 4-char shortCode) |
| `/spectator` | `SpectatorPage` | TV/fullscreen spectator view — game lobby list |
| `/spectator/:gameId` | `SpectatorPage` | Spectator view for specific game |
| `*` | 404 page | "Page introuvable" |

All pages use lazy loading with retry logic (cache-busting on chunk failures, full reload as last resort).

---

## 4. Roles

Each role has: `id`, `name`, `team` (village/werewolf/solo), `emoji`, `color`, `description`, `power`, `minCount`, `maxCount`, `defaultCount`.

| Role | Team | Emoji | Default | Power |
|------|------|-------|---------|-------|
| Villageois | Village | `🧑‍🌾` | 3 | No power. Participates in village votes. |
| Loup-Garou | Werewolf | `🐺` | 2 | Each night, wolves collectively choose a victim to devour. |
| Voyante (Seer) | Village | `🔮` | 1 | Each night, discovers the true identity of one player. |
| Chasseur (Hunter) | Village | `🏹` | 0 | When eliminated, immediately shoots and kills another player. |
| Cupidon (Cupid) | Village | `💘` | 0 | At game start, links two players as Lovers. If one dies, the other dies too. |
| Sorciere (Witch) | Village | `🧙‍♀️` | 1 | Has 2 one-use potions: heal (save wolf victim) and poison (kill any player). |
| Garde (Guard) | Village | `🛡️` | 0 | Each night, protects one player from elimination. Cannot protect same player two nights in a row or self. |
| Petite Fille (Little Girl) | Village | `👧` | 0 | Can spy on werewolves during their turn, but risks being discovered. |
| Corbeau (Crow) | Werewolf | `🐦‍⬛` | 0 | Each night, sends an anonymous hint message to a player (max 30 chars, cannot name a player directly). |
| Renard (Fox) | Village | `🦊` | 0 | Each night, designates 3 players. Learns if at least one werewolf is among them. |
| Concierge | Village | `🔑` | 0 | Each night, observes one player and discovers if they went out and who they visited. |

---

## 5. Game State

The full `GameState` interface (stored in KV and shared via Realtime):

### 5.1 Core Fields
- `gameId: string` — 8-char uppercase alphanumeric ID
- `screen: 'home' | 'setup' | 'game' | 'vote' | 'end'`
- `players: Player[]` — Each player has: `id`, `shortCode` (4-char join code), `name`, `role`, `alive`, `avatar` (emoji), `avatarUrl?`, `votesReceived`, `justRevived?`
- `roleConfig: Record<string, number>` — How many of each role
- `phase: 'night' | 'day'`
- `nightStep: 'werewolves' | 'seer' | 'witch' | 'cupidon' | 'idle' | 'done' | 'active'`
- `dayStep: 'discussion' | 'vote' | 'result'`
- `turn: number` — Current turn (starts at 1)
- `events: GameEvent[]` — Event log with id, turn, phase, message, timestamp
- `winner: 'village' | 'werewolf' | 'lovers' | null`

### 5.2 Night Action Fields
- `werewolfVotes: Record<number, number>` — wolfPlayerId -> targetPlayerId
- `werewolfTarget: number | null` — Resolved wolf victim shown to witch
- `werewolfTargets: number[]` — All resolved wolf kill targets (top N by vote)
- `wolfKillsPerNight: number` — GM setting (default 1)
- `seerTargets: Record<number, number>` — seerPlayerId -> targetPlayerId
- `seerResults: Record<number, RoleDefinition | null>` — seerPlayerId -> revealed role
- `witchHealUsedBy: number[]` — Witch IDs who permanently used heal
- `witchKillUsedBy: number[]` — Witch IDs who permanently used kill
- `witchHealTarget: number | null` — Wolf victim shown to witches
- `witchKillTargets: Record<number, number>` — witchPlayerId -> targetPlayerId
- `witchHealedThisNight: Record<number, boolean>` — witchPlayerId -> healed this night
- `guardTargets: Record<number, number>` — guardPlayerId -> protectedPlayerId
- `guardLastTargets: Record<number, number>` — guardPlayerId -> last protected (can't repeat)
- `corbeauTargets: Record<number, number>` — corbeauPlayerId -> targetPlayerId
- `corbeauMessages: Record<number, string>` — corbeauPlayerId -> message text
- `corbeauLastTargets: Record<number, number>` — Previous night's targets
- `foxTargets: Record<number, number[]>` — foxPlayerId -> 3 sniffed player IDs
- `foxResults: Record<number, boolean>` — foxPlayerId -> true if wolf found
- `conciergeTargets: Record<number, number>` — conciergePlayerId -> observed player
- `hunterPreTargets: Record<number, number>` — hunterId -> preselected target
- `hunterPending: boolean` — Hunter shot needs resolution
- `hunterShooterId: number | null`

### 5.3 Day/Vote Fields
- `votes: Record<number, number>` — voterId -> targetId (includes dead players' "derniere volonte")
- `voteResult: number | null`
- `nominations: Record<number, number>` — targetId -> first nominatorId (tracks who nominated whom)
- `earlyVotes: Record<number, number>` — Anticipated votes cast during night
- `voteHistory: Array<{ turn, votes, eliminated, nominations? }>`
- `hypotheses: Record<number, Record<number, string>>` — viewerId -> targetId -> guessed roleId

### 5.4 Special Mechanics
- `loverPairs: [number, number][]` — Array of lover pairs (Cupid)
- `cupidLinkedBy: number[]` — Cupid IDs who have linked
- `maireId: number | null` — Elected Maire player ID
- `maireElectionDone: boolean`
- `maireCandidates: number[]` — Player IDs who declared candidacy
- `maireCampaignMessages: Record<number, string>` — Campaign messages (max 100 chars)
- `maireSuccessScreen?: boolean` — Shows election success overlay
- `maireVotes: Record<number, number>` — Dedicated maire election votes
- `lastWillUsed: Record<number, boolean>` — Dead players who used their one-time last-will vote
- `wolfMissedVotes: Record<number, number>` — Consecutive nights each wolf missed voting
- `wolfInactivityThreshold: number` — Missed votes before wolf death (default 2, 0=disabled)

### 5.5 Hints System
- `hints: Hint[]` — `{ id, text, createdAt }` — Generated by Corbeau
- `playerHints: PlayerHint[]` — `{ hintId, playerId, sentAt, revealed, revealedAt? }`

### 5.6 Timer
- `phaseTimerDuration: number` — Base duration in seconds (default 900)
- `phaseTimerDayDuration: number` — Day-specific override
- `phaseTimerNightDuration: number` — Night-specific override
- `phaseTimerEndAt: string | null` — ISO timestamp when timer expires

### 5.7 Phase Transitions
- `roleRevealDone: boolean` — Whether role reveal phase completed
- `roleRevealedBy: number[]` — Player IDs who have seen their role
- `aliveAtPhaseStart?: Record<number, boolean>` — Snapshot for death detection
- `lastPhaseDeaths?: PhaseDeathRecord` — `{ phaseKey, transition: 'dawn'|'dusk', turn, deadPlayerIds }`
- `phaseDeathHistory?: PhaseDeathRecord[]` — Full history for late joiners

---

## 6. Game Flow

### 6.1 Setup Phase
1. GM creates a game (name, gets 8-char gameId)
2. GM configures roles (role picker with min/max/count per role)
3. GM adds players (names, optional avatar upload via camera/gallery)
4. Each player gets a unique 4-char `shortCode` (join code)
5. GM assigns roles randomly
6. Players join by entering their shortCode on the HomePage

### 6.2 Role Reveal Phase
- Each player sees a card-flip animation revealing their role (emoji, name, description, power)
- Players tap to acknowledge; GM waits for all players to reveal
- Server tracks `roleRevealedBy` array

### 6.3 Maire Election (Turn 1, after role reveal)
- Day phase, vote step, `maireElectionDone=false`, turn 1
- Players can declare/withdraw candidacy with a campaign message
- Other players vote for candidates (auto-vote for self when declaring)
- Vertical candidate card list showing name, message, vote count
- On timer expiry or GM resolution: highest vote wins (random tiebreak)
- `maireSuccessScreen` overlay with cinematic animation
- **Transitions directly to Night 1** (not another day phase)

### 6.4 Night Phase
- Background: pixel-art village night illustration with gradient overlay
- **"Le village dort..." card** with 3D flip animation (perspective, rotateY, backface-visibility hidden):
  - **Front face**: Sleeping card with animated stars, "z Z z" letters, "Vous dormez..." title in `nightSky` color (#7c8db5)
  - **Back face**: Role-specific action panel (tap card to flip, "Retourner la carte" button to flip back)
- Night actions are role-specific (see Section 7)
- GM controls phase progression; timer auto-transition also supported

### 6.5 Day Phase
- Background switches to warm parchment palette
- **Vote phase**: Players nominate and vote for elimination
  - "Nominer" button opens a bottom sheet to select a player
  - Regular vote grid (4 columns) shows nominated/voted players
  - Each player card shows: avatar, name, vote count badge, vote count text, nominator info
  - Maire's vote counts as 2 during regular votes (not during Maire election)
  - Dead players can cast one "derniere volonte" (last will) vote (not counted in tally, marked with scroll icon)
  - Vote counts exclude dead players' votes from the tally
- On timer expiry: most-voted player is eliminated

### 6.6 Phase Transitions
- Night -> Day: Resolve wolf kills, witch kills, guard blocks, wolf inactivity deaths, lover cascade deaths, hunter trigger. Apply early votes. Record dawn deaths.
- Day -> Night: Resolve elimination vote, handle hunter shot if needed, lover cascade. Reset night-specific state. Increment turn.
- Timer auto-transition: Managed by GM page and Spectator page with jitter (0-1.5s GM, 2-4s spectator) and distributed lock on server.

### 6.7 Win Conditions
- **Werewolf win**: All villagers eliminated
- **Village win**: All werewolves eliminated  
- **Lovers win**: All other players eliminated, both lovers alive (even if one is a wolf)

---

## 7. Role Night Actions (Player View)

Each role's action panel appears on the back of the sleeping card (3D flip):

### Loup-Garou (Werewolf)
- `WerewolfAction.tsx` — Vote for a victim among alive non-wolf players
- Grid of player avatars; tap to vote/toggle
- Shows other wolves' votes
- Multiple wolves vote collectively

### Voyante (Seer)
- `SeerAction.tsx` — Pick one player to investigate
- Purple gradient background (`rgba(12,13,21,0.9)` wrapper)
- Shows revealed role after selection (emoji, name, team)
- "Enqueter" button in nightSky color

### Sorciere (Witch)
- `WitchAction.tsx` — Two potions:
  - Heal: Save the wolf victim (shown to witch). One-use per game.
  - Poison: Kill any player. One-use per game.
- Shows potion availability status

### Garde (Guard)
- `GuardAction.tsx` — Protect one player
- Cannot protect same player as last night
- Cannot protect self

### Cupidon (Cupid)
- `CupidAction.tsx` — Link two players as Lovers (first night only)
- Two-step selection

### Chasseur (Hunter)
- `HunterAction.tsx` — Pre-select a target for if/when eliminated
- Actual shot resolved via modal when hunter dies

### Corbeau (Crow)
- `CorbeauAction.tsx` — Send anonymous hint to a player
- Text input (max 30 chars, cannot name a player directly)
- Creates a Hint + PlayerHint entry server-side

### Renard (Fox)
- `FoxAction.tsx` — Select 3 players to sniff
- Result: whether at least one werewolf is among them

### Concierge
- `ConciergeAction.tsx` — Observe one player
- Result: whether they went out and who they visited

### Petite Fille (Little Girl)
- `PetiteFilleAction.tsx` — Spy on werewolves (passive, UI for observation)

### Villageois (Villager)
- `VillagerSleepingPanel.tsx` — No action, just sleeping screen with background `rgba(12,13,21,0.7)`

### Non-role panels
- `GuardSleepingPanel.tsx` — Guard's sleeping display
- `DiscoveryRecapPanel.tsx` — Recap of night discoveries

---

## 8. Player Page (`PlayerPage.tsx`)

### 8.1 Layout
- Sets `html.style.fontSize = '20px'` (all rem-based sizing is relative to this)
- Swipe navigation between 3 panels: **Game** (main), **Village** (player list), **Quetes** (journal/quests)
- `useSwipeNavigation.ts`: `touch-action: pan-y`, `{ passive: false }` on touchmove, only prevents default for horizontal swipes
- Dot indicators at bottom for current panel

### 8.2 Header
- `PlayerHeader.tsx` — Player name, avatar, role emoji, phase indicator, timer
- Sticky top header with glassmorphism

### 8.3 Game Panel
- `GamePanel.tsx` — Main game view:
  - Night: Flip card with sleeping front / role action back
  - Day: Vote section, Maire candidacy section, victim banner
  - 3-layer flip card protection (pointerEvents, visibility, zIndex) to prevent front face blocking back face interactions

### 8.4 Village List Panel
- `VillageListPanel.tsx` — List of all players with alive/dead status, hypothesis badges

### 8.5 Quests Panel
- `JournalComponents.tsx` / `QuestsPanel` — Player's quest log, hints received
- `HintComponents.tsx` — Hint reveal flow:
  - `HintRevealButton`: Native pointer event listeners (pointerdown/pointerup, 12px movement threshold) via ref to bypass React event system
  - Click calls `onReveal` immediately, opens `HintRevealModal` showing revealed content
  - Ghost-click protection (500ms after mount) on modal backdrop
  - Defensive filtering of hints via Set of valid hintIds
  - Auto-close useEffect if hint becomes null
  - Optimistic update via local `localRevealedIds` Set

### 8.6 Special Screens (Portalized Overlays)
- `RoleRevealScreen.tsx` — Card-flip role reveal animation
- `MaireElectionSuccessScreen.tsx` — Cinematic 3-phase success overlay via `createPortal`
- `DeathAnnouncementModal.tsx` — Death announcement with player info
- `RevivedScreen.tsx` — Player revived notification
- `LastWillSection.tsx` — Dead player's one-time vote UI (excluded from tally, marked with scroll icon)

All portalized components use `fontSize: '16px'` on their root container to compensate for the PlayerPage's `20px` root font size.

### 8.7 Sync
- `usePlayerSync.ts` — Polls server state, handles Realtime updates
- `useServerAction.ts` — Optimistic updates for actions (candidacy, votes, etc.)

---

## 9. Game Master Page (`GameMasterPage.tsx`)

### 9.1 Tabs
- **Setup**: `SetupPanel.tsx` — Player management, role configuration
- **Game**: `GMGamePanel.tsx` — Full game control dashboard
- **Hints**: `GMHintPanel` — Manage game hints
- **Spectator**: `SpectatorEmbed.tsx` — Embedded spectator view

### 9.2 Game Control
- `GMNightDashboard.tsx` — Night phase overview showing all role actions
- `GMPhaseActions.tsx` — Phase transition controls
- `GMPlayerList.tsx` / `GMVillageGrid.tsx` — Player management grid
- `GMVoteTracking.tsx` — Vote monitoring with dead players' last-will votes shown with scroll icon
- `GMPlayerDetail.tsx` — Individual player detail panel
- `GMModals.tsx` — Hunter shot resolution, end game overlay
- `GMPhaseTimerSettings.tsx` — Configure phase timers (day/night/global)
- `GMWolfInactivitySettings.tsx` — Configure wolf inactivity threshold
- `GMWolfKillsStepper.tsx` — Configure max wolf kills per night
- `GMRoleRevealPhase.tsx` — Monitor role reveal progress
- `GMNightActionPlayerPickerModal.tsx` — Override night actions for specific players

### 9.3 Multi-Game Lobby
- `GMLobbyView.tsx` — List/create/delete games
- GM password: `"loupgarou"` (hardcoded)
- Secret admin code: `"AMVU"` bypasses password
- Keyboard shortcut: Cmd+D / Ctrl+D opens GM modal from HomePage

### 9.4 GM Logic
- `useGMGameLogic.ts` / `useGMPhaseTransitions.ts` — Phase transition logic, win condition checks
- `gmPureHelpers.ts` — Pure computation helpers (vote counts, etc.)
- Phase timer auto-transition with 0-1.5s jitter

---

## 10. Spectator Page (`SpectatorPage.tsx`)

### 10.1 Design
- **TV fullscreen optimized**: Village illustration fills entire screen, no side panel
- All information overlaid with glassmorphism cards
- Text shadows and 2-3x larger font sizes for readability from distance
- Village illustration changes based on phase:
  - Night: `nightVillageBg`
  - Day (vote): `dayVillageBg`
  - Day (peaceful/discussion): `dayVillagePeacefulBg`
  - Maire election: `electionVillageBg`

### 10.2 Phase Transition Overlay
- `PhaseTransitionOverlay.tsx` — Cinematic day/night transition via `createPortal` at z-index 9999
- Static pixel-art village with tinted overlay (blue night / amber dawn)
- Vignette effect
- Text in Cinzel Decorative font
- Sliding day counter animation (prev label slides up, new slides from bottom, stacked via `gridArea: "1 / 1"`, 0.9s animation)
- `prevTurnRef` tracks previous turn for animation
- Auto-dismiss after ~4s
- `onTransitionChange(active: boolean)` controls `isTransitioning` state in SpectatorPage

### 10.3 Day/Night Crossfade
- Both phase backgrounds coexist in render tree
- `motion.div` with animated opacity over 1.8s for smooth crossfade
- Header border uses longhand CSS properties (`borderBottomWidth`, `borderBottomStyle`, `borderBottomColor`) to avoid conflicts with Tailwind's `* { @apply border-transparent }` rule

### 10.4 Player Marquee
- `PlayerMarquee.tsx` — Horizontal scrolling player banner at bottom
- Phase-based filtering:
  - **Maire election**: Only candidates shown
  - **Night**: Only dead players shown
  - **Day**: Only nominated/voted players shown (keys of `nominations` + players with `voteCounts > 0`)
- Continuous right-to-left scroll via `requestAnimationFrame` at 60px/s (only if content overflows, otherwise centered static)
- Dead players: greyscale, skull badge, strikethrough name
- Vote count badges and progress bar preserved during vote phases

### 10.5 Timer Auto-Transition
- Polls `phaseTimerEndAt`, triggers `POST /game/action/timer-transition` at expiry
- Random jitter: 2-4s (spectator has higher jitter than GM's 0-1.5s)
- Server-side distributed lock prevents duplicate transitions

### 10.6 Victory Overlay
- "Fermer" button dismisses via `winnerDismissed` state
- Auto-reset if `state.winner` changes

---

## 11. Server API Endpoints

All routes prefixed with `/make-server-ed2f8415`.

### 11.1 Game Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/game/auth` | Verify GM password |
| GET | `/games` | List all games |
| POST | `/games` | Create new game |
| GET | `/game/state?gameId=X` or `?shortCode=X` | Get game state |
| POST | `/game/state` | Save full game state |
| DELETE | `/game?gameId=X` | Delete a game |

### 11.2 Player Actions
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/game/action/vote` | `{ voterId, targetId, gameId }` | Cast village vote (also tracks nominations) |
| POST | `/game/action/cancel-vote` | `{ voterId, gameId }` | Cancel village vote |
| POST | `/game/action/declare-candidacy` | `{ playerId, message?, gameId }` | Declare Maire candidacy (auto-votes for self) |
| POST | `/game/action/withdraw-candidacy` | `{ playerId, gameId }` | Withdraw candidacy (removes votes for this candidate) |
| POST | `/game/action/werewolf-vote` | `{ wolfId, targetId, gameId }` | Cast/toggle werewolf vote |
| POST | `/game/action/seer-target` | `{ actorId, playerId, gameId }` | Set seer investigation target (null to clear) |
| POST | `/game/action/guard-target` | `{ actorId, playerId, gameId }` | Set guard protection target |
| POST | `/game/action/hunter-pre-target` | `{ actorId, playerId, gameId }` | Pre-select hunter shot target |
| POST | `/game/action/fox-target` | `{ actorId, playerIds[], gameId }` | Fox sniff 3 players (returns foxResult) |
| POST | `/game/action/concierge-target` | `{ actorId, targetId, gameId }` | Concierge observation |
| POST | `/game/action/corbeau-target` | `{ actorId, playerId, message, gameId }` | Send anonymous crow hint (creates Hint + PlayerHint) |
| POST | `/game/action/witch-heal` | `{ actorId, gameId }` | Use witch heal potion |
| POST | `/game/action/witch-kill` | `{ actorId, playerId, gameId }` | Use witch poison potion |
| POST | `/game/action/cancel-witch-kill` | `{ actorId, gameId }` | Cancel witch poison |
| POST | `/game/action/cupid-link` | `{ actorId, id1, id2, gameId }` | Link two players as lovers |
| POST | `/game/action/role-revealed` | `{ playerId, gameId }` | Mark player as having seen their role |
| POST | `/game/action/reveal-hint` | `{ playerId, hintId, gameId }` | Reveal a hint for a player |
| POST | `/game/action/early-vote` | `{ voterId, targetId, gameId }` | Cast anticipated vote during night |
| POST | `/game/action/last-will-used` | `{ playerId, gameId }` | Mark dead player's last-will vote as used |
| POST | `/game/action/timer-transition` | `{ gameId }` | Auto-transition when timer expires (with distributed lock) |

### 11.3 Miscellaneous
| Method | Path | Description |
|--------|------|-------------|
| POST | `/game/heartbeat` | Player heartbeat (presence tracking) |
| GET | `/game/heartbeats?gameId=X` | GM reads all heartbeats |
| POST | `/game/hypothesis` | Save player hypothesis about another player's role |
| GET | `/game/hypothesis?gameId=X&shortCode=X` | Get player's hypotheses |
| POST | `/game/avatar-upload` | Upload player avatar image |

### 11.4 Push Notifications
- Subscription management and push notification sending endpoints in `push.tsx`

---

## 12. Theme System

### 12.1 Theme Tokens (`gameTheme.ts`)
Function `gameTheme(phase)` returns a `GameThemeTokens` object:

**Night theme**: Dark blue-violet (`pageBgSolid: '#070b1a'`, `text: '#c0c8d8'`, `gold: '#d4a843'`, `nightSky: '#7c8db5'`, `overlayChannel: '255,255,255'`)

**Day theme**: Warm parchment (`pageBgSolid: '#f0ead8'`, `text: '#2a1f10'`, `gold: '#a07808'`, `overlayChannel: '0,0,0'`)

**Dead theme**: Desaturated greyscale (`pageBgSolid: '#0a0a0a'`, `text: '#a0a0a0'`, `gold: '#888888'`)

### 12.2 Night Card Backgrounds
- Front face (sleeping): `rgba(12,13,21,0.4)`
- Back face wrapper: `rgba(12,13,21,0.9)`
- Villager sleeping panel: `rgba(12,13,21,0.7)`
- Seer action: Subtle violet gradient

### 12.3 Key Colors
- Gold accent: `#d4a843` (night), `#a07808` (day)
- Danger/vote: `#c41e3a`
- Night sky / stars / "z Z z" / sleeping title / "Enqueter" button: `#7c8db5`
- Maire election gold: `#d4a843`

### 12.4 CSS Considerations
- Global `theme.css` has `button { font-size: var(--text-base); }` in base layer
- Global `* { @apply border-transparent }` conflicts with `borderBottom` shorthand — must use longhand properties (`borderBottomWidth`, `borderBottomStyle`, `borderBottomColor`) for Motion animations
- PlayerPage sets `html.style.fontSize = '20px'` — portalized components reset to `fontSize: '16px'`

---

## 13. Animations & Interactions

### 13.1 Motion (framer-motion successor)
- Import: `import { motion, AnimatePresence } from 'motion/react'`
- Used throughout for: page transitions, card animations, vote badges, overlays, marquee

### 13.2 3D Flip Card
- Night sleeping card uses perspective + rotateY transform
- `backfaceVisibility: 'hidden'` on both faces
- 3 layers of protection on front face when flipped: `pointerEvents: 'none'`, `visibility: 'hidden'`, `zIndex` management
- Types in `gamePanelTypes.ts`: `isFlipped`, `onFlipBack`, `roleBackContent: React.ReactNode`

### 13.3 Sleeping Card Animations
- Animated stars in nightSky color
- Floating "z Z z" letters
- Pulsing "Vous dormez..." title

### 13.4 Maire Election Success
- 3-phase cinematic transition via `createPortal`
- Overlay with animation sequence

### 13.5 Spectator Phase Transition
- Cinematic overlay with village illustration
- Day counter sliding animation (gridArea stacking)

### 13.6 Swipe Navigation
- `useSwipeNavigation.ts` manages horizontal swipe between Game/Village/Quetes panels
- `touch-action: pan-y` allows vertical scroll while capturing horizontal swipe
- `{ passive: false }` on touchmove, `preventDefault` only for horizontal swipes

---

## 14. Key Technical Patterns

### 14.1 Optimistic Updates
- Vote/candidacy actions update local state immediately before server request
- `useServerAction.ts` provides optimistic state updates for: `serverDeclareCandidacy`, `serverWithdrawCandidacy`, votes
- Hint reveal uses local `localRevealedIds` Set in `PlayerHintSection`

### 14.2 Defensive Programming
- Ghost-click protection (500ms delay) on modal backdrops
- `HintRevealButton` uses native pointer events (pointerdown/pointerup) via ref with 12px movement threshold to bypass React event system
- Defensive hint filtering via Set of valid hintIds
- Auto-close useEffect when hint becomes null
- Timer transition distributed lock prevents duplicate phase changes

### 14.3 Vote Counting
- Dead players' votes (derniere volonte) stored in `state.votes` but excluded from `voteCounts` calculation
- Exclusion applied in: `useGameActions.ts` (client), `actionRoutes.tsx` (server), `gmPureHelpers.ts` (GM display), `GamePanel.tsx`, `LastWillSection.tsx`
- Dead votes visible in GM detail with scroll icon and `isLastWill` flag
- Maire's vote = 2 weight during regular (non-Maire-election) votes

### 14.4 Wolf Inactivity
- Tracks consecutive missed wolf votes in `wolfMissedVotes`
- At threshold (default 2), wolf is auto-killed with message "Devore par les siens"
- Threshold configurable (0 = disabled)

### 14.5 Real-time Architecture
- GM broadcasts full state to all clients via Supabase Realtime
- Players send actions to REST API, then notify GM via Realtime to merge
- Heartbeat system for presence tracking
- `useRealtimeSync` hook manages channel subscription, status tracking

### 14.6 PWA Support
- `usePWA.ts` / `usePWAContext` for install prompt
- `PWAInstallBanner.tsx` shown on HomePage
- Push notification support via service worker

### 14.7 Error Handling
- Route-level error boundaries with themed fallback UI
- Retry logic for lazy imports (cache-busting, page reload)
- Local mode fallback when server unreachable
- Floating local mode indicator icon

---

## 15. Assets

### 15.1 Images (figma:asset)
- Wolf icon logo: `f25450638f641bf3950904ddd9c219ce09dc887b.png`
- Day village background: `f2db523e07c044463bd79385fbcf3b0ed37ca945.png`
- Day village peaceful: `a82839620a1569fcbf0c2b77dd03b73637aa89ad.png`
- Night village background: `970b6d36e9ae2b4285a385d4f028ab9db13a07a7.png`
- Election village background: `f54adbcfe4b6b635b5c6f68ca367a59c1d9e5161.png`

### 15.2 SVGs
- Located in `/src/imports/svg-*.ts`

### 15.3 Avatars
- 60 emoji avatars defined in `gameContextConstants.ts`
- Custom photo avatars uploaded to Supabase Storage

---

## 16. Dependencies

Key packages:
- `react`, `react-dom` (v19)
- `react-router` (v7, data mode — NOT react-router-dom)
- `motion` (Motion, successor to framer-motion — import from `motion/react`)
- `@supabase/supabase-js`
- `lucide-react` (icons)
- `sonner` (toast notifications)
- `tailwindcss` (v4)
- Shadcn/ui components in `/src/app/components/ui/`

---

## 17. Multiplayer Flow Summary

1. **GM** creates game on `/master` -> gets gameId
2. **GM** adds players with names -> each gets a 4-char shortCode
3. **GM** configures roles and assigns
4. **Players** go to `/` and enter their shortCode -> redirected to `/player/{shortCode}`
5. **Spectator** (optional TV screen) goes to `/spectator/{gameId}`
6. **Role reveal**: All players flip their card to see their role
7. **Maire election** (Turn 1): Candidates declare, players vote, winner announced
8. **Night 1**: GM or timer advances to night. Players with roles perform actions via flip card.
9. **Day 1 vote**: Deaths announced, players nominate/vote for elimination
10. **Cycle continues**: Night/day alternate until a win condition is met
11. **Victory**: Winner overlay shown to all clients

All actions sync in real-time via Supabase Realtime broadcast + REST API persistence.
