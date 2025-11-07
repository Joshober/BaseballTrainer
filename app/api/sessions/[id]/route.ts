import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/auth0/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDatabaseAdapter();
    const session = await db.getSession(id);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    // Verify user has access to this session (owner or team coach)
    // Auth0 uses 'sub' as the user ID
    if (session.uid !== decodedToken.sub) {
      // TODO: Check if user is team coach
      // For now, only allow owner access
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(session);
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

