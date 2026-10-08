"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, Check, Clock3, LoaderCircle, Pencil, Plus, ReceiptText, Save, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, formatMoney, humanize, readBoolean, readNumber, readText, type ApiRecord } from "@/lib/api-data";

const pageSize = 10;

function SelectStudent({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRequestError("");
    const timer = window.setTimeout(() => {
      api.get<unknown>("/admin/users", { params: { page: 1, limit: 10, role: "STUDENT", searchTerm: query.trim(), sortOrder: "asc" } })
        .then(({ data }) => {
          if (!active) return;
          const rows = findRows(data, ["users"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
          setStudents(rows);
        }).catch((reason: unknown) => {
          if (active) setRequestError(apiErrorMessage(reason, "Couldn’t search students. Try again."));
        }).finally(() => { if (active) setLoading(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const matching = students.filter((student) => {
    const profile = asRecord(student.studentProfile);
    return Boolean(readText(profile ?? {}, "id") && !profile?.deletedAt);
  });

  return <div className="field-group student-combobox">
    <label className="field-label" htmlFor="student-search">Student</label>
    <div className="student-search-wrap"><Search size={16} /><input id="student-search" className="field-control" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="student-options" aria-invalid={Boolean(error)} value={open ? query : selectedLabel || query} onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(""); setSelectedLabel(""); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} placeholder="Search name or email" /><button type="button" className="combobox-clear" aria-label="Clear student selection" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(""); setSelectedLabel(""); onChange(""); setOpen(true); }}><X size={15} /></button>
      {open && <div className="combobox-options" id="student-options" role="listbox">{loading ? <p className="combobox-message">Searching students…</p> : requestError ? <p className="combobox-message error-text">{requestError}</p> : matching.length ? matching.map((student, index) => {
        const profile = asRecord(student.studentProfile);
        const id = readText(profile ?? {}, "id");
        const name = readText(student, "name") ?? "Student";
        const email = readText(student, "email") ?? "";
        return <button key={id ?? index} type="button" role="option" aria-selected={id === value} className="combobox-option" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!id) return; onChange(id); setSelectedLabel(email ? `${name} · ${email}` : name); setQuery(""); setOpen(false); }}><strong>{name}</strong>{email && <small>{email}</small>}</button>;
      }) : <p className="combobox-message">No students found.</p>}</div>}
    </div>
    {error && <p className="field-error"><AlertCircle size={16} />{error}</p>}
    {requestError && !error && <p className="field-help">{requestError}</p>}
  </div>;
}

const invoiceSchema = z.object({
  studentId: z.string().min(1, "Choose a student."),
  semesterId: z.string().min(1, "Choose a semester."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  dueDate: z.string().min(1, "Choose a due date."),
});

type InvoiceValues = z.infer<typeof invoiceSchema>;
type InvoiceInput = z.input<typeof invoiceSchema>;

function FeeDialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  return <dialog ref={dialogRef} className="fee-dialog" aria-labelledby="fee-dialog-title" onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
    <div className="fee-dialog-content"><header className="fee-dialog-header"><div><h2 id="fee-dialog-title">{title}</h2><p>{description}</p></div><button className="icon-button" type="button" aria-label="Close dialog" onClick={() => dialogRef.current?.close()}><X size={19} /></button></header><div className="fee-dialog-body">{children}</div></div>
  </dialog>;
}

export function AdminFeeInvoice({ onBack, embedded = false }: { onBack?: () => void; embedded?: boolean } = {}) {
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [created, setCreated] = useState<InvoiceValues>();
  const form = useForm<InvoiceInput, unknown, InvoiceValues>({ resolver: zodResolver(invoiceSchema), mode: "onTouched", defaultValues: { studentId: "", semesterId: "", amount: 0, dueDate: "" } });
  const semesterId = form.watch("semesterId");
  const studentId = form.watch("studentId");
  const amount = form.watch("amount");
  const dueDate = form.watch("dueDate");
  const selectedSemester = semesters.find((semester) => readText(semester, "id") === semesterId);

  useEffect(() => {
    let active = true;
    setLookupLoading(true);
    api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } })
      .then(({ data }) => {
        if (!active) return;
        const result = findRows(data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
        setSemesters(result);
        if (!result.length) setLookupError("No semester records were returned. Create or verify a semester before invoicing.");
      }).catch((reason: unknown) => {
        if (active) setLookupError(apiErrorMessage(reason, "Couldn’t load semesters. Try again."));
      }).finally(() => { if (active) setLookupLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const semesterAmount = selectedSemester ? readNumber(selectedSemester, "feeAmount") : undefined;
    if (semesterAmount !== undefined) form.setValue("amount", semesterAmount, { shouldValidate: true });
  }, [selectedSemester, form]);

  async function submit(values: InvoiceValues) {
    setSubmitError("");
    if (new Date(`${values.dueDate}T00:00:00`).getTime() < new Date().setHours(0, 0, 0, 0)) {
      form.setError("dueDate", { message: "Due date can’t be in the past." });
      return;
    }
    try {
      await api.post("/fees", {
        studentId: values.studentId,
        semesterId: values.semesterId,
        amount: values.amount,
        dueDate: new Date(`${values.dueDate}T23:59:59.000Z`).toISOString(),
      });
      setCreated(values);
      toast.success("Fee invoice created.");
    } catch (reason) {
      setSubmitError(apiErrorMessage(reason, "Couldn’t create this invoice. Check the details and try again."));
    }
  }

  if (created) {
    const semester = semesters.find((item) => readText(item, "id") === created.semesterId);
    return <>
      {!embedded && <PageHeader title="Fee invoice created" description="The API accepted the invoice request." />}
        <section className="invoice-success"><div className="success-icon"><Check size={22} /></div><div><p className="section-kicker">Invoice summary</p><h2>{readText(semester ?? {}, "name") ?? "Semester fee"}</h2><dl><div><dt>Amount</dt><dd>{formatMoney(created.amount)}</dd></div><div><dt>Due date</dt><dd>{formatDate(created.dueDate)}</dd></div><div><dt>Student profile ID</dt><dd>{created.studentId}</dd></div></dl><div className="header-button-group"><button className="button button-primary" onClick={() => { setCreated(undefined); form.reset(); }}>Create another invoice</button>{onBack && <button className="button button-secondary" onClick={onBack}>View invoices</button>}</div></div></section>
    </>;
  }

  return <>
    {!embedded && <PageHeader title="Create fee invoice" description="Create a student fee from a real account and semester record." action={onBack ? <button className="button button-secondary" onClick={onBack}><ArrowLeft size={16} />Back to invoices</button> : undefined} />}
    {lookupError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{lookupError}</span></div>}
    {submitError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{submitError}</span></div>}
    <div className="invoice-layout">
      <section className="form-panel invoice-form-panel">
        <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
          <SelectStudent value={studentId} onChange={(id) => form.setValue("studentId", id, { shouldDirty: true, shouldValidate: true })} error={form.formState.errors.studentId?.message} />
          <div className="field-group"><label className="field-label" htmlFor="semesterId">Semester</label><select id="semesterId" className="field-control" aria-invalid={Boolean(form.formState.errors.semesterId)} disabled={lookupLoading || !semesters.length} {...form.register("semesterId", { onChange: () => form.clearErrors("semesterId") })}><option value="">{lookupLoading ? "Loading semesters…" : "Select a semester"}</option>{semesters.map((semester, index) => {
            const id = readText(semester, "id");
            return id ? <option key={id} value={id}>{readText(semester, "name") ?? `Semester ${index + 1}`} {readText(semester, "department") ? `· ${readText(semester, "department")}` : ""}</option> : null;
          })}</select>{form.formState.errors.semesterId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.semesterId.message}</p>}</div>
          <div className="form-grid">
            <div className="field-group"><label className="field-label" htmlFor="amount">Amount (BDT)</label><div className="money-input-wrap"><span>৳</span><input id="amount" className="field-control" type="number" min="0.01" step="0.01" inputMode="decimal" {...form.register("amount")} /></div>{form.formState.errors.amount?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.amount.message}</p>}{selectedSemester && readNumber(selectedSemester, "feeAmount") !== undefined && <p className="field-help">Prefilled from the selected semester fee amount.</p>}</div>
            <div className="field-group"><label className="field-label" htmlFor="dueDate">Due date</label><input id="dueDate" className="field-control" type="date" {...form.register("dueDate")} />{form.formState.errors.dueDate?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.dueDate.message}</p>}</div>
          </div>
          <button className="button button-primary" type="submit" disabled={form.formState.isSubmitting || lookupLoading}>{form.formState.isSubmitting && <LoaderCircle className="spinner" size={17} />}{form.formState.isSubmitting ? "Creating invoice" : "Create invoice"}</button>
        </form>
      </section>
      <aside className="invoice-preview"><p className="section-kicker">Invoice preview</p><div className="invoice-ticket"><div className="ticket-main"><span className="ticket-icon"><ReceiptText size={19} /></span><h2>{readText(selectedSemester ?? {}, "name") ?? "Semester fee"}</h2><p>{readText(selectedSemester ?? {}, "department") ?? "University fee invoice"}</p><span className="status-label">Due {dueDate ? formatDate(dueDate) : "—"}</span></div><div className="ticket-amount"><strong>{Number.isFinite(Number(amount)) ? formatMoney(Number(amount)) : "—"}</strong><span>BDT</span></div></div><p className="field-help">The invoice amount and due date are submitted to the API as entered.</p></aside>
    </div>
  </>;
}

