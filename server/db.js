import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const { Pool } = pg;

// Parse pg DATE (type 1082) as a raw string rather than a local Date object.
// This prevents timezone shifts when translating DATE columns to/from the frontend.
pg.types.setTypeParser(1082, (val) => val);

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. On Render, attach a managed Postgres database and ' +
    'set DATABASE_URL in the service environment settings.'
  );
}

const localDbPattern = /localhost|127\.0\.0\.1/;
if (process.env.NODE_ENV === 'production' && localDbPattern.test(process.env.DATABASE_URL)) {
  throw new Error(
    'DATABASE_URL points to localhost in production. Use a Render-managed database connection string.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Render, Railway, Supabase) require SSL.
  // Disabled automatically for local connections (localhost/127.0.0.1).
  ssl: process.env.DATABASE_URL && !localDbPattern.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

export const query = (text, params) => pool.query(text, params);

export async function waitForDb({ retries = 10, delayMs = 3000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (err) {
      lastError = err;
      console.warn(`Database connect attempt ${attempt}/${retries} failed: ${err.code || err.message}`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});
