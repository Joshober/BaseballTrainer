import { NextRequest, NextResponse } from 'next/server';
import { estimateAnglesFromImageBuffer } from '@/lib/pose/server';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { verifyIdToken } from '@/lib/firebase/admin';

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

    // Get image file from form data
    const formData = await request.formData();
    const file = formData.get('image') as File;
    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Run pose detection
    const result = await estimateAnglesFromImageBuffer(buffer);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Pose detection API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', ok: false },
      { status: 500 }
    );
  }
}

