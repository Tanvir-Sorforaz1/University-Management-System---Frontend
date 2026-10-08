"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, Printer, ScrollText, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArchMark } from "@/components/brand/arch-mark";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, readNumber, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";
import { BRAND } from "@/lib/brand";

function recordOf(value: unknown): ApiRecord {
  const record = asRecord(unwrapPayload(value));
  return record ?? {};
}

function transcriptRows(value: unknown): ApiRecord[] {
  const possible = findRows(value, ["semesters", "results", "courses", "records", "transcript"]);
  return possible.map(asRecord).filter((row): row is ApiRecord => Boolean(row));
}

function GradeText({ grade }: { grade?: string }) {
  if (!grade) return <span className="grade-print">—</span>;
  const first = grade.trim().charAt(0).toUpperCase();
  const tone = first === "A" ? "tone-success" : first === "B" ? "tone-info" : first === "C" ? "tone-warning" : first === "F" ? "tone-danger" : first === "D" ? "tone-d" : "tone-neutral";
  return <span className={`grade-print ${tone}`}>{grade}</span>;
}

function TranscriptRecordRow({ record }: { record: ApiRecord }) {
  const course = asRecord(record.course) ?? {};
  const exam = asRecord(record.exam) ?? {};
  const marks = readNumber(record, "marksObtained");
  const total = readNumber(record, "totalMarks") ?? readNumber(exam, "totalMarks");
  const title = readText(record, "courseTitle") ?? readText(record, "examTitle") ?? readText(course, "title") ?? readText(course, "name") ?? readText(exam, "title") ?? readText(record, "title") ?? "Academic result";
  return <tr><td>{readText(course, "code") ?? readText(record, "courseCode") ?? title}</td><td className="transcript-marks">{marks !== undefined ? `${marks}${total !== undefined ? ` / ${total}` : ""}` : "—"}</td><td><GradeText grade={readText(record, "grade")} /></td><td className="transcript-marks">{readNumber(record, "gpaPoints")?.toFixed(2) ?? readNumber(record, "gradePoint")?.toFixed(2) ?? "—"}</td></tr>;
}

function TranscriptDocument({ data, readOnly }: { data: unknown; readOnly?: boolean }) {
  const record = recordOf(data);
  const student = asRecord(record.student) ?? asRecord(record.studentProfile) ?? {};
  const rows = transcriptRows(data);
  const semesterRows = findRows(record, ["semesters"]).map(asRecord).filter((item): item is ApiRecord => Boolean(item));
  const cgpa = readNumber(record, "cgpa") ?? readNumber(record, "CGPA");
  const issued = readText(record, "issuedAt") ?? readText(record, "generatedAt") ?? readText(record, "createdAt");
  const displayName = readText(student, "name") ?? readText(record, "studentName");

  return <>
    {readOnly && <div className="inline-alert info-alert transcript-readonly"><ScrollText size={18} /><span>Viewing {displayName ?? "student"}’s transcript (read-only).</span></div>}
    <div className="transcript-toolbar no-print"><Link href="/student" className="button button-ghost"><ArrowLeft size={17} />Back</Link><button className="button button-secondary" onClick={() => window.print()}><Printer size={17} />Print / Save as PDF</button></div>
    <article className="transcript-paper paper">
      <header className="transcript-paper-header"><div className="transcript-brand"><ArchMark /><span>Academic transcript</span></div><h2>Academic transcript</h2><p>{BRAND.name}</p></header>
      <dl className="transcript-identity">{[["Name", displayName], ["Student ID", readText(student, "studentId") ?? readText(student, "id") ?? readText(record, "studentId")], ["Department", readText(student, "department") ?? readText(record, "department")], ["Issued", issued ? formatDate(issued) : undefined]].filter((item): item is [string, string] => Boolean(item[1])).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === "Issued" ? value : value}</dd></div>)}</dl>
      {readOnly && <div className="transcript-readonly-print">Read-only academic transcript</div>}
      {semesterRows.length ? semesterRows.map((semester, index) => {
        const sectionRows = findRows(semester, ["results", "courses", "records"]).map(asRecord).filter((item): item is ApiRecord => Boolean(item));
        return <section className="semester-block" key={readText(semester, "id") ?? index}><div className="transcript-semester-heading"><h2>{readText(semester, "name") ?? "Semester"}</h2><span>Semester GPA {readNumber(semester, "gpa")?.toFixed(2) ?? "—"}</span></div>{sectionRows.length ? <table className="transcript-table"><thead><tr><th scope="col">Course / exam</th><th scope="col">Marks</th><th scope="col">Grade</th><th scope="col">Points</th></tr></thead><tbody>{sectionRows.map((row, rowIndex) => <TranscriptRecordRow key={readText(row, "id") ?? rowIndex} record={row} />)}</tbody></table> : <p className="transcript-empty-line">No results have been published for this semester.</p>}</section>;
      }) : rows.length ? <section className="semester-block"><div className="transcript-semester-heading"><h2>Results</h2></div><table className="transcript-table"><thead><tr><th scope="col">Course / exam</th><th scope="col">Marks</th><th scope="col">Grade</th><th scope="col">Points</th></tr></thead><tbody>{rows.map((row, index) => <TranscriptRecordRow key={readText(row, "id") ?? index} record={row} />)}</tbody></table></section> : <p className="transcript-empty-line transcript-no-results">No results have been published yet.</p>}
      {cgpa !== undefined && <div className="transcript-cgpa"><strong>Cumulative GPA (CGPA)</strong><span>{cgpa.toFixed(2)}</span></div>}
      <footer className="transcript-footer">Generated by {BRAND.name}. Not valid without registrar stamp.</footer>
    </article>
  </>;
}

