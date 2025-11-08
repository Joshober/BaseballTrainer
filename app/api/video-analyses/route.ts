import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getMongoDb } from '@/lib/mongodb/client';

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const videoUrl = searchParams.get('videoUrl');
    const userId = decodedToken.sub;

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl parameter is required' }, { status: 400 });
    }

    const db = await getMongoDb();
    
    // Find video analysis by videoUrl and userId
    const analysis = await db.collection('videoAnalyses').findOne({
      userId,
      videoUrl: videoUrl,
    });

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // Return the analysis data
    return NextResponse.json(analysis.analysis || null);
  } catch (error) {
    console.error('Video analysis fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

