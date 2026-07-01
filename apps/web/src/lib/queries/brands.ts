"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BrandDto, CreateBrandDto, UpdateBrandDto } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type BrandRecord = MongoDoc<BrandDto>;

const KEY = ["brands"] as const;

export function useBrands() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<BrandRecord[]>("/brands"),
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateBrandDto) =>
      apiFetch<BrandRecord>("/brands", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateBrandDto }) =>
      apiFetch<BrandRecord>(`/brands/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
