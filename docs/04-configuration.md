# Configuration Strategy

Goal: "easily configurable" — DB connection, logo, business name, tax rules, printers — without
forcing a rebuild, and ideally without a restart for anything business-facing.

## Hybrid: bootstrap env vars + DB-backed settings

### Env vars (bootstrap-only, immutable at runtime)

Anything needed *before* Mongo connects: `MONGODB_URI`, `PORT`, `JWT_SECRET`, `NODE_ENV`. Use
`@nestjs/config` with Zod (or Joi) validation. This is the one category of config that does
require a restart to change — that's acceptable, since changing the DB connection is inherently
an infrastructure action, not a business one.

### `settings` collection (mutable at runtime, no restart)

Business name, logo URL, currency, tax rates, receipt/invoice template, invoice numbering,
feature flags. Loaded once into an in-memory cache at boot via a `SettingsService`
(`onModuleInit`), with the cache invalidated/refreshed whenever settings are written (a simple
in-process cache with TTL or an event emitter is sufficient at single-business scale — no need
for Redis pub/sub).

- Expose an **admin-only** `/settings` CRUD endpoint.
- Expose a **public, filtered** `/settings/public` endpoint (name, logo, currency, tax display
  rules) for the Next.js frontend to fetch on load, so nothing sensitive leaks to the browser.

### Printer config: per-machine, not per-user or per-DB

Printer configuration lives in a **local config file on each terminal**
(e.g. `%APPDATA%/onepos/printers.json`: receipt printer connection string, label printer IP/port,
default A4 printer name), keyed by terminal/machine. The central server only stores a terminal ID
reference if remote monitoring is needed later — it never stores or touches actual printer
connection details. This is what makes "reconfigure the label printer on till 3" a local,
zero-downtime, zero-redeploy action, and keeps one till's printer setup from affecting another.
See [`06-printer-integration.md`](./06-printer-integration.md) for the full printing architecture.

## Centralized deployment (browser terminals)

The primary deployment shape (see [`01-architecture-overview.md`](./01-architecture-overview.md)):
one central machine runs MongoDB + `apps/api` + `apps/web` together; every terminal is nothing but
a browser tab pointed at that machine's address. Nothing is installed on a terminal, and adding a
terminal means opening a browser on a new PC — no build, no deploy, no per-machine config.

### Bring up the central server

```bash
cp .env.example .env   # then set JWT_SECRET and WEB_ORIGIN
docker compose up -d --build
```

This starts three services (`docker-compose.yml`, root of the repo): `mongo` (persistent named
volume), `api` (NestJS, built from `apps/api/Dockerfile`), and `web` (Next.js standalone build,
`apps/web/Dockerfile`). `web` talks to `api` over the Docker network (`http://api:3001/api`);
`api`'s `CORS_ORIGIN` is set from `WEB_ORIGIN` in `.env` — set it to whatever address terminals
will actually use (e.g. `http://192.168.1.50:3000` for a shop LAN), not `localhost`.

### Point a terminal at it

Open a browser on the terminal PC to `http://<server-LAN-IP>:3000`. First terminal to load with an
empty database is redirected to `/setup` to create the business + first admin; after that,
`/login`. Each browser gets its own persistent terminal id (`localStorage`, see
`apps/web/src/lib/terminal.ts`) the first time it loads the POS screen — no server-side terminal
registration needed.

### The `COOKIE_SECURE` / TLS gotcha

`apps/web`'s session cookie's `secure` flag is controlled by the `COOKIE_SECURE` env var, **not**
`NODE_ENV`. A shop-LAN deployment with no TLS certificate must leave `COOKIE_SECURE=false` (the
default) even though it's otherwise a "production" deployment — `secure: true` on a plain-HTTP
connection makes the browser silently discard the cookie, and login will appear to succeed then
immediately bounce back to `/login`. Only set it to `true` if a TLS-terminating reverse proxy
actually sits in front of `web`.

### Printing on browser terminals

Browsers can't drive receipt/label printers directly. Per
[`06-printer-integration.md`](./06-printer-integration.md) §4, the print-agent is deployable as a
small standalone local service on each terminal machine (same agent core as the Electron path,
just not embedded in an Electron main process) — this is Phase 5 scope, not yet built.

## Why this split (not all-env or all-DB)

- All-env would mean every branding/tax change requires editing a file and restarting the
  service — too slow for what should be a same-day admin change.
- All-DB (including the Mongo connection string itself) is circular — you can't look up "where is
  the database" inside the database.
- This hybrid matches 12-factor principles for secrets/infrastructure while keeping everything a
  business user would reasonably want to change themselves out of the deploy pipeline entirely.
