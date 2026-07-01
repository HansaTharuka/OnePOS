"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type CategoryRecord = MongoDoc<CategoryDto>;

const KEY = ["categories"] as const;

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<CategoryRecord[]>("/categories"),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateCategoryDto) =>
      apiFetch<CategoryRecord>("/categories", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) =>
      apiFetch<CategoryRecord>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
