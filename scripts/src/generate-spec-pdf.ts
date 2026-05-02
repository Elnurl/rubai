import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT = resolve(process.cwd(), "exports/rubai-system-specification.pdf");
mkdirSync(dirname(OUT), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 56, bottom: 56, left: 56, right: 56 },
  info: {
    Title: "rubai — Full System Specification",
    Author: "rubai engineering",
    Subject: "Project documentation snapshot",
    CreationDate: new Date(),
  },
});
doc.pipe(createWriteStream(OUT));

const COLOR = {
  ink: "#15140F",
  muted: "#5A574E",
  accent: "#0E6F5C",
  amber: "#B7791F",
  rule: "#D9D5CB",
  codeBg: "#F4F1E8",
};

const FONT = {
  body: "Helvetica",
  bold: "Helvetica-Bold",
  mono: "Courier",
  monoBold: "Courier-Bold",
  italic: "Helvetica-Oblique",
};

function ensureSpace(h: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + h > bottom) doc.addPage();
}

function h1(text: string) {
  doc.addPage();
  doc.font(FONT.bold).fontSize(22).fillColor(COLOR.ink).text(text);
  doc.moveDown(0.3);
  doc
    .strokeColor(COLOR.accent)
    .lineWidth(2)
    .moveTo(doc.x, doc.y)
    .lineTo(doc.x + 80, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

function h2(text: string) {
  ensureSpace(40);
  doc.moveDown(0.6);
  doc.font(FONT.bold).fontSize(14).fillColor(COLOR.accent).text(text);
  doc.moveDown(0.3);
}

function h3(text: string) {
  ensureSpace(28);
  doc.moveDown(0.4);
  doc.font(FONT.bold).fontSize(11).fillColor(COLOR.ink).text(text);
  doc.moveDown(0.2);
}

function p(text: string) {
  ensureSpace(20);
  doc.font(FONT.body).fontSize(10).fillColor(COLOR.ink).text(text, {
    align: "left",
    lineGap: 2,
  });
  doc.moveDown(0.4);
}

function bullets(items: Array<string | [string, string]>) {
  doc.font(FONT.body).fontSize(10).fillColor(COLOR.ink);
  for (const item of items) {
    ensureSpace(16);
    const startY = doc.y;
    doc.font(FONT.bold).text("• ", doc.x, startY, { continued: true });
    if (typeof item === "string") {
      doc.font(FONT.body).text(item, { lineGap: 2 });
    } else {
      const [label, body] = item;
      doc.font(FONT.bold).text(`${label}: `, { continued: true });
      doc.font(FONT.body).text(body, { lineGap: 2 });
    }
  }
  doc.moveDown(0.3);
}

function code(text: string) {
  const lines = text.split("\n");
  const lineH = 12;
  const padding = 8;
  const blockH = lines.length * lineH + padding * 2;
  ensureSpace(blockH + 6);
  const x = doc.x;
  const y = doc.y;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save();
  doc.rect(x, y, w, blockH).fill(COLOR.codeBg);
  doc.restore();
  doc.font(FONT.mono).fontSize(9).fillColor(COLOR.ink);
  let ty = y + padding;
  for (const ln of lines) {
    doc.text(ln, x + padding, ty, { lineBreak: false });
    ty += lineH;
  }
  doc.y = y + blockH + 6;
  doc.x = doc.page.margins.left;
}

function table(headers: string[], rows: string[][], colWeights?: number[]) {
  const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const weights = colWeights ?? headers.map(() => 1);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sumW) * totalW);
  const padding = 6;

  const measureRow = (cells: string[]) => {
    let max = 0;
    cells.forEach((c, i) => {
      doc.font(FONT.body).fontSize(9);
      const h = doc.heightOfString(c, { width: widths[i] - padding * 2 });
      if (h > max) max = h;
    });
    return max + padding * 2;
  };

  const drawRow = (cells: string[], opts: { header?: boolean } = {}) => {
    const h = measureRow(cells);
    ensureSpace(h);
    const x0 = doc.x;
    const y0 = doc.y;
    if (opts.header) {
      doc.save();
      doc.rect(x0, y0, totalW, h).fill(COLOR.accent);
      doc.restore();
    } else {
      doc.save();
      doc.rect(x0, y0, totalW, h).strokeColor(COLOR.rule).lineWidth(0.5).stroke();
      doc.restore();
    }
    let cx = x0;
    cells.forEach((c, i) => {
      doc
        .font(opts.header ? FONT.bold : FONT.body)
        .fontSize(9)
        .fillColor(opts.header ? "#FFFFFF" : COLOR.ink)
        .text(c, cx + padding, y0 + padding, {
          width: widths[i] - padding * 2,
          lineGap: 1,
        });
      cx += widths[i];
    });
    doc.y = y0 + h;
    doc.x = x0;
  };

  drawRow(headers, { header: true });
  for (const r of rows) drawRow(r);
  doc.moveDown(0.5);
}

