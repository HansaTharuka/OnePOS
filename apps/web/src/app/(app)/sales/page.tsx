"use client";

import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSales } from "@/lib/queries/sales";
import { usePublicSettings } from "@/lib/queries/settings";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  parked: "warning",
  voided: "destructive",
};

export default function SalesPage() {
  const { data: sales, isLoading } = useSales();
  const { data: settings } = usePublicSettings();
  const currencySymbol = settings?.currencySymbol ?? "$";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales</h1>
        <p className="text-sm text-slate-500">Completed and voided sales history.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sales ?? [])
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell className="font-medium">
                      <Link href={`/sales/${sale._id}`} className="text-primary hover:underline">
                        {sale.orderNo}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(sale.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{sale.lines.length}</TableCell>
                    <TableCell className="tabular-money">
                      {formatMoneyCents(sale.grandTotal, currencySymbol)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[sale.status] ?? "secondary"}>{sale.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              {(sales ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Receipt className="h-8 w-8" />
                      <span className="text-sm">No sales yet.</span>
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
