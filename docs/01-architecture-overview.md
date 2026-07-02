# Architecture Overview

## System topology

```
                        ┌─────────────────────────┐
                        │   Central Server         │
                        │  Next.js UI + NestJS API │
                        │  + MongoDB               │
                        │  (replica set, 1 primary │
                        │   + local secondary)     │
                        └───────────┬─────────────┘
                                    │ LAN / VPN (HTTP)
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
 ┌──────▼──────┐            ┌───────▼─────┐             ┌───────▼─────┐
 │ Terminal #1  │            │ Terminal #2 │             │ Terminal #N │
 │ just a       │            │ just a      │             │ just a      │
 │ browser tab  │            │ browser tab │             │ browser tab │
 └─────────────┘            └─────────────┘             └─────────────┘
```

- **Primary path: centralized deployment, browser-only terminals.** One central machine runs
  `apps/web` + `apps/api` + MongoDB together (see [`docker-compose.yml`](../docker-compose.yml)
  and [`04-configuration.md`](./04-configuration.md)); a terminal is nothing more than a browser
  tab pointed at that machine's LAN address. Nothing is installed or updated per terminal — adding
  one is "open a browser on a new PC." The central server is a documented single point of failure,
  mitigated by standard server-side measures (backups, eventually a replica set) rather than by
  per-terminal offline resilience.
- **Secondary path: offline-resilient Electron terminal**, for sites that need a terminal to keep
  selling through a network/server outage. Each Electron terminal keeps a **local SQLite outbox**:
  sales are written locally and queued while offline, and a background sync worker replays them to
  the central server the moment connectivity returns. See
  [`05-offline-sync-and-backup.md`](./05-offline-sync-and-backup.md) for the full design. This path
  is scheduled to be built/reworked *last* (see [`08-roadmap.md`](./08-roadmap.md)) — the existing
  `apps/desktop` code predates the centralized server and currently spawns its own local API +
  embedded MongoDB per machine rather than pointing at one; it needs rework to genuinely act as a
  satellite of the central server described above before it's a real alternative to the primary
  path.
- Printing is a per-terminal concern regardless of path — see
  [`06-printer-integration.md`](./06-printer-integration.md) §4 for how a browser-only terminal
  gets local hardware access without Electron.

## Desktop packaging: Electron (secondary/offline path only)

This section applies only to the offline-resilient Electron terminal (see above) — the primary,
centralized-browser path needs no desktop packaging at all.

Compared Electron vs Tauri vs Nextron (2025-2026 status):

- **Nextron** (Next.js+Electron scaffold) is currently flagged "looking for maintainers" on
  GitHub — too risky as a long-term production dependency.
- **Tauri 2.x** is production-ready and produces much smaller installers (3–15MB vs Electron's
  50–150MB), but would force Rust competency onto a team that already owns two Node stacks
  (Next.js, NestJS), for no POS-specific benefit. Its updater/ops tooling is also less proven for
  unattended retail-terminal deployments than Electron's.
- **Electron** (recommended) wraps a locally-run Next.js server as an Electron main-process child,
  packaged with `electron-builder`. Electron's maturity for auto-update, code-signing, and
  MSI/NSIS installer generation matters more here than binary size for a cashier PC.

Today (pre-rework) the Electron main process also spawns its own local NestJS + embedded MongoDB
as siblings, communicating over localhost — that's the single-machine demo shape flagged above as
needing rework. Once reworked, the Electron shell should run only the Next.js UI + SQLite outbox +
Print Agent locally, with NestJS/MongoDB calls going to the central server over LAN/VPN, matching
the topology diagram at the top of this doc.

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

Multiple terminals (browser or Electron) hitting one NestJS server over LAN is architecturally
fine, but:

- Inventory decrements **must** use MongoDB's atomic conditional update —
  `findOneAndUpdate({_id, qty: {$gt: 0}}, {$inc: {qty: -n}})` — never read-then-write in
  application code. This is the standard fix for concurrent-oversell bugs.
- Avoid multi-document transactions on this hot path (perf cost); reserve transactions for
  cross-collection consistency (e.g. sale + ledger + stock together).
- The NestJS server is a single point of failure for all terminals. For the primary (browser)
  path this is mitigated by ordinary server-side measures — backups, eventually a replica set (see
  doc 05) — not by any per-terminal offline queue, since browser terminals have none. Sites that
  need a terminal to keep selling through an outage use the secondary Electron path instead, whose
  offline queue mitigates exactly this failure mode for that terminal.
- Use **server-assigned sequence numbers**, not client timestamps, as the source of truth for
  event ordering during sync — terminal clocks can skew.
