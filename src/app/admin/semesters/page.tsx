import { Suspense } from "react";
import { SemesterList } from "@/components/semester-pages";

export default function SemestersPage() {
  return <Suspense fallback={<main className="page-loading">Loading semesters…</main>}><SemesterList /></Suspense>;
}