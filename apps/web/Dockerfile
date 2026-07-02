# Build context is the repo root (npm workspaces) — see docker-compose.yml.
# Relies on next.config.ts's `output: "standalone"` + `outputFileTracingRoot`
# (already set for monorepo module resolution), which nests the traced server
# under apps/web/ inside .next/standalone rather than at its root.
FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/print-templates/package.json packages/print-templates/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npx turbo run build --filter=@onepos/web

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
