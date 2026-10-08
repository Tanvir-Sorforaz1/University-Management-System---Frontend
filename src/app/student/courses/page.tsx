import { Suspense } from "react";
import { StudentCourses } from "@/components/enrollment-pages";

export default function StudentCoursesPage() {
  return <Suspense fallback={<main className="page-loading">Loading courses…</main>}><StudentCourses /></Suspense>;
}