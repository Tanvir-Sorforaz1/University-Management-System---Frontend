"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowUpDown, CalendarRange, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, formatMoney, readNumber, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

const pageSize = 10;

function recordFrom(value: unknown): ApiRecord | undefined {
  const unwrapped = unwrapPayload(value);
  const direct = asRecord(unwrapped);
  if (direct) return direct;
  return findRows(value, ["semester"])
    .map(asRecord)
    .find((record): record is ApiRecord => Boolean(record));
}

function isCurrentSemester(record: ApiRecord): boolean {
  const start = readText(record, "startDate");
  const end = readText(record, "endDate");
  if (!start || !end) return false;
  const now = Date.now();
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Number.isFinite(startTime) && Number.isFinite(endTime) && startTime <= now && now <= endTime;
}

export function SemesterList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const department = params.get("department") ?? "";
  const sortOrder = params.get("sortOrder") === "desc" ? "desc" : "asc";
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/semesters", { params: { page, limit: pageSize, department: department || undefined, sortOrder } })
      .then(({ data }) => { if (active) setRows(findRows(data, ["semesters"])); })
      .catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load semesters. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, department, sortOrder]);

  const semesters = useMemo(() => rows.map(asRecord).filter((item): item is ApiRecord => Boolean(item)), [rows]);
  const departments = useMemo(() => [...new Set(semesters.map((item) => readText(item, "department")).filter((value): value is string => Boolean(value)))].sort(), [semesters]);
  const currentIndex = semesters.findIndex(isCurrentSemester);

  function updateQuery(values: { department?: string; sortOrder?: string; page?: number }) {
    const next = new URLSearchParams(queryString);
    if (values.department !== undefined) {
      if (values.department) next.set("department", values.department);
      else next.delete("department");
    }
    if (values.sortOrder) next.set("sortOrder", values.sortOrder);
    next.set("page", String(values.page ?? 1));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return <>
    <PageHeader title="Semesters" description="Review semester schedules and fee settings." />
    <section className="filter-bar" aria-label="Semester filters">
      <label className="filter-select-label"><span>Department</span><select aria-label="Filter semesters by department" value={department} onChange={(event) => updateQuery({ department: event.target.value })}><option value="">All departments</option>{departments.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
      <button className="button button-ghost sort-toggle" onClick={() => updateQuery({ sortOrder: sortOrder === "asc" ? "desc" : "asc" })}><ArrowUpDown size={16} />{sortOrder === "asc" ? "Oldest first" : "Newest first"}</button>
    </section>
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => router.refresh()}>Try again</button></div>}
    <section className="data-panel">
      <div className="data-panel-heading"><div><h2>Semester records</h2><p>{loading ? "Updating records…" : `${semesters.length} records on this page`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>
      {loading && !semesters.length ? <div className="table-skeleton">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div> : semesters.length ? <>
        <div className="semester-table-wrap"><table className="data-table semester-table"><thead><tr><th scope="col">Semester</th><th scope="col">Department</th><th scope="col">Start date</th><th scope="col">End date</th><th scope="col">Fee amount</th><th scope="col">Record</th></tr></thead><tbody>{semesters.map((semester, index) => {
          const id = readText(semester, "id");
          const name = readText(semester, "name") ?? "—";
          const current = index === currentIndex;
          return <tr key={id ?? index}><td><strong>{name}</strong>{current && <span className="current-semester">Current</span>}</td><td>{readText(semester, "department") ?? "—"}</td><td>{readText(semester, "startDate") ? formatDate(readText(semester, "startDate")!) : "—"}</td><td>{readText(semester, "endDate") ? formatDate(readText(semester, "endDate")!) : "—"}</td><td className="numeric-cell">{readNumber(semester, "feeAmount") !== undefined ? formatMoney(readNumber(semester, "feeAmount")!) : "—"}</td><td>{id ? <Link className="table-link" href={`/admin/semesters/${encodeURIComponent(id)}`}>View <ChevronRight size={15} /></Link> : "—"}</td></tr>;
        })}</tbody></table></div>
        <div className="semester-mobile-list">{semesters.map((semester, index) => {
          const id = readText(semester, "id");
          const name = readText(semester, "name") ?? "—";
          return <article className="semester-mobile-card" key={id ?? index}><div className="semester-mobile-title"><h3>{name}</h3>{index === currentIndex && <span className="current-semester">Current</span>}</div><dl><div><dt>Department</dt><dd>{readText(semester, "department") ?? "—"}</dd></div><div><dt>Start date</dt><dd>{readText(semester, "startDate") ? formatDate(readText(semester, "startDate")!) : "—"}</dd></div><div><dt>End date</dt><dd>{readText(semester, "endDate") ? formatDate(readText(semester, "endDate")!) : "—"}</dd></div><div><dt>Fee amount</dt><dd>{readNumber(semester, "feeAmount") !== undefined ? formatMoney(readNumber(semester, "feeAmount")!) : "—"}</dd></div></dl>{id && <Link className="table-link" href={`/admin/semesters/${encodeURIComponent(id)}`}>View semester <ChevronRight size={15} /></Link>}</article>;
        })}</div>
      </> : !error && <div className="empty-state"><div className="empty-icon"><CalendarRange size={22} /></div><h2>No semesters found</h2><p>{department ? "Try another department filter." : "Semester records will appear here when available."}</p>{department && <button className="button button-secondary" onClick={() => updateQuery({ department: "" })}>Clear filters</button>}</div>}
      <div className="pagination-bar"><span>Page {page}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button className="button button-secondary pagination-button" disabled={semesters.length < pageSize || loading} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
    </section>
  </>;
}

