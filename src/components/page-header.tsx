import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div><p className="section-kicker">University registry</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}