// ============================================================
// COVER PAGE
// ============================================================
doc.font(FONT.bold).fontSize(40).fillColor(COLOR.ink).text("rubai", {
  align: "left",
});
doc
  .font(FONT.body)
  .fontSize(14)
  .fillColor(COLOR.muted)
  .text("AI Goal Coach — Full System Specification", { align: "left" });
doc.moveDown(2);
doc
  .strokeColor(COLOR.accent)
  .lineWidth(3)
  .moveTo(doc.x, doc.y)
  .lineTo(doc.x + 120, doc.y)
  .stroke();
doc.moveDown(1.5);
doc
  .font(FONT.body)
  .fontSize(11)
  .fillColor(COLOR.ink)
  .text(
    "A complete documentation snapshot of every layer, package, route, table, file, and tech choice currently present in the rubai monorepo.",
    { lineGap: 3 },
  );
doc.moveDown(2);
doc.font(FONT.bold).fontSize(11).fillColor(COLOR.ink).text("Document metadata");
doc.moveDown(0.3);
doc.font(FONT.body).fontSize(10).fillColor(COLOR.muted);
const meta: Array<[string, string]> = [
  ["Project", "rubai (Expo + Express monorepo)"],
  ["Version", "1.0.0"],
  ["Generated", new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC"],
  ["Repository layout", "pnpm workspace · TypeScript ~5.9.2"],
];
for (const [k, v] of meta) {
  doc
    .font(FONT.bold)
    .fillColor(COLOR.ink)
    .text(`${k}: `, { continued: true })
    .font(FONT.body)
    .fillColor(COLOR.muted)
    .text(v);
}

doc.moveDown(2);
doc.font(FONT.bold).fontSize(13).fillColor(COLOR.accent).text("Contents");
doc.moveDown(0.4);
const toc = [
  "1. Product",
  "2. Repository Layout",
  "3. Tech Stack & Versions",
  "4. Workflows",
  "5. Database Schema",
  "6. API Server",
  "7. Mobile App",
  "8. Shared Libraries",
  "9. Auth & Routing Rules",
  "10. AI Coach Behavior",
  "11. Push Notifications",
  "12. Environment Variables / Secrets",
  "13. Build / Lint / Typecheck Commands",
  "14. Known Constraints / Conventions",
];
doc.font(FONT.body).fontSize(10).fillColor(COLOR.ink);
for (const t of toc) doc.text(t, { lineGap: 3 });

// ============================================================
// 1. PRODUCT
// ============================================================
h1("1. Product");
bullets([
  ["Name (wordmark)", "rubai (always lowercase). Internal identifiers Atlas* / RubAI are historical."],
  ["Type", "Mobile-first AI goal-execution coach. User picks a goal (template or custom), AI runs intake → builds a multi-phase roadmap → generates a daily plan → coaches them every day with adaptive evolution."],
  ["Tiers", "Free (1 active goal), Pro (5), Premium (25). Currently UI-preview only — billing is wired structurally but no charges."],
  ["Target platforms", "iOS + Android via Expo Go for dev; production-ready EAS build path. Web is dev preview only."],
]);

// ============================================================
// 2. REPO LAYOUT
// ============================================================
h1("2. Repository Layout (pnpm monorepo)");
code(`artifacts/
  api-server/                       # Express API (mounted at /api)
  mobile/                           # Expo React Native app
  mockup-sandbox/                   # Vite component-preview sandbox
lib/
  api-spec/                         # OpenAPI 3.1 + Orval codegen
  api-zod/                          # Generated Zod schemas (server)
  api-client-react/                 # Generated React Query hooks (mobile)
  db/                               # Drizzle ORM schema + push CLI
  integrations-openai-ai-server/    # OpenAI server wrapper
  integrations-openai-ai-react/     # OpenAI client helpers (audio)
scripts/                            # Repo-level utility scripts
pnpm-workspace.yaml                 # Workspace + catalog + 1-day quarantine
tsconfig.base.json                  # Shared strict TS defaults
tsconfig.json                       # Solution file for libs only`);

// ============================================================
// 3. TECH STACK
// ============================================================
h1("3. Tech Stack & Versions");
bullets([
  ["Language / build", "TypeScript ~5.9.2, esbuild (server bundle), Metro (mobile), Vite 7 (mockup sandbox)."],
  ["Runtime", "Node 20 (Replit container, NixOS)."],
  ["Mobile", "Expo SDK 54.0.27 · React Native 0.81.5 · React 19.1.0 · expo-router 6 · React Compiler enabled · newArchEnabled: true."],
  ["Server", "Express 5 · pino 9 (structured logs, no console.log) · cookie-parser · cors · multer (audio uploads) · http-proxy-middleware · express-rate-limit 8."],
  ["Auth", "Clerk (@clerk/expo 3.2 mobile, @clerk/express 2.1 server). Email+password and SSO. Custom branded screens."],
  ["DB", "PostgreSQL via pg 8 + Drizzle ORM 0.45 + drizzle-kit (push migrations). drizzle-zod for schema → Zod."],
  ["Validation / contracts", "OpenAPI 3.1 + Orval 8.5 codegen → Zod (server) + React Query hooks (mobile)."],
  ["State (mobile)", "React Query 5.90 + AsyncStorage (cache snapshot) + a single AtlasProvider context."],
  ["Icons / fonts", "@expo/vector-icons (Feather, Ionicons, MaterialIcons), Inter via @expo-google-fonts/inter. .ttf files copied into assets/fonts/ and loaded by direct require to defeat Android Expo Go bundling bug."],
  ["Animations / UI", "react-native-reanimated 4.1 · gesture-handler · keyboard-controller · expo-linear-gradient · expo-blur · expo-glass-effect · expo-haptics · expo-symbols (SF Symbols on iOS)."],
  ["Media", "expo-image-picker 17, expo-image 3, expo-audio (mic), expo-speech (TTS)."],
  ["Push", "expo-notifications + expo-device (client); expo-server-sdk 6 (server); @ide/backoff peer dep."],
  ["AI", "openai SDK 6. Models: MODEL=gpt-5.4, MODEL_FAST=gpt-5.4-mini, MODEL_VISION=gpt-4o (vision turns only), whisper-1 (transcribe)."],
  ["Supply-chain defense", "minimumReleaseAge: 1440 (1-day quarantine on every npm package)."],
]);

// ============================================================
// 4. WORKFLOWS
// ============================================================
h1("4. Workflows (Replit-managed processes)");
bullets([
  ["artifacts/api-server: API Server", "pnpm --filter @workspace/api-server run dev (esbuild bundle → node start, mounted at /api)."],
  ["artifacts/mobile: expo", "pnpm --filter @workspace/mobile run dev (expo start with Replit-specific env vars: EXPO_PACKAGER_PROXY_URL, EXPO_PUBLIC_DOMAIN, EXPO_PUBLIC_REPL_ID, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, REACT_NATIVE_PACKAGER_HOSTNAME)."],
  ["artifacts/mockup-sandbox: Component Preview Server", "vite dev (canvas iframes only)."],
]);

// ============================================================
// 5. DB SCHEMA
// ============================================================
h1("5. Database Schema (Postgres via Drizzle, push not migrate)");
p("Source: lib/db/src/schema/. Push command: pnpm --filter @workspace/db run push.");
table(
  ["Table", "Purpose", "Key columns"],
  [
    ["users", "One row per Clerk user", "id (serial), clerk_user_id (unique), email, tier (free/pro/premium), expo_push_token, tz_offset_minutes, last_morning_nudge_date (YYYY-MM-DD), timestamps"],
    ["user_state", "Single per-user app blob", "user_id (PK FK), goals (jsonb array), active_goal_id (text), account_prefs (jsonb), pending_draft (jsonb intake-in-progress), version (CAS counter), updated_at"],
    ["conversations", "Chat conversations", "id, title, created_at"],
    ["messages", "Chat turns", "id, conversation_id FK, role, content, created_at"],
    ["subscriptions", "Forward-looking billing record (RevenueCat / Stripe ready)", "provider, product_id, status, current_period_end, store_transaction_id (unique with provider), raw jsonb"],
    ["ai_usage", "Per-call OpenAI ledger", "route, model, input_tokens, output_tokens, latency_ms, status, error_message"],
    ["analytics_events", "Generic product/business events", "event_type, payload jsonb"],
  ],
  [1.4, 2.4, 5],
);

// ============================================================
// 6. API SERVER
// ============================================================
h1("6. API Server (artifacts/api-server)");
p("Entry: src/index.ts → src/app.ts (62 lines). All routes mounted under /api.");

h2("6.1 Middlewares");
bullets([
  ["clerkProxyMiddleware", "Passes Clerk session through dev proxy."],
  ["requireAuth", "Verifies Clerk token, upserts user row, sets req.userId (numeric DB id)."],
  ["rateLimit", "aiRateLimiter applied at the /atlas router level."],
]);

h2("6.2 Routes");
h3("src/routes/health.ts");
bullets(["GET /api/healthz"]);

h3("src/routes/me.ts (218 lines) — single user-state surface");
bullets([
  ["GET /api/me", "Public-safe identity + tier."],
  ["GET /api/me/state", "Returns full MeStateResponse (goals[], activeGoalId, accountPrefs, pendingDraft, version)."],
  ["PUT /api/me/state", "Optimistic concurrency via expectedVersion; returns 409 + latest on conflict."],
]);

h3("src/routes/atlas.ts (1797 lines, the AI brain) — all under /api/atlas/*, requires auth + AI rate limiter");
bullets([
  ["POST /generate-title", "Short brand-neutral goal title (NEW goals only)."],
  ["POST /intake-questions", "Tailored intake form per goal type."],
  ["POST /intake-submit", "Synthesizes a UserProfile from answers."],
  ["POST /onboarding-chat", "Alternative chat-driven onboarding."],
  ["POST /roadmap", "Multi-phase Roadmap (phases × milestones, strategy, riskAnalysis, totalWeeks)."],
  ["POST /daily-plan", "Today's DailyTask[] with focusOfTheDay, coachNote, priority (critical/high/normal)."],
  ["POST /coach", "Free-form chat. Accepts modelChoice (smart/fast), optional attachmentNote (filename ack) OR attachmentImage { base64Data, mimeType } (real vision via gpt-4o, MIME allowlist, 5MB decoded cap). Returns reply + optional actionSuggestion (Confirm/Cancel cards) + optional coachMemoryUpdate."],
  ["POST /transcribe", "Multipart audio → text via Whisper, 25 MB cap, multer memory storage."],
  ["POST /adapt", "Adaptive engine returning easier/same/harder recommendation."],
  ["POST /behavioral-profile", "Builds/evolves cumulative BehavioralProfile (consistency, workload tolerance, motivation trend, focus style, peak hours, failure patterns, strengths, recommendedAdjustments)."],
  ["POST /evolve-roadmap", "Updates roadmap based on behavior + reflections; returns evolved roadmap + phaseChanges[] + changeSummary + rationale."],
  ["POST /push-token", "Registers Expo token + device tz offset on the user row."],
  ["POST /push-test", "One-shot self-test push."],
]);

h2("6.3 Server-side libs");
bullets([
  ["src/lib/logger.ts", "pino singleton (use req.log in routes)."],
  ["src/lib/aiUsage.ts", "Wrapper that records every OpenAI call into ai_usage."],
  ["src/lib/pushScheduler.ts (229 lines)", "In-process setInterval 60s tick. For each user with a token, computes local time from tz_offset_minutes; if local hour is in [7,10) and last_morning_nudge_date != today (local), picks the active goal, builds momentum-based body, sends via expo-server-sdk, stamps last_morning_nudge_date regardless of send result (prevents bad-token hourly retries)."],
  ["src/app.ts", "JSON body limit raised 2 MB → 8 MB (for base64 images), CORS, cookie-parser, mounts routes."],
]);

// ============================================================
// 7. MOBILE
// ============================================================
h1("7. Mobile App (artifacts/mobile)");
p("Entry: expo-router/entry. App config: app.json (newArch on, Clerk + push + audio plugins, expo-font plugin embeds .ttfs).");

h2("7.1 Routes (file-based, app/)");
h3("Auth group (auth)/");
bullets([
  ["_layout.tsx", "Closed group (no escape to tabs)."],
  ["sign-in.tsx, sign-up.tsx, verify.tsx, forgot-password.tsx", "Branded Clerk flows."],
]);
h3("Top-level");
bullets([
  ["_layout.tsx (262 lines)", "Root: ClerkProvider, QueryClientProvider, AtlasProvider, Inter + icon fonts via direct .ttf requires, AuthGate (auth + goal-gating + welcome-once-only logic), SafeAreaProvider, ErrorBoundary, status bar."],
  ["index.tsx", "Splash / route classifier."],
  ["welcome.tsx", "First-run welcome (shown exactly once per user)."],
  ["intake.tsx", "Dynamic intake form rendering AI-generated questions."],
  ["generating.tsx", "Animated wait while roadmap+plan generate."],
  ["new-goal.tsx", "Add another goal (gated by tier)."],
  ["replace-goal.tsx", "Swap an active goal at the tier limit."],
  ["plans.tsx", "Free/Pro/Premium tier picker (UI preview, no billing call)."],
  ["+not-found.tsx", "404."],
]);
h3("Tab group (tabs)/");
bullets([
  ["_layout.tsx", "Bottom tabs with Feather icons."],
  ["index.tsx", "Today (focus, daily tasks, momentum, smart/fast, voice, paperclip, chat composer)."],
  ["roadmap.tsx", "Multi-phase roadmap with PhaseCards, evolve-roadmap entry point."],
  ["coach.tsx", "Full coach screen."],
  ["goals.tsx", "List/manage goals."],
  ["account.tsx", "Profile, plans link, sign out, behavioral profile refresh."],
]);

h2("7.2 Providers");
p("providers/AtlasProvider.tsx (1247 lines) — single source of truth for client app state:");
bullets([
  "Hydrates from /api/me/state, falls back to AsyncStorage cache.",
  "Optimistic + coalesced PUT mutations with version CAS; on 409 re-syncs and retries.",
  "Tier refs: serverTierRef (authoritative, persisted) vs localTierOverrideRef (session-only Plans preview, never persisted).",
  "Exposes all goal/profile/roadmap/plan/coach/reflection mutations and selectors.",
  "Bootstraps push registration once per signed-in userId.",
]);

h2("7.3 Components (components/)");
p(
  "AtlasButton, AtlasLogo, AwardToast, ChatBubble (with TTS speaker icon), ActiveGoalChip, AdaptiveEngineCard, EmptyState, ErrorBoundary, ErrorFallback, GoalCard, GoalListItem, GoogleGIcon, IntakeForm, KeyboardAwareScrollViewCompat, MomentumCard, PhaseCard, ProposedActionCard (Confirm/Cancel for AI task edits), ReflectionSheet, SectionHeader, SubscriptionCard, TaskCard, TaskDetailSheet (full-screen task view on tap).",
);

h2("7.4 Hooks (hooks/)");
bullets([
  ["useColors", "Light/dark palette resolver."],
  ["useEvolveRoadmap", "Orchestrates /atlas/evolve-roadmap + state merge."],
  ["useTextToSpeech", "expo-speech (native) / window.speechSynthesis (web)."],
  ["useVoiceRecorder", "expo-audio (native) / MediaRecorder (web), uploads to /atlas/transcribe."],
]);

h2("7.5 Lib (lib/)");
bullets([
  ["authErrors.ts", "Clerk error → user-friendly copy."],
  ["awards.ts", "Streak/award logic."],
  ["momentum.ts", "Momentum band + body copy (mirrored server-side for push)."],
  ["push.ts", "registerForPushAsync (permission, Expo token, tz offset, POST /atlas/push-token)."],
  ["storage.ts", "Typed AsyncStorage cache snapshot."],
]);

h2("7.6 Assets");
bullets([
  ["assets/images/icon.png", "App icon, splash, adaptive icon."],
  ["assets/fonts/Feather.ttf, Ionicons.ttf, MaterialIcons.ttf", "Explicitly bundled via expo-font plugin (Android Expo Go fix)."],
]);

// ============================================================
// 8. SHARED LIBS
// ============================================================
h1("8. Shared Libraries (lib/)");
bullets([
  ["@workspace/api-spec", "openapi.yaml (single source of truth), Orval config; pnpm --filter @workspace/api-spec run codegen regenerates clients + zod."],
  ["@workspace/api-zod", "Generated Zod schemas (server-side input/output validation)."],
  ["@workspace/api-client-react", "Generated React Query hooks (mobile data layer)."],
  ["@workspace/db", "Drizzle schema, types, push CLI."],
  ["@workspace/integrations-openai-ai-server", "OpenAI server wrapper (chat, image, audio, batch) with p-limit + p-retry."],
  ["@workspace/integrations-openai-ai-react", "audio client helpers."],
]);

// ============================================================
// 9. AUTH
// ============================================================
h1("9. Auth & Routing Rules");
p("Clerk session is the only signed-in concept. A custom AuthGate enforces:");
bullets([
  "Signed-out → only (auth) routes reachable.",
  "While AtlasProvider hydrating → forced to /index.",
  "Signed-in with 0 goals → trapped in welcome → intake → generating → new-goal/replace-goal.",
  "Signed-in with goals.length > 0 landing on /welcome → bumped to (tabs) (welcome is once-per-user).",
  "pendingDraft present → resumes on /intake or /generating.",
]);

// ============================================================
// 10. AI COACH
// ============================================================
h1("10. AI Coach Behavior");
bullets([
  "Default model gpt-5.4; the Fast pill switches to gpt-5.4-mini; image attachments switch the single turn to gpt-4o.",
  "Coach proposes task edits as actionSuggestion → renders ProposedActionCard with Confirm/Cancel; Confirm runs setActiveDailyPlan / updateActiveGoal → schedulePush → server PUT.",
  "Coach maintains coachMemory (summary + facts list capped at 20) updated via optional coachMemoryUpdate patches.",
  "AI auto-titles ONLY new goals (via /generate-title); never re-titles existing ones.",
  "Voice: mic record → Whisper → auto-send transcript; assistant bubbles get tap-to-speak; Voice on/off pill toggles auto-speak.",
]);

// ============================================================
// 11. PUSH
// ============================================================
h1("11. Push Notifications");
bullets([
  ["Client", "registerForPushAsync after Clerk sign-in (web/simulator short-circuit), POSTs Expo token + UTC offset."],
  ["Server", "60s in-process tick, local-morning window [7,10), dedupe via last_morning_nudge_date, momentum-aware body, stamp date even on send failure."],
  ["Self-test", "/atlas/push-test for manual verification."],
]);

// ============================================================
// 12. ENV
// ============================================================
h1("12. Environment Variables / Secrets");
bullets([
  ["DATABASE_URL", "Postgres connection."],
  ["CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY", "Auth."],
  ["EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", "Mobile bundle-time."],
  ["AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL", "OpenAI proxy."],
  ["SESSION_SECRET", "Express session signing."],
  ["PORT, REPLIT_DEV_DOMAIN, REPLIT_EXPO_DEV_DOMAIN, REPL_ID", "Replit-injected."],
]);

// ============================================================
// 13. COMMANDS
// ============================================================
h1("13. Build / Lint / Typecheck Commands");
code(`# Whole-repo typecheck (libs --build, leaves --noEmit)
pnpm run typecheck

# Regenerate API client + zod from openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema to Postgres (no migrations)
pnpm --filter @workspace/db run push

# Mobile-only typecheck
pnpm --filter @workspace/mobile run typecheck

# Server bundle (esbuild → dist/index.mjs)
pnpm --filter @workspace/api-server run build`);

// ============================================================
// 14. CONSTRAINTS
// ============================================================
h1("14. Known Constraints / Conventions");
bullets([
  "Never call service ports directly — always go through the shared proxy at localhost:80.",
  "Never use console.log in server code — use req.log or the singleton logger.",
  "All OpenAPI descriptions are single-line; nullable fields use oneOf: [type, \"null\"] (3.1 style).",
  "Mobile uses expo-router file-based routing, no manual nav stack.",
  "No architectural rewrites — UI mutations always flow through existing setActiveDailyPlan / updateActiveGoal → server PUT path.",
  "Cloudflare CAPTCHA blocks Playwright e2e on auth flows — auth testing is manual on a real device.",
]);

// ============================================================
// FOOTER on every page
// ============================================================
const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  const oldBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font(FONT.body)
    .fontSize(8)
    .fillColor(COLOR.muted)
    .text(
      `rubai — System Specification · Page ${i + 1} of ${range.count}`,
      doc.page.margins.left,
      doc.page.height - 28,
      { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
    );
  doc.page.margins.bottom = oldBottom;
}

doc.end();
console.log(`Wrote ${OUT}`);
