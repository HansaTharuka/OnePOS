import "server-only";
import { cookies } from "next/headers";
import type { AuthTokenResponse } from "@onepos/shared-types";
import { SESSION_COOKIE } from "@/lib/constants";

export type SessionUser = AuthTokenResponse["user"];

export interface Session {
  accessToken: string;
  user: SessionUser;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Deliberately not tied to NODE_ENV: a centralized LAN deployment (see
 * docs/04-configuration.md) commonly runs with NODE_ENV=production but no TLS
 * termination, and `secure: true` on plain HTTP makes browsers silently drop the
 * cookie — login "succeeds" then immediately bounces back to /login.
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export async function setSessionCookie(auth: AuthTokenResponse): Promise<void> {
  const store = await cookies();
  const session: Session = { accessToken: auth.accessToken, user: auth.user };
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: auth.expiresIn,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
