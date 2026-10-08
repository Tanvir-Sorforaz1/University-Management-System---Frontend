"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ArchMark } from "@/components/brand/arch-mark";
import { api, apiErrorMessage } from "@/lib/api";
import { BRAND } from "@/lib/brand";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  departmentName: z.string().trim().min(1, "Enter your department."),
  phone: z.string().trim().min(1, "Enter your phone number."),
  address: z.string().trim().min(1, "Enter your address."),
});

const verifySchema = z.object({
  email: z.email("Enter a valid email address."),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type VerifyValues = z.infer<typeof verifySchema>;

function FormField({
  id,
  label,
  type = "text",
  error,
  registration,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  error?: string;
  registration: UseFormRegisterReturn;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="field-group">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="field-control"
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      {error && <p className="field-error" id={`${id}-error`}><AlertCircle size={16} />{error}</p>}
    </div>
  );
}

function PasswordField({ registration, error }: { registration: UseFormRegisterReturn; error?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field-group">
      <label className="field-label" htmlFor="password">Password</label>
      <div className="password-wrap">
        <input
          id="password"
          className="field-control"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "password-error" : undefined}
          {...registration}
        />
        <button className="password-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="field-error" id="password-error"><AlertCircle size={16} />{error}</p>}
    </div>
  );
}

function AuthFrame({ children, eyebrow, title, description }: { children: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return (
    <main id="main-content" className="auth-page">
      <section className="auth-aside">
        <Link href="/" className="auth-brand"><ArchMark /><span className="role-chip">Academic workspace</span></Link>
        <div className="auth-aside-copy">
          <p className="section-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="auth-proof"><ShieldCheck size={20} /><span>One account for fees, classes, results and transcripts.</span></div>
        </div>
        <div className="auth-arch-pattern" aria-hidden="true"><span /><span /><span /></div>
      </section>
      <section className="auth-content">
        <div className="auth-card">
          {children}
          <p className="auth-support">Need help? <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></p>
        </div>
      </section>
    </main>
  );
}

function findRole(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const role = findRole(child);
      if (role) return role;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (key.toLowerCase() === "role" && typeof child === "string") return child.toUpperCase();
  }
  for (const child of Object.values(record)) {
    const role = findRole(child);
    if (role) return role;
  }
  return undefined;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState("");
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onTouched" });

  async function submit(values: LoginValues) {
    setServerError("");
    try {
      await api.post("/auth/login", values);
      const { data } = await api.get<unknown>("/auth/me");
      const role = findRole(data);
      const home = role === "ADMIN" ? "/admin" : role === "FACULTY" ? "/faculty" : role === "STUDENT" ? "/student" : undefined;
      if (!home) {
        setServerError("Your account role could not be read. Contact the registrar before continuing.");
        return;
      }
      const next = params.get("next");
      toast.success("Signed in.");
      router.replace(next === home || next?.startsWith(`${home}/`) ? next : home);
    } catch (error) {
      setServerError(apiErrorMessage(error, "Email or password is incorrect."));
    }
  }

  return (
    <AuthFrame eyebrow="Welcome back" title="Your semester, in one place." description="Sign in to keep your academic record close and your next steps clear.">
      <div className="auth-heading"><p className="section-kicker">Student and staff portal</p><h2>Sign in to your account</h2><p>Use your university email and password.</p></div>
      {serverError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{serverError}</span></div>}
      <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
        <FormField id="email" label="Email" type="email" placeholder="name@university.edu" autoComplete="email" registration={form.register("email")} error={form.formState.errors.email?.message} />
        <PasswordField registration={form.register("password")} error={form.formState.errors.password?.message} />
        <button className="button button-primary button-wide" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting && <LoaderCircle className="spinner" size={18} />}{form.formState.isSubmitting ? "Signing in" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">New to {BRAND.short}? <Link href="/register">Create an account</Link></p>
    </AuthFrame>
  );
}

function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: "onTouched" });

  async function submit(values: RegisterValues) {
    setServerError("");
    try {
      await api.post("/auth/register", values);
      toast.success("Account created. Check your email for a code.");
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      setServerError(apiErrorMessage(error, "Your account could not be created. Check the details and try again."));
    }
  }

  return (
    <AuthFrame eyebrow="Start here" title="A clearer view of university life." description="Create a student account to follow fees, courses and results from one place.">
      <div className="auth-heading"><p className="section-kicker">Student registration</p><h2>Create your account</h2><p>Enter the details used by your university.</p></div>
      {serverError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{serverError}</span></div>}
      <form className="form-stack form-grid" onSubmit={form.handleSubmit(submit)}>
        <div className="field-span"><FormField id="name" label="Full name" autoComplete="name" registration={form.register("name")} error={form.formState.errors.name?.message} /></div>
        <FormField id="email" label="Email" type="email" autoComplete="email" registration={form.register("email")} error={form.formState.errors.email?.message} />
        <FormField id="departmentName" label="Department" placeholder="Computer Science and Engineering" registration={form.register("departmentName")} error={form.formState.errors.departmentName?.message} />
        <FormField id="phone" label="Phone" type="tel" autoComplete="tel" registration={form.register("phone")} error={form.formState.errors.phone?.message} />
        <FormField id="address" label="Address" autoComplete="street-address" registration={form.register("address")} error={form.formState.errors.address?.message} />
        <div className="field-span"><PasswordField registration={form.register("password")} error={form.formState.errors.password?.message} /></div>
        <div className="field-span"><button className="button button-primary button-wide" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting && <LoaderCircle className="spinner" size={18} />}{form.formState.isSubmitting ? "Creating account" : "Create account"}
        </button></div>
      </form>
      <p className="auth-switch">Already registered? <Link href="/login">Sign in</Link></p>
    </AuthFrame>
  );
}

function VerifyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    mode: "onTouched",
    defaultValues: { email: params.get("email") ?? "", otp: "" },
  });

  async function submit(values: VerifyValues) {
    setServerError("");
    try {
      await api.post("/auth/verify-email", values);
      toast.success("Email verified.");
      router.replace("/login");
    } catch (error) {
      setServerError(apiErrorMessage(error, "That code did not work. Check the email and try again."));
    }
  }

  return (
    <AuthFrame eyebrow="Verify your email" title="One quick check, then you’re in." description="Enter the six-digit code sent to your university email address.">
      <Link href="/register" className="back-link"><ArrowLeft size={16} /> Back to registration</Link>
      <div className="auth-heading"><p className="section-kicker">Email verification</p><h2>Verify your email</h2><p>The code is valid for the address shown below.</p></div>
      {serverError && <div className="inline-alert" role="alert"><AlertCircle size={18} /><span>{serverError}</span></div>}
      <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
        <FormField id="email" label="Email" type="email" autoComplete="email" registration={form.register("email")} error={form.formState.errors.email?.message} />
        <FormField id="otp" label="6-digit code" type="text" placeholder="000000" autoComplete="one-time-code" registration={form.register("otp")} error={form.formState.errors.otp?.message} />
        <button className="button button-primary button-wide" disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting && <LoaderCircle className="spinner" size={18} />}{form.formState.isSubmitting ? "Verifying email" : "Verify email"}
        </button>
      </form>
      <p className="auth-switch">Didn’t receive a code? Check your spam folder or contact the registrar.</p>
    </AuthFrame>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" | "verify" }) {
  if (mode === "register") return <RegisterForm />;
  if (mode === "verify") return <VerifyForm />;
  return <LoginForm />;
}