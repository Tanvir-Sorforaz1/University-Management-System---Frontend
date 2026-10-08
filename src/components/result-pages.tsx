"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, Award, Check, FileText, LoaderCircle, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, readNumber, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

const resultSchema = z.object({
  examId: z.string().trim().min(1, "Enter an exam ID."),
  studentId: z.string().trim().min(1, "Enter a student profile ID."),
  marksObtained: z.coerce.number().min(0, "Marks can’t be below zero."),
  remarks: z.string().trim().max(300, "Remarks can’t exceed 300 characters."),
});

type ResultValues = z.infer<typeof resultSchema>;
type ResultInput = z.input<typeof resultSchema>;

const correctionSchema = z.object({
  examId: z.string().trim().min(1, "Select an exam."),
  studentId: z.string().trim().min(1, "Select a student."),
  marksObtained: z.coerce.number().min(0, "Marks can’t be below zero."),
  remarks: z.string().trim().max(300, "Remarks can’t exceed 300 characters."),
});
type CorrectionValues = z.infer<typeof correctionSchema>;
type CorrectionInput = z.input<typeof correctionSchema>;

function FormField({ id, label, registration, error, type = "text", placeholder }: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return <div className="field-group"><label className="field-label" htmlFor={id}>{label}</label><input className="field-control" id={id} type={type} placeholder={placeholder} inputMode={type === "number" ? "decimal" : undefined} aria-invalid={Boolean(error)} {...registration} />{error && <p className="field-error"><AlertCircle size={16} />{error}</p>}</div>;
}

function unwrapRecord(data: unknown) {
  return asRecord(unwrapPayload(data));
}

