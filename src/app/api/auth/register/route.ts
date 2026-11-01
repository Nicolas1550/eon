import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { jsonError, safeError, trustedMutation } from '@/lib/api';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.email().max(254).transform((x) => x.trim().toLowerCase()),
  password: z.string().min(10, 'Usá al menos 10 caracteres.').max(128),
  displayName: z.string().trim().min(2).max(80),
});

export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return jsonError('Origen no permitido.', 403);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Datos inválidos.');
    const { email, password, displayName } = parsed.data;
    const hash = await bcrypt.hash(password, 12);
    const inserted = await sql<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING id`,
      [email, hash, displayName],
    );
    if (!inserted.rows[0]) return jsonError('Este correo ya está registrado.', 409);
    await createSession(inserted.rows[0].id);
    return NextResponse.json({ user: { id: inserted.rows[0].id, email, display_name: displayName } }, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
