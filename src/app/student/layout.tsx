import { DashboardShell } from "@/components/dashboard-shell";

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <DashboardShell role="student">{children}</DashboardShell>;
}