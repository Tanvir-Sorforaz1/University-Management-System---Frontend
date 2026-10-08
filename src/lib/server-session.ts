import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "ums_access_token";
export const REFRESH_COOKIE = "ums_refresh_token";

function tokenAtPath(value: unknown, path: string | undefined): string | undefined {
  if (!path?.trim()) return undefined;
  let current = value;
  for (const part of path.replace(/^\$\.?/, "").split(".").filter(Boolean)) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" && current ? current : undefined;
}

export function extractTokens(value: unknown) {
  return {
    access: tokenAtPath(value, process.env.AUTH_ACCESS_TOKEN_PATH),
    refresh: tokenAtPath(value, process.env.AUTH_REFRESH_TOKEN_PATH),
  };
}

function stripConfiguredPath(value: unknown, path: string | undefined): unknown {
  const parts = path?.replace(/^\$\.?/, "").split(".").filter(Boolean) ?? [];
  if (!parts.length) return value;
  const visit = (current: unknown, depth: number): unknown => {
    if (Array.isArray(current)) return current.map((child) => visit(child, depth));
    if (!current || typeof current !== "object" || depth >= parts.length) return current;
    const record = current as Record<string, unknown>;
    return Object.fromEntries(Object.entries(record)
      .filter(([key]) => !(depth === parts.length - 1 && key === parts[depth]))
      .map(([key, child]) => [key, key === parts[depth] ? visit(child, depth + 1) : child]));
  };
  return visit(value, 0);
}

export function stripTokens(value: unknown): unknown {
  const stripped = stripConfiguredPath(
    stripConfiguredPath(value, process.env.AUTH_ACCESS_TOKEN_PATH),
    process.env.AUTH_REFRESH_TOKEN_PATH,
  );
  return stripCommonTokenFields(stripped);
}

function stripCommonTokenFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCommonTokenFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/(access|refresh)?_?token/i.test(key))
      .map(([key, child]) => [key, stripCommonTokenFields(child)]),
  );
}

export function setSessionCookies(response: NextResponse, access?: string, refresh?: string) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
  if (access) response.cookies.set(ACCESS_COOKIE, access, options);
  if (refresh) response.cookies.set(REFRESH_COOKIE, refresh, options);
}