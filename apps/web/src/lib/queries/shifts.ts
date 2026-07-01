"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CashDrawerMovementDto,
  CashDrawerMovementRecordDto,
  CloseShiftDto,
  OpenShiftDto,
  ShiftDto,
} from "@onepos/shared-types";
import { apiFetch } from "@/lib/api/client";
import type { MongoDoc } from "@/lib/api/types";

export type ShiftRecord = MongoDoc<ShiftDto>;
export type CashMovementRecord = MongoDoc<CashDrawerMovementRecordDto>;

const KEY = ["shifts"] as const;

export function useShifts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ShiftRecord[]>("/shifts"),
  });
}

export function useShift(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<ShiftRecord>(`/shifts/${id}`),
    enabled: Boolean(id),
  });
}

/** The cashier's own open shift on this terminal, or `null` if none — see GET /shifts/current. */
export function useCurrentShift(terminalId: string | null) {
  return useQuery({
    queryKey: [...KEY, "current", terminalId],
    queryFn: () =>
      apiFetch<ShiftRecord | null>(`/shifts/current?terminalId=${encodeURIComponent(terminalId as string)}`),
    enabled: Boolean(terminalId),
  });
}

export function useOpenShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: OpenShiftDto) =>
      apiFetch<ShiftRecord>("/shifts/open", { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCloseShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CloseShiftDto }) =>
      apiFetch<ShiftRecord>(`/shifts/${id}/close`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useCashMovements(shiftId: string) {
  return useQuery({
    queryKey: [...KEY, shiftId, "cash-movements"],
    queryFn: () => apiFetch<CashMovementRecord[]>(`/shifts/${shiftId}/cash-movements`),
    enabled: Boolean(shiftId),
  });
}

export function useRecordCashMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, dto }: { shiftId: string; dto: CashDrawerMovementDto }) =>
      apiFetch<CashMovementRecord>(`/shifts/${shiftId}/cash-movements`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
