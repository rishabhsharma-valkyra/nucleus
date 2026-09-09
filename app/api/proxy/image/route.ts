import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { authorizeGcsPath } from '@/lib/gcsAccess';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const path = request.nextUrl.searchParams.get('path');
  if (!path) return new Response('Missing path', { status: 400 });

  // Authentication isn't enough — the path is caller-supplied and we attach
  // the internal key to it. See lib/gcsAccess.ts.
  const access = await authorizeGcsPath(session, path);
  if (!access.ok) return new Response(access.message, { status: access.status });

  try {
    const upstream = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/gcs/image?path=${encodeURIComponent(path)}`,
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' } }
    );
    // Don't dress an upstream failure up as a 200 image — the browser would
    // just render a broken tile with no clue why.
    if (!upstream.ok) {
      return new Response('Upstream error', { status: upstream.status });
    }
    const contentType = upstream.headers.get('Content-Type') || 'image/png';
    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
        // Private: these are per-patient medical images, and the response
        // varies by who is asking — a shared cache must never reuse them.
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }
}
