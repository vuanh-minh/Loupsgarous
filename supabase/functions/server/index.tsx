/**
 * index.tsx — Thin Hono server orchestrator.
 *
 * Route modules:
 *   serverHelpers.tsx  — constants, KV key helpers, supabase client, bucket init
 *   gameRoutes.tsx     — health, auth, games CRUD, game state
 *   actionRoutes.tsx   — player actions + timer auto-transition
 *   miscRoutes.tsx     — heartbeat, hypothesis, avatar upload
 *   push.tsx           — web push notifications
 */
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";

// Import side-effects (bucket creation) from helpers
import "./serverHelpers.tsx";

// Import sub-apps
import { push } from "./push.tsx";
import { gameRoutes } from "./gameRoutes.tsx";
import { actionRoutes } from "./actionRoutes.tsx";
import { miscRoutes } from "./miscRoutes.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Mount all route modules
app.route('/', push);
app.route('/', gameRoutes);
app.route('/', actionRoutes);
app.route('/', miscRoutes);

Deno.serve(app.fetch);
