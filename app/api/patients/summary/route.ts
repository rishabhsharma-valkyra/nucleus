import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';

// Aggregate triage stats across all patients — admin/doctor only.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission((await getEffectiveRole(session)), PERMISSIONS.OPERATIONS_VIEW)) {
    return new Response('Forbidden — insufficient role', { status: 403 });
  }

  const { status, data } = await forwardToBackend('/patients/summary');
  return Response.json(data, { status });
}
