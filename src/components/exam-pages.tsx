"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, Check, ChevronRight, ClipboardList, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, readNumber, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

const examSchema = z.object({
  semesterId: z.string().min(1, "Choose a semester."),
  title: z.string().trim().min(1, "Enter an exam title."),
  type: z.string().min(1, "Choose an exam type."),
  examDate: z.string().min(1, "Choose an exam date."),
  totalMarks: z.coerce.number().positive("Total marks must be greater than zero."),
  weightPercent: z.coerce.number().min(0, "Weight can’t be below zero.").max(100, "Weight can’t exceed 100%"),
});

type ExamValues = z.infer<typeof examSchema>;
type ExamInput = z.input<typeof examSchema>;
const examTypes = ["MIDTERM", "FINAL", "QUIZ"];

function nestedValue(value: unknown, keyOptions: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const result = nestedValue(child, keyOptions);
      if (result) return result;
    }
    return undefined;
  }
  const record = value as ApiRecord;
  for (const [key, child] of Object.entries(record)) {
    if (keyOptions.includes(key.toLowerCase()) && typeof child === "string" && child.trim()) return child;
  }
  for (const child of Object.values(record)) {
    const result = nestedValue(child, keyOptions);
    if (result) return result;
  }
  return undefined;
}

function unwrapRecord(value: unknown): ApiRecord | undefined {
  return asRecord(unwrapPayload(value));
}

