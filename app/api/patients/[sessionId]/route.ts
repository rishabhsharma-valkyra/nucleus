import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';
import { PATIENT_ACCESS_ENABLED, PATIENT_ACCESS_DISABLED_MESSAGE } from '@/lib/patientAccess';

// Single session lookup. Admin/doctor can open any session; a patient can
// only open their own — enforced here (not just hidden in the UI) by
// forcing the backend's ownership filter whenever the caller lacks
// OPERATIONS_VIEW, regardless of what sessionId they ask for.
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const isPrivileged = hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW);
  if (!isPrivileged && !PATIENT_ACCESS_ENABLED) {
    return Response.json({ error: PATIENT_ACCESS_DISABLED_MESSAGE }, { status: 403 });
  }
  const qs = isPrivileged
    ? ''
    : `?patientEmail=${encodeURIComponent(session.user.email ?? '')}`;

  const { status, data } = await forwardToBackend(
    `/patient/${encodeURIComponent(params.sessionId)}${qs}`
  );
  return Response.json(data, { status });
}
