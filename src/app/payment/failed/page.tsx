import { Suspense } from "react";
import { PaymentLanding } from "@/components/payment-pages";

export default function PaymentFailedPage() {
  return <Suspense fallback={<main className="payment-loading"><h1>Confirming your payment…</h1></main>}><PaymentLanding /></Suspense>;
}