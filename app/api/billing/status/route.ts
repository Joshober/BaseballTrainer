import { NextResponse } from 'next/server';
import { getBillingStatus } from '@/lib/firebase/billing-protection';

export async function GET() {
  try {
    const status = getBillingStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Billing status error:', error);
    return NextResponse.json(
      { error: 'Failed to get billing status' },
      { status: 500 }
    );
  }
}

