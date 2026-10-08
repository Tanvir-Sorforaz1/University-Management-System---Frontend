import { Suspense } from "react";
import { NotificationInbox } from "@/components/notification-pages";

export default function StudentNotificationsPage() {
  return <Suspense fallback={<main className="page-loading">Loading notifications…</main>}><NotificationInbox role="student" /></Suspense>;
}