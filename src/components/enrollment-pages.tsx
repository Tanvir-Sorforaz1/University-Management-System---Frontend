"use client";

import { AlertCircle, ArrowRight, BookOpenCheck, Check, LoaderCircle, LockKeyhole, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, formatMoney, readBoolean, readNumber, readText, type ApiRecord } from "@/lib/api-data";

function linkedId(record: ApiRecord, key: string, nestedKey: string): string | undefined {
  return readText(record, key) ?? readText(asRecord(record[nestedKey]) ?? {}, "id");
}

function paidFee(fee: ApiRecord): boolean {
  return readBoolean(fee, "isPaid") ?? ["paid", "completed", "success"].includes((readText(fee, "status") ?? "").trim().toLowerCase());
}

function semesterName(semester: ApiRecord): string {
  return readText(semester, "name") ?? "Semester";
}

export function StudentCourses() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryString = params.toString();
  const selectedId = params.get("semesterId") ?? "";
  const [semesters, setSemesters] = useState<ApiRecord[]>([]);
  const [fees, setFees] = useState<ApiRecord[]>([]);
  const [enrollments, setEnrollments] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get<unknown>("/semesters", { params: { page: 1, limit: 50, sortOrder: "asc" } }),
      api.get<unknown>("/fees/my", { params: { page: 1, limit: 50 } }),
      api.get<unknown>("/enrollments/my"),
    ]).then(([semesterResponse, feeResponse, enrollmentResponse]) => {
      if (!active) return;
      setSemesters(findRows(semesterResponse.data, ["semesters"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
      setFees(findRows(feeResponse.data, ["fees"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
      setEnrollments(findRows(enrollmentResponse.data, ["enrollments"]).map(asRecord).filter((row): row is ApiRecord => Boolean(row)));
    }).catch((reason: unknown) => {
      if (active) setError(apiErrorMessage(reason, "Couldn’t load courses and fees. Check your connection and try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const selectedSemester = useMemo(() => semesters.find((semester) => readText(semester, "id") === selectedId) ?? semesters[0], [semesters, selectedId]);
  const semesterId = selectedSemester ? readText(selectedSemester, "id") : undefined;
  const semesterFees = fees.filter((fee) => linkedId(fee, "semesterId", "semester") === semesterId);
  const matchingFee = semesterFees[0];
  const hasPaidFee = semesterFees.some(paidFee);
  const hasKnownUnpaidFee = semesterFees.length > 0 && !hasPaidFee;
  const alreadyEnrolled = enrollments.some((enrollment) => linkedId(enrollment, "semesterId", "semester") === semesterId);

  useEffect(() => {
    if (!selectedId && semesterId) {
      const next = new URLSearchParams(queryString);
      next.set("semesterId", semesterId);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [selectedId, semesterId, pathname, queryString, router]);

  function selectSemester(id: string) {
    const next = new URLSearchParams(queryString);
    if (id) next.set("semesterId", id);
    else next.delete("semesterId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    setEnrollmentError("");
  }

  async function enroll() {
    if (!semesterId || saving || hasKnownUnpaidFee || alreadyEnrolled) return;
    setSaving(true);
    setEnrollmentError("");
    try {
      await api.post("/enrollments", { semesterId });
      toast.success("You’re enrolled.");
      setRefresh((count) => count + 1);
    } catch (reason) {
      setEnrollmentError(apiErrorMessage(reason, "Couldn’t enroll in this semester. Check the fee status and try again."));
    } finally {
      setSaving(false);
    }
  }

  const detailRows = enrollments.flatMap((enrollment) => {
    const courses = findRows(enrollment, ["courses", "course"]);
    if (courses.length) return courses.map((course) => ({ enrollment, course: asRecord(course) })).filter((item): item is { enrollment: ApiRecord; course: ApiRecord } => Boolean(item.course));
    return [{ enrollment, course: asRecord(enrollment.course) }].filter((item): item is { enrollment: ApiRecord; course: ApiRecord } => Boolean(item.course));
  });

  return <>
    <PageHeader title="Courses" description="Enroll in a semester and review your course records." />
    {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRefresh((count) => count + 1)}>Try again</button></div>}
    {loading && !semesters.length ? <div className="enrollment-skeleton"><span /><span /></div> : <section className="enroll-panel">
      <div className="enroll-panel-heading"><div><p className="section-kicker">Current enrollment</p><h2>Enroll in a semester</h2></div><span className="enroll-icon"><BookOpenCheck size={21} /></span></div>
      <div className="field-group"><label className="field-label" htmlFor="semester-choice">Semester</label><select id="semester-choice" className="field-control" value={semesterId ?? ""} onChange={(event) => selectSemester(event.target.value)} disabled={!semesters.length}><option value="">Select a semester</option>{semesters.map((semester, index) => {
        const id = readText(semester, "id");
        return id ? <option key={id} value={id}>{semesterName(semester)}{readText(semester, "department") ? ` · ${readText(semester, "department")}` : ""}{index === 0 ? "" : ""}</option> : null;
      })}</select></div>
      {selectedSemester && <div className={`enroll-gate${alreadyEnrolled ? " gate-success" : hasKnownUnpaidFee ? " gate-warning" : " gate-info"}`} role="status">
        {alreadyEnrolled ? <Check size={20} /> : hasKnownUnpaidFee ? <LockKeyhole size={20} /> : <BookOpenCheck size={20} />}
        <div><strong>{alreadyEnrolled ? "Already enrolled" : hasPaidFee ? "Your fee is paid" : hasKnownUnpaidFee ? "Fee payment required" : "Fee status unavailable"}</strong><p>{alreadyEnrolled ? `You’re enrolled in ${semesterName(selectedSemester)}.` : hasPaidFee ? "You can enroll in this semester." : hasKnownUnpaidFee ? "Pay the semester fee before enrolling." : "No matching fee record was returned. The API will confirm whether enrollment is allowed."}</p></div>
        {alreadyEnrolled ? <span className="gate-label">Enrolled</span> : hasKnownUnpaidFee ? <Link className="button button-secondary" href="/student/fees">Go to fees <ArrowRight size={16} /></Link> : <button className="button button-primary" disabled={!semesterId || saving} onClick={enroll}>{saving && <LoaderCircle className="spinner" size={17} />}{saving ? "Enrolling" : "Enroll in semester"}</button>}
      </div>}
      {!semesters.length && !error && <div className="inline-alert warning-alert"><AlertCircle size={18} /><span>No semesters were returned for your account.</span></div>}
      {enrollmentError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{enrollmentError}</span></div>}
      {matchingFee && readNumber(selectedSemester ?? {}, "feeAmount") !== undefined && <p className="field-help">Semester fee: {formatMoney(readNumber(selectedSemester ?? {}, "feeAmount")!)}</p>}
    </section>}
    <section className="course-records-section"><div className="section-heading"><p className="section-kicker">Your academic record</p><h2>Enrolled courses</h2></div>
      {loading && !enrollments.length ? <div className="enrollment-skeleton"><span /><span /></div> : detailRows.length ? <div className="course-record-grid">{detailRows.map(({ enrollment, course }, index) => {
        const semester = asRecord(enrollment.semester);
        const name = readText(course, "title") ?? readText(course, "name") ?? "Course";
        return <article className="course-record" key={readText(course, "id") ?? index}><div className="course-spine" /><small>{readText(course, "code") ?? "Course record"}</small><h3 title={name}>{name}</h3><dl><div><dt>Semester</dt><dd>{readText(semester ?? {}, "name") ?? "—"}</dd></div><div><dt>Credits</dt><dd>{readNumber(course, "creditHours") ?? readNumber(course, "credits") ?? "—"}</dd></div></dl></article>;
      })}</div> : enrollments.length ? <div className="enrollment-record-list">{enrollments.map((enrollment, index) => {
        const semester = asRecord(enrollment.semester);
        return <article key={readText(enrollment, "id") ?? index} className="enrollment-record"><span className="enroll-icon"><Check size={19} /></span><div><strong>{readText(semester ?? {}, "name") ?? "Semester enrollment"}</strong><p>{readText(semester ?? {}, "department") ?? "Enrollment confirmed"}</p></div><span className="status-pill tone-success"><Check size={14} />Enrolled</span></article>;
      })}</div> : !error && <div className="empty-panel"><div className="empty-icon"><BookOpenCheck size={22} /></div><h2>No enrollments yet</h2><p>Pay your semester fee, then enroll.</p><Link href="/student/fees" className="button button-secondary">Go to fees <ArrowRight size={16} /></Link></div>}
    </section>
  </>;
}