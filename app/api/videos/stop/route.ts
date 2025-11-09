import { NextRequest, NextResponse } from 'next/server';

// In-memory store for stop signals by sessionId
// In production, you might want to use Redis or a database
const stopSignals = new Map<string, {
  sessionId: string;
  timestamp: number;
}>();

// Cleanup old stop signals every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  for (const [key, signal] of stopSignals.entries()) {
    if (now - signal.timestamp > maxAge) {
      stopSignals.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Store stop signal
    stopSignals.set(sessionId, {
      sessionId,
      timestamp: Date.now(),
    });

    console.log('🛑 STOP SIGNAL received for session:', sessionId);

    return NextResponse.json({
      success: true,
      message: 'Stop signal received',
      sessionId,
    });
  } catch (error: any) {
    console.error('Error processing stop signal:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to process stop signal',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Check if stop signal exists for this session
    const stopSignal = stopSignals.get(sessionId);

    if (stopSignal) {
      // Delete the signal after reading it (one-time use)
      stopSignals.delete(sessionId);
      return NextResponse.json({
        success: true,
        shouldStop: true,
      });
    }

    return NextResponse.json({
      success: true,
      shouldStop: false,
    });
  } catch (error: any) {
    console.error('Error checking stop signal:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to check stop signal',
      },
      { status: 500 }
    );
  }
}

