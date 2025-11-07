import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/auth0/admin';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { uid1, uid2 } = body;

    if (!uid1 || !uid2) {
      return NextResponse.json({ error: 'Missing uid1 or uid2' }, { status: 400 });
    }

    // Verify user is part of this conversation
    // Auth0 uses 'sub' as the user ID
    if (uid1 !== decodedToken.sub && uid2 !== decodedToken.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDatabaseAdapter();
    await db.markMessagesAsRead(uid1, uid2, decodedToken.sub);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

