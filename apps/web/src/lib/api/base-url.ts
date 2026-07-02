/**
 * Single source of truth for the NestJS base URL — see docs/04-configuration.md.
 *
 * Deliberately not `NEXT_PUBLIC_`-prefixed even though every caller is server-only
 * (Route Handlers / Server Components, never shipped to the browser): Next.js's
 * bundler inlines `NEXT_PUBLIC_*` reads via static analysis at *build* time,
 * regardless of whether the surrounding code is server- or client-only. A Docker
 * image built without this var set (then given it at container-start via
 * docker-compose) would silently keep whatever fallback got baked in at build
 * time — confirmed by inspecting the compiled output, which had collapsed this
 * function to `return "http://localhost:3001/api"` unconditionally.
 */
export function getApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:3001/api";
}
