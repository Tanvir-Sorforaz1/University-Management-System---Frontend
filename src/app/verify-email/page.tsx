import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="page-loading">Loading verification…</main>}><AuthForm mode="verify" /></Suspense>;
}