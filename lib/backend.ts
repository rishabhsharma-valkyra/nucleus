// Server-only helper for calling the Express backend. Never import this
// from a client component — it attaches the shared internal key that
// authorizes calls to the backend's protected routes.
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/auth';

// Headers for every Hospital API call: the key, plus who is signed in. The
// API records the user in its audit trail of patient-data access and (once
// organization access rules are switched on) scopes data to their
// organizations. Only this server holds the key, so the API trusts these.
// The role sent is the real one from the sign-in, never the dev role switch.
export async function backendHeaders(): Promise<Record<string, string>> {
  const out: Record<string, string> = { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' };
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      out['x-user-email'] = session.user.email;
      if (session.user.role) out['x-user-role'] = session.user.role;
    }
    const ip = headers().get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) out['x-client-ip'] = ip;
  } catch {
    // Outside a request (e.g. build time): key only
  }
  return out;
}

export async function forwardToBackend(path: string, init: RequestInit = {}) {
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(await backendHeaders()),
    },
  });
  const data = await upstream.json().catch(() => null);
  return { status: upstream.status, data };
}
