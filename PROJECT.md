# Spruce

> A native mobile app for AI-assisted yard and home redesign. Photo in, plan out.

## Vision

A dedicated mobile assistant for landscaping and redecorating. The primary user (Raymond's wife) currently uses ChatGPT Plus on her phone to riff on her yard and her rooms — uploading photos, getting suggestions, iterating. The web ChatGPT UX is generic, the conversation history is bottomless, and saved projects don't have structure. Spruce is the dedicated tool for that workflow: take a photo, get an opinionated plan, save it as a project, see it visualized, eventually shop the suggestions through Amazon.

**Yard-first.** Her primary current use case is the yard, so Cycle 1 ships yard support. Indoor rooms come in a later cycle.

**Distribution model: BYOK (Bring Your Own Key).** Each user enters their own OpenAI API key in settings. Spruce never holds shared LLM billing — the user does. This makes the app shareable beyond Raymond's household while keeping operating costs at $0 for us. The moat is **domain-specialized prompts** (yard/home redesign with structured output) plus a focused UX, not the model.

**Domain:** `spruce.studio`

## Non-goals

Explicit out-of-scope to prevent scope creep:

- **Not a social product.** No feeds, no sharing-with-strangers, no comments. Single-user or household-scale only.
- **Not a CAD/floorplan tool.** No 3D modeling, no measurements, no room scanning. Photos in, plans out — that's the loop.
- **Not a marketplace.** When we add Amazon links (Cycle 3), they're search URLs. We don't host listings, scrape product data, or process payments.
- **Not a PWA.** Hard requirement: native Android app. PWA was considered and rejected — camera UX, install ergonomics, and "this is a real app on my phone" matter for the use case. **iOS dropped 2026-06-22** — target user is on Android, no reason to carry Apple toolchain.
- **Not a hosted-LLM SaaS.** We never pay for users' inference. Spruce is BYOK: user supplies API key, user pays the API provider directly. Keeps Spruce free to operate and free to share.
- **Not an account system in v1.** BYOK + local storage means no signup, no passwords, no email. The user's API key *is* their identity.

## Stack

Defaults from `~/src/CLAUDE.md` (Vite + React 19 + Vercel) **do not apply** — that's a web stack. For native mobile:

- **Repo layout:** **Single package for Cycle 1**, monorepo deferred. `src/app/` (Expo), `src/shared/` (types, USDA table, schema), `worker/` (Cloudflare Workers, deployed via its own `wrangler.toml`). Reversed from the earlier monorepo+pnpm decision after an ultrathink pass — Expo + pnpm + Metro has well-documented resolver pain (symlink hoisting, `watchFolders`, EAS `pnpm` flag) and Cycle 1 has one developer, no second consumer of `shared/`, and a tight ship target. Revisit monorepo in Cycle 3+ when Cycle 2's image-gen code creates real cross-runtime shared logic.
- **Framework:** Expo (React Native) + Expo Router
- **Build/distribution:** EAS Build + EAS Submit (Google Play **internal testing track** for distribution)
- **Language:** TypeScript strict
- **State:** Zustand (single store per domain: `useSession` for API key, `useProjects` for the project list + active project). `persist` middleware for SQLite-backed state.
- **Data persistence:** SQLite via `expo-sqlite` for projects + photo blobs + chat history. No cloud sync.
- **Secrets storage:** Android Keystore via `expo-secure-store` (uses EncryptedSharedPreferences backed by the Keystore on Android). Never AsyncStorage or SQLite for secrets.
- **Camera/photos:** `expo-camera` + `expo-image-picker`
- **Vision LLM:** BYOK — user supplies an OpenAI API key in settings. v1 is OpenAI-only (`gpt-4o`). Provider-agnostic adapter is still scaffolded in code so Anthropic can be added in a later cycle without refactoring.
- **Backend:** Thin Cloudflare Workers proxy. Receives `{userApiKey, imageData, goal, chatHistory}` from the app, attaches our tuned system prompt server-side, forwards to OpenAI. Never persists the user's key. **Why a proxy under BYOK:** keeps the system prompts off the device — they're the moat, not the model.
- **Amazon integration (Cycle 3):** generate Amazon search URLs from LLM-extracted item names. No PA API, no Associates signup, no scraping. PA-API-based product cards deferred to Cycle 4+ once we know users actually tap the items.

**Why Expo over bare RN:** managed workflow, EAS handles Android signing + AAB builds in the cloud, OTA updates for non-native changes, every camera/image library is pre-integrated.

**Why not Flutter / native Swift:** Raymond is a React/TS engineer. Expo is the path of least resistance and his existing mental model carries over.

## Architecture (Cycle 1)

Resolutions from the 2026-06-22 ultrathink pass. These are the *how* behind the locked decisions in `## Stack` — design contracts that the Cycle 1 build depends on.

### Data model

```ts
// src/shared/types/project.ts
type Project = {
  id: string;              // ulid
  createdAt: number;
  updatedAt: number;
  mode: 'yard' | 'indoor'; // 'indoor' lands in Cycle 4
  thumbnailUri: string;    // file://… local path to the original photo
  photoSha256: string;     // dedup / cache key
  zone?: string;           // USDA zone for yard mode (e.g. "7a"); room type for indoor (Cycle 4)
  goal: string;            // user's one-line Turn 1 prompt

  // Turn 1 outputs
  visionSummary: string;   // hidden; injected as context on every follow-up
  plan: Plan;              // see schema below

  // Follow-up chat (text-only, photo-once)
  turns: Array<{ role: 'user' | 'assistant'; content: string; createdAt: number }>;
};
```

- Photos live on disk at `${FileSystem.documentDirectory}projects/${projectId}/original.jpg`. SQLite stores the path plus a 300px thumbnail blob for fast list rendering.
- Turn 1 sends the photo (base64) to the Worker. After that, the photo is never re-sent — `visionSummary` is the LLM's persistent memory of it.
- 10-turn cap = `turns.filter(t => t.role === 'user').length < 10`. At cap, input is replaced with a "Start a new project from this plan" CTA that clones `plan` + `visionSummary` into a fresh project, preserving context.

### Worker proxy contract

Two routes, shared auth + rate-limit middleware:

- `POST /v1/plan` — Turn 1 (image + goal → `Plan`) and follow-up turns (no image → `FollowupReply`).
- `POST /v1/visualize` — Cycle 2 image generation. Stricter rate limit.

**Auth:** per-device anonymous token, generated at first run via `POST /v1/register` and stored in the Keystore alongside the user's API key. Requests are HMAC-signed over `(method, path, body_sha256, timestamp, nonce)` using a per-device secret returned at registration. ±5 min timestamp window, nonce cache to block replay. Not bulletproof against a determined reverser — defense-in-depth for the casual case. **Google Play Integrity API is the upgrade path** if Spruce ever opens beyond personal use; left as a backlog item but middleware shape is designed to swap auth schemes cleanly.

**Rate limits (Worker-enforced, per device, KV-backed):** 60 req/hour and 500 req/day for `/v1/plan`; 10 req/hour and 40 req/day for `/v1/visualize`. Tunable via Worker env vars. These are *prompt-abuse and runaway-loop* guards, not OpenAI spend caps (still the user's job).

**Server-side injection (never client):** system prompt, JSON schema for structured output, `response_format` config, model name. Client sends only `{messages, photoData?, mode, projectContext?}`. The moat lives in the Worker.

**Logging allowlist:** `request_id, device_id, mode, timestamp, response_code, latency_ms, prompt_tokens, completion_tokens`. **Never logged:** Authorization header, message content, photo bytes, response body, system prompt, vision summary. Pre-release audit step: `rg "console\.(log|info|warn|error)|env\.LOG" worker/src/` and verify no body interpolation.

**Failure → client response mapping:**

| Upstream / Worker condition | Worker response | App behavior |
|---|---|---|
| OpenAI 401 (bad key) | `401 {error: 'invalid_key'}` | Full-screen modal: "OpenAI rejected your key" + Settings deep-link |
| OpenAI 429 (user quota/rate) | `429 {error: 'quota_exceeded'}` | Toast + link to platform.openai.com/usage. No auto-retry. |
| OpenAI 5xx / timeout | `502 {error: 'upstream_unavailable'}` | One auto-retry @ 1s backoff, then inline "Tap to retry" |
| Worker rate limit hit | `429 {error: 'spruce_rate_limit', retry_after_s}` | Toast "Slow down — retry in Ns"; auto-retry after window |
| Schema parse fail (Turn 1) | Worker retries once with "return only valid JSON", then `502 {error: 'schema_parse_fail'}` | "Plan came back malformed. Retry?" |

Errors are first-class state in the `useChat` Zustand slice: `{status: 'idle' | 'sending' | 'error', error?: {kind, message, retryable}}`. UI consumes the state, never raw exceptions.

**Streaming:** off for Cycle 1. Plan responses are structured JSON; partial JSON is unusable. Single-shot UX with a loading state.

### Structured-output schema

```ts
// src/shared/schema/plan.ts
import { z } from 'zod';

export const ItemCategorySchema = z.enum([
  'plant', 'hardscape', 'furniture', 'lighting', 'decor',
]);

export const PlanItemSchema = z.object({
  name: z.string().min(1).max(80),
  category: ItemCategorySchema,
  searchTerms: z.string().min(3).max(120),       // Cycle 3 uses this for Amazon URLs
  estimatedPriceRange: z.string().optional(),    // "$20-50"
  notes: z.string().max(280).optional(),         // why it fits / alternatives
});

export const PlanSchema = z.object({
  visionSummary: z.string().min(50).max(1500),   // HIDDEN — injected into follow-ups
  vibe: z.string().min(20).max(400),             // 1-2 sentences shown to user
  keyChanges: z.array(z.string().min(10).max(300)).min(2).max(7),
  items: z.array(PlanItemSchema).min(3).max(20),
});

export const FollowupReplySchema = z.object({
  reply: z.string().min(1).max(2000),            // markdown-rendered
  planPatch: z.object({                          // optional surgical update
    addedItems: z.array(PlanItemSchema).optional(),
    removedItemNames: z.array(z.string()).optional(),
    updatedVibe: z.string().optional(),
  }).optional(),
});
```

- Categories widened from the plan's "plants vs. hardscape vs. furniture" to include `lighting` and `decor` — they routinely fall out of LLM plans and deserve their own cards, especially for Cycle 3 Amazon linking. Flag for Raymond if he wants this narrower.
- `visionSummary` is the keystone: ~200-1500 chars of detail ("south-facing 30×20 backyard, mature oak in NE corner, afternoon shade on left third, patchy lawn, wood privacy fence three sides, neighbor's house visible north…") that the LLM produces once on Turn 1 and never sees the photo again afterward.
- Follow-ups can return a `planPatch` so the LLM can edit the plan surgically ("swap the patio set for something cheaper" → reply + `removedItemNames: ['Acacia Lounge Set'] + addedItems: [...]`). App applies the patch to local state.
- OpenAI Structured Outputs config: `response_format: { type: 'json_schema', json_schema: { name: 'plan', schema: <zod-to-json-schema>, strict: true } }`. On parse fail: one retry with a tightening system message, then user-visible error.

### USDA zone derivation

Confirming the locked decision with one addition: source the mapping from a public dataset (USDA / plantmaps-derived), vendor as `src/shared/data/usda-zones.json` (~40KB, ~42k zips). `zipToZone(zip: string): string | null`. For non-US zips, app shows: "Spruce is yard-tuned for US plant zones. Indoor mode (Cycle 4) works anywhere." — door open for a "Set zone manually" fallback later.

## Cycles

Each cycle ships as a feature branch → PR → Play Store internal-testing-track build her phone can install.

### Cycle 1 — MVP: yard photo → plan → save

**Theme:** The core loop, end to end, yard-first, single user.

**Done when:**

*Google Play / EAS prereqs (one-time, easy to underestimate):*
- [ ] Google Play Console developer account enrolled (~$25 one-time, usually approved within 48h — start now).
- [ ] Package name `studio.spruce.app` reserved in Play Console. App record created with placeholder icon + Data Safety form (BYOK + Keystore storage + no analytics + no third-party SDKs + no data shared with third parties; user data sent to user's own OpenAI account via our proxy disclosed).
- [ ] EAS Build credentials configured (Android upload keystore — EAS-managed).
- [ ] `app.json` set: package name, name, version, versionCode, adaptive icon (foreground + background), splash, Android permission strings (`CAMERA`, `READ_MEDIA_IMAGES`, `INTERNET`).
- [ ] Play Console **internal testing track** created, wife's Google account added as tester.

*Core loop:*
- [ ] App installed on her Android device via **Play Store internal testing link** (not Expo Go — see Workflow notes).
- [ ] First-run flow: paste OpenAI API key + enter zip code (used once to derive USDA hardiness zone). Worker registration call issues per-device token + HMAC secret, stored in Keystore alongside the user's key.
- [ ] She can hit a big "+" button, capture or pick a photo of a yard/outdoor space.
- [ ] She can **type** a one-line goal (Gboard voice-input handles "speak" — no Whisper integration needed for Cycle 1).
- [ ] App sends image + goal + zone + tuned yard system prompt (server-side) to `gpt-4o`. LLM returns structured JSON: `{vibe, key_changes[], items[]}`. Items have plant-type awareness (plants vs. hardscape vs. furniture).
- [ ] Plan is rendered as a styled view. Saved as a "project" with the original photo. Project list screen shows thumbnails.
- [ ] Tapping a project re-opens its plan. She can ask **text-only follow-ups** (photo-once model — `visionSummary` injected as context, photo not re-sent). **Hard cap: 10 follow-up turns per project.** At cap, input replaced with "Start a new project from this plan" CTA that clones the plan + vision summary. Chat persists across app launches.
- [ ] Follow-up replies can return a `planPatch` (added/removed items, updated vibe) that the app applies to the local plan state.
- [ ] Error states implemented per the Architecture table: 401 modal, 429 toasts, 5xx one-retry + tap-to-retry, schema-parse retry, offline detection.
- [ ] Onboarding screen links to OpenAI dashboard with instructions to set a hard spend limit. Spruce enforces no caps.
- [ ] **Pre-release audit:** `rg "console\.(log|info|warn|error)" worker/src/` confirms no message/photo/response bodies are logged. Allowlist enforced.

**Scope:**
- Yard / outdoor only. Indoor mode is Cycle 4.
- Zip → USDA zone is a one-time lookup via `src/shared/data/usda-zones.json` (~40KB, no network call). Non-US zip → "indoor mode (Cycle 4) works anywhere" message.
- Provider-agnostic adapter scaffolded, OpenAI implementation only.
- Single tuned yard system prompt + JSON schema (`PlanSchema` / `FollowupReplySchema`) live server-side in the Worker, not in the app bundle.
- Chat schema and data model per the `## Architecture (Cycle 1)` section. Persisted in SQLite.
- Android only. iOS dropped 2026-06-22.

**Out of scope for this cycle:**
- Image generation (Cycle 2)
- Amazon links (Cycle 3)
- Indoor mode (Cycle 4)
- Multi-user
- Anthropic provider
- In-app spend caps
- Voice input via Whisper (Gboard voice-input handles voice in v1)

### Cycle 2 — Visualize: see the change, not just read it

**Theme:** The magic. Generate an inspirational rendering of the suggested yard changes.

**Done when:**
- [ ] On any plan view, user can tap "Visualize" → image generation kicks off.
- [ ] Generated image renders alongside the original photo (swipe between before/after, or stacked).
- [ ] Generations save with the project.
- [ ] User can regenerate (each regen is a new API call, cost shown to user).
- [ ] Pre-generation modal: clear cost disclosure ("This will cost ~$0.08 on your OpenAI account").

**Scope:**
- OpenAI `gpt-image-1` `images.edit` endpoint with the original photo + LLM-distilled "change description" as the editing prompt.
- Quality preset: `medium` (cost vs. quality balance, ~$0.07-$0.09 per image).
- **Framed as "inspirational rendering," not "literal photorealistic structure preservation."** We don't promise her yard will look exactly like the render — we promise a vibe.
- Generated images stored as blobs in SQLite alongside the project.

**Why no spike-first**: Decision was to commit fully. If quality falls short during Cycle 2, fallback plan is to ship what we have (label clearly as "concept render") and swap Cycle 3 (Shoppable) and Cycle 2 — visualize moves to a later cycle for revisiting.

### Cycle 3 — Shoppable: link items to Amazon (search URLs)

**Theme:** Close the loop from "here's what to buy" to "buy it."

**Done when:**
- [ ] LLM responses include a structured items list with `search_terms` field.
- [ ] Each item renders as a card with an "Open in Amazon" button.
- [ ] Buttons open `amazon.com/s?k=<search_terms>` — Amazon app handles deep-link if installed, otherwise mobile web.
- [ ] Per-project shopping list view: tick off items as bought.

**Scope:**
- No Amazon Associates signup. No PA API. No affiliate tag.
- Item cards show LLM-generated name + category + price-range estimate (no real product previews).
- Shopping list persists in SQLite.

### Cycle 4 — Indoor mode

**Theme:** Bring her secondary workflow over.

**Done when:**
- [ ] Mode toggle on the photo capture screen: yard / indoor.
- [ ] Second tuned system prompt for indoor (furniture-focused item schema, room-type awareness, style preference inheritance).
- [ ] All Cycles 1-3 functionality (plan, visualize, shoppable) works for indoor.

**Scope:**
- Single tuned indoor prompt, no per-room-type variants in v1 (LLM infers from photo).
- No new dependencies. Just prompt and schema work.

### Cycle 5+ — backlog

- **Amazon PA API integration** — Associates signup + real product cards (images, prices, ratings). Triggered when we have signal that users tap items meaningfully.
- Voice input for goals via Whisper API (BYOK, replaces native dictation for hands-free flow)
- Project export (PDF / share-sheet)
- iOS build (EAS makes this cheap if we want it later — requires Apple Developer Program enrollment)
- Saved style preferences ("we like mid-century modern, low maintenance")
- Household sharing (multiple devices same household, shared project list)
- Anthropic provider in BYOK settings

## Open questions

Decisions locked:
- ✅ **Distribution = BYOK** (user supplies API key, user pays the provider).
- ✅ **Backend = thin Cloudflare Workers proxy** (no key storage, system-prompt injection only — protects prompt IP).
- ✅ **Provider in v1 = OpenAI only (`gpt-4o`)**, provider-agnostic adapter scaffolded for Anthropic later.
- ✅ **Cycle order = Yard MVP → Visualize → Shoppable → Indoor** (yard-first because that's her current primary ChatGPT use case).
- ✅ **Cycle 2 image gen = full commit, no spike** (with fallback plan: relabel as "concept render" and reshuffle if quality falls short).
- ✅ **Yard context capture = zip code at onboarding, LLM asks the rest inline** via natural follow-ups.
- ✅ **Follow-up chat = photo-once + 10 turn cap + persistent**.
- ✅ **State management = Zustand** with `persist` middleware.
- ✅ **Amazon in Cycle 3 = search URLs only**, no PA API / Associates until validated.
- ✅ **Cost guardrails = trust OpenAI's own** (onboarding directs to OpenAI dashboard limits; Spruce enforces nothing).
- ✅ **"Speak" goal input = Gboard voice-input** (free, built-in on Android). Whisper API integration deferred to backlog.
- ✅ **ChatGPT Plus subscription cannot be used for API access** — irrelevant given BYOK.

Locked in the 2026-06-22 ultrathink pass:
- ✅ **Repo layout = single package for Cycle 1** (`src/app`, `src/shared`, `worker/`). Monorepo + pnpm workspaces deferred — see `## Stack` for the reasoning. **Reverses the earlier monorepo decision** — flagged for explicit Raymond review.
- ✅ **Worker auth = per-device anonymous token + HMAC-signed requests + replay window**. Google Play Integrity API = backlog upgrade path.
- ✅ **Worker rate limits = 60/hr + 500/day for `/v1/plan`, 10/hr + 40/day for `/v1/visualize`** (KV-backed, env-tunable).
- ✅ **Logging allowlist = request_id, device_id, mode, timestamp, response_code, latency_ms, token counts**. No bodies, no keys, no system prompt.
- ✅ **Schema = `PlanSchema` + `FollowupReplySchema` in `src/shared/schema/`** with OpenAI Structured Outputs strict mode + one-retry on parse fail.
- ✅ **Item categories widened to 5**: `plant | hardscape | furniture | lighting | decor`. Flag if narrower preferred.
- ✅ **Error UX** — full Worker→app mapping table in `## Architecture (Cycle 1)`. 401 = modal, 429 (user) = toast + dashboard link, 429 (Spruce) = retry-after toast, 5xx = one auto-retry then tap-to-retry, offline = banner state.
- ✅ **Bundle ID = `studio.spruce.app`** (reverse of `spruce.studio` + `.app` for clarity).
- ✅ **Streaming = off for Cycle 1** (structured-JSON responses are not partial-renderable).

Deferred (will revisit when relevant):

- [ ] **Brand visuals** — icon, palette, type. Decide once we have an internal-track build to look at. Spruce-tree direction is the obvious lean.
- [ ] **Anthropic provider** — slot in when there's signal it'd unlock real users (e.g. user feedback "I only have an Anthropic account").
- [ ] **Google Play Integrity API** — swap in for HMAC auth if Spruce ever opens beyond personal use.
- [ ] **Monorepo revisit** — Cycle 3+ once cross-runtime shared code becomes real.

## Risks / unknowns

- **Play Store review for an LLM-powered app.** Google's "AI-Generated Content" policy applies — apps that generate content from AI must have an in-app reporting mechanism for offensive output. Worth surfacing in Cycle 1 UI (long-press a plan item → "Report this suggestion") even though it's a closed-test app, because review for the internal track is still policy-checked.
- **Internal testing track expiry.** No 90-day expiry like TestFlight — Play internal testing builds don't expire. OTA updates via EAS still handle most changes; native code changes still need a new AAB upload.
- **Internal testing track has a 100-tester cap.** Not a ceiling we'll hit for personal/household use. If Spruce ever needed >100 testers, move to closed testing (then open testing, then production) — all still pre-public, all on the same Play Console flow.
- **BYOK onboarding friction.** Asking users to paste an API key on first run is a real drop-off. Mitigation: clear instructions screen with screenshots of where to get the key on OpenAI's site, paste-from-clipboard auto-detect, "I'll do this later" with a sample/demo mode (TBD).
- **User's API key leakage.** Key must live in Android Keystore via `expo-secure-store` (not AsyncStorage, not SQLite). Cloudflare Workers proxy must never log the key — log only request shapes + provider response codes. Audit this before release.
- **Prompt extraction via app decompile.** If we ever ship prompts client-side as a fallback, they're gone. Keep them server-side, full stop.
- **LLM structured-output reliability.** OpenAI JSON mode helps but isn't 100%. Need a retry-on-parse-fail strategy (one retry with a "your last response wasn't valid JSON, return only the schema" follow-up). Hard fail to user only after retry also fails.
- **Cycle 2 image gen quality.** Image-to-image with structure preservation is uneven on `gpt-image-1` as of mid-2026. Mitigation: framed as inspirational rendering, fallback plan in Cycle 2 description if quality falls short.
- **Expo's managed workflow ceiling.** If we ever need a native module Expo doesn't have (rare), we'd eject — cost is real. None of the Cycle 1-4 features need this.

## Workflow notes

- **Dev loop:** `npx expo start` at the repo root. Use Expo Go on her Android phone (or yours, or an Android emulator) for fast iteration. Expo Go is for development only. On Linux dev box, mirror a real Android device into a window via `scrcpy` over USB or Wi-Fi ADB.
- **Cycle ship gate:** **Play Store internal-testing-track build via EAS**, not Expo Go. Real package name, real app icon, real splash, signed AAB. This is what she actually keeps using and what defines "shipped."
- **Workers proxy dev:** `wrangler dev` for local, `wrangler deploy` for prod. Free tier handles personal use; a Cloudflare account is needed.
- **Prompt-testing strategy:** A golden-test file at `apps/proxy/test/golden/` with 5-10 anonymized yard photos + expected JSON shape (vibe present, key_changes is non-empty array, items have search_terms, etc.). Run before any prompt change via `pnpm test:golden`. Catches schema regressions cheaply. Outputs are scored by shape + presence, not literal-equality (the LLM will vary in wording).
- **Not a `launch`-able project in the team-of-3-Smiths sense.** Expo's dev model (one packager + device/simulator) doesn't fit the 3-Smiths-sharing-a-dev-server pattern. Single Smith at a time on this repo.
- **`.smith.json`** will still get dropped via `smith-init` for consistency, but `launch` won't be used.

---
*Created 2026-06-21. Private ops log: `~/montressor-private/claude/project-logs/spruce/log.md`*
