import { Suspense } from "react";
import { AdminFees } from "@/components/fee-pages";

export default function AdminFeesPage() {
  return <Suspense fallback={<main className="page-loading">Loading fee invoices…</main>}><AdminFees /></Suspense>;
}