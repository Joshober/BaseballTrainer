import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/auth0/admin';
import { getDatabaseAdapter } from '@/lib/database';

// In-memory store for sessions with swing data received
// In production, you might want to use Redis or a database
const sessionsWithSwingData = new Map<string, {
  sessionId: string;
  userId: string;
  swingData: any;
  timestamp: number;
}>();

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  for (const [key, session] of sessionsWithSwingData.entries()) {
    if (now - session.timestamp > maxAge) {
      sessionsWithSwingData.delete(key);
    }
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify auth token if provided
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decodedToken = await verifyIdToken(token);
        userId = decodedToken?.sub || null;
      } catch (error) {
        // If auth fails, we can still accept the data (for internal calls)
        console.warn('Auth verification failed, accepting swing data anyway:', error);
      }
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['t_start', 't_peak', 't_end', 'duration_ms', 'omega_peak_dps', 'bat_speed_mph'];
    const missingFields = requiredFields.filter(field => body[field] === undefined);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields',
          missingFields 
        },
        { status: 400 }
      );
    }

    // Extract swing data
    const swingData = {
      t_start: body.t_start,
      t_peak: body.t_peak,
      t_end: body.t_end,
      duration_ms: body.duration_ms,
      omega_peak_dps: body.omega_peak_dps,
      bat_speed_mph: body.bat_speed_mph,
      attack_angle_deg: body.attack_angle_deg || 0,
      timestamp: body.timestamp || new Date().toISOString(),
    };

    // If sessionId is provided and we have a userId, save to database
    const sessionId = body.sessionId;
    if (sessionId && userId) {
      try {
        const db = getDatabaseAdapter();
        
        // Create or update session with swing data
        // This would integrate with your existing session management
        // For now, we'll just log it
        console.log('Swing data received:', {
          sessionId,
          userId,
          swingData,
        });
        
        // Store swing data for this session (client will poll to check)
        sessionsWithSwingData.set(sessionId, {
          sessionId,
          userId,
          swingData,
          timestamp: Date.now(),
        });
        
        console.log('✅ SWING DETECTED! Session:', sessionId);
        console.log('   Bat Speed:', swingData.bat_speed_mph, 'mph');
        console.log('   Attack Angle:', swingData.attack_angle_deg, 'deg');
        console.log('   Duration:', swingData.duration_ms, 'ms');
        
        // You can add database saving logic here if needed
        // Example:
        // await db.saveSwingData(sessionId, userId, swingData);
      } catch (error) {
        console.error('Error saving swing data to database:', error);
        // Don't fail the request if database save fails
      }
    }

    return NextResponse.json({
      success: true,
      received: swingData,
      message: 'Swing data received successfully',
    });
  } catch (error: any) {
    console.error('Error processing swing data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to process swing data',
      },
      { status: 500 }
    );
  }
}

// Export the sessions map for use in GET endpoint
export { sessionsWithSwingData };

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
    
    // Check if swing data was received for this session
    const sessionData = sessionsWithSwingData.get(sessionId);
    
    if (sessionData) {
      return NextResponse.json({
        success: true,
        hasSwingData: true,
        swingData: sessionData.swingData,
      });
    }
    
    return NextResponse.json({
      success: true,
      hasSwingData: false,
    });
  } catch (error: any) {
    console.error('Error checking swing data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Failed to check swing data',
      },
      { status: 500 }
    );
  }
}

