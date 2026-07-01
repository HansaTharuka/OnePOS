import { NextResponse } from "next/server";
import type { AuthTokenResponse } from "@onepos/shared-types";
import { setSessionCookie } from "@/lib/session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export async function POST(request: Request) {
  const body = await request.text();

  const apiRes = await fetch(`${API_BASE_URL}/auth/login`, {
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

  const auth = (await apiRes.json()) as AuthTokenResponse;
  await setSessionCookie(auth);

  return NextResponse.json({ user: auth.user });
}
