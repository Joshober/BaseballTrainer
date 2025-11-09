import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/auth0/admin';

export async function GET(request: NextRequest) {
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

    const db = getDatabaseAdapter();
    // Auth0 uses 'sub' as the user ID
    try {
      const conversations = await db.getConversations(decodedToken.sub);
      return NextResponse.json(conversations);
    } catch (dbError: any) {
      console.error('Conversations database error:', dbError);
      // Return empty array instead of error - conversations are optional
      // This allows the app to work even if conversations fail
      return NextResponse.json([]);
    }
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    // Return empty array instead of error - conversations are optional
    return NextResponse.json([]);
  }
}

