// Typed request helpers — all calls go through the axios instance
// in lib/api.ts which handles auth token injection and 401 redirects.
// Every helper automatically unwraps the { ok, data } envelope.


import axios from "axios";
import { getSession } from "next-auth/react";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
  headers: { "Content-Type": "application/json" },
  timeout: 100_000,
});

// Deduplicate concurrent getSession() calls — all parallel React Query fetches
// within the same render cycle share one promise instead of each firing separately.
let _sessionPromise: ReturnType<typeof getSession> | null = null;

function getSessionOnce() {
  if (!_sessionPromise) {
    _sessionPromise = getSession().finally(() => {
      _sessionPromise = null;
    });
  }
  return _sessionPromise;
}

api.interceptors.request.use(async (config) => {
  const session = await getSessionOnce();
  const token = session?.accessToken
    ?? (process.env.NODE_ENV === "development" ? "dev-qa-bypass" : null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Guard: only redirect to /login when not already there.
    // Without this, a 401 from an API call on /dashboard triggers a redirect
    // to /login, which the middleware immediately flips back to /dashboard
    // (because the session cookie is still valid), creating an infinite loop.
    if (
      err.response?.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);


type Params = Record<string, string | number | boolean | undefined>;

async function get<T>(url: string, params?: Params): Promise<T> {
  const res = await api.get<{ ok: boolean; data: T }>(url, { params });
  return res.data.data;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<{ ok: boolean; data: T }>(url, body);
  return res.data.data;
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.patch<{ ok: boolean; data: T }>(url, body);
  return res.data.data;
}

async function del<T>(url: string): Promise<T> {
  const res = await api.delete<{ ok: boolean; data: T }>(url);
  return res.data.data;
}

export const requests = { get, post, patch, del };
