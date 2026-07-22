# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Claw3D is an open-source (MIT) project. Keep everything committed here generic and OSS-safe — no
personal, environment-specific, or secret instructions (see `AGENTS.md`).

## What This Repo Is

Claw3D is the **UI + Studio proxy layer** for an OpenClaw agent runtime — a Next.js 16 / React 19
app that visualizes and operates AI agents, including an immersive 3D "office". **It is not the
OpenClaw runtime.** OpenClaw remains the system of record for agents, sessions, config, approvals,
and runtime events; Claw3D reads and mutates that state over a gateway WebSocket and stores only
local UI/connection state.

> **Boundary rule:** Do not modify upstream OpenClaw source from this repo. Requests are changes to
> *this app*. To understand runtime behavior, read `src/lib/gateway`, or consult a *separate* local
> OpenClaw checkout — never vendor it in here.

## Commands

All commands use the custom Node server, not `next dev`/`next start` directly.

| Task | Command | Notes |
|------|---------|-------|
| Dev server | `npm run dev` | `node server/index.js --dev`, port 3000. Runs without a backend (shows connect form — not an error). |
| Dev over HTTPS | `npm run dev:https` | Generates a self-signed cert in `.certs/` on first run. |
| Build | `npm run build` | `next build` (Turbopack). Produces the production build in `.next/`. |
| Prod server | `npm run start` | |
| Lint | `npm run lint` | `eslint .` — **not currently green** (see Verified State). |
| Typecheck | `npm run typecheck` | `tsc --noEmit`. |
| Unit tests | `npm run test -- --run` | Vitest. **Watch mode is the default — always pass `-- --run` for a single pass / CI.** |
| Single test file | `npx vitest run tests/unit/<name>.test.ts` | Or `npm run test -- --run <pattern>`. |
| E2E | `npm run e2e` | Playwright; run `npx playwright install` first. Auto-starts the dev server on 3000 against `tests/fixtures/openclaw-empty-state`. |
| Diagnostics | `npm run doctor` | `claw3doctor` — probes OpenClaw/Hermes/demo/custom backends; `--all-profiles` / `--json` supported. |
| Dev-server smoke | `npm run smoke:dev-server` | Boots dev on a random port and checks HTTP. |
| Demo backend | `npm run demo-gateway` | Mock gateway on `ws://localhost:18789` — no OpenClaw/Hermes needed. |
| Hermes backend | `npm run hermes-adapter` | Hermes WS adapter on `ws://localhost:18789`. |

`npm run studio:setup` is **interactive (TTY prompts)** — avoid it in non-interactive/CI environments.

Backends are selected in the UI or via env. Adapter types: `openclaw`, `hermes`, `demo`, `local`,
`claw3d`, `custom`. Default gateway URL is `ws://localhost:18789`. See `.env.example` and README
"Configuration" for `NEXT_PUBLIC_GATEWAY_URL` (build-time) vs `CLAW3D_GATEWAY_URL` (runtime), the
`UPSTREAM_ALLOWLIST`/`CUSTOM_RUNTIME_ALLOWLIST` production guards, and `STUDIO_ACCESS_TOKEN`.

## Architecture (the parts that need multiple files to see)

Read `ARCHITECTURE.md` (boundaries) and `CODE_DOCUMENTATION.md` (code map + extension guides)
before non-trivial changes. The big picture:

**Two network hops keep credentials server-side.** The browser never talks to the upstream gateway
directly:
```
Browser ──HTTP + same-origin WS (/api/gateway/ws)──▶ Studio server ──second WS──▶ OpenClaw Gateway
```
The custom server (`server/index.js`) boots Next.js *and* the WS proxy (`server/gateway-proxy.js`),
loads the upstream URL/token server-side (`server/studio-settings.js`), and gates access
(`server/access-gate.js`, `server/network-policy.js`). Gateway protocol **v3–v4** is negotiated in
`src/lib/gateway/nodeGatewayClient.ts` and `src/lib/gateway/openclaw/GatewayBrowserClient.ts`
(`minProtocol: 3`, `maxProtocol: 4`).

**State ownership is a hard boundary.** The Gateway owns agent records, sessions, approvals, and
runtime streams. Studio owns only local settings (connection profiles, focused agent, desk
assignments, office layout) persisted to `~/.openclaw/claw3d/settings.json` via `/api/studio` —
**never create a competing local source of truth for runtime state.** Client components must not
touch the filesystem, SSH, or tokens; that all lives server-side.

