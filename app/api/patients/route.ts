import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';

// Full patient list — admin/doctor only. Patients use /api/my-sessions
// instead, which forces the filter to their own email server-side.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW)) {
    return new Response('Forbidden — insufficient role', { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const limit = searchParams.get('limit') ?? '20';
  const offset = searchParams.get('offset') ?? '0';
  // Optional: narrow to one patient's wound sessions
  const patientId = searchParams.get('patient_id');

  const { status, data } = await forwardToBackend(
    `/patients?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}` +
    (patientId ? `&patient_id=${encodeURIComponent(patientId)}` : '')
  );
  return Response.json(data, { status });
}
