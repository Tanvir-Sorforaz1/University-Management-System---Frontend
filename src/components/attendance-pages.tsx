"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CalendarCheck, Check, Clock3, Eye, LoaderCircle, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, readText, type ApiRecord } from "@/lib/api-data";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";
type StudentEntry = { key: number; studentId: string; status: AttendanceStatus };

const statusOptions: { value: AttendanceStatus; label: string; icon: typeof Check }[] = [
  { value: "PRESENT", label: "Present", icon: Check },
  { value: "ABSENT", label: "Absent", icon: X },
  { value: "LATE", label: "Late", icon: Clock3 },
];

function dhakaDateInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function AttendanceStatusBadge({ status }: { status: string }) {
  const normalized = status.trim().toUpperCase();
  const option = statusOptions.find((item) => item.value === normalized);
  const Icon = option?.icon ?? AlertCircle;
  const tone = normalized === "PRESENT" ? "tone-success" : normalized === "ABSENT" ? "tone-danger" : normalized === "LATE" ? "tone-warning" : "tone-neutral";
  return <span className={`status-pill ${tone}`}><Icon size={14} />{option?.label ?? normalized.toLowerCase().replace(/[_-]+/g, " ")}</span>;
}

function nestedRecord(record: ApiRecord, key: string): ApiRecord {
  return asRecord(record[key]) ?? {};
}

