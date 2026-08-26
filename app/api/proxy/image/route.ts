import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const path = request.nextUrl.searchParams.get('path');
  if (!path) return new Response('Missing path', { status: 400 });

  try {
    const upstream = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/gcs/image?path=${encodeURIComponent(path)}`,
      { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? '' } }
    );
    const contentType = upstream.headers.get('Content-Type') || 'image/png';
    return new Response(upstream.body, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }
}
