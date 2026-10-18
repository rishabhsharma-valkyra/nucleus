import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';

// Latest GPS fix of every headset (live_tracking in GCS) — admin/doctor only.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission(getEffectiveRole(session), PERMISSIONS.OPERATIONS_VIEW)) {
    return new Response('Forbidden — insufficient role', { status: 403 });
  }

  const { status, data } = await forwardToBackend('/live-locations');
  return Response.json(data, { status });
}
