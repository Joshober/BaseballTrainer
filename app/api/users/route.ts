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
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(token);
    } catch (error: any) {
      // If Auth0 is not configured, return helpful error
      if (error.message && error.message.includes('AUTH0_DOMAIN is not configured')) {
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
    // Auth0 uses 'sub' as the user ID
    const targetUid = uid || decodedToken.sub;
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
      // If Auth0 is not configured, return helpful error
      if (error.message && error.message.includes('AUTH0_DOMAIN is not configured')) {
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
    // Auth0 uses 'sub' as the user ID
    if (uid !== decodedToken.sub) {
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

export async function PUT(request: NextRequest) {
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
      // If Auth0 is not configured, return helpful error
      if (error.message && error.message.includes('AUTH0_DOMAIN is not configured')) {
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
    
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    // Verify user owns this account
    // Auth0 uses 'sub' as the user ID
    if (uid !== decodedToken.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { displayName, email, role, teamId } = body;

    const db = getDatabaseAdapter();
    
    // Get existing user
    const existingUser = await db.getUser(uid);
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user with provided fields
    const updatedUser = await db.updateUser(uid, {
      displayName: displayName !== undefined ? displayName : existingUser.displayName,
      email: email !== undefined ? email : existingUser.email,
      role: role !== undefined ? role : existingUser.role,
      teamId: teamId !== undefined ? teamId : existingUser.teamId,
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('User update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}

