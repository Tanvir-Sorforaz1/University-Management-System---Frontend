"use client";

import { AlertCircle, ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, formatMoney, unwrapPayload } from "@/lib/api-data";
import { PageHeader } from "@/components/page-header";

type Metric = { key: string; label: string; value: number };

function collectMetrics(value: unknown, prefix = ""): Metric[] {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, child]) => {
    const label = prefix ? `${prefix} ${key}` : key;
    if (typeof child === "number" && Number.isFinite(child)) return [{ key: label.toLowerCase(), label, value: child }];
    if (child && typeof child === "object" && !Array.isArray(child)) return collectMetrics(child, label);
    return [];
  });
}

export function AdminOverview() {
  const [payload, setPayload] = useState<unknown>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/admin/dashboard-stats").then(({ data }) => {
      if (active) setPayload(data);
    }).catch((reason: unknown) => {
      if (active) setError(apiErrorMessage(reason, "Couldn’t load dashboard statistics. Check your connection and try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const metrics = collectMetrics(unwrapPayload(payload));

  return (
    <>
      <PageHeader title="Overview" description="A current view of university records and collections." />
      {error ? <section className="error-panel" role="alert"><AlertCircle size={20} /><div><h2>Couldn’t load overview</h2><p>{error}</p><button className="button button-secondary" onClick={() => setRetry((count) => count + 1)}><RefreshCw size={16} />Try again</button></div></section> : loading ? <div className="metric-grid" aria-label="Loading dashboard statistics">{[0, 1, 2, 3].map((item) => <div className="metric-skeleton" key={item}><span /><strong /></div>)}</div> : metrics.length ? <div className="metric-grid">{metrics.map((metric) => {
        const isMoney = /revenue|collected|amount/i.test(metric.key);
        const value = isMoney ? formatMoney(metric.value) : new Intl.NumberFormat("en-BD").format(metric.value);
        return <article className="metric-card" key={metric.key}><span className="metric-label">{metric.label.replace(/[_-]+/g, " ")}</span><strong className="metric-value">{value}</strong></article>;
      })}</div> : <section className="empty-panel"><div className="empty-icon"><LoaderCircle size={21} /></div><h2>No statistics returned</h2><p>The API response did not include numeric aggregate fields.</p></section>}
      <section className="overview-links"><div className="section-heading"><p className="section-kicker">Registry tasks</p><h2>Manage university records</h2></div><div className="overview-link-grid">
        <Link href="/admin/users" className="overview-link"><span><strong>People</strong><small>Review accounts and access</small></span><ArrowUpRight size={18} /></Link>
        <Link href="/admin/semesters" className="overview-link"><span><strong>Semesters</strong><small>Review dates and fee settings</small></span><ArrowUpRight size={18} /></Link>
        <Link href="/admin/fees" className="overview-link"><span><strong>Fee invoices</strong><small>Create a student invoice</small></span><ArrowUpRight size={18} /></Link>
        <Link href="/admin/audit-logs" className="overview-link"><span><strong>Audit logs</strong><small>Inspect recorded changes</small></span><ArrowUpRight size={18} /></Link>
      </div></section>
    </>
  );
}