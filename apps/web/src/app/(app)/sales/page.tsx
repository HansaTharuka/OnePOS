"use client";

import Link from "next/link";
import { formatMoneyCents } from "@onepos/shared-types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSales } from "@/lib/queries/sales";
import { usePublicSettings } from "@/lib/queries/settings";

export default function SalesPage() {
  const { data: sales, isLoading } = useSales();
  const { data: settings } = usePublicSettings();
  const currencySymbol = settings?.currencySymbol ?? "$";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-zinc-900">Sales</h1>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
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
                    <Link href={`/sales/${sale._id}`} className="hover:underline">
                      {sale.orderNo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(sale.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{sale.lines.length}</TableCell>
                  <TableCell>{formatMoneyCents(sale.grandTotal, currencySymbol)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{sale.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            {(sales ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                  No sales yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
