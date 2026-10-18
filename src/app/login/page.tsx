import { Suspense } from "react";
import { AuthForm, type DemoAccount } from "@/components/auth-form";

function getDemoAccounts(): DemoAccount[] {
  return [
    { label: "Admin", email: process.env.NEXT_DEMO_ADMIN_EMAIL ?? "", password: process.env.NEXT_DEMO_ADMIN_PASSWORD ?? "" },
    { label: "Faculty", email: process.env.NEXT_DEMO_FACULTY_EMAIL ?? "", password: process.env.NEXT_DEMO_FACULTY_PASSWORD ?? "" },
    { label: "Student", email: process.env.NEXT_DEMO_STUDENT_EMAIL ?? "", password: process.env.NEXT_DEMO_STUDENT_PASSWORD ?? "" },
  ].filter((account) => account.email && account.password);
}

export default function LoginPage() {
  return <Suspense fallback={<main className="page-loading">Loading sign in…</main>}><AuthForm mode="login" demoAccounts={getDemoAccounts()} /></Suspense>;
}