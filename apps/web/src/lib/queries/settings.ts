"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicSettings } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";

export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => apiFetch<PublicSettings>("/settings/public"),
    staleTime: 5 * 60_000,
  });
}
