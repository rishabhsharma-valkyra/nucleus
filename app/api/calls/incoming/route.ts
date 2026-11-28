import { forwardToBackend } from '@/lib/backend';
import { requireCallRole } from '@/lib/callsServer';

// Calls ringing now, and calls in progress this doctor can join. Polled.
export async function GET() {
  const denied = await requireCallRole();
  if (denied) return denied;
  const { status, data } = await forwardToBackend('/calls/incoming', { cache: 'no-store' });
  return Response.json(data ?? { calls: [] }, { status });
}
