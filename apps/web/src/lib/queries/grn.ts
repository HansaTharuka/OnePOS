"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateGrnDto, GrnDto } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type GrnRecord = MongoDoc<GrnDto>;

const KEY = ["goods-received-notes"] as const;

export function useGrns() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<GrnRecord[]>("/goods-received-notes"),
  });
}

export function useCreateGrn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGrnDto) =>
      apiFetch<GrnRecord>("/goods-received-notes", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
