import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseAdapter } from '@/lib/database';
import { verifyIdToken } from '@/lib/firebase/admin';
import { getBackendUrl } from '@/lib/utils/backend-url';

/**
 * AI Bot endpoint - analyzes videos and provides feedback
 */
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

    const body = await request.json();
    const { messageId, videoURL, sessionId } = body;

    if (!videoURL && !sessionId) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    const db = getDatabaseAdapter();
    const aiBotUid = 'ai_bot';
    const userUid = decodedToken.uid;

    // Get session if sessionId provided
    let session = null;
    if (sessionId) {
      session = await db.getSession(sessionId);
    }

    // If we have a video URL, we can analyze it
    // For now, we'll provide feedback based on session data if available
    let aiResponse = '';
    
    if (session && session.videoAnalysis && session.videoAnalysis.ok) {
      const analysis = session.videoAnalysis;
      const metrics = analysis.metrics;
      const formAnalysis = analysis.formAnalysis;

      // Generate AI feedback based on analysis
      aiResponse = `Great swing! Here's my analysis:\n\n`;
      
      if (metrics) {
        aiResponse += `📊 **Metrics:**\n`;
        aiResponse += `• Bat Speed: ${metrics.batLinearSpeedMph.toFixed(1)} mph\n`;
        aiResponse += `• Exit Velocity: ${metrics.exitVelocityEstimateMph.toFixed(1)} mph\n`;
        aiResponse += `• Launch Angle: ${metrics.launchAngle.toFixed(1)}°\n\n`;
      }

      if (formAnalysis && formAnalysis.feedback && formAnalysis.feedback.length > 0) {
        aiResponse += `💡 **Form Feedback:**\n`;
        formAnalysis.feedback.forEach((fb: string) => {
          aiResponse += `• ${fb}\n`;
        });
        aiResponse += `\n`;
      }

      // Add personalized tips
      if (metrics && metrics.exitVelocityEstimateMph < 60) {
        aiResponse += `💪 **Tip:** Focus on generating more bat speed through your hips and core rotation. This will help increase your exit velocity.\n`;
      } else if (metrics && metrics.exitVelocityEstimateMph >= 60) {
        aiResponse += `🔥 **Excellent!** Your exit velocity is strong. Keep working on consistency!\n`;
      }

      if (formAnalysis && formAnalysis.hip_rotation && formAnalysis.hip_rotation.deviation > 10) {
        aiResponse += `🔄 **Tip:** Work on your hip rotation timing. Your hips should lead your hands through the swing.\n`;
      }
    } else if (videoURL) {
      // If we have a video URL but no analysis, provide generic feedback
      aiResponse = `Thanks for sharing your swing video! I can see you're working on your technique.\n\n`;
      aiResponse += `To provide more detailed feedback, I'll need to analyze the video. Would you like me to analyze it now?\n\n`;
      aiResponse += `In the meantime, here are some general tips:\n`;
      aiResponse += `• Keep your eyes on the ball throughout the swing\n`;
      aiResponse += `• Generate power from your hips and core\n`;
      aiResponse += `• Maintain balance and finish strong\n`;
    } else {
      aiResponse = `Thanks for sharing! I'd love to analyze your swing. Please share a video or session for detailed feedback.`;
    }

    // Create AI bot message
    const aiMessage = await db.createMessage(aiBotUid, {
      receiverUid: userUid,
      content: aiResponse,
    });

    return NextResponse.json(aiMessage);
  } catch (error) {
    console.error('AI bot error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

