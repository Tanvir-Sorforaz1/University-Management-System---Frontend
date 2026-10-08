import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, extractTokens, setSessionCookies, stripTokens } from "@/lib/server-session";

type RouteContext = { params: Promise<{ path: string[] }> };

function valueAtPath(value: unknown, path: string | undefined): unknown {
  if (!path?.trim()) return undefined;
  let current = value;
  for (const part of path.replace(/^\$\.?/, "").split(".").filter(Boolean)) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const baseUrl = process.env.API_BASE_URL?.replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json({ message: "Set API_BASE_URL to connect to the university API." }, { status: 503 });
  }

  const { path } = await context.params;
  const endpoint = path.map((part) => encodeURIComponent(part)).join("/");
  const target = `${baseUrl}/${endpoint}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const token = path[0] === "auth" && path[1] === "refresh-token"
    ? request.cookies.get(REFRESH_COOKIE)?.value ?? request.cookies.get(ACCESS_COOKIE)?.value
    : request.cookies.get(ACCESS_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    const response = NextResponse.json({ message: "The university API is unavailable. Check the server and try again." }, { status: 502 });
    if (path[0] === "auth" && path[1] === "logout") {
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
    }
    return response;
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  const isAuthMutation = path[0] === "auth" && ["login", "refresh-token"].includes(path[1] ?? "");

  if (upstream.ok && path[0] === "payments" && path[1] === "initiate") {
    const checkoutPath = process.env.PAYMENT_CHECKOUT_URL_PATH;
    if (!checkoutPath) {
      return NextResponse.json({ message: "Configure PAYMENT_CHECKOUT_URL_PATH to match the API payment response." }, { status: 502 });
    }
    try {
      const payload = await upstream.clone().json();
      const checkoutUrl = valueAtPath(payload, checkoutPath);
      if (typeof checkoutUrl !== "string" || !checkoutUrl) {
        return NextResponse.json({ message: "The payment response did not include a checkout URL at the configured path." }, { status: 502 });
      }
      return NextResponse.json({ checkoutUrl, data: payload }, { status: upstream.status });
    } catch {
      return NextResponse.json({ message: "The payment response could not be read. Try again." }, { status: 502 });
    }
  }

  if (isAuthMutation && upstream.ok) {
    let payload: unknown;
    try {
      payload = await upstream.clone().json();
    } catch {
      payload = undefined;
    }

    const tokens = extractTokens(payload);
    const headerToken = upstream.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const access = tokens.access ?? headerToken;
    if (!access) {
      return NextResponse.json({ message: "Configure AUTH_ACCESS_TOKEN_PATH to match the API login response before signing in." }, { status: 502 });
    }
    const response = NextResponse.json(stripTokens(payload), { status: upstream.status, headers: responseHeaders });
    setSessionCookies(response, access, tokens.refresh);
    return response;
  }

  const body = await upstream.arrayBuffer();
  const response = new NextResponse(body.byteLength ? body : null, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (path[0] === "auth" && path[1] === "logout") {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  if (path[0] === "auth" && path[1] === "refresh-token" && [401, 403].includes(upstream.status)) {
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;