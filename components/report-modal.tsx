"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { REPORT_REASON_VALUES, type ReportReason } from "@/lib/db/enums";
import { createReport } from "@/lib/actions/reports";

export type ReportTarget = {
  type: "user" | "offer" | "request";
  id: string;
  label?: string;
};

export default function ReportModal({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget | null;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setReason("");
    setDetails("");
    setSubmitting(false);
    setDone(false);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!target || !reason) return;
    setSubmitting(true);
    setError(null);
    const input = {
      reason,
      details: details.trim() || null,
      ...(target.type === "user" ? { reported_user_id: target.id } : {}),
      ...(target.type === "offer" ? { reported_offer_id: target.id } : {}),
      ...(target.type === "request" ? { reported_request_id: target.id } : {}),
    };
    const result = await createReport(input);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  const noun =
    target?.type === "user" ? "user" : target?.type === "offer" ? "offer" : "request";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        {done ? (
          <div className="text-center py-4">
            <DialogTitle className="text-lg font-bold text-gray-900 mb-2">
              Report submitted
            </DialogTitle>
            <p className="text-sm text-gray-600 mb-5">
              Thanks for helping keep MakeAbot safe. Our team will review this.
            </p>
            <Button onClick={handleClose} className="min-w-[120px]">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Report {noun}
                {target?.label ? `: ${target.label}` : ""}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-2">
              <label className="text-sm font-medium text-gray-700">Reason</label>
              <div className="flex flex-col gap-2">
                {REPORT_REASON_VALUES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`text-left text-sm rounded-lg border px-3 py-2 transition-colors ${
                      reason === r
                        ? "border-[#3761B0] bg-blue-50 text-[#3761B0] font-medium"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <label className="text-sm font-medium text-gray-700 mt-2">
                Details <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Add anything that helps us understand the issue."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3761B0]"
              />

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>

            <DialogFooter className="flex flex-row justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="bg-[#3761B0] hover:bg-[#2d5199] text-white"
              >
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
