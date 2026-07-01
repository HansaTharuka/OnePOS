# OnePOS

Enterprise point-of-sale system for a hardware/retail business — Next.js + NestJS + MongoDB,
packaged as an installable desktop app via Electron. Full architecture rationale lives in
[`docs/`](./docs/README.md).

## Monorepo layout

```
apps/
  web/      # Next.js — POS UI, admin panel, dashboards
  api/      # NestJS — REST API, auth, RBAC, business logic
  desktop/  # Electron shell (Phase 4 — offline-first)
packages/
  shared-types/    # DTOs, enums, zod schemas shared across apps
  config/          # shared tsconfig/eslint presets
  print-templates/ # ESC/POS, ZPL, invoice templates (Phase 5)
```

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env   # then edit MONGODB_URI / JWT_SECRET
npm run dev                               # runs api + web via Turborepo
```

Requires a running MongoDB instance (see `MONGODB_URI` in `apps/api/.env`).

- API: http://localhost:3001/api (health check: `/api/health`)
- Web: http://localhost:3000

## Scripts

- `npm run dev` — run all apps in dev mode
- `npm run build` — build all apps/packages
- `npm run lint` — lint all workspaces
- `npm run typecheck` — typecheck all workspaces
- `npm run test` — run all test suites

## Documentation

See [`docs/README.md`](./docs/README.md) for the full architecture, data model, RBAC design,
configuration strategy, offline-sync/backup plan, printer integration, admin/UX design, and the
phased delivery roadmap.