export function FacultyAttendance() {
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [semesterId, setSemesterId] = useState("");
  const [date, setDate] = useState("");
  const [entries, setEntries] = useState<StudentEntry[]>([{ key: 1, studentId: "", status: "PRESENT" }]);
  const [error, setError] = useState("");
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDate(dhakaDateInput());
    let active = true;
    api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } }).then(({ data }) => {
      if (!active) return;
      const values = findRows(data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
      setSemesters(values);
      setSemesterId(readText(values[0] ?? {}, "id") ?? "");
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load semesters. Check your connection and try again.")); })
      .finally(() => { if (active) setLoadingSemesters(false); });
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => entries.reduce((total, entry) => ({ ...total, [entry.status]: total[entry.status] + 1 }), { PRESENT: 0, ABSENT: 0, LATE: 0 }), [entries]);

  function updateEntry(key: number, values: Partial<StudentEntry>) {
    setEntries((current) => current.map((entry) => entry.key === key ? { ...entry, ...values } : entry));
    setError("");
  }

  async function save() {
    const normalized = entries.map((entry) => ({ ...entry, studentId: entry.studentId.trim() }));
    if (!semesterId || !date) {
      setError("Choose a semester and date before saving attendance.");
      return;
    }
    if (normalized.some((entry) => !entry.studentId)) {
      setError("Enter a student profile ID for each row.");
      return;
    }
    if (new Set(normalized.map((entry) => entry.studentId)).size !== normalized.length) {
      setError("Each student profile ID can appear only once per attendance date.");
      return;
    }

    setSaving(true);
    setError("");
    const outcomes = await Promise.allSettled(normalized.map((entry) => api.post("/attendance", {
      semesterId,
      studentId: entry.studentId,
      date,
      status: entry.status,
    })));
    const failed = outcomes.filter((outcome) => outcome.status === "rejected");
    if (failed.length) {
      const firstError = failed[0].status === "rejected" ? failed[0].reason : undefined;
      const savedCount = outcomes.length - failed.length;
      setError(`${apiErrorMessage(firstError, "Some attendance records could not be saved.")}${savedCount ? ` ${savedCount} record${savedCount === 1 ? "" : "s"} did save.` : ""}`);
      toast.error("Couldn’t save all attendance records.");
    } else {
      const displayDate = formatDate(date);
      toast.success(`Attendance saved for ${displayDate}.`);
      setEntries([{ key: Date.now(), studentId: "", status: "PRESENT" }]);
    }
    setSaving(false);
  }

  return <>
    <PageHeader title="Attendance" description="Record daily attendance by student profile ID." />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    <section className="attendance-workbench">
      <div className="attendance-controls">
        <div className="field-group"><label className="field-label" htmlFor="attendance-semester">Semester</label><select id="attendance-semester" className="field-control" value={semesterId} onChange={(event) => setSemesterId(event.target.value)} disabled={loadingSemesters || !semesters.length}><option value="">{loadingSemesters ? "Loading semesters…" : "Select a semester"}</option>{semesters.map((semester) => {
          const id = readText(semester, "id");
          return id ? <option key={id} value={id}>{readText(semester, "name") ?? "Semester"}{readText(semester, "department") ? ` · ${readText(semester, "department")}` : ""}</option> : null;
        })}</select></div>
        <div className="field-group"><label className="field-label" htmlFor="attendance-date">Date</label><input id="attendance-date" type="date" className="field-control" max={dhakaDateInput()} value={date} onChange={(event) => setDate(event.target.value)} /></div>
      </div>
      <div className="attendance-roster-heading"><div><h2>Student records</h2><p>Roster lookup is not available for faculty accounts. Enter student profile IDs.</p></div><button className="button button-ghost" disabled={entries.length >= 50} onClick={() => setEntries((current) => [...current, { key: Date.now() + current.length, studentId: "", status: "PRESENT" }])}><Plus size={17} />Add student</button></div>
      <div className="attendance-entry-list">{entries.map((entry, index) => <div className="attendance-entry" key={entry.key}><span className="entry-number">{index + 1}</span><div className="field-group"><label className="field-label" htmlFor={`student-profile-${entry.key}`}>Student profile ID</label><input id={`student-profile-${entry.key}`} className="field-control" value={entry.studentId} onChange={(event) => updateEntry(entry.key, { studentId: event.target.value })} placeholder="Paste student profile ID" autoComplete="off" /></div><div className="attendance-segment" role="group" aria-label={`Attendance status for student ${index + 1}`}>{statusOptions.map(({ value, label, icon: Icon }) => <button type="button" key={value} className={`attendance-option ${value.toLowerCase()}${entry.status === value ? " is-selected" : ""}`} aria-pressed={entry.status === value} onClick={() => updateEntry(entry.key, { status: value })}><Icon size={15} /><span>{label}</span></button>)}</div><button className="icon-button remove-entry" type="button" aria-label={`Remove student ${index + 1}`} disabled={entries.length === 1} onClick={() => setEntries((current) => current.filter((item) => item.key !== entry.key))}><Trash2 size={17} /></button></div>)}</div>
      <div className="attendance-sticky-bar"><div className="attendance-counts"><span><i className="attendance-dot present" />{counts.PRESENT} present</span><span><i className="attendance-dot absent" />{counts.ABSENT} absent</span><span><i className="attendance-dot late" />{counts.LATE} late</span></div><button className="button button-primary" disabled={saving} onClick={save}>{saving && <LoaderCircle className="spinner" size={17} />}{saving ? "Saving attendance" : "Save attendance"}</button></div>
    </section>
    <FacultyAttendanceLookup />
  </>;
}

export function StudentAttendance() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>("/attendance/my").then(({ data }) => { if (active) setRows(findRows(data, ["attendance", "records"])); })
      .catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load attendance. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const records = useMemo(() => rows.map(asRecord).filter((row): row is ApiRecord => Boolean(row)), [rows]);
  const counts = records.reduce<{ PRESENT: number; ABSENT: number; LATE: number }>((total, row) => {
    const status = (readText(row, "status") ?? "").toUpperCase();
    if (status === "PRESENT" || status === "ABSENT" || status === "LATE") total[status] += 1;
    return total;
  }, { PRESENT: 0, ABSENT: 0, LATE: 0 });

  return <>
    <PageHeader title="Attendance" description="Review attendance records returned for your account." />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRetry((count) => count + 1)}>Try again</button></div>}
    {!loading && records.length > 0 && <div className="attendance-summary-grid"><article><span>Present</span><strong>{counts.PRESENT}</strong></article><article><span>Absent</span><strong>{counts.ABSENT}</strong></article><article><span>Late</span><strong>{counts.LATE}</strong></article><p>Counts reflect the records returned on this page.</p></div>}
    <section className="data-panel attendance-student-panel"><div className="data-panel-heading"><div><h2>Attendance records</h2><p>{loading ? "Loading records…" : `${records.length} records returned`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>
      {loading && !records.length ? <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : records.length ? <div className="attendance-student-list">{records.map((record, index) => {
        const semester = nestedRecord(record, "semester");
        const course = nestedRecord(record, "course");
        const status = readText(record, "status") ?? "UNKNOWN";
        return <article className="attendance-student-row" key={readText(record, "id") ?? index}><span className="attendance-record-icon"><CalendarCheck size={19} /></span><div className="attendance-record-main"><strong>{readText(course, "title") ?? readText(semester, "name") ?? "Class attendance"}</strong><small>{readText(course, "code") ?? readText(semester, "department") ?? "University record"}</small></div><span className="attendance-record-date">{readText(record, "date") ? formatDate(readText(record, "date")!) : "—"}</span><AttendanceStatusBadge status={status} /></article>;
      })}</div> : !error && <div className="empty-state"><div className="empty-icon"><CalendarCheck size={22} /></div><h2>No attendance recorded yet</h2><p>Attendance records will appear after your faculty submits them.</p></div>}
    </section>
  </>;
}

