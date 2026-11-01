import 'server-only';
import { Pool, type QueryResultRow } from 'pg';

const globalForPg = globalThis as unknown as { eonPg?: Pool };

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada. Revisá .env.local.');
  }
  if (!globalForPg.eonPg) {
    globalForPg.eonPg = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 8000,
    });
  }
  return globalForPg.eonPg;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(query: string, params: unknown[] = []) {
  return getPool().query<T>(query, params);
}
