import { NextResponse } from 'next/server';

// Billing protection not needed
export async function GET() {
  return NextResponse.json({
    enabled: false,
    message: 'Billing protection not needed',
  });
}

