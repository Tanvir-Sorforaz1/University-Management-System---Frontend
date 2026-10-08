import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export default function FacultyLayout({ children }: { children: ReactNode }) {
  return <DashboardShell role="faculty">{children}</DashboardShell>;
}