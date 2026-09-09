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
      `${process.env.NEXT_PUBLIC_API_BASE}/gcs/text?path=${encodeURIComponent(path)}`,
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' } }
    );
    // A failed fetch previously came back as a 200 text/plain body, so the
    // Gemini report pane rendered the upstream error JSON as if it were the
    // clinical report.
    if (!upstream.ok) {
      return new Response('Upstream error', { status: upstream.status });
    }
    return new Response(upstream.body, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }
}
