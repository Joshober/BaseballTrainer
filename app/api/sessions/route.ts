import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/auth0/admin';
import type { CreateSessionInput } from '@/types/session';

export async function POST(request: NextRequest) {
  try {
    // Verify auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: CreateSessionInput = await request.json();
    
    // Verify user owns this session
    // Auth0 uses 'sub' as the user ID
    if (body.uid !== decodedToken.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getDatabaseAdapter();
    const session = await db.createSession(body);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const searchParams = request.nextUrl.searchParams;
    // Auth0 uses 'sub' as the user ID
    const uid = searchParams.get('uid') || decodedToken.sub;
    const teamId = searchParams.get('teamId');

    const db = getDatabaseAdapter();
    let sessions;
    if (teamId) {
      sessions = await db.getSessionsByTeam(teamId);
    } else {
      sessions = await db.getSessionsByUser(uid);
    }
    
    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Session fetch error:', error);
    const errorMessage = error?.message || 'Internal server error';
    
    // Check for MongoDB connection errors
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('Mongo')) {
      return NextResponse.json({ 
        error: 'Database connection failed',
        message: 'Unable to connect to MongoDB. Please check your MongoDB connection string in .env.local',
        hint: 'The MongoDB cluster might not exist or be accessible. Please verify your MongoDB Atlas connection string.'
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: errorMessage
    }, { status: 500 });
  }
}


