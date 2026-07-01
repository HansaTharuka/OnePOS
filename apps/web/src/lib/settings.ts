import type { PublicSettings } from "@onepos/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api";

export async function getPublicSettings(): Promise<PublicSettings | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/settings/public`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicSettings;
  } catch {
    return null;
  }
}
