import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });
export { schema };