const attendanceIdSchema = z.object({ attendanceId: z.string().trim().min(1, "Enter an attendance ID.") });
type AttendanceLookupValues = z.infer<typeof attendanceIdSchema>;

function AttendanceDetails({ record }: { record: ApiRecord }) {
  const student = nestedRecord(record, "student");
  const semester = nestedRecord(record, "semester");
  const course = nestedRecord(record, "course");
  const details: [string, string][] = [
    ["Student", readText(student, "name") ?? "—"],
    ["Student profile ID", readText(record, "studentId") ?? readText(student, "id") ?? "—"],
    ["Semester", readText(semester, "name") ?? "—"],
    ["Course", readText(course, "title") ?? readText(course, "name") ?? "—"],
    ["Date", readText(record, "date") ? formatDate(readText(record, "date")!) : "—"],
    ["Marked by", readText(nestedRecord(record, "markedBy"), "name") ?? "—"],
  ];
  return <dl className="facts-list attendance-facts">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === "Date" ? value : value}</dd></div>)}<div><dt>Status</dt><dd><AttendanceStatusBadge status={readText(record, "status") ?? "UNKNOWN"} /></dd></div></dl>;
}

function AttendanceLookup({ title }: { title: string }) {
  const [record, setRecord] = useState<ApiRecord>();
  const [lookupError, setLookupError] = useState("");
  const form = useForm<AttendanceLookupValues>({ resolver: zodResolver(attendanceIdSchema), mode: "onTouched" });

  async function submit(values: AttendanceLookupValues) {
    setLookupError("");
    try {
      const { data } = await api.get<unknown>(`/attendance/${encodeURIComponent(values.attendanceId)}`);
      const found = asRecord(data) ?? asRecord(asRecord(data)?.data);
      if (!found) {
        setLookupError("The response did not contain an attendance record.");
        setRecord(undefined);
      } else setRecord(found);
    } catch (reason) {
      setRecord(undefined);
      setLookupError(apiErrorMessage(reason, "Couldn’t find that attendance record. Check the ID and try again."));
    }
  }

  return <section className="attendance-lookup"><div className="section-heading"><p className="section-kicker">Record lookup</p><h2>{title}</h2></div><form className="lookup-form" onSubmit={form.handleSubmit(submit)}><div className="field-group"><label className="field-label" htmlFor="attendanceId">Attendance ID</label><input id="attendanceId" className="field-control" placeholder="Paste attendance ID" {...form.register("attendanceId")} /></div><button className="button button-secondary" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? <LoaderCircle className="spinner" size={17} /> : <Search size={17} />}Find record</button></form>{lookupError && <div className="inline-alert" role="alert"><AlertCircle size={18} />{lookupError}</div>}{record && <div className="data-panel attendance-detail-panel"><div className="data-panel-heading"><div><h2>Attendance detail</h2><p>{readText(record, "id") ?? "Record"}</p></div><Eye size={18} /></div><AttendanceDetails record={record} /></div>}</section>;
}

export function FacultyAttendanceLookup() {
  return <AttendanceLookup title="Open an attendance record" />;
}

export function AdminAttendanceLookup() {
  return <><PageHeader title="Attendance lookup" description="Open one attendance record by its ID." /><AttendanceLookup title="Find an attendance record" /></>;
}

