import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getApiBaseUrl } from "@/lib/api/base-url";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { path } = await context.params;
  const search = new URL(request.url).search;
  const targetUrl = `${getApiBaseUrl()}/${path.join("/")}${search}`;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let apiRes: Response;
  try {
    apiRes = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });
  } catch {
    // The backend api is unreachable (offline / crashed) — this happens
    // server-side in Next.js, so the browser's own fetch to this same-origin
    // route never throws a network-level error the way isNetworkFailure()
    // (lib/offline/electron-bridge.ts) expects; it just sees a resolved,
    // non-ok response. 503 is the signal that maps back to a real offline
    // failure client-side instead of a generic 500.
    return NextResponse.json({ message: "Backend unreachable" }, { status: 503 });
  }

  if (apiRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseBody = await apiRes.text();
  return new NextResponse(responseBody, {
    status: apiRes.status,
    headers: { "Content-Type": apiRes.headers.get("Content-Type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
