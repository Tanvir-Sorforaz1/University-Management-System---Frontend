import { Suspense } from "react";
import { AdminUsers } from "@/components/admin-users";

export default function AdminUsersPage() {
  return <Suspense fallback={<main className="page-loading">Loading user records…</main>}><AdminUsers /></Suspense>;
}