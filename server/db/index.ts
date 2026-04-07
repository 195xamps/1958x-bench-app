import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema';

// Pool config tuned for Replit autoscale: keep max modest (one instance
// rarely needs >10 simultaneous queries), let idle connections drain so
// nothing's wasted when an instance is spinning down, and fail fast if
// we can't acquire a connection.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  min: 0,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: '195x-bench-api',
});

// Critical: pg pools emit 'error' events for connection-level failures
// (network blip, server restart). Without a listener these become
// uncaughtException and crash the process. Log instead and let pg retry
// on the next query.
pool.on('error', (err) => {
  console.error('[pg pool] unexpected error on idle client:', err.message);
});

export const db = drizzle(pool, { schema });
export { schema };
