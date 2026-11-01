import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { jsonError, safeError, trustedMutation } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  seed: z.number().int().min(0).max(2147483647),
  gridWidth: z.number().int().min(8).max(32),
  gridHeight: z.number().int().min(8).max(32),
  generatorVersion: z.enum(['citygen-1.0.0', 'citygen-2.0.0', 'citygen-3.0.0', 'citygen-4.0.0', 'citygen-5.0.0', 'citygen-6.0.0']).default('citygen-6.0.0'),
  config: z.object({ time: z.number().min(0).max(24), weather: z.enum(['clear', 'haze', 'rain']) }),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError('Iniciá sesión para ver tus ciudades.', 401);
    const result = await sql(
      `SELECT id, name, seed, grid_width, grid_height, generator_version, config, created_at, updated_at
       FROM cities WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 40`,
      [user.id],
    );
    return NextResponse.json({ cities: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return safeError(e);
  }
}

export async function POST(req: NextRequest) {
  if (!trustedMutation(req)) return jsonError('Origen no permitido.', 403);
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError('Iniciá sesión para guardar ciudades.', 401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return jsonError('Datos de ciudad inválidos.');
    const { name, seed, gridWidth, gridHeight, generatorVersion, config } = parsed.data;
    const result = await sql(
      `INSERT INTO cities (owner_id, name, seed, grid_width, grid_height, generator_version, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, name, seed, grid_width, grid_height, generator_version, config, created_at, updated_at`,
      [user.id, name, seed, gridWidth, gridHeight, generatorVersion, JSON.stringify(config)],
    );
    return NextResponse.json({ city: result.rows[0] }, { status: 201 });
  } catch (e) {
    return safeError(e);
  }
}
