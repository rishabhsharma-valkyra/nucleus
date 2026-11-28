// Video calls from headsets (client side). The server routes under
// /api/calls forward to the Hospital API; see valkyra-cloud calls.py.
import axios from 'axios';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'cancelled';

export interface CallInfo {
  call_id: string;
  status: CallStatus;
  created_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  duration_s: number | null;
  ring_timeout_s: number;
  device_id: string | null;
  org_id: string | null;
  responder: { email: string; name: string | null } | null;
  patient_id: string | null;
  patient_name: string | null;
  session_id: string | null;
  doctors: { name: string | null; joined_at: string | null }[];
  declined_by_me?: boolean;
  joined_by_me?: boolean;
}

export interface CallJoin extends CallInfo {
  token: string;
  server_url: string;
  room: string;
  identity: string;
  expires_at: string;
}

// How often Nucleus checks for a ringing call
export const INCOMING_POLL_MS = 3_000;

export const fetchIncomingCalls = (): Promise<{ calls: CallInfo[] }> =>
  axios.get('/api/calls/incoming').then((r) => r.data);

export const fetchCallHistory = (patientId: string, limit = 20): Promise<{ calls: CallInfo[] }> =>
  axios.get(`/api/calls?patient_id=${encodeURIComponent(patientId)}&limit=${limit}`).then((r) => r.data);

export const acceptCall = (callId: string): Promise<CallJoin> =>
  axios.post(`/api/calls/${encodeURIComponent(callId)}/accept`).then((r) => r.data);

export const declineCall = (callId: string): Promise<CallInfo> =>
  axios.post(`/api/calls/${encodeURIComponent(callId)}/decline`).then((r) => r.data);

export const endCall = (callId: string): Promise<CallInfo> =>
  axios.post(`/api/calls/${encodeURIComponent(callId)}/end`).then((r) => r.data);

export const isHeadset = (identity: string) => identity.startsWith('headset-');

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function callerLabel(c: CallInfo): string {
  return c.responder?.name || c.responder?.email || (c.device_id ? `Headset ${c.device_id}` : 'Headset');
}

export function statusLabel(c: CallInfo): string {
  switch (c.status) {
    case 'ringing': return 'Ringing';
    case 'active': return 'Live';
    case 'missed': return `Missed (no answer in ${c.ring_timeout_s} s)`;
    case 'cancelled': return 'Cancelled by responder';
    case 'ended':
      if (c.ended_reason === 'doctor_ended') return 'Ended by doctor';
      if (c.ended_reason === 'headset_ended' || c.ended_reason === 'participant_left') return 'Ended by responder';
      if (c.ended_reason === 'max_duration') return 'Ended (time limit)';
      return 'Ended';
    default: return c.status;
  }
}
