import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Set it to your PostgreSQL connection string.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Render, Railway, Supabase) require SSL.
  // Disabled automatically for local connections (localhost/127.0.0.1).
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

export const query = (text, params) => pool.query(text, params);

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});
