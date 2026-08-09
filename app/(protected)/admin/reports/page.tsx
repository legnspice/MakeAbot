"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/navbar";
import BottomNav from "@/components/ui/bottomnavbar";
import { useAuth } from "@/contexts/auth-context";
import {
  getReports,
  updateReportStatus,
  type AdminReportRow,
} from "@/lib/actions/admin";

const STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;

export default function AdminReportsPage() {
  const router = useRouter();
  const { userData } = useAuth();
  const isAdmin = userData.publicUser.is_admin;
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    getReports().then((res) => {
      setRows(res.data ?? []);
      setLoading(false);
    });
  }, [isAdmin, router]);

  async function handleStatus(id: string, status: string) {
    setRows((prev) =>
      prev.map((r) => (r.report.id === id ? { ...r, report: { ...r.report, status } } : r)),
    );
    await updateReportStatus(id, status);
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-md md:max-w-3xl mx-auto w-full px-4 pt-6 pb-28 md:pb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-4">Reports</h1>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400">No reports.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ report, reporterName, targetLabel }) => (
              <li
                key={report.id}
                className="rounded-xl border border-gray-200 p-4 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {targetLabel}
                  </span>
                  {report.report_count > 1 && (
                    <span className="text-xs text-gray-500">
                      ×{report.report_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {report.reason} · by {reporterName}
                </p>
                {report.details && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {report.details}
                  </p>
                )}
                <select
                  value={report.status}
                  onChange={(e) => handleStatus(report.id, e.target.value)}
                  className="mt-2 self-start rounded-lg border border-gray-300 text-sm px-2 py-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
