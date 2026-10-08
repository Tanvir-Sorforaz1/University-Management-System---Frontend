import { DashboardShell } from "@/components/dashboard-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}