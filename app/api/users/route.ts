import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch (error: any) {
      // If Admin SDK is not configured, return helpful error
      if (error.message && error.message.includes('Firebase Admin SDK not configured')) {
        return NextResponse.json({ 
          error: error.message 
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Token verification failed', 
        details: error.message 
      }, { status: 500 });
    }
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get('uid');
    const teamId = searchParams.get('teamId');

    const db = getDatabaseAdapter();
    
    // If teamId is provided, get all users in that team
    if (teamId) {
      const users = await db.getUsersByTeam(teamId);
      return NextResponse.json(users);
    }
    
    // Otherwise, get single user
    const targetUid = uid || decodedToken.uid;
    const user = await db.getUser(targetUid);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch (error: any) {
      // If Admin SDK is not configured, return helpful error
      if (error.message && error.message.includes('Firebase Admin SDK not configured')) {
        return NextResponse.json({ 
          error: error.message 
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Token verification failed', 
        details: error.message 
      }, { status: 500 });
    }
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { uid, displayName, email, role, teamId } = body;

    if (!uid || !displayName || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (role !== 'player' && role !== 'coach') {
      return NextResponse.json(
        { error: 'Invalid role. Must be "player" or "coach"' },
        { status: 400 }
      );
    }

    // Verify user owns this account
    if (uid !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDatabaseAdapter();
    const user = await db.createUser({
      uid,
      displayName,
      email,
      role,
      teamId: teamId || null,
    });

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create/update user' },
      { status: 500 }
    );
  }
}