export function FacultyResults({ role }: { role: "faculty" | "admin" }) {
  const [exam, setExam] = useState<ApiRecord>();
  const [examError, setExamError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [savedResponse, setSavedResponse] = useState<unknown>();
  const [saving, setSaving] = useState(false);
  const [exams, setExams] = useState<ApiRecord[]>([]);
  const [students, setStudents] = useState<ApiRecord[]>([]);
  const [existingResults, setExistingResults] = useState<ApiRecord[]>([]);
  const form = useForm<ResultInput, unknown, ResultValues>({ resolver: zodResolver(resultSchema), mode: "onTouched", defaultValues: { examId: "", studentId: "", marksObtained: 0, remarks: "" } });
  const correctionForm = useForm<CorrectionInput, unknown, CorrectionValues>({ resolver: zodResolver(correctionSchema), mode: "onTouched", defaultValues: { examId: "", studentId: "", marksObtained: 0, remarks: "" } });
  const examId = form.watch("examId");
  const remarks = form.watch("remarks") ?? "";

  useEffect(() => {
    if (role !== "faculty") return;
    api.get<unknown>("/exams/mine", { params: { sortOrder: "asc" } }).then(({ data }) => setExams(findRows(data, ["exams"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)))).catch((reason: unknown) => setExamError(apiErrorMessage(reason, "Couldn’t load your exams. Try again.")));
  }, [role]);

  async function loadExam(selectedExamId?: string) {
    const id = String(selectedExamId ?? examId ?? "").trim();
    setStudents([]);
    setExistingResults([]);
    form.setValue("studentId", "");
    correctionForm.setValue("studentId", "");
    if (!id) { setExam(undefined); setExamError(""); return; }
    setExamError("");
    try {
      const { data } = await api.get<unknown>(`/exams/${encodeURIComponent(id)}`);
      const record = unwrapRecord(data);
      if (!record) { setExam(undefined); setExamError("The response did not contain an exam record."); return; }
      setExam(record);
      const semester = asRecord(record.semester);
      const semesterId = readText(semester ?? {}, "id");
      if (semesterId) {
        const roster = await api.get<unknown>("/attendance/roster", { params: { semesterId } });
        setStudents(findRows(roster.data, ["students", "roster"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
      }
      const resultResponse = await api.get<unknown>("/results", { params: { examId: id } });
      setExistingResults(findRows(resultResponse.data, ["results"] ).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
    } catch (reason) {
      setExam(undefined);
      setExamError(apiErrorMessage(reason, "Couldn’t load exam details. Verify the exam ID and try again."));
    }
  }

  async function saveResult(values: ResultValues) {
    const total = exam ? readNumber(exam, "totalMarks") : undefined;
    if (total !== undefined && values.marksObtained > total) {
      form.setError("marksObtained", { message: `Marks can’t be more than the exam’s total (${total}).` });
      return;
    }
    setSubmitError("");
    setSavedResponse(undefined);
    setSaving(true);
    try {
      const { data } = await api.post<unknown>("/results", {
        examId: values.examId,
        studentId: values.studentId,
        marksObtained: values.marksObtained,
        ...(values.remarks ? { remarks: values.remarks } : {}),
      });
      setSavedResponse(data);
      toast.success("Result saved. Transcript updated.");
      form.reset({ examId: values.examId, studentId: "", marksObtained: 0, remarks: "" });
    } catch (reason) {
      const message = apiErrorMessage(reason, "Couldn’t save the result. Check the values and try again.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function correctResult(values: CorrectionValues) {
    const existing = existingResults.find((result) => (readText(result, "studentId") ?? readText(asRecord(result.student) ?? {}, "id")) === values.studentId);
    const resultId = readText(existing ?? {}, "id");
    if (!resultId) {
      toast.error("No saved result exists for this student and exam.");
      return;
    }
    const confirmation = await Swal.fire({
      title: "Save this correction?",
      text: "This change is recorded in the audit log and recalculates the student’s transcript.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Save correction",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setSaving(true);
    setSubmitError("");
    try {
      await api.patch(`/results/${encodeURIComponent(resultId)}`, {
        marksObtained: values.marksObtained,
        ...(values.remarks ? { remarks: values.remarks } : {}),
      });
      toast.success("Changes saved.");
      correctionForm.reset();
    } catch (reason) {
      const message = apiErrorMessage(reason, "Couldn’t save this correction. Try again.");
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <PageHeader title="Results" description={role === "faculty" ? "Save a student result or record an audited correction." : "Record an audited correction to an existing result."} />
    {submitError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{submitError}</span></div>}
    {role === "admin" && <div className="inline-alert info-alert"><AlertCircle size={18} /><span>Result corrections are audit-logged and recalculate the student’s transcript.</span></div>}
    {role === "faculty" && <div className="result-workbench"><section className="form-panel result-form-panel"><div className="section-heading"><p className="section-kicker">Faculty entry</p><h2>Save result</h2></div><form className="form-stack" onSubmit={form.handleSubmit(saveResult)}>
      <div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="examId">Exam</label><select id="examId" className="field-control" {...form.register("examId", { onChange: (event) => { void loadExam(event.target.value); } })}><option value="">Select one of your exams</option>{exams.map((item) => { const id = readText(item, "id"); return id ? <option key={id} value={id}>{readText(item, "title") ?? "Exam"}</option> : null; })}</select>{form.formState.errors.examId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.examId.message}</p>}</div><div className="field-group"><label className="field-label" htmlFor="studentId">Student</label><select id="studentId" className="field-control" {...form.register("studentId")}><option value="">Select a student</option>{students.map((student) => { const id = readText(student, "id"); const user = asRecord(student.user) ?? {}; return id ? <option key={id} value={id}>{readText(user, "name") ?? readText(student, "studentId") ?? id}</option> : null; })}</select>{form.formState.errors.studentId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.studentId.message}</p>}</div></div>
      {examError && <div className="inline-alert" role="alert"><AlertCircle size={18} />{examError}</div>}
      {exam && <div className="exam-context"><FileText size={18} /><span><strong>{readText(exam, "title") ?? "Exam record"}</strong><small>{readNumber(exam, "totalMarks") !== undefined ? `Marks out of ${readNumber(exam, "totalMarks")}` : "Maximum marks not returned"}</small></span></div>}
      <div className="field-group"><label className="field-label" htmlFor="marksObtained">Marks obtained</label><div className="result-marks-wrap"><input className="field-control numeric-input" id="marksObtained" type="number" min="0" max={exam ? readNumber(exam, "totalMarks") : undefined} inputMode="decimal" {...form.register("marksObtained")} /><span>{exam && readNumber(exam, "totalMarks") !== undefined ? `out of ${readNumber(exam, "totalMarks")}` : "marks"}</span></div>{form.formState.errors.marksObtained?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.marksObtained.message}</p>}</div>
      <div className="field-group"><label className="field-label" htmlFor="remarks">Remarks (optional)</label><textarea className="field-control result-remarks" id="remarks" maxLength={300} {...form.register("remarks")} /><span className="character-count">{remarks.length} / 300</span></div>
      <button className="button button-primary" disabled={saving} type="submit">{saving && <LoaderCircle className="spinner" size={17} />}<Save size={17} />{saving ? "Saving result" : "Save result"}</button>
    </form>{savedResponse !== undefined && <ResultSaveSummary response={savedResponse} />}</section>
    {role === "faculty" && exam && <section className="data-panel correction-panel"><div className="data-panel-heading"><div><h2>Published results</h2><p>{existingResults.length} results for this exam</p></div></div>{existingResults.length ? existingResults.map((result, index) => { const student = asRecord(result.student) ?? {}; const user = asRecord(student.user) ?? {}; return <div className="student-result-row" key={readText(result, "id") ?? index}><span><strong>{readText(user, "name") ?? readText(student, "studentId") ?? "Student"}</strong><small>{readText(user, "email") ?? ""}</small></span><b>{readNumber(result, "marksObtained") ?? "—"}</b><span>{readText(result, "grade") ?? "—"}</span></div>; }) : <div className="student-empty-copy">No results saved for this exam yet.</div>}</section>}</div>}
    <section className="data-panel correction-panel"><div className="data-panel-heading"><div><h2>Correct an existing result</h2><p>Select the exam and student, then save the correction.</p></div><RefreshCw size={18} /></div><form className="form-stack correction-form" onSubmit={correctionForm.handleSubmit(correctResult)}><div className="form-grid"><div className="field-group"><label className="field-label" htmlFor="correctionExamId">Exam</label><select id="correctionExamId" className="field-control" {...correctionForm.register("examId", { onChange: (event) => { form.setValue("examId", event.target.value); void loadExam(); } })}><option value="">Select an exam</option>{exams.map((item) => { const id = readText(item, "id"); return id ? <option key={id} value={id}>{readText(item, "title") ?? "Exam"}</option> : null; })}</select>{correctionForm.formState.errors.examId?.message && <p className="field-error">{correctionForm.formState.errors.examId.message}</p>}</div><div className="field-group"><label className="field-label" htmlFor="correctionStudentId">Student</label><select id="correctionStudentId" className="field-control" {...correctionForm.register("studentId")}><option value="">Select a student</option>{students.map((student) => { const id = readText(student, "id"); const user = asRecord(student.user) ?? {}; return id ? <option key={id} value={id}>{readText(user, "name") ?? readText(student, "studentId") ?? id}</option> : null; })}</select>{correctionForm.formState.errors.studentId?.message && <p className="field-error">{correctionForm.formState.errors.studentId.message}</p>}</div></div><div className="form-grid"><FormField id="correctionMarks" label="Marks obtained" type="number" registration={correctionForm.register("marksObtained")} error={correctionForm.formState.errors.marksObtained?.message} /><FormField id="correctionRemarks" label="Correction remarks" registration={correctionForm.register("remarks")} error={correctionForm.formState.errors.remarks?.message} /></div><button className="button button-secondary" type="submit" disabled={saving}>{saving && <LoaderCircle className="spinner" size={17} />}Save correction</button></form></section>
  </>;
}

export function FacultyExamResults({ examId }: { examId: string }) {
  const [exam, setExam] = useState<ApiRecord>();
  const [results, setResults] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([api.get<unknown>(`/exams/${encodeURIComponent(examId)}`), api.get<unknown>("/results", { params: { examId } })]).then(([examResponse, resultsResponse]) => {
      if (!active) return;
      setExam(unwrapRecord(examResponse.data));
      setResults(findRows(resultsResponse.data, ["results"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
    }).catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load exam results. Try again.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId]);
  return <><div className="breadcrumbs"><Link href="/faculty/results">Results</Link><span>/</span><span>{readText(exam ?? {}, "title") ?? "Exam results"}</span></div><PageHeader title={readText(exam ?? {}, "title") ?? "Exam results"} description="Marks published for every student in this exam." />{error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}<section className="data-panel exam-results-panel"><div className="data-panel-heading"><div><h2>Student marks</h2><p>{loading ? "Loading results…" : `${results.length} results saved`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>{loading ? <div className="table-skeleton">{[0, 1, 2, 3, 4].map((item) => <span key={item} />)}</div> : results.length ? <table className="data-table"><thead><tr><th scope="col">Student</th><th scope="col">Email</th><th scope="col">Marks</th><th scope="col">Grade</th><th scope="col">Remarks</th></tr></thead><tbody>{results.map((result, index) => { const student = asRecord(result.student) ?? {}; const user = asRecord(student.user) ?? {}; return <tr key={readText(result, "id") ?? index}><td><strong>{readText(user, "name") ?? readText(student, "studentId") ?? "Student"}</strong></td><td>{readText(user, "email") ?? "—"}</td><td className="numeric-cell">{readNumber(result, "marksObtained") ?? "—"}</td><td>{readText(result, "grade") ?? "—"}</td><td>{readText(result, "remarks") ?? "—"}</td></tr>; })}</tbody></table> : <div className="empty-state"><div className="empty-icon"><Award size={22} /></div><h2>No results saved</h2><p>Use the results form to publish marks for this exam.</p></div>}</section></>;
}

function ResultSaveSummary({ response }: { response: unknown }) {
  const record = unwrapRecord(response);
  const grade = readText(record ?? {}, "grade");
  const marks = readNumber(record ?? {}, "marksObtained");
  const gpa = readNumber(record ?? {}, "gpaPoints");
  return <div className="result-save-summary"><div className="success-icon"><Check size={20} /></div><div><strong>Result saved. Transcript recalculated.</strong>{record ? <p>{[marks !== undefined ? `${marks} marks` : "", grade ? `Grade ${grade}` : "", gpa !== undefined ? `GPA ${gpa.toFixed(2)}` : ""].filter(Boolean).join(" · ") || "The API returned a result record without summary fields."}</p> : <p>The API accepted the request but did not return result details.</p>}</div></div>;
}

function GradeBadge({ grade }: { grade?: string }) {
  if (!grade) return <span className="grade-badge tone-neutral">—</span>;
  const first = grade.trim().charAt(0).toUpperCase();
  const tone = first === "A" ? "tone-success" : first === "B" ? "tone-info" : first === "C" ? "tone-warning" : first === "F" ? "tone-danger" : "tone-neutral";
  return <span className={`grade-badge ${tone}`}>{grade}</span>;
}

function ResultRecord({ record }: { record: ApiRecord }) {
  const exam = asRecord(record.exam) ?? {};
  const semester = asRecord(record.semester) ?? asRecord(exam.semester) ?? {};
  const examId = readText(record, "examId") ?? readText(exam, "id");
  const marks = readNumber(record, "marksObtained");
  const total = readNumber(record, "totalMarks") ?? readNumber(exam, "totalMarks");
  const grade = readText(record, "grade");
  const progress = marks !== undefined && total !== undefined && total > 0 ? Math.max(0, Math.min(100, marks / total * 100)) : undefined;
  const title = readText(exam, "title") ?? readText(record, "examTitle") ?? "Exam result";
  return <article className="result-record"><div className="result-record-main"><div><h3>{examId ? <Link href={`/student/exams/${encodeURIComponent(examId)}`}>{title}</Link> : title}</h3><p>{readText(semester, "name") ?? "Semester not returned"}{readText(exam, "type") ? ` · ${readText(exam, "type")!.toLowerCase()}` : ""}</p></div><GradeBadge grade={grade} /></div>{progress !== undefined && <div className="result-progress-line"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{marks} / {total}</span></div>}{readText(record, "remarks") && <p className="result-remarks-text">{readText(record, "remarks")}</p>}</article>;
}

export function StudentResults() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [transcript, setTranscript] = useState<ApiRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.allSettled([api.get<unknown>("/results/my"), api.get<unknown>("/transcripts/my")]).then(([resultsResponse, transcriptResponse]) => {
      if (!active) return;
      if (resultsResponse.status === "fulfilled") setRows(findRows(resultsResponse.value.data, ["results"]));
      else setError(apiErrorMessage(resultsResponse.reason, "Couldn’t load results. Check your connection and try again."));
      if (transcriptResponse.status === "fulfilled") setTranscript(unwrapRecord(transcriptResponse.value.data));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  const results = useMemo(() => rows.map(asRecord).filter((row): row is ApiRecord => Boolean(row)), [rows]);
  const cgpa = transcript ? readNumber(transcript, "cgpa") ?? readNumber(transcript, "CGPA") : undefined;
  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; rows: ApiRecord[] }>();
    for (const result of results) {
      const semester = asRecord(result.semester) ?? asRecord(asRecord(result.exam)?.semester) ?? {};
      const semesterId = readText(result, "semesterId") ?? readText(semester, "id") ?? "current";
      const label = readText(semester, "name") ?? "Results";
      const current = groups.get(semesterId) ?? { label, rows: [] };
      current.rows.push(result);
      groups.set(semesterId, current);
    }
    return [...groups.values()];
  }, [results]);

  return <>
    <PageHeader title="Results" description="Review grades published for your academic record." />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRetry((count) => count + 1)}>Try again</button></div>}
    {cgpa !== undefined && <section className="cgpa-strip"><span className="cgpa-icon"><Award size={21} /></span><div><small>Cumulative GPA</small><strong>{cgpa.toFixed(2)}</strong></div><Link href="/student/transcript">View transcript <ArrowRight size={16} /></Link></section>}
    <div className="results-section-heading"><div><p className="section-kicker">Published record</p><h2>Grades by semester</h2></div></div>
    {loading && !results.length ? <div className="fee-skeleton-list">{[0, 1, 2].map((index) => <div key={index} />)}</div> : grouped.length ? <div className="result-groups">{grouped.map((group, index) => <section className="result-group" key={`${group.label}-${index}`}><div className="result-group-heading"><h3>{group.label}</h3><span>{group.rows.length} {group.rows.length === 1 ? "result" : "results"}</span></div><div>{group.rows.map((result, resultIndex) => <ResultRecord key={readText(result, "id") ?? resultIndex} record={result} />)}</div></section>)}</div> : !error && <div className="empty-panel"><div className="empty-icon"><Award size={22} /></div><h2>No results published yet</h2><p>Results appear after your faculty publish them.</p></div>}
  </>;
}