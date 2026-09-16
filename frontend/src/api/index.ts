import { request } from './client';
import type {
  Cow, CowCreate, CowWithHistory, HealthRecord, RegisterPayload,
  StaffCreate, TokenResponse, UserPublic, UserRole, Vaccination,
} from './types';

/* ── Auth ── POST /auth/register, POST /auth/login ────────────────────────── */
export const auth = {
  register: (payload: RegisterPayload) =>
    request<UserPublic>('/auth/register', { method: 'POST', body: payload, auth: false }),

  /** identifier is phone OR email. */
  login: (identifier: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
      auth: false,
    }),
};

/* ── Users ────────────────────────────────────────────────────────────────── */
export const users = {
  me: () => request<UserPublic>('/users/me'),
  updateMe: (patch: Partial<UserPublic>) =>
    request<UserPublic>('/users/me', { method: 'PATCH', body: patch }),
  createStaff: (payload: StaffCreate) =>
    request<UserPublic>('/users/staff', { method: 'POST', body: payload }),
  listByRole: (role: UserRole) => request<UserPublic[]>('/users/', { query: { role } }),
  byId: (id: string) => request<UserPublic>(`/users/${id}`),
  deactivate: (id: string) => request<UserPublic>(`/users/${id}/deactivate`, { method: 'PATCH' }),
};

/* ── Cows ─────────────────────────────────────────────────────────────────── */
export const cows = {
  create: (payload: CowCreate) => request<Cow>('/cows/', { method: 'POST', body: payload }),
  myHerd: () => request<Cow[]>('/cows/'),
  /** Any authenticated role. Pass exactly one identifier. */
  lookup: (q: { barcode?: string; pashu_aadhar?: string; tag_number?: string }) =>
    request<CowWithHistory>('/cows/lookup', { query: q }),
  byFarmer: (farmerId: string) => request<Cow[]>(`/cows/farmer/${farmerId}`),
  detail: (cowId: string) => request<CowWithHistory>(`/cows/${cowId}`),
  update: (cowId: string, patch: Partial<CowCreate> & { is_active?: boolean }) =>
    request<Cow>(`/cows/${cowId}`, { method: 'PATCH', body: patch }),
};

/* ── Health records ───────────────────────────────────────────────────────── */
export const health = {
  list: (cowId: string) => request<HealthRecord[]>(`/cows/${cowId}/health/`),
  add: (cowId: string, payload: {
    disease_name: string; diagnosed_date?: string | null; resolved_date?: string | null;
    treatment?: string | null; notes?: string | null; is_comorbidity?: boolean;
  }) => request<HealthRecord>(`/cows/${cowId}/health/`, { method: 'POST', body: payload }),
};

/* ── Vaccinations ─────────────────────────────────────────────────────────── */
export const vaccinations = {
  list: (cowId: string) => request<Vaccination[]>(`/cows/${cowId}/vaccinations/`),
  add: (cowId: string, payload: {
    vaccine_name: string; date_administered: string; disease_covered?: string | null;
    next_due_date?: string | null; batch_number?: string | null;
    administered_by?: string | null; notes?: string | null;
  }) => request<Vaccination>(`/cows/${cowId}/vaccinations/`, { method: 'POST', body: payload }),
};

export * from './types';
export { ApiError, API_URL } from './client';
