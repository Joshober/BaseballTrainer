import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Minimal stub: returns no analysis so UI won’t error.
export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('videoUrl') || '';
  return NextResponse.json({ ok: false, message: 'Video analysis API not implemented', videoUrl });
}

