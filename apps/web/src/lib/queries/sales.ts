"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSaleDto,
  ParkSaleDto,
  ReceiptDto,
  SaleDto,
  VoidSaleDto,
} from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type SaleRecord = MongoDoc<SaleDto>;

const KEY = ["sales"] as const;

export function useSales() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<SaleRecord[]>("/sales"),
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<SaleRecord>(`/sales/${id}`),
    enabled: Boolean(id),
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: [...KEY, id, "receipt"],
    queryFn: () => apiFetch<ReceiptDto>(`/sales/${id}/receipt`),
    enabled: Boolean(id),
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    // CreateSaleDto now carries shiftId + payments[] instead of amountTendered (Phase 3), but the
    // hook itself is unchanged — it just forwards whatever shape the caller builds.
    mutationFn: (dto: CreateSaleDto) =>
      apiFetch<SaleRecord>("/sales", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/** Parked sales have no stock/payment side effects, so no ["inventory"] invalidation here. */
export function useParkSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ParkSaleDto) =>
      apiFetch<SaleRecord>("/sales/park", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useParkedSales() {
  return useQuery({
    queryKey: [...KEY, "parked"],
    queryFn: () => apiFetch<SaleRecord[]>("/sales/parked"),
  });
}

export function useDeleteParkedSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/sales/parked/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useVoidSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: VoidSaleDto }) =>
      apiFetch<SaleRecord>(`/sales/${id}/void`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
