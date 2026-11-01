import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { safeError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return safeError(e);
  }
}