function TranscriptView({ endpoint, readOnly = false }: { endpoint: string; readOnly?: boolean }) {
  const [data, setData] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<unknown>(endpoint).then(({ data: response }) => { if (active) setData(response); })
      .catch((reason: unknown) => { if (active) setError(apiErrorMessage(reason, "Couldn’t load transcript. Check your connection and try again.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, retry]);

  if (loading) return <><PageHeader title="Transcript" description="Your academic record." /><div className="transcript-skeleton"><span /><span /><span /></div></>;
  if (error) return <><PageHeader title="Transcript" description="Your academic record." /><div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRetry((count) => count + 1)}>Try again</button></div></>;
  return <div className="transcript-view"><PageHeader title={readOnly ? "Student transcript" : "Transcript"} description={readOnly ? "Read-only academic record." : "Your academic record."} /><TranscriptDocument data={data} readOnly={readOnly} /></div>;
}

export function StudentTranscript() {
  return <TranscriptView endpoint="/transcripts/my" />;
}

const lookupSchema = z.object({ studentProfileId: z.string().trim().min(1, "Enter a student profile ID.") });
type LookupValues = z.infer<typeof lookupSchema>;

export function TranscriptLookup({ role }: { role: "faculty" | "admin" }) {
  const router = useRouter();
  const form = useForm<LookupValues>({ resolver: zodResolver(lookupSchema), mode: "onTouched" });
  function submit(values: LookupValues) {
    router.push(`/${role}/transcripts/${encodeURIComponent(values.studentProfileId)}`);
  }
  return <><PageHeader title="Transcripts" description="Open a student transcript by profile ID." /><section className="form-panel transcript-lookup-panel"><div className="section-heading"><p className="section-kicker">Student record</p><h2>Open a transcript</h2></div><form className="lookup-form" onSubmit={form.handleSubmit(submit)}><div className="field-group"><label className="field-label" htmlFor="studentProfileId">Student profile ID</label><input className="field-control" id="studentProfileId" placeholder="Paste student profile ID" {...form.register("studentProfileId")} />{form.formState.errors.studentProfileId?.message && <p className="field-error"><AlertCircle size={16} />{form.formState.errors.studentProfileId.message}</p>}</div><button className="button button-primary" type="submit"><Search size={17} />Open transcript</button></form></section></>;
}

export function OtherTranscript({ role }: { role: "faculty" | "admin" }) {
  const params = useParams<{ studentProfileId: string }>();
  const router = useRouter();
  return <><div className="breadcrumbs"><button className="breadcrumb-button" onClick={() => router.push(`/${role}/transcripts`)}>Transcripts</button><span>/</span><span>Student transcript</span></div><TranscriptView endpoint={`/transcripts/${encodeURIComponent(params.studentProfileId)}`} readOnly /></>;
}
