# Spruce

> A native mobile app for AI-assisted home and yard redesign. Photo in, plan out.

## Vision

A dedicated mobile assistant for redecorating and landscaping. The primary user (Raymond's wife) currently uses ChatGPT Plus on her phone to riff on redesigning rooms and the yard — uploading photos, getting suggestions, iterating. The web ChatGPT UX is generic, the conversation history is bottomless, and saved projects don't have structure.

Spruce is the dedicated tool for that workflow: take a photo, get an opinionated plan, save it as a project, optionally shop the suggestions through Amazon.

**Distribution model: BYOK (Bring Your Own Key).** Each user enters their own OpenAI/Anthropic API key in settings. Spruce never holds shared LLM billing — the user does. This makes the app shareable beyond Raymond's household while keeping operating costs at $0 for us. The moat is **domain-specialized prompts** (yard/home redesign with structured output + shoppable items) plus a focused UX, not the model.

**Domain:** `spruce.studio`

## Non-goals

Explicit out-of-scope to prevent scope creep:

- **Not a social product.** No feeds, no sharing-with-strangers, no comments. Single-user or household-scale only.
- **Not a CAD/floorplan tool.** No 3D modeling, no measurements, no room scanning. Photos in, plans out — that's the loop.
- **Not a marketplace.** We surface Amazon search links; we don't host listings, scrape product data, or process payments.
- **Not a PWA.** Hard requirement: native iOS app (and Android if cheap). PWA was considered and rejected — camera UX, install ergonomics, and "this is a real app on my phone" matter for the use case.
- **Not a hosted-LLM SaaS.** We never pay for users' inference. Spruce is BYOK: user supplies API key, user pays the API provider directly. Keeps Spruce free to operate and free to share.
- **Not an account system in v1.** BYOK + local storage means no signup, no passwords, no email. The user's API key *is* their identity.

## Stack

Defaults from `~/src/CLAUDE.md` (Vite + React 19 + Vercel) **do not apply** — that's a web stack. For native mobile:

- **Framework:** Expo (React Native) + Expo Router
- **Build/distribution:** EAS Build + EAS Submit (TestFlight for iOS distribution to wife)
- **Language:** TypeScript strict
- **State:** Zustand (or Jotai) — small, no boilerplate. No Redux.
- **Data persistence:** SQLite via `expo-sqlite` for local projects/history. No cloud DB for Cycle 1.
- **Camera/photos:** `expo-camera` + `expo-image-picker`
- **Vision LLM:** BYOK — user supplies an OpenAI or Anthropic API key in settings. v1 supports both providers behind a provider-agnostic adapter. **See Open Questions for which to ship first.**
- **Backend:** Thin Cloudflare Workers proxy. Receives `{userApiKey, imageData, goal}` from the app, attaches our tuned system prompt server-side, forwards to OpenAI/Anthropic. Never persists the user's key. **Why a proxy at all under BYOK:** keeps the system prompts off the device — they're the moat, not the model.
- **Amazon integration (Cycle 2):** generate Amazon search URLs from LLM-extracted item names. No PA API, no Associates signup, no scraping. Richer PA-API-based product cards deferred to a later cycle once we know users actually tap the items.

**Why Expo over bare RN:** managed workflow, easy iOS builds without owning a Mac toolchain locally, OTA updates for non-native changes, every camera/image library is pre-integrated.

**Why not Flutter / native Swift:** Raymond is a React/TS engineer. Expo is the path of least resistance and his existing mental model carries over.

## Cycles

Each cycle ships as a feature branch → PR → TestFlight build her phone can install.

### Cycle 1 — MVP: photo → plan → save

**Theme:** The core loop, end to end, single user.

**Done when:**
- [ ] App installs on her iPhone via TestFlight.
- [ ] She can open the app, hit a big "+" button, capture or pick a photo of a space.
- [ ] She can type or speak a one-line goal ("modernize this living room", "low-water front yard").
- [ ] App sends image + prompt to vision LLM, displays a structured plan: vibe summary, key changes, suggested items list.
- [ ] Plan is saved as a "project" with the original photo. Project list screen shows thumbnails.
- [ ] Tapping a project re-opens its plan. She can ask follow-ups (chat-style continuation).

**Scope:**
- BYOK from day one. First-run flow: pick provider (OpenAI / Anthropic), paste API key, key stored in iOS Keychain.
- Provider-agnostic adapter so swapping/adding providers is one file later.
- One tuned system prompt (served from the Cloudflare Workers proxy, not bundled in the app).
- LLM returns structured JSON: `{vibe, key_changes[], items[]}`. Rendered as a styled plan view.
- Local SQLite for projects + photo blobs. No cloud sync.
- iOS only (TestFlight). Android deferred.

**Out of scope for this cycle:**
- Amazon links (Cycle 2)
- Image generation / before-after (Cycle 3)
- Multi-user
- Outdoor-specific prompts (Cycle 3)

### Cycle 2 — Shoppable: link items to Amazon (search URLs)

**Theme:** Close the loop from "here's what to buy" to "buy it" — without an API integration.

**Done when:**
- [ ] LLM responses include a structured items list (`{name, category, search_terms, est_price_range}`).
- [ ] Each item renders as a card with an "Open in Amazon" button.
- [ ] Buttons open `amazon.com/s?k=<search_terms>` — Amazon app handles deep-link if installed, otherwise mobile web.
- [ ] Per-project shopping list view: tick off items as bought.

**Scope:**
- No Amazon Associates signup. No PA API. No affiliate tag.
- Item cards show LLM-generated name + category + price-range estimate (no real product previews).
- Shopping list persists in SQLite.

**Why no PA API yet:** PA API requires an Associates account, takes 1-7 days to approve, and adds significant integration work (signed requests, throttling, product unavailability handling). Defer until we know users actually tap the items. Search URLs are the same UX 80% of competing apps ship.

### Cycle 3 — Outdoor & visualize

**Theme:** Make it feel magical — see the change, not just read about it.

**Done when:**
- [ ] Yard / outdoor prompt mode: zone awareness, sun exposure, seasonality hints.
- [ ] Image generation: "show me this space with the suggested changes" — gpt-image-1 / similar.
- [ ] Side-by-side before/after view per project.

**Scope:**
- Image gen costs are real ($0.04-$0.19 per image depending on quality). Cap per-project generations.
- Outdoor prompt mode is just a different system prompt + UI toggle; no new models needed.

### Cycle 4+ — backlog

- **Amazon PA API integration** — Associates signup + real product cards (images, prices, ratings). Triggered when we have signal that users tap items meaningfully.
- Voice input for goals (Whisper API, BYOK)
- Project export (PDF / share-sheet)
- Android build (EAS makes this cheap if we want it)
- Saved style preferences ("we like mid-century modern, low maintenance")
- Household sharing (multiple devices same household, shared project list)

## Open questions

Decisions locked from the first pass:
- ✅ **Distribution = BYOK** (user supplies API key, user pays the provider).
- ✅ **Backend = thin Cloudflare Workers proxy** (no key storage, system-prompt injection only — protects prompt IP).
- ✅ **Amazon in Cycle 2 = search URLs only**, no PA API / Associates until validated.
- ✅ **ChatGPT Plus subscription cannot be used for API access** — irrelevant given BYOK.

Still open:

- [ ] **Which LLM providers in BYOK v1?** OpenAI-only first (simplest), Anthropic-only, or both providers behind the adapter from day one? Adding both adds maybe a day of work.
- [ ] **Brand visuals** — deferred. Decide once we have a TestFlight build to look at (icon, palette, type). Spruce-tree direction is the obvious lean.
- [ ] **Per-user cost guardrails** — even under BYOK, users may want a "stop after $X today" cap. Add to Cycle 1 or defer to Cycle 2?
- [ ] **What happens on key invalid / quota exceeded?** Need a UX spec for "your OpenAI key returned 401 / 429." Defer to Cycle 1 build.

## Risks / unknowns

- **App Store review for an LLM-powered app.** Apple has tightened review of "AI assistant" apps. We're personal-use via TestFlight first — no review needed there. Don't plan for public App Store distribution.
- **TestFlight expiry.** Builds expire every 90 days. OTA updates via EAS handle most changes, but native code changes mean a new build + reinstall.
- **BYOK onboarding friction.** Asking users to paste an API key on first run is a real drop-off. Mitigation: clear instructions screen with screenshots of where to get the key on each provider's site, paste-from-clipboard auto-detect, "I'll do this later" with a sample/demo mode (TBD).
- **User's API key leakage.** Key must live in iOS Keychain (not AsyncStorage / SQLite). Cloudflare Workers proxy must never log the key. Audit this before TestFlight.
- **Prompt extraction via app decompile.** If we ever ship prompts client-side as a fallback, they're gone. Keep them server-side, full stop.
- **Expo's managed workflow ceiling.** If we ever need a native module Expo doesn't have (rare), we'd eject — cost is real. None of the Cycle 1-3 features need this.

## Workflow notes

- **Not a `launch`-able project in the team-of-3-Smiths sense.** Expo's dev model (one packager + device/simulator) doesn't fit the 3-Smiths-sharing-a-dev-server pattern. Single Smith at a time on this repo.
- **`.smith.json`** will still get dropped via `smith-init` for consistency, but `launch` won't be used.
- **Dev loop:** `npx expo start` → Expo Go app on her iPhone or iOS simulator for testing.

---
*Created 2026-06-21. Private ops log: `~/montressor-private/claude/project-logs/spruce/log.md`*
