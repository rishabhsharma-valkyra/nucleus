// Server-only helper for calling the Express backend. Never import this
// from a client component — it attaches the shared internal key that
// authorizes calls to the backend's protected routes.
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/auth';

// Who a backend call is made for. The Hospital API records this user in its
// audit trail and scopes data to their organizations (once organization
// access rules are on). `via` names the feature making the call, e.g. the
// assistant, so the audit trail can tell its lookups from page views.
export interface Actor {
  email: string;
  role?: string | null;
  ip?: string | null;
  via?: string;
}

// The signed-in user of the current request. The role is the real one from
// the sign-in, never the dev role switch.
export async function currentActor(): Promise<Actor | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    return { email: session.user.email, role: session.user.role ?? null, ip };
  } catch {
    return null;    // outside a request (e.g. build time)
  }
}

// Headers for every Hospital API call: the key, plus who it's for. Only this
// server holds the key, so the API trusts these.
export async function backendHeaders(actor?: Actor | null): Promise<Record<string, string>> {
  const out: Record<string, string> = { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' };
  const who = actor === undefined ? await currentActor() : actor;
  if (who?.email) {
    out['x-user-email'] = who.email;
    if (who.role) out['x-user-role'] = who.role;
    if (who.ip) out['x-client-ip'] = who.ip;
    if (who.via) out['x-access-via'] = who.via;
  }
  return out;
}

// `actor` defaults to the signed-in user of the current request
export async function forwardToBackend(path: string, init: RequestInit = {}, actor?: Actor | null) {
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(await backendHeaders(actor)),
    },
  });
  const data = await upstream.json().catch(() => null);
  return { status: upstream.status, data };
}
