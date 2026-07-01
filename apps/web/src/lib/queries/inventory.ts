"use client";

import { useQuery } from "@tanstack/react-query";
import type { InventoryDto } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type InventoryRecord = MongoDoc<InventoryDto>;

export function useInventory() {
  return useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryRecord[]>("/inventory"),
  });
}
