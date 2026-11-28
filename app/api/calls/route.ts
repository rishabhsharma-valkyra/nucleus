import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/backend';
import { requireCallRole } from '@/lib/callsServer';

// Call history, newest first; ?patient_id= for one patient's calls.
export async function GET(request: NextRequest) {
  const denied = await requireCallRole();
  if (denied) return denied;
  const qs = new URLSearchParams();
  const patientId = request.nextUrl.searchParams.get('patient_id');
  const limit = request.nextUrl.searchParams.get('limit');
  if (patientId) qs.set('patient_id', patientId.slice(0, 200));
  if (limit && /^\d{1,3}$/.test(limit)) qs.set('limit', limit);
  const { status, data } = await forwardToBackend(`/calls${qs.size ? `?${qs}` : ''}`, { cache: 'no-store' });
  return Response.json(data ?? { calls: [] }, { status });
}
