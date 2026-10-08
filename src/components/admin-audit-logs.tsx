"use client";

import { AlertCircle, ChevronDown, ChevronUp, LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, humanize, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

const pageSize = 10;

function actorName(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return "System";
  if (Array.isArray(value)) return "System";
  const record = value as ApiRecord;
  return readText(record, "name") ?? readText(record, "email") ?? "System";
}

function actionTone(value: string): string {
  const action = value.toLowerCase();
  if (action.includes("create")) return "tone-success";
  if (action.includes("update") || action.includes("promote")) return "tone-info";
  if (action.includes("delete")) return "tone-danger";
  return "tone-neutral";
}

function DetailBlock({ row }: { row: ApiRecord }) {
  const before = row.before;
  const after = row.after;
  if (before !== undefined || after !== undefined) {
    return <div className="audit-diff"><div><strong>Before</strong><pre>{JSON.stringify(before ?? null, null, 2)}</pre></div><div><strong>After</strong><pre>{JSON.stringify(after ?? null, null, 2)}</pre></div></div>;
  }
  return <pre className="audit-json">{JSON.stringify(row, null, 2)}</pre>;
}

export function AdminAuditLogs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const entity = params.get("entity") ?? "";
  const [entityDraft, setEntityDraft] = useState(entity);
  const [rows, setRows] = useState<unknown[]>([]);
  const [expanded, setExpanded] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => setEntityDraft(entity), [entity]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/admin/audit-logs", { params: { page, limit: pageSize, entity: entity || undefined, sortOrder } })
      .then(({ data }) => { if (active) setRows(findRows(data, ["auditLogs"])); })
      .catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load audit logs. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, entity, sortOrder]);

  const entries = useMemo(() => rows.map(asRecord).filter((item): item is ApiRecord => Boolean(item)), [rows]);

  function updateQuery(nextValues: { page?: number; entity?: string; sortOrder?: string }) {
    const next = new URLSearchParams(queryString);
    if (nextValues.entity !== undefined) {
      const trimmed = nextValues.entity.trim();
      if (trimmed) next.set("entity", trimmed);
      else next.delete("entity");
    }
    if (nextValues.sortOrder) next.set("sortOrder", nextValues.sortOrder);
    next.set("page", String(nextValues.page ?? 1));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return <>
    <PageHeader title="Audit logs" description="Review changes recorded across university records." />
    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); updateQuery({ entity: entityDraft }); }}>
      <label className="search-wrap"><Search size={17} /><input value={entityDraft} onChange={(event) => setEntityDraft(event.target.value)} aria-label="Filter audit logs by entity" placeholder="Filter entity, for example User" /></label>
      <button className="button button-secondary" type="submit"><SlidersHorizontal size={16} />Apply filter</button>
      <button className="button button-ghost sort-toggle" type="button" onClick={() => updateQuery({ sortOrder: sortOrder === "desc" ? "asc" : "desc" })}>{sortOrder === "desc" ? <ChevronDown size={16} /> : <ChevronUp size={16} />}{sortOrder === "desc" ? "Newest first" : "Oldest first"}</button>
    </form>
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => router.refresh()}>Try again</button></div>}
    <section className="data-panel audit-panel">
      <div className="data-panel-heading"><div><h2>Activity</h2><p>{loading ? "Updating records…" : `${entries.length} records on this page`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>
      {loading && !entries.length ? <div className="table-skeleton">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div> : entries.length ? <div className="audit-table-scroll"><table className="data-table audit-table"><thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Entity ID</th><th scope="col">Details</th></tr></thead><tbody>{entries.map((entry, index) => {
        const key = readText(entry, "id") ?? `${page}-${index}`;
        const action = readText(entry, "action") ?? "—";
        const createdAt = readText(entry, "createdAt");
        return <Fragment key={key}><tr><td title={createdAt ? new Date(createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : undefined}>{createdAt ? formatDate(createdAt) : "—"}</td><td>{actorName(entry.actor)}</td><td><span className={`audit-action ${actionTone(action)}`}>{humanize(action)}</span></td><td>{readText(entry, "entity") ?? "—"}</td><td className="audit-id" title={readText(entry, "entityId")}>{readText(entry, "entityId") ?? "—"}</td><td><button className="icon-button audit-expand" aria-label={expanded === key ? "Hide details" : "Show details"} aria-expanded={expanded === key} onClick={() => setExpanded(expanded === key ? "" : key)}>{expanded === key ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</button></td></tr>{expanded === key && <tr className="audit-details-row"><td colSpan={6}><DetailBlock row={entry} /></td></tr>}</Fragment>;
      })}</tbody></table></div> : !error && <div className="empty-state"><div className="empty-icon"><SlidersHorizontal size={21} /></div><h2>No audit entries match</h2><p>Try another entity filter or clear the current filter.</p>{entity && <button className="button button-secondary" onClick={() => updateQuery({ entity: "" })}>Clear filters</button>}</div>}
      <div className="pagination-bar"><span>Page {page}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button className="button button-secondary pagination-button" disabled={entries.length < pageSize || loading} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
    </section>
  </>;
}