const semesterPatchSchema = z.object({
  name: z.string().trim().min(1, "Enter a semester name."),
  feeAmount: z.coerce.number().min(0, "Fee amount can’t be negative."),
  creditHours: z.coerce.number().min(0, "Credit hours can’t be negative."),
});

type SemesterPatchValues = z.infer<typeof semesterPatchSchema>;
type SemesterPatchInput = z.input<typeof semesterPatchSchema>;

function SemesterField({ label, id, error, registration, type = "text" }: {
  label: string;
  id: keyof SemesterPatchValues;
  error?: string;
  registration: UseFormRegisterReturn;
  type?: string;
}) {
  return <div className="field-group"><label className="field-label" htmlFor={id}>{label}</label><input className="field-control" id={id} type={type} inputMode={type === "number" ? "decimal" : undefined} aria-invalid={Boolean(error)} {...registration} />{error && <p className="field-error"><AlertCircle size={16} />{error}</p>}</div>;
}

export function SemesterDetail() {
  const params = useParams<{ semesterId: string }>();
  const router = useRouter();
  const semesterId = params.semesterId;
  const [semester, setSemester] = useState<ApiRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = useForm<SemesterPatchInput, unknown, SemesterPatchValues>({ resolver: zodResolver(semesterPatchSchema), mode: "onTouched" });

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<unknown>(`/semesters/${encodeURIComponent(semesterId)}`).then(({ data }) => {
      if (!active) return;
      const record = recordFrom(data);
      if (!record) {
        setError("The API response did not contain a semester record.");
        return;
      }
      setSemester(record);
      form.reset({
        name: readText(record, "name") ?? "",
        feeAmount: readNumber(record, "feeAmount") ?? 0,
        creditHours: readNumber(record, "creditHours") ?? 0,
      });
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "We couldn’t find that semester. Try again or return to the semester list.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [semesterId, form]);

  async function save(values: SemesterPatchValues) {
    const patch: Partial<SemesterPatchValues> = {};
    if (values.name !== (readText(semester ?? {}, "name") ?? "")) patch.name = values.name;
    if (values.feeAmount !== (readNumber(semester ?? {}, "feeAmount") ?? 0)) patch.feeAmount = values.feeAmount;
    if (values.creditHours !== (readNumber(semester ?? {}, "creditHours") ?? 0)) patch.creditHours = values.creditHours;
    if (!Object.keys(patch).length) {
      toast.info("No changes to save.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch<unknown>(`/semesters/${encodeURIComponent(semesterId)}`, patch);
      const updated = recordFrom(data);
      if (updated) setSemester(updated);
      else {
        const refreshed = await api.get<unknown>(`/semesters/${encodeURIComponent(semesterId)}`);
        setSemester(recordFrom(refreshed.data));
      }
      form.reset(values);
      setEditing(false);
      toast.success("Changes saved.");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Couldn’t save semester changes. Check the fields and try again."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="detail-loading"><LoaderCircle className="spinner" size={20} />Loading semester…</div>;
  if (error && !semester) return <section className="error-panel" role="alert"><AlertCircle size={20} /><div><h2>We couldn’t load that semester</h2><p>{error}</p><Link className="button button-secondary" href="/admin/semesters"><ArrowLeft size={16} />Back to semesters</Link></div></section>;
  if (!semester) return null;

  return <>
    <div className="breadcrumbs"><Link href="/admin/semesters">Semesters</Link><span>/</span><span>{readText(semester, "name") ?? "Semester details"}</span></div>
    <PageHeader title={readText(semester, "name") ?? "Semester details"} description={readText(semester, "department")} action={!editing ? <button className="button button-primary" onClick={() => setEditing(true)}>Edit semester</button> : undefined} />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}
    <div className="semester-detail-grid">
      <section className="data-panel semester-facts"><div className="data-panel-heading"><div><h2>Semester facts</h2><p>Values returned by the semester API</p></div></div><dl className="facts-list">
        {[["Department", "department"], ["Fee amount", "feeAmount"], ["Credit hours", "creditHours"], ["Start date", "startDate"], ["End date", "endDate"]].map(([label, key]) => {
          const value = semester[key];
          let display = "—";
          if (key === "feeAmount" && typeof value === "number") display = formatMoney(value);
          else if ((key === "startDate" || key === "endDate") && typeof value === "string") display = formatDate(value);
          else if (typeof value === "string" || typeof value === "number") display = String(value);
          return value !== undefined && value !== null ? <div key={key}><dt>{label}</dt><dd>{display}</dd></div> : null;
        })}
      </dl></section>
      {editing && <section className="data-panel semester-edit-panel"><div className="data-panel-heading"><div><h2>Edit semester</h2><p>Only changed values will be sent.</p></div></div><form className="form-stack edit-form" onSubmit={form.handleSubmit(save)}>
        <SemesterField id="name" label="Semester name" registration={form.register("name")} error={form.formState.errors.name?.message} />
        <SemesterField id="feeAmount" label="Fee amount (BDT)" type="number" registration={form.register("feeAmount")} error={form.formState.errors.feeAmount?.message} />
        <SemesterField id="creditHours" label="Credit hours" type="number" registration={form.register("creditHours")} error={form.formState.errors.creditHours?.message} />
        <div className="header-button-group"><button className="button button-secondary" type="button" onClick={() => { form.reset(); setEditing(false); }}>Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving && <LoaderCircle className="spinner" size={17} />}{saving ? "Saving changes" : "Save changes"}</button></div>
      </form></section>}
    </div>
  </>;
}