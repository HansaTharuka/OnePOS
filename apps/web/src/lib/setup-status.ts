import type { SetupStatusDto } from "@onepos/shared-types";
import { getApiBaseUrl } from "@/lib/api/base-url";

/** Unauthenticated — safe to call from public pages (/login, /setup) to decide which to show. */
export async function getSetupStatus(): Promise<SetupStatusDto> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/setup-status`, { cache: "no-store" });
    if (!res.ok) return { needsSetup: false };
    return (await res.json()) as SetupStatusDto;
  } catch {
    return { needsSetup: false };
  }
}
