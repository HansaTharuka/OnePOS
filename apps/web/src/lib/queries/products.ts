"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateProductDto, ProductDto, UpdateProductDto } from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type ProductRecord = MongoDoc<ProductDto>;

const KEY = ["products"] as const;

export function useProducts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ProductRecord[]>("/products"),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<ProductRecord>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProductDto) =>
      apiFetch<ProductRecord>("/products", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProductDto }) =>
      apiFetch<ProductRecord>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(dto) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
