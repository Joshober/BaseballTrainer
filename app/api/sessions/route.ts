import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyIdToken } from '@/lib/firebase/admin';
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
    if (body.uid !== decodedToken.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const uid = request.nextUrl.searchParams.get('uid') || decodedToken.uid;
    const sessions = await db.getSessionsByUser(uid);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

