"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGrns } from "@/lib/queries/grn";

export default function GoodsReceivedPage() {
  const { data: grns, isLoading } = useGrns();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Goods Received Notes</h1>
        <Button asChild>
          <Link href="/goods-received/new">Receive stock</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GRN #</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(grns ?? [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((grn) => (
                <TableRow key={grn._id}>
                  <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                  <TableCell className="text-zinc-500">{grn.branchId}</TableCell>
                  <TableCell>{grn.lines.length}</TableCell>
                  <TableCell className="text-zinc-500">
                    {new Date(grn.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            {(grns ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-zinc-500">
                  No goods received notes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
