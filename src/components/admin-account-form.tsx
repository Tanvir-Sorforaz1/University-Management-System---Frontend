"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, Check, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { api, apiErrorMessage } from "@/lib/api";

const facultySchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  department: z.string().trim().min(1, "Enter a department."),
  designation: z.string().trim().min(1, "Enter a designation."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  isDepartmentHead: z.boolean(),
});

const adminSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  adminType: z.enum(["VC", "REGISTRAR", "FINANCE", "SUPER"]),
});

type FacultyValues = z.infer<typeof facultySchema>;
type AdminValues = z.infer<typeof adminSchema>;

function FormField({ label, id, type = "text", error, registration }: {
  label: string;
  id: string;
  type?: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm> ["register"]>;
}) {
  return <div className="field-group"><label className="field-label" htmlFor={id}>{label}</label><input className="field-control" id={id} type={type} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...registration} />{error && <p className="field-error" id={`${id}-error`}><AlertCircle size={16} />{error}</p>}</div>;
}

function FacultyAccountForm() {
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const form = useForm<FacultyValues>({ resolver: zodResolver(facultySchema), mode: "onTouched", defaultValues: { isDepartmentHead: false } });

  async function submit(values: FacultyValues) {
    setError("");
    try {
      await api.post("/admin/faculty", values);
      setCreated(true);
      form.reset({ isDepartmentHead: false });
      toast.success("Faculty account created.");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Couldn’t create the faculty account. Check the details and try again."));
    }
  }

  return <>
    <PageHeader title="Create faculty account" description="Create a faculty login and assign the university profile details." />
    {created ? <section className="success-panel"><div className="success-icon"><Check size={22} /></div><div><h2>Faculty account created</h2><p>The account request completed. The password is not retained in this browser.</p><div className="header-button-group"><button className="button button-primary" onClick={() => setCreated(false)}>Create another</button><Link className="button button-secondary" href="/admin/users">View users</Link></div></div></section> : <section className="form-panel">
      <Link href="/admin/users" className="back-link"><ArrowLeft size={16} />Back to users</Link>
      {error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}
      <form className="form-stack form-grid" onSubmit={form.handleSubmit(submit)}>
        <FormField id="name" label="Full name" registration={form.register("name")} error={form.formState.errors.name?.message} />
        <FormField id="email" label="Email" type="email" registration={form.register("email")} error={form.formState.errors.email?.message} />
        <FormField id="password" label="Temporary password" type="password" registration={form.register("password")} error={form.formState.errors.password?.message} />
        <FormField id="phone" label="Phone" type="tel" registration={form.register("phone")} error={form.formState.errors.phone?.message} />
        <FormField id="department" label="Department" registration={form.register("department")} error={form.formState.errors.department?.message} />
        <FormField id="designation" label="Designation" registration={form.register("designation")} error={form.formState.errors.designation?.message} />
        <label className="checkbox-field field-span"><input type="checkbox" {...form.register("isDepartmentHead")} /><span>Assign as department head</span></label>
        <div className="field-span"><button className="button button-primary" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting && <LoaderCircle className="spinner" size={17} />}{form.formState.isSubmitting ? "Creating account" : "Create faculty account"}</button></div>
      </form>
    </section>}
  </>;
}

function AdminAccountFields() {
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const form = useForm<AdminValues>({ resolver: zodResolver(adminSchema), mode: "onTouched", defaultValues: { adminType: "REGISTRAR" } });
  const adminType = form.watch("adminType");

  async function submit(values: AdminValues) {
    setError("");
    try {
      await api.post("/admin/admins", values);
      setCreated(true);
      form.reset({ adminType: "REGISTRAR" });
      toast.success("Admin account created.");
    } catch (reason) {
      setError(apiErrorMessage(reason, "Couldn’t create the admin account. Check the details and try again."));
    }
  }

  return <>
    <PageHeader title="Create admin account" description="Choose the account type and set initial sign-in details." />
    {created ? <section className="success-panel"><div className="success-icon"><Check size={22} /></div><div><h2>Admin account created</h2><p>The account request completed. The password is not retained in this browser.</p><div className="header-button-group"><button className="button button-primary" onClick={() => setCreated(false)}>Create another</button><Link className="button button-secondary" href="/admin/users">View users</Link></div></div></section> : <section className="form-panel">
      <Link href="/admin/users" className="back-link"><ArrowLeft size={16} />Back to users</Link>
      {error && <div className="inline-alert" role="alert"><AlertCircle size={18} />{error}</div>}
      <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
        <div className="form-grid">
          <FormField id="name" label="Full name" registration={form.register("name")} error={form.formState.errors.name?.message} />
          <FormField id="email" label="Email" type="email" registration={form.register("email")} error={form.formState.errors.email?.message} />
          <FormField id="password" label="Temporary password" type="password" registration={form.register("password")} error={form.formState.errors.password?.message} />
        </div>
        <fieldset className="admin-type-fieldset"><legend className="field-label">Admin type</legend><div className="admin-type-grid">{[
          ["VC", "Vice chancellor"], ["REGISTRAR", "Registrar"], ["FINANCE", "Finance"], ["SUPER", "Super admin"],
        ].map(([value, label]) => <label className={`admin-type-option${adminType === value ? " is-selected" : ""}`} key={value}><input type="radio" value={value} {...form.register("adminType")} /><span><strong>{label}</strong><small>{value}</small></span></label>)}</div></fieldset>
        {adminType === "SUPER" && <div className="inline-alert warning-alert"><ShieldAlert size={18} /><span>Super admins have full access.</span></div>}
        <button className="button button-primary" disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting && <LoaderCircle className="spinner" size={17} />}{form.formState.isSubmitting ? "Creating account" : "Create admin account"}</button>
      </form>
    </section>}
  </>;
}

export function AdminAccountForm({ mode }: { mode: "faculty" | "admin" }) {
  return mode === "faculty" ? <FacultyAccountForm /> : <AdminAccountFields />;
}