import axios from 'axios';
import { Summary, PatientsResponse, Session, IncidentsResponse, Incident } from '@/types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Sessions ────────────────────────────────────────────────
// These all route through same-origin Next.js API routes rather than
// hitting the Express backend directly — the routes check the signed-in
// user's role server-side (admin/doctor see everything, patients are
// scoped to their own records) before forwarding upstream with the
// shared internal key. See app/api/patients/**.
export const fetchSummary = (): Promise<Summary> =>
  axios.get<Summary>('/api/patients/summary').then(r => r.data);

export const fetchSessions = (limit = 20, offset = 0): Promise<PatientsResponse> =>
  axios.get<PatientsResponse>(`/api/patients?limit=${limit}&offset=${offset}`).then(r => r.data);

// Every wound session recorded for one patient (admin/doctor only).
export const fetchPatientWounds = (patientId: string, limit = 100): Promise<PatientsResponse> =>
  axios.get<PatientsResponse>(
    `/api/patients?limit=${limit}&offset=0&patient_id=${encodeURIComponent(patientId)}`
  ).then(r => r.data);

export const fetchPatient = (id: string): Promise<Session> =>
  axios.get<Session>(`/api/patients/${encodeURIComponent(id)}`).then(r => r.data);

// A patient's own sessions — always scoped server-side to the caller's
// email, regardless of role.
export const fetchMySessions = (limit = 20, offset = 0): Promise<PatientsResponse> =>
  axios.get<PatientsResponse>(`/api/my-sessions?limit=${limit}&offset=${offset}`).then(r => r.data);

export const checkHealth = (): Promise<{ status: string }> =>
  api.get<{ status: string }>('/health').then(r => r.data);

// ── Incidents ────────────────────────────────────────────────
export const fetchIncidents = (): Promise<IncidentsResponse> =>
  axios.get<IncidentsResponse>('/api/incidents').then(r => r.data);

// Mutations route through Next.js API routes (same-origin), which check the
// signed-in user's role server-side before forwarding to the backend. This
// keeps permission checks enforceable even if someone bypasses the UI.
export const createIncident = (
  data: Omit<Incident, 'id' | 'created_at'>
): Promise<{ success: boolean; id: string }> =>
  axios.post('/api/incidents', data).then(r => r.data);

export const resolveIncident = (id: string): Promise<{ success: boolean }> =>
  axios.patch(`/api/incidents/${encodeURIComponent(id)}/resolve`).then(r => r.data);

// ── GCS Proxy URLs (through Next.js API) ──────────────────────
export const gcsImageUrl = (path: string): string =>
  `/api/proxy/image?path=${encodeURIComponent(path)}`;

export const gcsTextUrl = (path: string): string =>
  `/api/proxy/text?path=${encodeURIComponent(path)}`;
