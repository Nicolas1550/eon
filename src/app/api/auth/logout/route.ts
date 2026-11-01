import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/auth';
import { jsonError, safeError, trustedMutation } from '@/lib/api';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return jsonError('Origen no permitido.', 403);
  try {
    await revokeSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