function isPastDue(value?: string): boolean {
  if (!value) return false;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return false;
  const dueDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(dueDate);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  return dueDay < today;
}

const feeEditSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  dueDate: z.string().min(1, "Choose a due date."),
});
type FeeEditValues = z.infer<typeof feeEditSchema>;
type FeeEditInput = z.input<typeof feeEditSchema>;

function canEditFee(fee: ApiRecord): boolean {
  if (readBoolean(fee, "isPaid") !== false) return false;
  const payments = Array.isArray(fee.payments) ? fee.payments.map(asRecord).filter((row): row is ApiRecord => Boolean(row)) : [];
  return !payments.some((payment) => ["PENDING", "SUCCESS"].includes((readText(payment, "status") ?? "").toUpperCase()));
}

function AdminFeeRegistry({ onCreate }: { onCreate: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const searchTerm = params.get("searchTerm") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchTerm);
  const [rows, setRows] = useState<unknown[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editingFee, setEditingFee] = useState<ApiRecord>();
  const [saving, setSaving] = useState(false);
  const form = useForm<FeeEditInput, unknown, FeeEditValues>({ resolver: zodResolver(feeEditSchema), mode: "onTouched" });

  useEffect(() => setSearchDraft(searchTerm), [searchTerm]);
  useEffect(() => {
    if (searchDraft.trim() === searchTerm) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(queryString);
      const value = searchDraft.trim();
      if (value) next.set("searchTerm", value);
      else next.delete("searchTerm");
      next.set("page", "1");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchTerm, queryString, pathname, router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/fees", { params: { page, limit: pageSize, searchTerm: searchTerm || undefined, sortOrder: "desc" } }).then(({ data }) => {
      if (!active) return;
      setRows(findRows(data, ["fees"]));
      const meta = asRecord(asRecord(data)?.meta);
      const pages = readNumber(meta ?? {}, "totalPages");
      setTotalPages(pages && pages > 0 ? pages : 1);
    }).catch((reason: unknown) => {
      if (active) setError(apiErrorMessage(reason, "Couldn’t load fee invoices. Check your connection and try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, searchTerm, refresh]);

  useEffect(() => {
    if (!editingFee) return;
    form.reset({
      amount: readNumber(editingFee, "amount") ?? 0,
      dueDate: readText(editingFee, "dueDate")?.slice(0, 10) ?? "",
    });
  }, [editingFee, form]);

  const fees = useMemo(() => rows.map(asRecord).filter((fee): fee is ApiRecord => Boolean(fee)), [rows]);
  const editingStudent = asRecord(editingFee?.student) ?? {};
  const editingUser = asRecord(editingStudent.user) ?? {};
  const editingSemester = asRecord(editingFee?.semester) ?? {};

  async function saveFee(values: FeeEditValues) {
    const feeId = readText(editingFee ?? {}, "id");
    if (!feeId) return;
    const payload: { amount?: number; dueDate?: string } = {};
    if (values.amount !== readNumber(editingFee ?? {}, "amount")) payload.amount = values.amount;
    if (values.dueDate !== readText(editingFee ?? {}, "dueDate")?.slice(0, 10)) {
      payload.dueDate = new Date(`${values.dueDate}T23:59:59.000Z`).toISOString();
    }
    if (!Object.keys(payload).length) {
      toast.info("No changes to save.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.patch(`/fees/${encodeURIComponent(feeId)}`, payload);
      toast.success("Changes saved.");
      setEditingFee(undefined);
      setRefresh((count) => count + 1);
    } catch (reason) {
      const message = apiErrorMessage(reason, "Couldn’t update this invoice. Check its payment status and try again.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(queryString);
    next.set("page", String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  function statusFor(fee: ApiRecord) {
    if (readBoolean(fee, "isPaid") === true) return { label: "Paid", tone: "tone-success", icon: Check };
    const payments = Array.isArray(fee.payments) ? fee.payments.map(asRecord).filter((row): row is ApiRecord => Boolean(row)) : [];
    if (payments.some((payment) => (readText(payment, "status") ?? "").toUpperCase() === "PENDING")) return { label: "Payment in progress", tone: "tone-info", icon: Clock3 };
    if (isPastDue(readText(fee, "dueDate"))) return { label: "Overdue", tone: "tone-danger", icon: AlertCircle };
    return { label: "Due", tone: "tone-warning", icon: Clock3 };
  }

  return <>
    <div className="fee-registry-toolbar"><label className="search-wrap"><Search size={17} /><input aria-label="Search fee invoices" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search student, email, or semester" /></label><button className="button button-primary" onClick={onCreate}><Plus size={17} />Create invoice</button></div>
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRefresh((count) => count + 1)}>Try again</button></div>}
    <section className="data-panel fee-registry-panel"><div className="data-panel-heading"><div><h2>Fee invoices</h2><p>{loading ? "Loading invoices…" : `${fees.length} records on this page`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>
      {loading && !fees.length ? <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : fees.length ? <>
        <div className="fee-registry-desktop"><table className="data-table fee-table"><colgroup><col className="fee-col-student" /><col className="fee-col-semester" /><col className="fee-col-amount" /><col className="fee-col-date" /><col className="fee-col-status" /><col className="fee-col-actions" /></colgroup><thead><tr><th scope="col">Student</th><th scope="col">Semester</th><th scope="col" className="numeric-cell">Amount</th><th scope="col">Due date</th><th scope="col">Status</th><th scope="col" className="actions-heading">Actions</th></tr></thead><tbody>{fees.map((fee, index) => {
          const id = readText(fee, "id") ?? String(index);
          const student = asRecord(fee.student) ?? {};
          const user = asRecord(student.user) ?? {};
          const semester = asRecord(fee.semester) ?? {};
          const status = statusFor(fee);
          const StatusIcon = status.icon;
          return <tr key={id}><td className="fee-student-cell"><strong title={readText(user, "name") ?? "Student"}>{readText(user, "name") ?? "Student"}</strong><small className="fee-student-meta" title={readText(user, "email") ?? readText(student, "studentId") ?? "—"}>{readText(user, "email") ?? readText(student, "studentId") ?? "—"}</small></td><td className="fee-semester-cell" title={readText(semester, "name") ?? "—"}>{readText(semester, "name") ?? "—"}</td><td className="numeric-cell">{readNumber(fee, "amount") !== undefined ? formatMoney(readNumber(fee, "amount")!) : "—"}</td><td className="fee-date-cell">{readText(fee, "dueDate") ? formatDate(readText(fee, "dueDate")!) : "—"}</td><td><span className={`status-pill ${status.tone}`}><StatusIcon size={14} />{status.label}</span></td><td className="fee-action-cell">{canEditFee(fee) ? <button className="table-action" onClick={() => setEditingFee(fee)}><Pencil size={15} />Edit</button> : <span className="field-help">{readBoolean(fee, "isPaid") ? "Paid invoice" : "Payment in progress"}</span>}</td></tr>;
        })}</tbody></table></div>
        <div className="fee-registry-mobile">{fees.map((fee, index) => {
          const id = readText(fee, "id") ?? String(index);
          const student = asRecord(fee.student) ?? {};
          const user = asRecord(student.user) ?? {};
          const semester = asRecord(fee.semester) ?? {};
          const status = statusFor(fee);
          const StatusIcon = status.icon;
          return <article className="fee-admin-card" key={id}><div className="fee-admin-card-head"><div><strong>{readText(user, "name") ?? "Student"}</strong><small>{readText(user, "email") ?? readText(student, "studentId") ?? "—"}</small></div><span className={`status-pill ${status.tone}`}><StatusIcon size={14} />{status.label}</span></div><dl><div><dt>Semester</dt><dd>{readText(semester, "name") ?? "—"}</dd></div><div><dt>Amount</dt><dd>{readNumber(fee, "amount") !== undefined ? formatMoney(readNumber(fee, "amount")!) : "—"}</dd></div><div><dt>Due date</dt><dd>{readText(fee, "dueDate") ? formatDate(readText(fee, "dueDate")!) : "—"}</dd></div></dl>{canEditFee(fee) ? <button className="button button-secondary" onClick={() => setEditingFee(fee)}><Pencil size={16} />Edit invoice</button> : <p className="field-help">{readBoolean(fee, "isPaid") ? "Paid invoice" : "Payment in progress"}</p>}</article>;
        })}</div>
      </> : !error && <div className="empty-state"><div className="empty-icon"><ReceiptText size={22} /></div><h2>No fee invoices found</h2><p>{searchTerm ? "Try another student or semester search." : "Create a fee invoice to see it in this registry."}</p><button className="button button-primary" onClick={onCreate}><Plus size={16} />Create invoice</button></div>}
      <div className="pagination-bar"><span>Page {page} of {totalPages}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)}>Previous</button><button className="button button-secondary pagination-button" disabled={page >= totalPages || loading} onClick={() => changePage(page + 1)}>Next</button></div></div>
    </section>
    {editingFee && <FeeDialog title="Edit fee invoice" description={`${readText(editingUser, "name") ?? "Student"} · ${readText(editingSemester, "name") ?? "Semester"}`} onClose={() => setEditingFee(undefined)}><form className="fee-edit-form" onSubmit={form.handleSubmit(saveFee)}><div className="field-group"><label className="field-label" htmlFor="edit-fee-amount">Amount (BDT)</label><input className="field-control" id="edit-fee-amount" type="number" min="0.01" step="0.01" {...form.register("amount")} />{form.formState.errors.amount?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.amount.message}</p>}</div><div className="field-group"><label className="field-label" htmlFor="edit-fee-due-date">Due date</label><input className="field-control" id="edit-fee-due-date" type="date" {...form.register("dueDate")} />{form.formState.errors.dueDate?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.dueDate.message}</p>}</div><div className="header-button-group"><button className="button button-secondary" type="button" onClick={() => setEditingFee(undefined)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spinner" size={16} /> : <Save size={16} />}{saving ? "Saving changes" : "Save changes"}</button></div></form></FeeDialog>}
  </>;
}

export function AdminFees() {
  const [creating, setCreating] = useState(false);
  return <><PageHeader title="Fees" description="Review, edit, or create student fee invoices." /><AdminFeeRegistry onCreate={() => setCreating(true)} />{creating && <FeeDialog title="Create fee invoice" description="Create a student fee from a real account and semester record." onClose={() => setCreating(false)}><AdminFeeInvoice embedded onBack={() => setCreating(false)} /></FeeDialog>}</>;
}

function feeStatus(record: ApiRecord): { label: string; tone: string; icon: typeof Check; paid: boolean; payable: boolean } {
  const status = (readText(record, "status") ?? "unknown").trim().toLowerCase().replace(/[_-]+/g, " ");
  const dueDate = readText(record, "dueDate");
  const paidByFlag = readBoolean(record, "isPaid");
  const paid = paidByFlag ?? ["paid", "completed", "success"].includes(status);
  const unpaid = paidByFlag === false || ["unpaid", "pending", "initiated"].includes(status);
  if (paid) return { label: "Paid", tone: "tone-success", icon: Check, paid: true, payable: false };
  if (unpaid && isPastDue(dueDate)) return { label: "Overdue", tone: "tone-danger", icon: AlertCircle, paid: false, payable: true };
  if (unpaid) return { label: "Due", tone: "tone-warning", icon: Clock3, paid: false, payable: true };
  return { label: status === "unknown" ? "Unknown" : humanize(status), tone: "tone-neutral", icon: AlertCircle, paid: false, payable: false };
}

function FeeTicket({ fee, paying, disabled, retrySeconds, onPay }: { fee: ApiRecord; paying: boolean; disabled: boolean; retrySeconds: number; onPay: (feeId: string) => void }) {
  const semester = asRecord(fee.semester);
  const title = readText(fee, "title") ?? readText(fee, "feeType") ?? `${readText(semester ?? {}, "name") ?? "Semester"} fee`;
  const amount = readNumber(fee, "amount");
  const dueDate = readText(fee, "dueDate");
  const status = feeStatus(fee);
  const StatusIcon = status.icon;
  const feeDate = readText(fee, "createdAt");
  const feeId = readText(fee, "id");
  const paid = status.paid;
  const payable = status.payable;
  return <article className={`fee-ticket${status.label === "Overdue" ? " is-overdue" : ""}`}>
    <div className="ticket-content"><div className="ticket-description"><div className="ticket-title-line"><span className="ticket-icon"><ReceiptText size={18} /></span><div><h2>{title}</h2><p>{readText(semester ?? {}, "name") ?? "University fee"}</p></div></div><div className="ticket-meta"><span>{dueDate ? `Due ${formatDate(dueDate)}` : "Due date unavailable"}</span><span className={`status-pill ${status.tone}`}><StatusIcon size={14} />{status.label}</span></div></div><div className="ticket-value"><strong>{amount !== undefined ? formatMoney(amount) : "—"}</strong>{feeDate && <small>Issued {formatDate(feeDate)}</small>}{feeId && payable && <button className="button button-bkash" type="button" disabled={disabled || retrySeconds > 0} onClick={() => onPay(feeId)}>{paying && <LoaderCircle className="spinner" size={16} />}{retrySeconds > 0 ? `Try again in ${retrySeconds}s` : paying ? "Redirecting to bKash" : "Pay with bKash"}</button>}{paid && readText(fee, "paymentId") && <Link className="button button-secondary" href={`/student/payments/${encodeURIComponent(readText(fee, "paymentId")!)}`}>View receipt</Link>}{payable && <small className="payment-note">You’ll be redirected to bKash to finish payment.</small>}</div></div>
  </article>;
}

export function StudentFees() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingFeeId, setPayingFeeId] = useState("");
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/fees/my", { params: { page, limit: pageSize, sortOrder } })
      .then(({ data }) => { if (active) setRows(findRows(data, ["fees"])); })
      .catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load fees. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, sortOrder]);

  const fees = useMemo(() => rows.map(asRecord).filter((item): item is ApiRecord => Boolean(item)), [rows]);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setInterval(() => setRetrySeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [retrySeconds]);

  async function initiatePayment(feeId: string) {
    if (payingFeeId || retrySeconds > 0) return;
    setPayingFeeId(feeId);
    setError("");
    try {
      const { data } = await api.post<{ checkoutUrl?: unknown }>("/payments/initiate", { feeId });
      if (typeof data.checkoutUrl !== "string") throw new Error("The API response did not contain a checkout URL.");
      const checkoutUrl = new URL(data.checkoutUrl);
      const safeHttps = checkoutUrl.protocol === "https:" || checkoutUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(checkoutUrl.hostname);
      if (!safeHttps) throw new Error("The payment API returned an unsafe checkout URL.");
      window.location.assign(checkoutUrl.toString());
    } catch (reason) {
      const response = typeof reason === "object" && reason !== null && "response" in reason ? (reason as { response?: { status?: number; headers?: Record<string, unknown> } }).response : undefined;
      if (response?.status === 429) {
        const headerValue = Number(response.headers?.["retry-after"]);
        setRetrySeconds(Number.isFinite(headerValue) && headerValue > 0 ? Math.min(headerValue, 120) : 30);
      }
      const message = apiErrorMessage(reason, reason instanceof Error && reason.message ? reason.message : "Couldn’t start the payment. Check your connection and try again.");
      setError(message);
      toast.error(message);
    } finally {
      setPayingFeeId("");
    }
  }
  function updateQuery(values: { page?: number; sortOrder?: string }) {
    const next = new URLSearchParams(queryString);
    if (values.sortOrder) next.set("sortOrder", values.sortOrder);
    next.set("page", String(values.page ?? 1));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return <>
    <PageHeader title="Fees" description="Review your invoices and due dates." />
    <div className="filter-bar fee-filter"><span className="filter-context">Your invoices</span><button className="button button-ghost sort-toggle" onClick={() => updateQuery({ sortOrder: sortOrder === "desc" ? "asc" : "desc" })}>{sortOrder === "desc" ? "Newest first" : "Oldest first"}</button></div>
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => router.refresh()}>Try again</button></div>}
    {loading && !fees.length ? <div className="fee-skeleton-list">{Array.from({ length: 4 }, (_, index) => <div key={index} />)}</div> : fees.length ? <div className="fee-list">{fees.map((fee, index) => <FeeTicket key={readText(fee, "id") ?? index} fee={fee} paying={payingFeeId === readText(fee, "id")} disabled={Boolean(payingFeeId)} retrySeconds={retrySeconds} onPay={initiatePayment} />)}</div> : !error && <section className="empty-panel"><div className="empty-icon"><ReceiptText size={22} /></div><h2>No fees yet</h2><p>Invoices for your semesters will appear here.</p></section>}
    <div className="pagination-bar fee-pagination"><span>Page {page}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => updateQuery({ page: page - 1 })}>Previous</button><button className="button button-secondary pagination-button" disabled={fees.length < pageSize || loading} onClick={() => updateQuery({ page: page + 1 })}>Next</button></div></div>
  </>;
}