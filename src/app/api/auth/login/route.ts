import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { jsonError, safeError, trustedMutation } from '@/lib/api';

export const runtime = 'nodejs';
const schema = z.object({ email: z.email().max(254), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return jsonError('Origen no permitido.', 403);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return jsonError('Credenciales inválidas.', 400);
    const email = parsed.data.email.trim().toLowerCase();
    const result = await sql<{ id: string; email: string; display_name: string; password_hash: string }>(
      `SELECT id, email, display_name, password_hash FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return jsonError('Correo o contraseña incorrectos.', 401);
    }
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (e) {
    return safeError(e);
  }
}
