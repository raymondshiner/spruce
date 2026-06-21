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
- **Not a PWA.** Hard requirement: native iOS app (and Android if cheap). PWA was considered and rejected — camera UX, install ergonomics, and "this is a real app on my phone" matter for the use case.
- **Not a hosted-LLM SaaS.** We never pay for users' inference. Spruce is BYOK: user supplies API key, user pays the API provider directly. Keeps Spruce free to operate and free to share.
- **Not an account system in v1.** BYOK + local storage means no signup, no passwords, no email. The user's API key *is* their identity.

## Stack

Defaults from `~/src/CLAUDE.md` (Vite + React 19 + Vercel) **do not apply** — that's a web stack. For native mobile:

- **Repo layout:** Monorepo with pnpm workspaces. `apps/mobile/` (Expo app), `apps/proxy/` (Cloudflare Workers), `packages/shared/` (request/response types, zone data).
- **Framework:** Expo (React Native) + Expo Router
- **Build/distribution:** EAS Build + EAS Submit (TestFlight for iOS distribution)
- **Language:** TypeScript strict
- **State:** Zustand (single store per domain: `useSession` for API key, `useProjects` for the project list + active project). `persist` middleware for SQLite-backed state.
- **Data persistence:** SQLite via `expo-sqlite` for projects + photo blobs + chat history. No cloud sync.
- **Secrets storage:** iOS Keychain via `expo-secure-store` for the API key. Never AsyncStorage or SQLite for secrets.
- **Camera/photos:** `expo-camera` + `expo-image-picker`
- **Vision LLM:** BYOK — user supplies an OpenAI API key in settings. v1 is OpenAI-only (`gpt-4o`). Provider-agnostic adapter is still scaffolded in code so Anthropic can be added in a later cycle without refactoring.
- **Backend:** Thin Cloudflare Workers proxy. Receives `{userApiKey, imageData, goal, chatHistory}` from the app, attaches our tuned system prompt server-side, forwards to OpenAI. Never persists the user's key. **Why a proxy under BYOK:** keeps the system prompts off the device — they're the moat, not the model.
- **Amazon integration (Cycle 3):** generate Amazon search URLs from LLM-extracted item names. No PA API, no Associates signup, no scraping. PA-API-based product cards deferred to Cycle 4+ once we know users actually tap the items.

**Why Expo over bare RN:** managed workflow, easy iOS builds without owning a Mac toolchain locally, OTA updates for non-native changes, every camera/image library is pre-integrated.

**Why not Flutter / native Swift:** Raymond is a React/TS engineer. Expo is the path of least resistance and his existing mental model carries over.

## Cycles

Each cycle ships as a feature branch → PR → TestFlight build her phone can install.

### Cycle 1 — MVP: yard photo → plan → save

**Theme:** The core loop, end to end, yard-first, single user.

