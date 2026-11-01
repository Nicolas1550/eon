import { NextRequest, NextResponse } from 'next/server';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// SameSite=Lax plus Origin validation on state-changing requests.
export function trustedMutation(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

export function safeError(error: unknown) {
  console.error('[EON API]', error);
  return jsonError('Error interno. Intentá nuevamente.', 500);
}
