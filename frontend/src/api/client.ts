import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000').replace(/\/$/, '');
const BASE = `${API_URL}/api/v1`;
const TOKEN_KEY = 'kamadhenu.token';

/**
 * expo-secure-store has no web implementation — it only exists on iOS/Android.
 * On web we fall back to localStorage (fine for local dev; web was never the
 * target platform for the token-sensitive parts of this app).
 */
const webStore = {
  async getItemAsync(key: string) {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  },
  async setItemAsync(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async deleteItemAsync(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

let memoryToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  memoryToken = await store.getItemAsync(TOKEN_KEY);
  return memoryToken;
}

export async function saveToken(token: string) {
  memoryToken = token;
  await store.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  memoryToken = null;
  await store.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** FastAPI returns {detail: string} or {detail: [{loc, msg, ...}]} for 422. */
function readDetail(body: any, status: number): string {
  const d = body?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d) && d.length) {
    const first = d[0];
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : '';
    return field ? `${field}: ${first.msg}` : String(first.msg ?? 'Invalid input');
  }
  if (status === 401) return 'Session expired. Sign in again.';
  return `Request failed (${status})`;
}

type Options = { method?: string; body?: unknown; auth?: boolean; query?: Record<string, unknown> };

export async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query } = opts;

  let url = `${BASE}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await loadToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, `Can't reach the server at ${API_URL}. Check EXPO_PUBLIC_API_URL and that the backend is running.`);
  }

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) throw new ApiError(res.status, readDetail(parsed, res.status));
  return parsed as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}
