import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { path } = await context.params;
  const search = new URL(request.url).search;
  const targetUrl = `${API_BASE_URL}/${path.join("/")}${search}`;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const apiRes = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });

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