function rememberExam(userId: string, examId: string, title?: string) {
  try {
    const key = `ums_recent_exams:${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    const recent = Array.isArray(existing) ? existing.filter((item): item is { id: string; title?: string } => Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string")) : [];
    localStorage.setItem(key, JSON.stringify([{ id: examId, title }, ...recent.filter((item) => item.id !== examId)].slice(0, 8)));
  } catch {
    // Recent IDs are optional device convenience.
  }
}

export function StudentExamList() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [semesterId, setSemesterId] = useState("");
  const [exams, setExams] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } }).then(({ data }) => { const result = findRows(data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)); setSemesters(result); setSemesterId(readText(result[0] ?? {}, "id") ?? ""); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!semesterId) return; setLoading(true); api.get<unknown>("/exams", { params: { semesterId } }).then(({ data }) => setExams(findRows(data, ["exams"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)))).finally(() => setLoading(false)); }, [semesterId]);
  return <><PageHeader title="Exams" description="Review exams scheduled for your semester." /><section className="exam-semester-filter"><div><p className="section-kicker">Semester</p><h2>Scheduled exams</h2></div><select className="field-control" value={semesterId} onChange={(event) => setSemesterId(event.target.value)}>{semesters.map((semester) => { const id = readText(semester, "id"); return id ? <option key={id} value={id}>{readText(semester, "name") ?? "Semester"}</option> : null; })}</select></section>{loading ? <div className="exam-list-grid"><div className="exam-card-skeleton" /></div> : exams.length ? <div className="exam-list-grid">{exams.map((exam, index) => { const id = readText(exam, "id"); return <article className="exam-list-card" key={id ?? index}><div className="exam-list-copy"><span className="status-pill tone-info">{readText(exam, "type")?.toLowerCase() ?? "exam"}</span><h3>{readText(exam, "title") ?? "Exam"}</h3><p>{readText(exam, "examDate") ? formatDate(readText(exam, "examDate")!) : "Date unavailable"}</p></div>{id && <button className="button button-secondary" onClick={() => router.push(`/student/exams/${encodeURIComponent(id)}`)}>View exam <ArrowRight size={16} /></button>}</article>; })}</div> : <div className="empty-panel"><h2>No exams scheduled</h2><p>No exams were returned for this semester.</p></div>}</>;
}

export function FacultyExamList() {
  const router = useRouter();
  const [exams, setExams] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get<unknown>("/exams/mine", { params: { sortOrder: "asc" } }).then(({ data }) => setExams(findRows(data, ["exams"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)))).catch((reason: unknown) => setError(apiErrorMessage(reason, "Couldn’t load your exams. Try again."))).finally(() => setLoading(false));
  }, []);
  return <><PageHeader title="Exams" description="Exams created by you and their published records." action={<Link className="button button-primary" href="/faculty/exams/new"><Plus size={18} />Create exam</Link>} />{error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}{loading ? <div className="exam-list-grid">{[0, 1, 2].map((item) => <div className="exam-card-skeleton" key={item} />)}</div> : exams.length ? <div className="exam-list-grid">{exams.map((exam, index) => { const id = readText(exam, "id"); const semester = asRecord(exam.semester) ?? {}; return <article className="exam-list-card" key={id ?? index}><div className="exam-list-date"><CalendarDays size={17} /><strong>{readText(exam, "examDate") ? new Date(readText(exam, "examDate")!).toLocaleDateString("en-US", { day: "2-digit", timeZone: "Asia/Dhaka" }) : "—"}</strong><small>{readText(exam, "examDate") ? new Date(readText(exam, "examDate")!).toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Dhaka" }) : "Date"}</small></div><div className="exam-list-copy"><span className="status-pill tone-info">{readText(exam, "type")?.toLowerCase() ?? "exam"}</span><h3>{readText(exam, "title") ?? "Exam"}</h3><p>{readText(semester, "name") ?? "Semester"}{readNumber(exam, "totalMarks") !== undefined ? ` · ${readNumber(exam, "totalMarks")} marks` : ""}</p></div>{id && <div className="header-button-group"><button className="button button-secondary" onClick={() => router.push(`/faculty/exams/${encodeURIComponent(id)}`)}>View exam <ArrowRight size={16} /></button><Link className="button button-ghost" href={`/faculty/results/${encodeURIComponent(id)}`}>View results</Link></div>}</article>; })}</div> : <div className="empty-panel"><div className="empty-icon"><ClipboardList size={22} /></div><h2>No exams created yet</h2><p>Create your first exam to begin publishing results.</p><Link className="button button-primary" href="/faculty/exams/new"><Plus size={16} />Create exam</Link></div>}</>;
}

export function ExamIndex({ role }: { role: "faculty" | "student" | "admin" }) {
  const router = useRouter();
  const canCreate = role === "faculty";
  const targetBase = `/${role}/exams`;
  const form = useForm<{ examId: string }>({ resolver: zodResolver(z.object({ examId: z.string().trim().min(1, "Enter an exam ID.") })), mode: "onTouched" });
  const [userId, setUserId] = useState("");
  const [recent, setRecent] = useState<{ id: string; title?: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get<unknown>("/auth/me").then(({ data }) => {
      if (!active) return;
      const id = nestedValue(data, ["id", "userId"]) ?? "account";
      setUserId(id);
      try {
        const value = JSON.parse(localStorage.getItem(`ums_recent_exams:${id}`) ?? "[]") as unknown;
        if (Array.isArray(value)) setRecent(value.filter((item): item is { id: string; title?: string } => Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string")));
      } catch {
        setRecent([]);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function openExam(values: { examId: string }) {
    setError("");
    router.push(`${targetBase}/${encodeURIComponent(values.examId.trim())}`);
  }

  return <>
    <PageHeader title="Exams" description={canCreate ? "Create an exam or open a record by ID." : "Open an exam record by ID."} action={canCreate ? <Link className="button button-primary" href="/faculty/exams/new"><Plus size={18} />Create exam</Link> : undefined} />
    <section className="exam-open-panel"><div className="exam-index-icon"><Search size={21} /></div><div className="exam-open-copy"><h2>Open an exam</h2><p>The API does not provide an exam list. Enter an exam ID to view its details.</p></div><form className="exam-id-form" onSubmit={form.handleSubmit(openExam)}><div className="field-group"><label className="field-label" htmlFor="examId">Exam ID</label><input className="field-control" id="examId" placeholder="Paste exam ID" {...form.register("examId")} /></div><button className="button button-secondary" type="submit">Open <ArrowRight size={16} /></button></form>{form.formState.errors.examId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.examId.message}</p>}{error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}</section>
    {canCreate && <section className="recent-exams"><div className="section-heading"><p className="section-kicker">Recently opened on this device</p><h2>Recent exams</h2></div>{recent.length ? <div className="recent-exam-list">{recent.map((exam) => <Link href={`${targetBase}/${encodeURIComponent(exam.id)}`} key={exam.id} className="recent-exam-link"><span className="exam-index-icon"><ClipboardList size={19} /></span><span><strong>{exam.title || "Exam record"}</strong><small>{exam.id}</small></span><ChevronRight size={17} /></Link>)}</div> : <p className="field-help">Opened exam IDs will appear here on this device after the API returns them.</p>}</section>}
  </>;
}

export function CreateExamWizard() {
  const router = useRouter();
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [createdExamId, setCreatedExamId] = useState("");
  const form = useForm<ExamInput, unknown, ExamValues>({ resolver: zodResolver(examSchema), mode: "onTouched", defaultValues: { semesterId: "", title: "", type: "MIDTERM", examDate: "", totalMarks: 100, weightPercent: 30 } });
  const values = form.watch();

  useEffect(() => {
    let active = true;
    api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } }).then(({ data }) => {
      if (active) setSemesters(findRows(data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load semesters. Try again.")); })
      .finally(() => { if (active) setLoadingSemesters(false); });
    return () => { active = false; };
  }, []);

  const fieldsByStep: (keyof ExamValues)[][] = [["semesterId", "title", "type"], ["examDate", "totalMarks", "weightPercent"], []];

  async function nextStep() {
    if (await form.trigger(fieldsByStep[step])) setStep((current) => Math.min(2, current + 1));
  }

  async function createExam(data: ExamValues) {
    setError("");
    try {
      const response = await api.post<unknown>("/exams", {
        semesterId: data.semesterId,
        title: data.title,
        type: data.type,
        examDate: data.examDate,
        totalMarks: data.totalMarks,
        weightPercent: data.weightPercent,
      });
      const record = unwrapRecord(response.data);
      const id = readText(record ?? {}, "id") ?? nestedValue(response.data, ["examId"]);
      setCreatedExamId(id ?? "");
      if (id) {
        rememberExam(nestedValue(await api.get<unknown>("/auth/me").then(({ data }) => data), ["id", "userId"]) ?? "account", id, data.title);
      }
      setCreated(true);
      toast.success("Exam created.");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Couldn’t create the exam. Check the details and try again."));
    }
  }

  if (created) return <>
    <PageHeader title="Exam created" description="The API accepted the exam request." />
    <section className="success-panel"><div className="success-icon"><Check size={22} /></div><div><h2>{values.title}</h2><p>{createdExamId ? `Exam ID: ${createdExamId}` : "The API did not return an exam ID. Open the exam later using its ID."}</p><div className="header-button-group">{createdExamId && <button className="button button-primary" onClick={() => router.replace(`/faculty/exams/${encodeURIComponent(createdExamId)}`)}>Open exam</button>}<Link href="/faculty/exams" className="button button-secondary">Back to exams</Link></div></div></section>
  </>;

  return <>
    <PageHeader title="Create exam" description="Enter the exam information in three short steps." />
    <section className="exam-wizard">
      <ol className="exam-stepper">{["Basics", "Marks and date", "Review"].map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""}><span>{index < step ? <Check size={15} /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
      {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {step === 0 && <div className="form-stack exam-step-content"><div className="field-group"><label className="field-label" htmlFor="semesterId">Semester</label><select className="field-control" id="semesterId" disabled={loadingSemesters} aria-invalid={Boolean(form.formState.errors.semesterId)} {...form.register("semesterId")}><option value="">{loadingSemesters ? "Loading semesters…" : "Select a semester"}</option>{semesters.map((semester) => {
        const id = readText(semester, "id");
        return id ? <option key={id} value={id}>{readText(semester, "name") ?? "Semester"}</option> : null;
      })}</select>{form.formState.errors.semesterId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.semesterId.message}</p>}</div><div className="field-group"><label className="field-label" htmlFor="title">Exam title</label><input className="field-control" id="title" placeholder="Midterm - Data Structures" {...form.register("title")} />{form.formState.errors.title?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.title.message}</p>}</div><fieldset className="admin-type-fieldset"><legend className="field-label">Exam type</legend><div className="exam-type-options">{examTypes.map((type) => <label key={type} className={`exam-type-option${values.type === type ? " is-selected" : ""}`}><input type="radio" value={type} {...form.register("type")} /><span>{type.toLowerCase()}</span></label>)}</div>{form.formState.errors.type?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.type.message}</p>}</fieldset></div>}
      {step === 1 && <div className="form-stack exam-step-content"><div className="field-group"><label className="field-label" htmlFor="examDate">Exam date</label><input className="field-control" id="examDate" type="date" {...form.register("examDate")} />{form.formState.errors.examDate?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.examDate.message}</p>}{values.examDate && values.examDate < new Date().toISOString().slice(0, 10) && <p className="field-help warning-text">This date is in the past. The API may still accept the exam.</p>}</div><div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="totalMarks">Total marks</label><input className="field-control numeric-input" id="totalMarks" type="number" min="1" inputMode="decimal" {...form.register("totalMarks")} />{form.formState.errors.totalMarks?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.totalMarks.message}</p>}</div><div className="field-group"><label className="field-label" htmlFor="weightPercent">Weight (%)</label><input className="field-control numeric-input" id="weightPercent" type="number" min="0" max="100" inputMode="decimal" {...form.register("weightPercent")} />{form.formState.errors.weightPercent?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.weightPercent.message}</p>}</div></div></div>}
      {step === 2 && <div className="exam-review"><div className="exam-date-tile"><CalendarDays size={18} /><strong>{values.examDate ? formatDate(values.examDate) : "—"}</strong></div><div className="exam-review-content"><p className="section-kicker">Review details</p><h2>{values.title || "Exam title"}</h2><dl><div><dt>Semester</dt><dd>{readText(semesters.find((semester) => readText(semester, "id") === values.semesterId) ?? {}, "name") ?? "—"}</dd></div><div><dt>Type</dt><dd>{values.type.toLowerCase()}</dd></div><div><dt>Total marks</dt><dd>{Number.isFinite(Number(values.totalMarks)) ? Number(values.totalMarks) : "—"}</dd></div><div><dt>Weight</dt><dd>{Number.isFinite(Number(values.weightPercent)) ? Number(values.weightPercent) : "—"}%</dd></div></dl></div></div>}
      <div className="exam-wizard-actions"><Link className="button button-ghost" href="/faculty/exams">Cancel</Link><div>{step > 0 && <button className="button button-secondary" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={16} />Back</button>}{step < 2 ? <button className="button button-primary" type="button" onClick={nextStep}>Continue <ArrowRight size={16} /></button> : <button className="button button-primary" type="button" disabled={form.formState.isSubmitting} onClick={form.handleSubmit(createExam)}>{form.formState.isSubmitting && <LoaderCircle className="spinner" size={17} />}{form.formState.isSubmitting ? "Creating exam" : "Create exam"}</button>}</div></div>
    </section>
  </>;
}

export function ExamDetail({ canManage, role }: { canManage: boolean; role: "faculty" | "student" | "admin" }) {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const examId = params.examId;
  const [exam, setExam] = useState<ApiRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const schema = z.object({ title: z.string().trim().min(1, "Enter an exam title."), type: z.string().min(1), examDate: z.string().min(1), totalMarks: z.coerce.number().positive(), weightPercent: z.coerce.number().min(0).max(100) });
  type EditValues = z.infer<typeof schema>;
  type EditInput = z.input<typeof schema>;
  const form = useForm<EditInput, unknown, EditValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get<unknown>(`/exams/${encodeURIComponent(examId)}`).then(({ data }) => {
      if (!active) return;
      const record = unwrapRecord(data);
      if (!record) { setError("The API response did not contain an exam record."); return; }
      setExam(record);
      form.reset({ title: readText(record, "title") ?? "", type: readText(record, "type") ?? "MIDTERM", examDate: readText(record, "examDate")?.slice(0, 10) ?? "", totalMarks: readNumber(record, "totalMarks") ?? 100, weightPercent: readNumber(record, "weightPercent") ?? 0 });
      const id = nestedValue(data, ["id", "examId"]) ?? examId;
      void api.get<unknown>("/auth/me").then(({ data: me }) => rememberExam(nestedValue(me, ["id", "userId"]) ?? "account", id, readText(record, "title")));
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "We couldn’t find that exam. Check the ID and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId, form]);

  async function save(values: EditValues) {
    const patch: Partial<EditValues> = {};
    if (values.title !== (readText(exam ?? {}, "title") ?? "")) patch.title = values.title;
    if (values.type !== (readText(exam ?? {}, "type") ?? "MIDTERM")) patch.type = values.type;
    if (values.examDate !== (readText(exam ?? {}, "examDate")?.slice(0, 10) ?? "")) patch.examDate = values.examDate;
    if (values.totalMarks !== (readNumber(exam ?? {}, "totalMarks") ?? 100)) patch.totalMarks = values.totalMarks;
    if (values.weightPercent !== (readNumber(exam ?? {}, "weightPercent") ?? 0)) patch.weightPercent = values.weightPercent;
    if (!Object.keys(patch).length) { toast.info("No changes to save."); return; }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch<unknown>(`/exams/${encodeURIComponent(examId)}`, patch);
      const updated = unwrapRecord(data);
      if (updated) setExam(updated);
      else setExam((current) => current ? { ...current, ...patch } : current);
      form.reset(values);
      setEditing(false);
      toast.success("Changes saved.");
    } catch (reason) { setError(apiErrorMessage(reason, "Couldn’t save exam changes. Try again.")); }
    finally { setSaving(false); }
  }

  async function deleteExam() {
    const title = readText(exam ?? {}, "title") ?? "this exam";
    const confirmation = await Swal.fire({
      title: `Delete ${title}?`,
      text: "Students will no longer see it. Results already saved stay in the audit log.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete exam",
      cancelButtonText: "Cancel",
      confirmButtonColor: "var(--danger-solid)",
    });
    if (!confirmation.isConfirmed) return;
    setDeleting(true);
    try {
      await api.delete(`/exams/${encodeURIComponent(examId)}`);
      toast.success("Exam deleted.");
      router.replace(role === "admin" ? "/admin/exams" : "/faculty/exams");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Couldn’t delete the exam. Try again."));
      toast.error(apiErrorMessage(reason, "Couldn’t delete the exam. Try again."));
      setDeleting(false);
    }
  }

  if (loading) return <div className="detail-loading"><LoaderCircle className="spinner" size={20} />Loading exam…</div>;
  if (!exam) return <section className="error-panel" role="alert"><AlertCircle size={20} /><div><h2>We couldn’t find that exam</h2><p>{error || "Check the exam ID and try again."}</p><Link href={`/${role}/exams`} className="button button-secondary"><ArrowLeft size={16} />Back to exams</Link></div></section>;
  const semester = asRecord(exam.semester) ?? {};
  const examDate = readText(exam, "examDate");

  return <>
    <div className="breadcrumbs"><Link href={`/${role}/exams`}>Exams</Link><span>/</span><span>{readText(exam, "title") ?? "Exam details"}</span></div>
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    <PageHeader title={readText(exam, "title") ?? "Exam details"} description={readText(semester, "name") ?? "Exam record"} action={canManage && !editing ? <div className="header-button-group"><button className="button button-secondary" onClick={() => setEditing(true)}>Edit exam</button><button className="button button-danger" disabled={deleting} onClick={deleteExam}>{deleting && <LoaderCircle className="spinner" size={16} />}<Trash2 size={16} />Delete exam</button></div> : undefined} />
    <section className="exam-details-card"><div className="exam-date-tile"><CalendarDays size={18} /><small>{examDate ? new Date(examDate).toLocaleDateString("en-US", { month: "short", timeZone: "Asia/Dhaka" }) : "Date"}</small><strong>{examDate ? new Date(examDate).toLocaleDateString("en-US", { day: "2-digit", timeZone: "Asia/Dhaka" }) : "—"}</strong><small>{examDate ? new Date(examDate).toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Dhaka" }) : ""}</small></div><div className="exam-facts"><div><span>Type</span><strong>{readText(exam, "type")?.toLowerCase() ?? "—"}</strong></div><div><span>Semester</span><strong>{readText(semester, "name") ?? "—"}</strong></div><div><span>Total marks</span><strong>{readNumber(exam, "totalMarks") ?? "—"}</strong></div><div><span>Weight</span><strong>{readNumber(exam, "weightPercent") !== undefined ? `${readNumber(exam, "weightPercent")}%` : "—"}</strong></div></div></section>
    {editing && <section className="data-panel exam-edit-panel"><div className="data-panel-heading"><div><h2>Edit exam</h2><p>Only changed values will be sent.</p></div></div><form className="form-stack exam-edit-form" onSubmit={form.handleSubmit(save)}><div className="field-group"><label className="field-label" htmlFor="edit-title">Exam title</label><input id="edit-title" className="field-control" {...form.register("title")} />{form.formState.errors.title?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.title.message}</p>}</div><div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="edit-type">Exam type</label><select id="edit-type" className="field-control" {...form.register("type")}>{examTypes.map((type) => <option key={type} value={type}>{type.toLowerCase()}</option>)}</select></div><div className="field-group"><label className="field-label" htmlFor="edit-date">Exam date</label><input id="edit-date" className="field-control" type="date" {...form.register("examDate")} /></div><div className="field-group"><label className="field-label" htmlFor="edit-marks">Total marks</label><input id="edit-marks" className="field-control" type="number" min="1" {...form.register("totalMarks")} /></div><div className="field-group"><label className="field-label" htmlFor="edit-weight">Weight (%)</label><input id="edit-weight" className="field-control" type="number" min="0" max="100" {...form.register("weightPercent")} /></div></div><div className="header-button-group"><button className="button button-secondary" type="button" onClick={() => { form.reset(); setEditing(false); }}>Cancel</button><button className="button button-primary" disabled={saving} type="submit">{saving && <LoaderCircle className="spinner" size={17} />}{saving ? "Saving changes" : "Save changes"}</button></div></form></section>}
  </>;
}