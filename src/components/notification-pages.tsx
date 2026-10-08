"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowDown, ArrowUp, Bell, Check, Clock3, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, readBoolean, readText, type ApiRecord } from "@/lib/api-data";

const pageSize = 10;

function isUnread(record: ApiRecord) {
  if (readBoolean(record, "isRead") !== undefined) return !readBoolean(record, "isRead");
  if (readBoolean(record, "read") !== undefined) return !readBoolean(record, "read");
  if (readBoolean(record, "isUnread") !== undefined) return readBoolean(record, "isUnread") ?? false;
  if (record.readAt !== undefined) return !readText(record, "readAt");
  return false;
}

function timeAgo(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, duration] of units) if (Math.abs(seconds) >= duration) return formatter.format(Math.round(seconds / duration), unit);
  return formatter.format(seconds, "second");
}

function notificationTarget(record: ApiRecord, role: string): string | undefined {
  const explicit = readText(record, "link") ?? readText(record, "href");
  if (explicit?.startsWith(`/${role}/`)) return explicit;
  const type = (readText(record, "type") ?? readText(record, "category") ?? "").toLowerCase();
  if (type.includes("fee") && role === "student") return "/student/fees";
  if (type.includes("result") && role === "student") return "/student/results";
  if (type.includes("attendance") && role === "student") return "/student/attendance";
  if (type.includes("exam")) return `/${role}/exams`;
  return undefined;
}

function NotificationCard({ record, role, onRead }: { record: ApiRecord; role: string; onRead: (record: ApiRecord) => Promise<void> }) {
  const unread = isUnread(record);
  const createdAt = readText(record, "createdAt") ?? readText(record, "sentAt");
  const title = readText(record, "title") ?? "Notification";
  const body = readText(record, "message") ?? readText(record, "body") ?? readText(record, "description");
  const link = notificationTarget(record, role);
  const [expanded, setExpanded] = useState(false);
  return <article className={`notification-row${unread ? " is-unread" : ""}`}>
    {unread && <span className="notification-unread-dot" aria-label="Unread" />}
    <span className="notification-icon"><Bell size={18} /></span>
    <button className="notification-main" type="button" onClick={async () => { if (unread) await onRead(record); if (link) window.location.assign(link); else setExpanded((value) => !value); }}>
      <strong>{title}</strong>{body && <span className={expanded ? "notification-body expanded" : "notification-body"}>{body}</span>}
    </button>
    <span className="notification-time" title={createdAt ? new Date(createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : undefined}>{createdAt ? timeAgo(createdAt) : "—"}</span>
  </article>;
}

export function NotificationInbox({ role }: { role: "student" | "faculty" | "admin" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const entries = useMemo(() => rows.map(asRecord).filter((row): row is ApiRecord => Boolean(row)), [rows]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/notifications/my", { params: { page, limit: pageSize, sortOrder } }).then(({ data }) => {
      if (active) setRows(findRows(data, ["notifications"]));
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load notifications. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, sortOrder, retry]);

  async function markRead(record: ApiRecord) {
    const id = readText(record, "id");
    if (!id || !isUnread(record)) return;
    const previous = rows;
    setRows((current) => current.map((item) => {
      const row = asRecord(item);
      return row && readText(row, "id") === id ? { ...row, isRead: true } : item;
    }));
    try {
      await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
    } catch (reason) {
      setRows(previous);
      toast.error(apiErrorMessage(reason, "Couldn’t mark this notification as read."));
      setRetry((count) => count + 1);
    }
  }

  function updateQuery(values: { page?: number; sortOrder?: string }) {
    const next = new URLSearchParams(queryString);
    if (values.sortOrder) next.set("sortOrder", values.sortOrder);
    next.set("page", String(values.page ?? 1));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return <>
    <PageHeader title="Notifications" description="Updates related to your university account." />
    <section className="data-panel notification-panel"><div className="data-panel-heading"><div><h2>Inbox</h2><p>{loading ? "Loading updates…" : `${entries.length} notifications returned`}</p></div><button className="button button-ghost sort-toggle" onClick={() => updateQuery({ sortOrder: sortOrder === "desc" ? "asc" : "desc" })}>{sortOrder === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}{sortOrder === "desc" ? "Newest first" : "Oldest first"}</button></div>
      {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRetry((count) => count + 1)}>Try again</button></div>}
      {loading && !entries.length ? <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : entries.length ? <div>{entries.map((record, index) => <NotificationCard key={readText(record, "id") ?? index} record={record} role={role} onRead={markRead} />)}</div> : !error && <div className="empty-state"><div className="empty-icon"><Bell size={22} /></div><h2>No notifications</h2><p>You’re all caught up.</p></div>}
      <div className="pagination-bar"><span>Page {page}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button className="button button-secondary pagination-button" disabled={entries.length < pageSize || loading} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
    </section>
  </>;
}

export function NotificationBell({ role }: { role: "student" | "faculty" | "admin" }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get<unknown>("/notifications/my", { params: { page: 1, limit: 5, sortOrder: "desc" } });
        if (!active) return;
        const values = findRows(data, ["notifications"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
        setRows(values);
        setUnreadCount(values.filter(isUnread).length);
        setError("");
      } catch {
        if (active) setError("Couldn’t refresh notifications.");
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function markRead(record: ApiRecord) {
    const id = readText(record, "id");
    if (!id || !isUnread(record)) return;
    const previous = rows;
    setRows((current) => current.map((row) => readText(row, "id") === id ? { ...row, isRead: true } : row));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
    } catch (reason) {
      setRows(previous);
      setUnreadCount(previous.filter(isUnread).length);
      toast.error(apiErrorMessage(reason, "Couldn’t mark this notification as read."));
    }
  }

  return <div className="notification-bell-wrap">
    <button className="icon-button notification-bell" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} onClick={() => setOpen((value) => !value)}><Bell size={20} />{unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
    {open && <><button className="popover-dismiss" aria-label="Close notifications" onClick={() => setOpen(false)} /><section className="notification-popover" aria-label="Recent notifications"><div className="notification-popover-head"><strong>Notifications</strong><span>{unreadCount} unread</span></div>{error && <p className="notification-popover-error">{error}</p>}{rows.length ? rows.map((record, index) => <button type="button" className={`notification-popover-row${isUnread(record) ? " is-unread" : ""}`} key={readText(record, "id") ?? index} onClick={async () => { await markRead(record); setOpen(false); const target = notificationTarget(record, role); if (target) window.location.assign(target); }}><span className="notification-icon"><Bell size={16} /></span><span><strong>{readText(record, "title") ?? "Notification"}</strong><small>{readText(record, "message") ?? readText(record, "body") ?? ""}</small></span></button>) : <p className="notification-popover-empty">You’re all caught up.</p>}<Link href={`/${role}/notifications`} onClick={() => setOpen(false)} className="notification-view-all">View all notifications</Link></section></>}
  </div>;
}