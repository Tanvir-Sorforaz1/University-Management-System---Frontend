import { Suspense } from "react";
import { NotificationInbox } from "@/components/notification-pages";

export default function FacultyNotificationsPage() {
  return <Suspense fallback={<main className="page-loading">Loading notifications…</main>}><NotificationInbox role="faculty" /></Suspense>;
}