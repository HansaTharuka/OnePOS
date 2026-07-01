"use client";

import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useShifts } from "@/lib/queries/shifts";
import { usePublicSettings } from "@/lib/queries/settings";

/** Near-zero variance reads as fine, a few dollars off is a warning, anything bigger is flagged. */
function varianceBadgeVariant(variance: number): "success" | "warning" | "destructive" {
  const abs = Math.abs(variance);
  if (abs === 0) return "success";
  if (abs <= 500) return "warning";
  return "destructive";
}

export default function ShiftsPage() {
  const { data: shifts, isLoading } = useShifts();
  const { data: settings } = usePublicSettings();
  const currencySymbol = settings?.currencySymbol ?? "$";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Shifts</h1>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shift #</TableHead>
              <TableHead>Terminal</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Closed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(shifts ?? [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((shift) => (
                <TableRow key={shift._id}>
                  <TableCell className="font-medium">
                    <Link href={`/shifts/${shift._id}`} className="hover:underline">
                      {shift.shiftNo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-500">{shift.terminalId}</TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(shift.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {shift.closedAt ? new Date(shift.closedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.status === "open" ? "secondary" : "outline"}>
                      {shift.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shift.variance !== undefined ? (
                      <Badge variant={varianceBadgeVariant(shift.variance)}>
                        {formatMoneyCents(shift.variance, currencySymbol)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            {(shifts ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-zinc-500">
                  No shifts yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
