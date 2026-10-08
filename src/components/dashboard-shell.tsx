"use client";

import { Archive, Award, Bell, BookOpenCheck, CalendarCheck, CalendarRange, ChevronRight, ClipboardList, LayoutDashboard, LogOut, Menu, Presentation, ReceiptText, ScrollText, Settings2, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArchMark } from "@/components/brand/arch-mark";
import { NotificationBell } from "@/components/notification-pages";
import { api, apiErrorMessage } from "@/lib/api";

type Role = "admin" | "student" | "faculty";
type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };

const navigation: Record<Role, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Semesters", href: "/admin/semesters", icon: BookOpenCheck },
    { label: "Fees", href: "/admin/fees", icon: ReceiptText },
    { label: "Attendance lookup", href: "/admin/attendance", icon: CalendarCheck },
    { label: "Exams", href: "/admin/exams", icon: ClipboardList },
    { label: "Results", href: "/admin/results", icon: Award },
    { label: "Transcripts", href: "/admin/transcripts", icon: ScrollText },
    { label: "Notifications", href: "/admin/notifications", icon: Bell },
    { label: "Payments", href: "/admin/payments", icon: ReceiptText },
    { label: "Audit logs", href: "/admin/audit-logs", icon: Archive },
  ],
  student: [
    { label: "Overview", href: "/student", icon: LayoutDashboard },
    { label: "Fees", href: "/student/fees", icon: ReceiptText },
    { label: "Courses", href: "/student/courses", icon: BookOpenCheck },
    { label: "Attendance", href: "/student/attendance", icon: CalendarCheck },
    { label: "Exams", href: "/student/exams", icon: ClipboardList },
    { label: "Results", href: "/student/results", icon: Award },
    { label: "Transcript", href: "/student/transcript", icon: ScrollText },
    { label: "Notifications", href: "/student/notifications", icon: Bell },
  ],
  faculty: [
    { label: "Overview", href: "/faculty", icon: LayoutDashboard },
    { label: "Attendance", href: "/faculty/attendance", icon: CalendarCheck },
    { label: "Exams", href: "/faculty/exams", icon: ClipboardList },
    { label: "Results", href: "/faculty/results", icon: Award },
    { label: "Transcripts", href: "/faculty/transcripts", icon: ScrollText },
    { label: "Notifications", href: "/faculty/notifications", icon: Bell },
  ],
};

function findText(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findText(child, keys);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (keys.includes(key.toLowerCase()) && typeof child === "string" && child.trim()) return child;
  }
  for (const child of Object.values(record)) {
    const found = findText(child, keys);
    if (found) return found;
  }
  return undefined;
}

function ownHome(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "STUDENT") return "/student";
  if (role === "FACULTY") return "/faculty";
  return "/login";
}

export function DashboardShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<unknown>("/auth/me").then(({ data }) => {
      if (!alive) return;
      const actualRole = findText(data, ["role"])?.toUpperCase();
      if (actualRole !== role.toUpperCase()) {
        toast.error("You don’t have access to that page.");
        router.replace(ownHome(actualRole));
        return;
      }
      setUserName(findText(data, ["name", "email"]) ?? "University account");
      setReady(true);
    }).catch(() => {
      if (alive) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => { alive = false; };
  }, [pathname, role, router]);

  async function signOut() {
    try {
      await api.post("/auth/logout");
      toast.success("You’ve been signed out.");
      router.replace("/login");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn’t confirm sign out. Your local session was cleared."));
      router.replace("/login");
    }
  }

  if (!ready) return <main className="dashboard-loading" aria-live="polite"><span className="loading-mark"><ArchMark compact /></span><span>Loading your workspace…</span></main>;

  const links = navigation[role];
  const roleLabel = role === "admin" ? "Administration" : role === "faculty" ? "Faculty workspace" : "Student portal";
  const initials = userName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

  return (
    <div className="dashboard-shell" data-role={role} data-density={role === "admin" ? "compact" : "comfortable"}>
      <div className="role-strip" />
      <aside className={`dashboard-sidebar${mobileOpen ? " is-open" : ""}`}>
        <div className="sidebar-brand"><Link href={role === "admin" ? "/admin" : "/student"}><ArchMark /></Link><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
        <div className="sidebar-role">{roleLabel}</div>
        <nav aria-label="Primary" className="sidebar-nav">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === `/${role}` ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={19} strokeWidth={1.75} /><span>{label}</span><ChevronRight className="nav-chevron" size={15} /></Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-chip"><span className="account-avatar">{initials}</span><span className="account-copy"><strong>{userName}</strong><small>{roleLabel}</small></span><Settings2 size={17} aria-hidden="true" /></div>
          <button className="signout-button" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation overlay" className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <Link href={role === "admin" ? "/admin" : "/student"} className="mobile-wordmark"><ArchMark compact /><span>{roleLabel}</span></Link>
          <div className="topbar-spacer" />
          <span className="topbar-date">Academic workspace</span>
          <NotificationBell role={role} />
          <span className="topbar-avatar" aria-label={userName}>{initials}</span>
        </header>
        <main id="main-content" className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}