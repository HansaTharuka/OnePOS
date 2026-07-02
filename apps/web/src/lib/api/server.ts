import "server-only";
import { getSession } from "@/lib/session";
import { toApiError } from "@/lib/api/error";
import { getApiBaseUrl } from "@/lib/api/base-url";

/**
 * For Server Components / Route Handlers only. Calls NestJS directly (already server-side, no
 * need to hop through our own /api/proxy route) using the JWT from the session cookie.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const session = await getSession();
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
