import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const api = axios.create({
  baseURL: "/api/backend",
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

let refreshRequest: Promise<void> | undefined;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const isRefreshRequest = config?.url?.includes("auth/refresh-token");
    const requestPath = config?.url?.split("?")[0] ?? "";
    const isPublicAuthRequest = /\/auth\/(login|register|verify-email)$/.test(requestPath);

    if (error.response?.status !== 401 || !config || config._retried || isRefreshRequest || isPublicAuthRequest) {
      return Promise.reject(error);
    }

    config._retried = true;
    refreshRequest ??= api
      .post("/auth/refresh-token")
      .then(() => undefined)
      .finally(() => {
        refreshRequest = undefined;
      });

    try {
      await refreshRequest;
      return api(config);
    } catch (refreshError) {
      if (typeof window !== "undefined" && !["/login", "/register", "/verify-email"].includes(window.location.pathname)) {
        window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      }
      return Promise.reject(refreshError);
    }
  },
);

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: unknown }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message.slice(0, 140);
    if (!error.response) return "Check your connection and try again.";
  }
  return fallback;
}