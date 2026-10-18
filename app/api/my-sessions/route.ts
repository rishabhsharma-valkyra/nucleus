import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { forwardToBackend } from '@/lib/backend';
import { PATIENT_ACCESS_ENABLED, PATIENT_ACCESS_DISABLED_MESSAGE } from '@/lib/patientAccess';

// Any authenticated user's own sessions — the patientEmail filter is
// always forced to the signed-in user's own email, never client-supplied.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response('Unauthorized', { status: 401 });
  if (!PATIENT_ACCESS_ENABLED) {
    return Response.json({ error: PATIENT_ACCESS_DISABLED_MESSAGE }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const limit = searchParams.get('limit') ?? '20';
  const offset = searchParams.get('offset') ?? '0';

  const { status, data } = await forwardToBackend(
    `/patients?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}&patientEmail=${encodeURIComponent(session.user.email)}`
  );
  return Response.json(data, { status });
}
