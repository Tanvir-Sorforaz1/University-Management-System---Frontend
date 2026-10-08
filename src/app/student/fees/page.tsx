import { Suspense } from "react";
import { StudentFees } from "@/components/fee-pages";

export default function StudentFeesPage() {
  return <Suspense fallback={<main className="page-loading">Loading fee records…</main>}><StudentFees /></Suspense>;
}