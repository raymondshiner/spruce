# Spruce

> A native mobile app for AI-assisted home and yard redesign. Photo in, plan out.

## Vision

A dedicated mobile assistant for redecorating and landscaping. The primary user (Raymond's wife) currently uses ChatGPT Plus on her phone to riff on redesigning rooms and the yard — uploading photos, getting suggestions, iterating. The web ChatGPT UX is generic, the conversation history is bottomless, and saved projects don't have structure.

Spruce is the dedicated tool for that workflow: take a photo, get an opinionated plan, save it as a project, optionally shop the suggestions through Amazon. Personal-scale (one or two users) but built to feel like a real product.

**Domain:** `spruce.studio`

## Non-goals

Explicit out-of-scope to prevent scope creep:

- **Not a social product.** No feeds, no sharing-with-strangers, no comments. Single-user or household-scale only.
- **Not a CAD/floorplan tool.** No 3D modeling, no measurements, no room scanning. Photos in, plans out — that's the loop.
- **Not a marketplace.** We surface Amazon links via the existing affiliate program; we don't host listings or process payments.
- **Not a PWA.** Hard requirement: native iOS app (and Android if cheap). PWA was considered and rejected — camera UX, install ergonomics, and "this is a real app on my phone" matter for the use case.
- **Not multi-tenant SaaS.** No accounts system for v1. Hardcoded user(s).

## Stack

Defaults from `~/src/CLAUDE.md` (Vite + React 19 + Vercel) **do not apply** — that's a web stack. For native mobile:

- **Framework:** Expo (React Native) + Expo Router
- **Build/distribution:** EAS Build + EAS Submit (TestFlight for iOS distribution to wife)
- **Language:** TypeScript strict
- **State:** Zustand (or Jotai) — small, no boilerplate. No Redux.
- **Data persistence:** SQLite via `expo-sqlite` for local projects/history. No cloud DB for Cycle 1.
- **Camera/photos:** `expo-camera` + `expo-image-picker`
- **Vision LLM:** OpenAI `gpt-4o` or Anthropic `claude-sonnet-4.5` with vision. **See Open Questions — this is a real decision.**
- **Backend:** Cloudflare Workers or Vercel Functions to proxy LLM calls (keeps API keys off-device). Minimal — just a thin auth+proxy layer.
- **Affiliate links:** Amazon Associates program (need to sign up, takes ~24h approval).

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
- Single hardcoded user (no auth UI). API key lives in env, proxy auth via a shared secret.
- One LLM provider, one prompt template. No model picker.
- Plain text plan output (LLM-structured JSON for the items list).
- Local SQLite for projects + photo blobs. No cloud sync.
- iOS only (TestFlight). Android deferred.

**Out of scope for this cycle:**
- Amazon links (Cycle 2)
- Image generation / before-after (Cycle 3)
- Multi-user
- Outdoor-specific prompts (Cycle 3)

### Cycle 2 — Shoppable: link items to Amazon

**Theme:** Close the loop from "here's what to buy" to "buy it."

**Done when:**
- [ ] LLM responses include a structured items list (`{name, category, search_terms, est_price_range}`).
- [ ] Each item renders as a card with an "Open in Amazon" button.
- [ ] Buttons deep-link to the Amazon app (or web) with the affiliate tag attached.
- [ ] Per-project shopping list view: tick off items as bought.

**Scope:**
- Amazon Associates affiliate ID setup (real link tagging).
- Item cards — simple, no in-app product previews (avoid scraping Amazon).
- Shopping list persists in SQLite.

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

- Multi-user / household sharing
- Voice input for goals (Whisper API)
- Project export (PDF / share-sheet)
- Android build (EAS makes this cheap if we want it)
- Saved style preferences ("we like mid-century modern, low maintenance")

## Open questions

Decide before Cycle 1 starts:

- [ ] **LLM provider?** `gpt-4o` (best image understanding, OpenAI ecosystem), `claude-sonnet-4.5` (Raymond already uses Anthropic, better at structured output), or both with a switch? **Recommendation: start with `gpt-4o` — image understanding is its strongest suit, and Raymond can use his own API key.**
- [ ] **"Hook to her ChatGPT account" — clarify:** ChatGPT Plus subscription does NOT include API access. The OpenAI API is separately billed per-token. Two paths: (a) Raymond pays for API usage personally (likely $5-30/mo at her volume), or (b) we proxy through his existing API account. There's no path that uses her ChatGPT Plus subscription directly.
- [ ] **Backend host:** Cloudflare Workers (cheaper, faster cold starts) vs. Vercel Functions (familiar tooling). Recommend Cloudflare Workers.
- [ ] **Amazon affiliate signup:** start the application now — 24h+ approval, blocks Cycle 2 if we wait.
- [ ] **App icon / brand visual:** Spruce-the-tree as logo? Soft green palette? Need a vibe doc before TestFlight.

## Risks / unknowns

- **App Store review for an LLM-powered app.** Apple has tightened review of "AI assistant" apps. We're personal-use via TestFlight first — no review needed there. Don't plan for public App Store distribution.
- **TestFlight expiry.** Builds expire every 90 days. OTA updates via EAS handle most changes, but native code changes mean a new build + reinstall.
- **LLM costs at her usage volume.** Could be $5/mo or $50/mo depending on how much she uses it. Add per-day spend cap in the proxy as a safety net before shipping Cycle 1.
- **Amazon affiliate approval failure.** Some applicants get rejected. Backup plan: link to Amazon search without affiliate tag (zero revenue but same UX).
- **Expo's managed workflow ceiling.** If we ever need a native module Expo doesn't have (rare), we'd eject — cost is real. None of the Cycle 1-3 features need this.

## Workflow notes

- **Not a `launch`-able project in the team-of-3-Smiths sense.** Expo's dev model (one packager + device/simulator) doesn't fit the 3-Smiths-sharing-a-dev-server pattern. Single Smith at a time on this repo.
- **`.smith.json`** will still get dropped via `smith-init` for consistency, but `launch` won't be used.
- **Dev loop:** `npx expo start` → Expo Go app on her iPhone or iOS simulator for testing.

---
*Created 2026-06-21. Private ops log: `~/montressor-private/claude/project-logs/spruce/log.md`*
