import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      // Try to get token from cookie or session
      const token = request.cookies.get('token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      await verifyIdToken(token);
    } else {
      const token = authHeader.substring(7);
      await verifyIdToken(token);
    }

    const body = await request.json();
    const { teamId, uid, distanceFt, sessionId } = body;

    if (!teamId || !uid || !distanceFt || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getDatabaseAdapter();
    await db.updateLeaderboard(teamId, uid, distanceFt, sessionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Leaderboard update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update leaderboard' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('teamId') || 'default';

    const db = getDatabaseAdapter();
    const entries = await db.getLeaderboardEntries(teamId);

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