export function FacultyAttendanceRoster() {
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [semesterId, setSemesterId] = useState("");
  const [date, setDate] = useState(dhakaDateInput());
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } }).then(({ data }) => {
      const result = findRows(data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
      setSemesters(result);
      setSemesterId(readText(result[0] ?? {}, "id") ?? "");
    }).catch((reason: unknown) => setError(apiErrorMessage(reason, "Couldn’t load semesters. Try again.")));
  }, []);

  useEffect(() => {
    if (!semesterId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.get<unknown>("/attendance/roster", { params: { semesterId } }), api.get<unknown>("/attendance", { params: { semesterId, date } })])
      .then(([rosterResponse, attendanceResponse]) => {
        if (!active) return;
        const roster = findRows(rosterResponse.data, ["students", "roster"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
        const records = findRows(attendanceResponse.data, ["attendance", "records"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row));
        const nextStatuses: Record<string, AttendanceStatus> = {};
        records.forEach((record) => { const id = readText(record, "studentId") ?? readText(asRecord(record.student) ?? {}, "id"); const status = readText(record, "status")?.toUpperCase(); if (id && (status === "PRESENT" || status === "ABSENT" || status === "LATE")) nextStatuses[id] = status; });
        setStudents(roster);
        setStatuses(nextStatuses);
      }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load the attendance roster. Try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [semesterId, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((current) => ({ ...current, [studentId]: status }));
  }

  async function saveAttendance() {
    const entries = students.map((student) => ({ studentId: readText(student, "id"), status: statuses[readText(student, "id") ?? ""] })).filter((entry): entry is { studentId: string; status: AttendanceStatus } => Boolean(entry.studentId && entry.status));
    if (!semesterId || !entries.length) { setError("Select a semester and mark at least one student before saving."); return; }
    setSaving(true);
    setError("");
    const outcomes = await Promise.allSettled(entries.map((entry) => api.post("/attendance", { semesterId, studentId: entry.studentId, date, status: entry.status })));
    const failed = outcomes.filter((result) => result.status === "rejected");
    if (failed.length) { setError(`Couldn’t save ${failed.length} attendance record${failed.length === 1 ? "" : "s"}. Try again.`); toast.error("Couldn’t save all attendance records."); }
    else toast.success(`Attendance saved for ${formatDate(date)}.`);
    setSaving(false);
  }

  const count = (status: AttendanceStatus) => Object.values(statuses).filter((value) => value === status).length;
  return <><PageHeader title="Attendance" description="Mark attendance for every student in your semester." />{error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}<section className="attendance-workbench"><div className="attendance-controls"><div className="field-group"><label className="field-label" htmlFor="roster-semester">Semester</label><select id="roster-semester" className="field-control" value={semesterId} onChange={(event) => setSemesterId(event.target.value)}><option value="">Select a semester</option>{semesters.map((semester) => { const id = readText(semester, "id"); return id ? <option key={id} value={id}>{readText(semester, "name") ?? "Semester"}</option> : null; })}</select></div><div className="field-group"><label className="field-label" htmlFor="roster-date">Date</label><input id="roster-date" className="field-control" type="date" max={dhakaDateInput()} value={date} onChange={(event) => setDate(event.target.value)} /></div></div><div className="attendance-roster-heading"><div><h2>Student roster</h2><p>Existing statuses load when you choose a date.</p></div><div className="attendance-counts"><span><i className="attendance-dot present" />{count("PRESENT")} present</span><span><i className="attendance-dot absent" />{count("ABSENT")} absent</span><span><i className="attendance-dot late" />{count("LATE")} late</span></div></div>{loading ? <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : students.length ? <div className="faculty-roster-list">{students.map((student, index) => { const id = readText(student, "id") ?? String(index); const user = asRecord(student.user) ?? {}; const status = statuses[id]; return <div className="faculty-roster-row" key={id}><div className="user-identity"><span className="user-avatar">{(readText(user, "name") ?? "S").slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{readText(user, "name") ?? "Student"}</strong><small>{readText(user, "email") ?? readText(student, "studentId") ?? "—"}</small></span></div><div className="attendance-segment" role="group" aria-label={`Attendance for ${readText(user, "name") ?? "student"}`}>{statusOptions.map(({ value, label, icon: Icon }) => <button className={`attendance-option ${value.toLowerCase()}${status === value ? " is-selected" : ""}`} type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(id, value)}><Icon size={15} />{label}</button>)}</div></div>; })}</div> : <div className="empty-state"><div className="empty-icon"><CalendarCheck size={22} /></div><h2>No students enrolled</h2><p>No student roster was returned for this semester.</p></div>}<div className="attendance-sticky-bar"><div className="attendance-counts"><span><i className="attendance-dot present" />{count("PRESENT")} present</span><span><i className="attendance-dot absent" />{count("ABSENT")} absent</span><span><i className="attendance-dot late" />{count("LATE")} late</span></div><button className="button button-primary" disabled={saving || loading} onClick={saveAttendance}>{saving && <LoaderCircle className="spinner" size={17} />}{saving ? "Saving attendance" : "Save attendance"}</button></div></section></>;
}