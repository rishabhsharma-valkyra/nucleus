import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { forwardToBackend } from '@/lib/backend';
import { getEffectiveRole } from '@/lib/serverRole';

// Clinician review of one injury's AI read — doctors and admins only.
// The reviewer's identity is taken from the signed-in session here, never
// from the request body, so a review can't be attributed to someone else.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });
  const role = getEffectiveRole(session);
  if (!hasPermission(role, PERMISSIONS.CLINICAL_REVIEW)) {
    return new Response('Forbidden — clinical review requires a doctor or admin role', { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = {
    session_id: body.session_id,
    model_region: body.model_region ?? null,
    frame_keys: Array.isArray(body.frame_keys) ? body.frame_keys : [],
    patient_id: body.patient_id ?? null,
    verdict: body.verdict,
    body_region: body.body_region ?? null,
    wound_type: body.wound_type ?? null,
    severity: body.severity ?? null,
    triage: body.triage ?? null,
    notes: body.notes ?? null,
    ai_snapshot: typeof body.ai_snapshot === 'object' && body.ai_snapshot ? body.ai_snapshot : {},
    reviewer_email: session.user.email,
    reviewer_name: session.user.name ?? null,
    reviewer_role: role,
  };

  const { status, data } = await forwardToBackend('/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return Response.json(data, { status });
}
