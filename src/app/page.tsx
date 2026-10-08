import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, CircleDollarSign, GraduationCap, ShieldCheck } from "lucide-react";
import { ArchMark } from "@/components/brand/arch-mark";
import { BRAND } from "@/lib/brand";

async function getApiStatus(): Promise<"normal" | "slow" | undefined> {
  const configuredUrl = process.env.API_BASE_URL;
  if (!configuredUrl) return undefined;
  try {
    const rootUrl = new URL("/", new URL(configuredUrl).origin);
    const response = await fetch(rootUrl, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2500),
    });
    return response.ok ? "normal" : "slow";
  } catch {
    return undefined;
  }
}

export default async function Home() {
  const apiStatus = await getApiStatus();
  return (
    <main id="main-content" className="public-home">
      <header className="public-header"><Link href="/" className="home-brand"><ArchMark /></Link><nav aria-label="Primary"><a href="#how-it-works">How it works</a><a href="#for-everyone">For everyone</a></nav><div className="header-actions"><Link href="/login" className="button button-secondary">Sign in</Link><Link href="/register" className="button button-primary">Create account</Link></div></header>
      <section className="home-hero">
        <div className="hero-copy"><p className="section-kicker">A calmer academic workspace</p><h1>{BRAND.tagline}</h1><p className="hero-description">Fees, classes, results and transcripts come together in one reliable view, so students can focus on the semester ahead.</p><div className="hero-actions"><Link href="/login" className="button button-primary">Sign in <ArrowRight size={18} /></Link><Link href="#how-it-works" className="button button-secondary">See how it works</Link></div><div className="hero-note"><ShieldCheck size={17} /><span>One university account. A clear record of every semester.</span></div></div>
        <div className="hero-visual" aria-hidden="true"><div className="hero-arch-grid"><span /><span /><span /><span /><span /><span /></div><div className="hero-document"><div className="document-crest"><ArchMark compact /></div><div className="document-line document-line-title" /><div className="document-line" /><div className="document-line document-line-short" /><div className="document-divider" /><div className="document-stat"><strong>Transcript</strong><span>Academic record</span></div><div className="document-bottom"><span /><span /><span /></div></div><div className="hero-stamp"><GraduationCap size={21} /><span>Semester by semester</span></div></div>
      </section>
      <section id="for-everyone" className="role-band"><div className="section-heading"><p className="section-kicker">Built around the people who use it</p><h2>One system, three working views.</h2></div><div className="role-grid"><article className="role-item role-student"><span className="role-icon"><GraduationCap size={22} /></span><div><h3>Students</h3><p>See fees, attendance, published results and the transcript that brings them together.</p></div></article><article className="role-item role-faculty"><span className="role-icon"><BookOpenCheck size={22} /></span><div><h3>Faculty</h3><p>Keep teaching records and assessment work close to the students and semesters they serve.</p></div></article><article className="role-item role-admin"><span className="role-icon"><ShieldCheck size={22} /></span><div><h3>Administration</h3><p>Manage accounts, semesters and fee records with an audit-minded registry view.</p></div></article></div></section>
      <section id="how-it-works" className="semester-band"><div className="section-heading"><p className="section-kicker">A semester, clearly tracked</p><h2>From the first fee to the final transcript.</h2></div><div className="semester-steps"><article><span className="step-icon"><CircleDollarSign size={20} /></span><small>01</small><h3>Review fees</h3><p>Check an invoice and follow its payment status.</p></article><article><span className="step-icon"><BookOpenCheck size={20} /></span><small>02</small><h3>Enroll</h3><p>Confirm the semester once the required fee is paid.</p></article><article><span className="step-icon"><CalendarDays size={20} /></span><small>03</small><h3>Attend and sit exams</h3><p>Keep a view of attendance and scheduled assessments.</p></article><article><span className="step-icon"><GraduationCap size={20} /></span><small>04</small><h3>Review results</h3><p>Published results become part of the academic record.</p></article></div></section>
      <footer className="public-footer"><Link href="/" className="home-brand"><ArchMark /></Link><p>{BRAND.tagline}</p>{apiStatus && <span className={`api-health ${apiStatus}`}><i />{apiStatus === "normal" ? "All systems normal" : "Service may be slow"}</span>}<a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a><span>© {new Date().getFullYear()} {BRAND.name}</span></footer>
    </main>
  );
}
