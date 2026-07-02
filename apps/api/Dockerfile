# Build context is the repo root (npm workspaces) — see docker-compose.yml.
# Not size-optimized (ships full node_modules including devDependencies); this
# project's own scale rationale (see docs/01-architecture-overview.md) favors
# simplicity over image-size tuning.
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
RUN npx turbo run build --filter=@onepos/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /repo/packages/shared-types/package.json ./packages/shared-types/package.json

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
