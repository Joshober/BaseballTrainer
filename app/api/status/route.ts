import { NextResponse } from 'next/server';

// Simple status endpoint to prevent 500 errors
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nextjs-frontend',
    version: '1.0.0',
  });
}


