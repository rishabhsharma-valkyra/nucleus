import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';

// Registered face photo for a patient — admin/doctor only. Returns
// { patient_id, photo } where photo is a gs:// path (served through
// /api/proxy/image) or null when no photo was registered.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW)) {
    return new Response('Forbidden — insufficient role', { status: 403 });
  }

  const patientId = request.nextUrl.searchParams.get('patient_id');
  if (!patientId) return new Response('Missing patient_id', { status: 400 });

  const { status, data } = await forwardToBackend(`/patient-photo/${encodeURIComponent(patientId)}`);
  return Response.json(data, { status });
}
