import type {
  AttendanceRecord,
  AuditEntry,
  AuthUser,
  ConsentResponse,
  LoginResponse,
  MarkResponse,
  Paginated,
  RecordDetail,
  RecordReview,
  SiteInput,
  SiteSummary,
  UserCreateInput,
  UserSummary,
  UserUpdateInput,
} from '@ams/shared';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('ams:unauthorized'));
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = await res.json();
      const raw = body.message ?? message;
      message = Array.isArray(raw) ? raw.join(', ') : raw;
      if (typeof message === 'string' && /^[A-Z_]+$/.test(message)) code = message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () =>
    request<{ status: string; db: boolean; uptimeSeconds: number; timestamp: string }>('/health'),

  login: (employeeCode: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ employeeCode, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),
  giveConsent: () => request<ConsentResponse>('/auth/consent', { method: 'POST' }),

  mark: (form: FormData) =>
    request<MarkResponse>('/attendance/mark', { method: 'POST', body: form }),
  myRecords: (page = 1) =>
    request<Paginated<AttendanceRecord>>(`/attendance/me?page=${page}&limit=50`),

  adminRecords: (params: URLSearchParams) =>
    request<Paginated<AttendanceRecord>>(`/admin/attendance?${params.toString()}`),
  adminRecord: (id: string) => request<RecordDetail>(`/admin/attendance/${id}`),
  reviewRecord: (id: string, review: RecordReview) =>
    request<RecordDetail>(`/admin/attendance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(review),
    }),
  adminAudit: (params: URLSearchParams) =>
    request<Paginated<AuditEntry>>(`/admin/audit?${params.toString()}`),

  sites: () => request<SiteSummary[]>('/admin/sites'),
  createSite: (input: SiteInput) =>
    request<SiteSummary>('/admin/sites', { method: 'POST', body: JSON.stringify(input) }),
  updateSite: (id: string, input: SiteInput) =>
    request<SiteSummary>(`/admin/sites/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateSite: (id: string) =>
    request<SiteSummary>(`/admin/sites/${id}`, { method: 'DELETE' }),

  users: () => request<UserSummary[]>('/admin/users'),
  createUser: (input: UserCreateInput) =>
    request<UserSummary>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (id: string, input: UserUpdateInput) =>
    request<UserSummary>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateUser: (id: string) =>
    request<UserSummary>(`/admin/users/${id}`, { method: 'DELETE' }),

  exportUrl: (params: URLSearchParams, format: 'csv' | 'xlsx') => {
    const p = new URLSearchParams(params);
    p.set('format', format);
    return `${BASE}/admin/attendance/export?${p.toString()}`;
  },
  download: async (url: string, filename: string) => {
    const headers = new Headers();
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};
