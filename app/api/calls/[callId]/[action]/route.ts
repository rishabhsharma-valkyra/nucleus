import { NextRequest } from 'next/server';
import { forwardToBackend } from '@/lib/backend';
import { CALL_ACTIONS, CallAction, requireCallRole } from '@/lib/callsServer';

// accept (answer or join; returns a LiveKit token for this doctor only),
// decline (stop ringing for me), end (end for everyone).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string; action: string }> }
) {
  const denied = await requireCallRole();
  if (denied) return denied;
  const { callId, action } = await params;
  if (!CALL_ACTIONS.includes(action as CallAction) || !/^[A-Za-z0-9-]{8,64}$/.test(callId)) {
    return Response.json({ detail: 'Not found' }, { status: 404 });
  }
  const { status, data } = await forwardToBackend(`/calls/${callId}/${action}`, { method: 'POST', cache: 'no-store' });
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