**Done when:**
- [ ] App installed on her iPhone via **TestFlight** (not Expo Go — see Workflow notes).
- [ ] First-run flow: paste OpenAI API key + enter zip code (used once to derive USDA hardiness zone).
- [ ] She can hit a big "+" button, capture or pick a photo of a yard/outdoor space.
- [ ] She can **type** a one-line goal (native iOS dictation in the keyboard handles "speak" — no Whisper integration needed for Cycle 1).
- [ ] App sends image + goal + zone + tuned yard system prompt (server-side) to `gpt-4o`. LLM returns structured JSON: `{vibe, key_changes[], items[]}`. Items have plant-type awareness (plants vs. hardscape vs. furniture).
- [ ] Plan is rendered as a styled view. Saved as a "project" with the original photo. Project list screen shows thumbnails.
- [ ] Tapping a project re-opens its plan. She can ask **text-only follow-ups** (photo-once model — photo not re-sent each turn, LLM's vision notes saved and re-used). **Hard cap: 10 follow-up turns per project.** Chat persists across app launches.
- [ ] Onboarding screen links to OpenAI dashboard with instructions to set a hard spend limit. Spruce enforces no caps.

**Scope:**
- Yard / outdoor only. Indoor mode is Cycle 4.
- Zip → USDA zone is a one-time lookup. JSON zip→zone table shipped in the Workers proxy (~40KB, no network call).
- Provider-agnostic adapter scaffolded, OpenAI implementation only.
- Single tuned yard system prompt (served from the proxy, not bundled in the app).
- Chat schema: `{role, content, photoNotesRef?}`. Persisted in SQLite.
- iOS only. Android deferred.

**Out of scope for this cycle:**
- Image generation (Cycle 2)
- Amazon links (Cycle 3)
- Indoor mode (Cycle 4)
- Multi-user
- Anthropic provider
- In-app spend caps
- Voice input via Whisper (native dictation handles voice in v1)

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
- Android build (EAS makes this cheap if we want it)
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
- ✅ **Repo = monorepo with pnpm workspaces** (`apps/mobile`, `apps/proxy`, `packages/shared`).
- ✅ **State management = Zustand** with `persist` middleware.
- ✅ **Amazon in Cycle 3 = search URLs only**, no PA API / Associates until validated.
- ✅ **Cost guardrails = trust OpenAI's own** (onboarding directs to OpenAI dashboard limits; Spruce enforces nothing).
- ✅ **"Speak" goal input = native iOS keyboard dictation** (free, built-in). Whisper API integration deferred to backlog.
- ✅ **ChatGPT Plus subscription cannot be used for API access** — irrelevant given BYOK.

Deferred (will revisit when relevant):

- [ ] **Brand visuals** — icon, palette, type. Decide once we have a TestFlight build to look at. Spruce-tree direction is the obvious lean.
- [ ] **Key invalid / quota exceeded UX** — what does the app show on 401/429 from OpenAI? Decide during Cycle 1 build (not a plan-level question).
- [ ] **Bundle ID** — `studio.spruce` or `com.spruce.app`? Decide before first EAS build.
- [ ] **Anthropic provider** — slot in when there's signal it'd unlock real users (e.g. user feedback "I only have an Anthropic account").

## Risks / unknowns

- **App Store review for an LLM-powered app.** Apple has tightened review of "AI assistant" apps. We're personal-use via TestFlight first — no review needed there. Don't plan for public App Store distribution.
- **TestFlight expiry.** Builds expire every 90 days. OTA updates via EAS handle most changes, but native code changes mean a new build + reinstall.
- **TestFlight has a 10,000-user cap on public-link beta.** Fine for now, but if Spruce goes viral via BYOK sharing, that becomes a ceiling — at which point we'd actually have to go through App Store review (or have her hate us for switching to Android-only).
- **BYOK onboarding friction.** Asking users to paste an API key on first run is a real drop-off. Mitigation: clear instructions screen with screenshots of where to get the key on OpenAI's site, paste-from-clipboard auto-detect, "I'll do this later" with a sample/demo mode (TBD).
- **User's API key leakage.** Key must live in iOS Keychain via `expo-secure-store` (not AsyncStorage, not SQLite). Cloudflare Workers proxy must never log the key — log only request shapes + provider response codes. Audit this before TestFlight.
- **Prompt extraction via app decompile.** If we ever ship prompts client-side as a fallback, they're gone. Keep them server-side, full stop.
- **LLM structured-output reliability.** OpenAI JSON mode helps but isn't 100%. Need a retry-on-parse-fail strategy (one retry with a "your last response wasn't valid JSON, return only the schema" follow-up). Hard fail to user only after retry also fails.
- **Cycle 2 image gen quality.** Image-to-image with structure preservation is uneven on `gpt-image-1` as of mid-2026. Mitigation: framed as inspirational rendering, fallback plan in Cycle 2 description if quality falls short.
- **Expo's managed workflow ceiling.** If we ever need a native module Expo doesn't have (rare), we'd eject — cost is real. None of the Cycle 1-4 features need this.

## Workflow notes

- **Dev loop:** `npx expo start` in `apps/mobile/`. Use Expo Go on her phone (or yours, or a simulator) for fast iteration. Expo Go is for development only.
- **Cycle ship gate:** **TestFlight build via EAS**, not Expo Go. Real bundle ID, real app icon, real splash. This is what she actually keeps using and what defines "shipped."
- **Workers proxy dev:** `wrangler dev` for local, `wrangler deploy` for prod. Free tier handles personal use; a Cloudflare account is needed.
- **Prompt-testing strategy:** A golden-test file at `apps/proxy/test/golden/` with 5-10 anonymized yard photos + expected JSON shape (vibe present, key_changes is non-empty array, items have search_terms, etc.). Run before any prompt change via `pnpm test:golden`. Catches schema regressions cheaply. Outputs are scored by shape + presence, not literal-equality (the LLM will vary in wording).
- **Not a `launch`-able project in the team-of-3-Smiths sense.** Expo's dev model (one packager + device/simulator) doesn't fit the 3-Smiths-sharing-a-dev-server pattern. Single Smith at a time on this repo.
- **`.smith.json`** will still get dropped via `smith-init` for consistency, but `launch` won't be used.

---
*Created 2026-06-21. Private ops log: `~/montressor-private/claude/project-logs/spruce/log.md`*
