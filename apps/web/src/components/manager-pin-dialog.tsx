"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/error";

/**
 * Reusable manager-approval gate: checkout override (no reason), void-sale (reason required),
 * and paid-out/drop cash movements (PIN only — the reason for those is already collected on the
 * surrounding cash-movement form, since `cashDrawerMovementDtoSchema.reason` is required for every
 * movement type regardless of whether a PIN is needed).
 *
 * `onSubmit` should perform the actual mutation call (e.g. `mutateAsync`) and let rejections throw
 * — this dialog catches, toasts via the same `ApiError`/`sonner` pattern used everywhere else, and
 * stays open so the cashier/manager can retry. It only closes itself after `onSubmit` resolves.
 */
export function ManagerPinDialog({
  open,
  onOpenChange,
  title,
  description,
  requireReason = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  requireReason?: boolean;
  onSubmit: (pin: string, reason?: string) => Promise<void> | void;
}) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    if (next) {
      setPin("");
      setReason("");
    }
    onOpenChange(next);
  }

  const canSubmit = pin.trim().length >= 4 && (!requireReason || reason.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(pin.trim(), requireReason ? reason.trim() : undefined);
      setPin("");
      setReason("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="manager-pin-input">Manager PIN</Label>
          <Input
            id="manager-pin-input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !requireReason) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="h-14 text-center text-2xl font-semibold tracking-[0.5em]"
          />
        </div>

        {requireReason && (
          <div className="space-y-2">
            <Label htmlFor="manager-pin-reason">Reason</Label>
            <textarea
              id="manager-pin-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input-border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Verifying…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
