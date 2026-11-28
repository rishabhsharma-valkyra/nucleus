// Server-only guard for the video-call routes: a signed-in doctor or admin.
// The Hospital API checks the role again; this keeps patients from even
// reaching it. The dev role switch can only lower a role, never raise it.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { getEffectiveRole } from '@/lib/serverRole';

export async function requireCallRole(): Promise<Response | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });
  if (!hasPermission(await getEffectiveRole(session), PERMISSIONS.CALLS_ANSWER)) {
    return Response.json({ detail: 'Video calls are for doctors and admins' }, { status: 403 });
  }
  return null;
}

export const CALL_ACTIONS = ['accept', 'decline', 'end'] as const;
export type CallAction = (typeof CALL_ACTIONS)[number];
