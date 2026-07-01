"use client";

import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Shifts</h1>
        <p className="text-sm text-slate-500">Terminal shift history and cash reconciliation.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
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
                      <Link href={`/shifts/${shift._id}`} className="text-primary hover:underline">
                        {shift.shiftNo}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{shift.terminalId}</TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(shift.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {shift.closedAt ? new Date(shift.closedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shift.status === "open" ? "info" : "secondary"}>{shift.status}</Badge>
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
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Clock className="h-8 w-8" />
                      <span className="text-sm">No shifts yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
