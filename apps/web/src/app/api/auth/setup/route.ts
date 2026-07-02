import { NextResponse } from "next/server";
import type { AuthTokenResponse } from "@onepos/shared-types";
import { setSessionCookie } from "@/lib/session";
import { getApiBaseUrl } from "@/lib/api/base-url";

export async function POST(request: Request) {
  const body = await request.text();

  const apiRes = await fetch(`${getApiBaseUrl()}/auth/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!apiRes.ok) {
    const errorBody = await apiRes.text();
    return new NextResponse(errorBody, {
      status: apiRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // AuthService.setup() logs the new admin in immediately, so this response
  // is shaped exactly like /api/auth/login's — same session cookie, same flow.
  const auth = (await apiRes.json()) as AuthTokenResponse;
  await setSessionCookie(auth);

  return NextResponse.json({ user: auth.user });
}
