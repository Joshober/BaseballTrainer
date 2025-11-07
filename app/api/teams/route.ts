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
    await verifyIdToken(token);

    const db = getDatabaseAdapter();
    const teams = await db.getAllTeams();

    return NextResponse.json(teams);
  } catch (error: any) {
    console.error('Teams fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch teams' },
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
    const decodedToken = await verifyIdToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Team name is required' },
        { status: 400 }
      );
    }

    const db = getDatabaseAdapter();
    // Auth0 uses 'sub' as the user ID
    const team = await db.createTeam(name, decodedToken.sub);

    return NextResponse.json(team);
  } catch (error: any) {
    console.error('Team creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create team' },
      { status: 500 }
    );
  }
}

