import { Suspense } from "react";
import { AdminAuditLogs } from "@/components/admin-audit-logs";

export default function AuditLogsPage() {
  return <Suspense fallback={<main className="page-loading">Loading audit records…</main>}><AdminAuditLogs /></Suspense>;
}