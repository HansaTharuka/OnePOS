# Architecture Overview

## System topology

```
                        ┌─────────────────────────┐
                        │   Head Office / Server   │
                        │  NestJS API  +  MongoDB  │
                        │  (replica set, 1 primary │
                        │   + local secondary)     │
                        └───────────┬─────────────┘
                                    │ LAN / VPN (REST + WS)
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
 ┌──────▼──────┐            ┌───────▼─────┐             ┌───────▼─────┐
 │ Terminal #1  │            │ Terminal #2 │             │ Terminal #N │
 │ Electron app │            │ Electron app│             │ Electron app│
 │ ├ Next.js UI │            │ ├ Next.js UI│             │ ├ Next.js UI│
 │ ├ SQLite outbox (offline queue)                        │
 │ └ Print Agent → Receipt / Label / A4 printers          │
 └─────────────┘            └─────────────┘             └─────────────┘
```

- Each terminal is one Electron install. The Next.js frontend renders inside it; API calls go to
  the central NestJS server over LAN/VPN.
- Each terminal keeps a **local SQLite outbox**: while offline, sales are written locally and
  queued; a background sync worker replays them to the server the moment connectivity returns.
  See [`05-offline-sync-and-backup.md`](./05-offline-sync-and-backup.md) for the full design.
- Browser-tab-only terminals (no Electron installed) are a supported fallback, not the primary
  path — see [`06-printer-integration.md`](./06-printer-integration.md) §4.

## Desktop packaging: Electron

Compared Electron vs Tauri vs Nextron (2025-2026 status):

- **Nextron** (Next.js+Electron scaffold) is currently flagged "looking for maintainers" on
  GitHub — too risky as a long-term production dependency.
- **Tauri 2.x** is production-ready and produces much smaller installers (3–15MB vs Electron's
  50–150MB), but would force Rust competency onto a team that already owns two Node stacks
  (Next.js, NestJS), for no POS-specific benefit. Its updater/ops tooling is also less proven for
  unattended retail-terminal deployments than Electron's.
- **Electron** (recommended) wraps a locally-run Next.js server + NestJS process(es) as Electron
  main-process children, packaged with `electron-builder`. Electron's maturity for auto-update,
  code-signing, and MSI/NSIS installer generation matters more here than binary size for a
  cashier PC.

Run Next.js in production mode (`next build && next start`) and NestJS as sibling processes
spawned by the Electron main process, communicating over localhost.

## Monorepo layout (Turborepo)

```
onepos/
├── apps/
│   ├── web/              # Next.js — POS UI, admin panel, dashboards
│   ├── api/               # NestJS — REST/WS API, business logic, RBAC
│   └── desktop/           # Electron shell: spawns web+api as child processes,
│                           #   owns the SQLite outbox, owns the Print Agent
├── packages/
│   ├── shared-types/      # DTOs, enums, zod schemas shared web ↔ api ↔ desktop
│   ├── config/            # eslint/tsconfig/tailwind presets
│   └── print-templates/   # ESC/POS, ZPL, and PDF/HTML invoice templates
└── turbo.json
```

**Why Turborepo over Nx**: for a two-app (NestJS API + Next.js frontend), single-business,
small-team project, Turborepo's minimal config and fast incremental build caching is the right
fit. Nx's extra value (project graph, codegen, affected-command analysis, polyglot support) only
pays off at 10+ packages / 10+ engineers. Revisit only if the backend grows into multiple
services.

## Multi-terminal race conditions

Multiple Electron terminals hitting one NestJS server over LAN is architecturally fine, but:

- Inventory decrements **must** use MongoDB's atomic conditional update —
  `findOneAndUpdate({_id, qty: {$gt: 0}}, {$inc: {qty: -n}})` — never read-then-write in
  application code. This is the standard fix for concurrent-oversell bugs.
- Avoid multi-document transactions on this hot path (perf cost); reserve transactions for
  cross-collection consistency (e.g. sale + ledger + stock together).
- The NestJS server is a single point of failure for all terminals — mitigated by the offline
  queue (see doc 05).
- Use **server-assigned sequence numbers**, not client timestamps, as the source of truth for
  event ordering during sync — terminal clocks can skew.
