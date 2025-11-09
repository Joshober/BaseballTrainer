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
    const conversations = await db.getConversations(decodedToken.sub);
    
    return NextResponse.json(conversations || []);
  } catch (error: any) {
    console.error('Conversations fetch error:', error);
    // Return empty array instead of 500 error to prevent UI errors
    // This allows the app to work even if database is not available
    console.warn('Returning empty conversations array due to error:', error?.message || 'Unknown error');
    return NextResponse.json([]);
  }
}

