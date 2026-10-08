"use client";

import { AlertCircle, ArrowDown, ArrowUp, Crown, LoaderCircle, Plus, Search, UserRoundCheck, UserRoundX, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { asRecord, findRows, formatDate, readBoolean, readText, unwrapPayload, type ApiRecord } from "@/lib/api-data";

const pageSize = 10;
const roles = ["", "STUDENT", "FACULTY", "ADMIN"] as const;

function identityText(value: unknown, keys: string[]): string | undefined {
  const root = asRecord(unwrapPayload(value));
  if (!root) return undefined;
  const sources = [root, asRecord(root.user), asRecord(root.account)].filter((item): item is ApiRecord => Boolean(item));
  for (const source of sources) {
    for (const key of keys) {
      const text = readText(source, key);
      if (text) return text;
    }
  }
  return undefined;
}

function UserCard({ user, currentUserId, currentEmail, onStatus, onPromote, busy }: {
  user: ApiRecord;
  currentUserId?: string;
  currentEmail?: string;
  onStatus: (user: ApiRecord, active: boolean) => void;
  onPromote: (user: ApiRecord, profileId: string) => void;
  busy: string;
}) {
  const id = readText(user, "id");
  const name = readText(user, "name") ?? "—";
  const email = readText(user, "email") ?? "—";
  const role = readText(user, "role") ?? "—";
  const active = readBoolean(user, "isActive");
  const profileId = readText(user, "facultyProfileId");
  const ownRow = Boolean(id && currentUserId && id === currentUserId) || Boolean(currentEmail && email.toLowerCase() === currentEmail.toLowerCase());
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";

  return (
    <article className={`user-card${active === false ? " is-deactivated" : ""}`}>
      <div className="user-identity"><span className="user-avatar">{initials}</span><span className="user-copy"><strong title={name}>{name}</strong><small title={email}>{email}</small></span></div>
      <span className="user-meta"><small>Role</small><span className="user-role">{role.toLowerCase()}</span></span>
      <span className="user-meta"><small>Status</small><span className={`status-label${active === true ? " is-active" : active === false ? " is-inactive" : ""}`}>{active === true ? "Active" : active === false ? "Deactivated" : "—"}</span></span>
      <span className="user-meta"><small>Joined</small><span className="user-joined">{readText(user, "createdAt") ? formatDate(readText(user, "createdAt")!) : "—"}</span></span>
      <div className="user-actions">
        {role.toUpperCase() === "FACULTY" && profileId && <button className="table-action" disabled={Boolean(busy)} onClick={() => onPromote(user, profileId)} title="Make department head"><Crown size={16} /><span>Promote</span></button>}
        {id && active !== undefined && <button className="table-action" disabled={Boolean(busy) || ownRow} onClick={() => onStatus(user, active)} title={ownRow ? "You can’t change your own status" : active ? "Deactivate user" : "Activate user"}>
          {busy === id ? <LoaderCircle className="spinner" size={16} /> : active ? <UserRoundX size={16} /> : <UserRoundCheck size={16} />}<span>{active ? "Deactivate" : "Activate"}</span>
        </button>}
      </div>
    </article>
  );
}

export function AdminUsers() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const role = params.get("role") ?? "";
  const searchTerm = params.get("searchTerm") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchTerm);
  const [rows, setRows] = useState<unknown[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [currentEmail, setCurrentEmail] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refresh, setRefresh] = useState(0);
  const queryString = params.toString();

  useEffect(() => setSearchDraft(searchTerm), [searchTerm]);
  useEffect(() => {
    if (searchDraft.trim() === searchTerm) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(queryString);
      const trimmed = searchDraft.trim();
      if (trimmed) next.set("searchTerm", trimmed);
      else next.delete("searchTerm");
      next.set("page", "1");
      if (next.toString() !== queryString) router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchTerm, pathname, queryString, router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.get<unknown>("/admin/users", { params: { page, limit: pageSize, searchTerm, role: role || undefined, sortOrder: "desc" } }),
      api.get<unknown>("/auth/me"),
    ]).then(([usersResponse, meResponse]) => {
      if (!active) return;
      setRows(findRows(usersResponse.data, ["users"]));
      setCurrentUserId(identityText(meResponse.data, ["id", "userId"]));
      setCurrentEmail(identityText(meResponse.data, ["email"]));
    }).catch((reason: unknown) => {
      if (active) setError(apiErrorMessage(reason, "Couldn’t load users. Check your connection and try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, role, searchTerm, refresh]);

  const users = useMemo(() => rows.map(asRecord).filter((item): item is ApiRecord => Boolean(item)), [rows]);

  function updateParams(nextRole: string) {
    const next = new URLSearchParams(queryString);
    if (nextRole) next.set("role", nextRole);
    else next.delete("role");
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function updateStatus(user: ApiRecord, active: boolean) {
    const id = readText(user, "id");
    const name = readText(user, "name") ?? "This user";
    if (!id) return;
    const action = active ? "deactivate" : "activate";
    const confirmation = await Swal.fire({
      title: `${active ? "Deactivate" : "Activate"} ${name}?`,
      text: active ? "They won’t be able to sign in. You can reactivate them later." : "They will be able to sign in again.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: active ? "Deactivate" : "Activate",
      cancelButtonText: "Cancel",
      ...(active ? { confirmButtonColor: "var(--danger-solid)" } : {}),
    });
    if (!confirmation.isConfirmed) return;
    setBusy(id);
    try {
      await api.patch(`/admin/users/${encodeURIComponent(id)}/status`, { isActive: !active });
      toast.success(`${name} ${active ? "deactivated" : "activated"}.`);
      setRefresh((count) => count + 1);
    } catch (reason) {
      toast.error(apiErrorMessage(reason, `Couldn’t ${action} this user. Try again.`));
    } finally {
      setBusy("");
    }
  }

  async function promote(user: ApiRecord, profileId: string) {
    const name = readText(user, "name") ?? "This faculty member";
    const confirmation = await Swal.fire({
      title: `Make ${name} a department head?`,
      text: "This will demote the current department head.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Promote",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setBusy(readText(user, "id") ?? profileId);
    try {
      await api.patch(`/admin/faculty/${encodeURIComponent(profileId)}/department-head`);
      toast.success(`${name} is now a department head.`);
      setRefresh((count) => count + 1);
    } catch (reason) {
      toast.error(apiErrorMessage(reason, "Couldn’t assign department head. Try again."));
    } finally {
      setBusy("");
    }
  }

  const hasNext = users.length === pageSize;

  return (
    <>
      <PageHeader title="Users" description="Manage university accounts and access." action={<div className="header-button-group"><Link href="/admin/users/new-faculty" className="button button-secondary"><Plus size={17} />Create faculty</Link><Link href="/admin/users/new-admin" className="button button-primary"><Plus size={17} />Create admin</Link></div>} />
      <section className="filter-bar" aria-label="User filters">
        <label className="search-wrap"><Search size={17} /><input aria-label="Search users" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search name or email" /></label>
        <label className="filter-select-label"><span>Role</span><select value={role} onChange={(event) => updateParams(event.target.value)} aria-label="Filter users by role">{roles.map((value) => <option key={value} value={value}>{value ? value.toLowerCase() : "All roles"}</option>)}</select></label>
      </section>
      {error && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button className="button button-ghost" onClick={() => setRefresh((count) => count + 1)}>Try again</button></div>}
      <section className="data-panel">
        <div className="data-panel-heading"><div><h2>University accounts</h2><p>{loading ? "Updating records…" : `${users.length} records on this page`}</p></div>{loading && <LoaderCircle className="spinner" size={18} />}</div>
        {loading && !users.length ? <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div> : users.length ? <>
          <div className="desktop-table-wrap"><table className="data-table"><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col" className="actions-heading">Actions</th></tr></thead><tbody>{users.map((user, index) => <tr key={readText(user, "id") ?? index}><td colSpan={5}><UserCard user={user} currentUserId={currentUserId} currentEmail={currentEmail} onStatus={updateStatus} onPromote={promote} busy={busy} /></td></tr>)}</tbody></table></div>
          <div className="mobile-user-list">{users.map((user, index) => <UserCard key={readText(user, "id") ?? index} user={user} currentUserId={currentUserId} currentEmail={currentEmail} onStatus={updateStatus} onPromote={promote} busy={busy} />)}</div>
        </> : !error && <div className="empty-state"><div className="empty-icon"><Users size={22} /></div><h2>No users found</h2><p>{searchTerm || role ? "Try changing the search or role filter." : "University accounts will appear here."}</p></div>}
        <div className="pagination-bar"><span>Page {page}</span><div><button className="button button-secondary pagination-button" disabled={page <= 1 || loading} onClick={() => { const next = new URLSearchParams(queryString); next.set("page", String(page - 1)); router.push(`${pathname}?${next.toString()}`); }}><ArrowUp size={15} />Previous</button><button className="button button-secondary pagination-button" disabled={!hasNext || loading} onClick={() => { const next = new URLSearchParams(queryString); next.set("page", String(page + 1)); router.push(`${pathname}?${next.toString()}`); }}><ArrowDown size={15} />Next</button></div></div>
      </section>
    </>
  );
}