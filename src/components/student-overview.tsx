"use client";

import { AlertCircle, ArrowRight, Award, BookOpenCheck, CalendarCheck, LoaderCircle, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, formatMoney, readBoolean, readNumber, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

function rowsFrom(value: unknown, keys: string[]) {
  return findRows(value, keys).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
}

export function StudentOverview() {
  const [user, setUser] = useState<ApiRecord>();
  const [fees, setFees] = useState<ApiRecord[]>([]);
  const [enrollments, setEnrollments] = useState<ApiRecord[]>([]);
  const [attendance, setAttendance] = useState<ApiRecord[]>([]);
  const [notifications, setNotifications] = useState<ApiRecord[]>([]);
  const [cgpa, setCgpa] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.get<unknown>("/auth/me"),
      api.get<unknown>("/fees/my", { params: { page: 1, limit: 10 } }),
      api.get<unknown>("/enrollments/my"),
      api.get<unknown>("/attendance/my"),
      api.get<unknown>("/notifications/my", { params: { page: 1, limit: 5 } }),
      api.get<unknown>("/transcripts/my"),
    ]).then((responses) => {
      if (!active) return;
      const [me, feeResponse, enrollmentResponse, attendanceResponse, notificationResponse, transcriptResponse] = responses;
      if (me.status === "fulfilled") setUser(asRecord(me.value.data));
      if (feeResponse.status === "fulfilled") setFees(rowsFrom(feeResponse.value.data, ["fees"]));
      if (enrollmentResponse.status === "fulfilled") setEnrollments(rowsFrom(enrollmentResponse.value.data, ["enrollments"]));
      if (attendanceResponse.status === "fulfilled") setAttendance(rowsFrom(attendanceResponse.value.data, ["attendance", "records"]));
      if (notificationResponse.status === "fulfilled") setNotifications(rowsFrom(notificationResponse.value.data, ["notifications"]));
      if (transcriptResponse.status === "fulfilled") {
        const transcript = asRecord(unwrapPayload(transcriptResponse.value.data));
        const value = readNumber(transcript ?? {}, "cgpa") ?? readNumber(transcript ?? {}, "CGPA");
        if (value !== undefined) setCgpa(value);
      }
      if (responses.every((response) => response.status === "rejected")) setError("Couldn’t load your overview. Check your connection and try again.");
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load your overview. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const unpaidFees = useMemo(() => fees.filter((fee) => readBoolean(fee, "isPaid") !== true), [fees]);
  const nextDue = unpaidFees.map((fee) => readText(fee, "dueDate")).filter((value): value is string => Boolean(value)).sort()[0];
  const displayName = readText(user ?? {}, "name") ?? "Student";

  return <>
    <PageHeader title={`Welcome back, ${displayName}`} description="Here’s a clear view of your current academic record." />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><Link className="button button-ghost" href="/student/fees">Open fees</Link></div>}
    {loading ? <div className="metric-grid" aria-label="Loading student overview">{[0, 1, 2, 3].map((item) => <div className="metric-skeleton" key={item}><span /><strong /></div>)}</div> : <>
      <div className="metric-grid student-metric-grid"><article className="metric-card"><span className="metric-label">Fees due</span><strong className="metric-value">{unpaidFees.length}</strong><small className="metric-context">{nextDue ? `Next due ${formatDate(nextDue)}` : "No unpaid invoices"}</small></article><article className="metric-card"><span className="metric-label">Enrolled semesters</span><strong className="metric-value">{enrollments.length}</strong><small className="metric-context">Your confirmed enrollment records</small></article><article className="metric-card"><span className="metric-label">Attendance records</span><strong className="metric-value">{attendance.length}</strong><small className="metric-context">Records returned by faculty</small></article><article className="metric-card"><span className="metric-label">Cumulative GPA</span><strong className="metric-value">{cgpa !== undefined ? cgpa.toFixed(2) : "—"}</strong><small className="metric-context">From your transcript</small></article></div>
      <div className="student-overview-grid"><section className="data-panel student-next-panel"><div className="data-panel-heading"><div><h2>Next steps</h2><p>Keep your semester moving.</p></div></div><div className="student-action-list"><Link href="/student/fees"><span className="student-action-icon"><ReceiptText size={18} /></span><span><strong>{unpaidFees.length ? "Review your fees" : "View your fees"}</strong><small>{unpaidFees.length ? `${unpaidFees.length} invoice${unpaidFees.length === 1 ? "" : "s"} need attention` : "Your invoice history"}</small></span><ArrowRight size={17} /></Link><Link href="/student/courses"><span className="student-action-icon"><BookOpenCheck size={18} /></span><span><strong>Manage courses</strong><small>{enrollments.length ? "Review enrolled courses" : "Choose a semester to enroll"}</small></span><ArrowRight size={17} /></Link><Link href="/student/attendance"><span className="student-action-icon"><CalendarCheck size={18} /></span><span><strong>Review attendance</strong><small>{attendance.length ? `${attendance.length} records returned` : "No attendance records yet"}</small></span><ArrowRight size={17} /></Link></div></section><section className="data-panel student-notification-panel"><div className="data-panel-heading"><div><h2>Recent updates</h2><p>{notifications.length ? `${notifications.length} recent notifications` : "No recent notifications"}</p></div><Link className="table-link" href="/student/notifications">View all</Link></div>{notifications.length ? <div className="student-notification-list">{notifications.slice(0, 4).map((notification, index) => <div className="student-notification-item" key={readText(notification, "id") ?? index}><span className="student-action-icon"><Award size={17} /></span><div><strong>{readText(notification, "title") ?? "Notification"}</strong><small>{readText(notification, "message") ?? readText(notification, "body") ?? ""}</small></div></div>)}</div> : <div className="student-empty-copy"><Award size={20} /><span>Important updates will appear here.</span></div>}</section></div>
    </>}
  </>;
}