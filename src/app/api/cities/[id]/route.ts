import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { jsonError, safeError, trustedMutation } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const uuid = z.uuid();

export async function GET(_req: NextRequest, ctx: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError('No autorizado.', 401);
    const { id } = await ctx.params;
    if (!uuid.safeParse(id).success) return jsonError('ID inválido.');
    const result = await sql(
      `SELECT id, name, seed, grid_width, grid_height, generator_version, config, created_at, updated_at
       FROM cities WHERE id = $1 AND owner_id = $2`,
      [id, user.id],
    );
    if (!result.rows[0]) return jsonError('Ciudad no encontrada.', 404);
    return NextResponse.json({ city: result.rows[0] });
  } catch (e) {
    return safeError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Context) {
  if (!trustedMutation(req)) return jsonError('Origen no permitido.', 403);
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError('No autorizado.', 401);
    const { id } = await ctx.params;
    if (!uuid.safeParse(id).success) return jsonError('ID inválido.');
    const result = await sql(`DELETE FROM cities WHERE id = $1 AND owner_id = $2 RETURNING id`, [id, user.id]);
    if (!result.rows[0]) return jsonError('Ciudad no encontrada.', 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return safeError(e);
  }
}