**Runtime events are derived, not duplicated.** `GatewayClient` receives events →
`src/features/agents/state/gatewayRuntimeEventHandler.ts` classifies/routes them → the
`runtime*Workflow.ts` planners produce state/effect commands →
`runtimeEventCoordinatorWorkflow.ts` applies them. Both the agents UI and the office derive their
views from this one stream; `operations/historySyncOperation.ts` reconciles canonical
`chat.history` when live streams are incomplete.

### Two separate office stacks — verify which one you're editing

This is the most common footgun in the repo:

- **Immersive live office** at `/office` — React Three Fiber, `src/features/retro-office/*` +
  `src/features/office/screens/OfficeScreen.tsx`. Motion is **derived**: runtime events →
  `src/lib/office/eventTriggers.ts` → animation state → `RetroOffice3D.tsx` turns holds into
  destinations/paths/actors. Do not push imperative scene mutations from runtime events.
- **Builder/editor** at `/office/builder` — **Phaser**, `src/features/office/phaser/*`, backed by
  the `OfficeMap` schema in `src/lib/office/schema.ts`.

They are related but not the same runtime. `CODE_DOCUMENTATION.md` has step-by-step guides for
adding a 3D object, adding a room/activity, and the full API-route inventory.

### Key conventions

- **Office intent has one entry point:** `src/lib/office/deskDirectives.ts` /
  `resolveOfficeIntentSnapshot()`. New room/behavior triggers (from UI chat, Telegram, WhatsApp,
  etc.) are parsed here as `OfficeIntentSnapshot` fields — do not add ad-hoc regex parsers
  elsewhere.
- **Code placement:** `src/app/*` route files *compose* features and server boundaries (keep heavy
  logic out); `src/features/<area>/operations` = side-effecting orchestration; `src/features/<area>/state`
  = reducers + workflow planners; `src/lib/<domain>` = pure shared helpers/adapters/contracts.
- **Tests as the spec:** `tests/unit` (Vitest, jsdom, `@ → src` alias) is the main regression net.
  For architecture-sensitive changes, read the nearest unit test before editing. Add/adjust the
  relevant test in the same area as the change.

## Verified current state (as of 2026-07-22 — re-check if stale)

All gates were green after a reliability fix pass (verified by running them):

- **`typecheck`: clean.**
- **`lint`: 0 errors, 25 warnings** (`npm run lint`). The warnings are pre-existing unused-var /
  `react-hooks/exhaustive-deps` items; there are no errors. If you hit a lint error, you introduced it.
- **`test -- --run`: 1078/1078 passing** (171 files), stable across repeated runs.
- **`build`: green** (`next build` succeeds).

A prior known-issues snapshot (9 lint errors, 6 failing tests, and an intermittently-flaky
`useAgentSettingsMutationController` test) was resolved: a runtime-name regression in
`agentFleetHydration.ts` (identity recovery clobbering the runtime name) was fixed in product code;
behavior-drift tests (`agentChatPanel-controls` onSend arity, `useGatewayConnection` auto-connect)
were updated to the intended contract; the `RetroOffice3D` effect-ordering and the SSR-safe
localStorage lint errors were addressed; and `tests/setup.ts` now runs `afterEach(cleanup)` to
remove cross-test DOM pollution. See [[claw3d-gateway-auto-connect-decision]] for the auto-connect
behavior choice encoded in the connection tests.

## Gotchas

- The `openclaw` npm package is **not a repo dependency**; it's resolved optionally at runtime. A
  `Can't resolve 'openclaw'` build warning is documented in `AGENTS.md` and is harmless; the current
  Turbopack `next build` completes without emitting it.
- The dev server holds a lock at `.next/dev/lock`; a second `next dev` (e.g. `npm run smoke:dev-server`)
  fails with "Unable to acquire lock" while one instance is already running. That is an environment
  conflict, not an app failure — stop the other instance first, or verify the running one is serving.
- `wss://` against a non-TLS gateway → `EPROTO` / `wrong version number`. `minProtocol`/`maxProtocol`
  `INVALID_REQUEST` errors mean the gateway is too old for protocol v3 — upgrade OpenClaw, use the
  Hermes adapter, or run `npm run demo-gateway`.
- The README links a Cursor rule file (`.cursor/rules/claw3d-project-guardrails.mdc`) that is **not
  present**; the live guardrails are in `AGENTS.md`, `ARCHITECTURE.md`, and `CODE_DOCUMENTATION.md`.
