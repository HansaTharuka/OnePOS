import type { PublicSettings } from "@onepos/shared-types";
import { getApiBaseUrl } from "@/lib/api/base-url";

export async function getPublicSettings(): Promise<PublicSettings | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/settings/public`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicSettings;
  } catch {
    return null;
  }
}
