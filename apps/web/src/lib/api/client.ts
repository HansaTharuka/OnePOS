"use client";

import { toApiError } from "@/lib/api/error";

/**
 * For Client Components. Always calls our own same-origin /api/proxy/* Route Handler — never
 * NestJS directly — so the JWT (held in an httpOnly cookie) never has to reach browser JS.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) throw await toApiError(res);

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
