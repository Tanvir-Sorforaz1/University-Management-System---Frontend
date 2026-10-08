"use client";

import { AlertCircle, ArrowRight, Award, Bell, CalendarCheck, ClipboardList, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, readText, type ApiRecord } from "@/lib/api-data";

export function FacultyOverview() {
  const [exams, setExams] = useState<ApiRecord[]>([]);
  const [notifications, setNotifications] = useState<ApiRecord[]>([]);
  const [user, setUser] = useState<ApiRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.allSettled([api.get<unknown>("/auth/me"), api.get<unknown>("/exams/mine"), api.get<unknown>("/notifications/my", { params: { page: 1, limit: 5 } })]).then(([me, examResponse, notificationResponse]) => {
      if (me.status === "fulfilled") setUser(asRecord(me.value.data));
      if (examResponse.status === "fulfilled") setExams(findRows(examResponse.value.data, ["exams"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
      if (notificationResponse.status === "fulfilled") setNotifications(findRows(notificationResponse.value.data, ["notifications"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
      if ([me, examResponse, notificationResponse].every((response) => response.status === "rejected")) setError("Couldn’t load your workspace. Check your connection and try again.");
    }).catch((reason: unknown) => setError(apiErrorMessage(reason, "Couldn’t load your workspace. Try again."))).finally(() => setLoading(false));
  }, []);
  return <><PageHeader title={`Welcome back, ${readText(user ?? {}, "name") ?? "Faculty member"}`} description="Your teaching workspace at a glance." />{error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}{loading ? <div className="metric-grid">{[0, 1, 2].map((item) => <div className="metric-skeleton" key={item}><span /><strong /></div>)}</div> : <><div className="metric-grid"><article className="metric-card"><span className="metric-label">Created exams</span><strong className="metric-value">{exams.length}</strong><small className="metric-context">Open your exam records</small></article><article className="metric-card"><span className="metric-label">Recent updates</span><strong className="metric-value">{notifications.length}</strong><small className="metric-context">Notifications returned</small></article><article className="metric-card"><span className="metric-label">Attendance</span><strong className="metric-value">—</strong><small className="metric-context">Open the attendance workbench</small></article></div><div className="faculty-overview-grid"><section className="data-panel"><div className="data-panel-heading"><div><h2>Teaching actions</h2><p>Jump into today’s work.</p></div></div><div className="student-action-list"><Link href="/faculty/attendance"><span className="student-action-icon"><CalendarCheck size={18} /></span><span><strong>Take attendance</strong><small>Mark present, absent, or late</small></span><ArrowRight size={17} /></Link><Link href="/faculty/exams"><span className="student-action-icon"><ClipboardList size={18} /></span><span><strong>Manage exams</strong><small>{exams.length ? `${exams.length} created exams` : "Create or open an exam"}</small></span><ArrowRight size={17} /></Link><Link href="/faculty/results"><span className="student-action-icon"><Award size={18} /></span><span><strong>Publish results</strong><small>Save results and update transcripts</small></span><ArrowRight size={17} /></Link></div></section><section className="data-panel"><div className="data-panel-heading"><div><h2>Recent notifications</h2><p>{notifications.length ? `${notifications.length} updates` : "No recent updates"}</p></div><Bell size={18} /></div>{notifications.length ? notifications.slice(0, 4).map((notification, index) => <div className="student-notification-item" key={readText(notification, "id") ?? index}><span className="student-action-icon"><Bell size={17} /></span><div><strong>{readText(notification, "title") ?? "Notification"}</strong><small>{readText(notification, "message") ?? readText(notification, "body") ?? ""}</small></div></div>) : <div className="student-empty-copy">No notifications yet.</div>}</section></div></>}</>;
}