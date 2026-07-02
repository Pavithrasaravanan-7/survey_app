// One-time migration: server/db.json  →  PostgreSQL
// Usage:  DATABASE_URL="postgres://..." node server/migrate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_JSON_PATH = path.join(__dirname, 'db.json');

async function migrate() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    console.log('No server/db.json found — nothing to migrate. Schema-only setup, done.');
    process.exit(0);
  }

  const data = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf8'));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ---- users ----
    for (const u of data.users || []) {
      await client.query(
        `INSERT INTO users (id, name, username, pass, role, zone, co)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           name=$2, username=$3, pass=$4, role=$5, zone=$6, co=$7`,
        [u.id, u.name, u.user, u.pass, u.role, u.zone || '', u.co || '']
      );
    }
    console.log(`✔ users: ${(data.users || []).length}`);

    // ---- visits ----
    for (const v of data.visits || []) {
      await client.query(
        `INSERT INTO visits
           (id, off_id, off_name, co, asn, dno, st, reg, contact, docs, description,
            wd, zn, is_new, pay, amt, app_status, app_remarks, lat, lng, ph, phf, ts, date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         ON CONFLICT (id) DO NOTHING`,
        [
          v.id, v.offId, v.offName, v.co, v.asn || '', v.dno || '', v.st || '', v.reg || '',
          v.contact || '', JSON.stringify(v.docs || {}), v.desc || '', v.wd || '', v.zn || '',
          !!v.isNew, v.pay || '', v.amt || 0, v.appStatus || '', v.appRemarks || '',
          v.lat, v.lng, v.ph, v.phf, v.ts || new Date().toISOString(),
          v.date || new Date().toISOString().split('T')[0],
        ]
      );
    }
    console.log(`✔ visits: ${(data.visits || []).length}`);

    // ---- track + track_points ----
    const trackEntries = Object.entries(data.track || {});
    for (const [offId, t] of trackEntries) {
      await client.query(
        `INSERT INTO track (off_id, name, last_seen)
         VALUES ($1,$2,$3)
         ON CONFLICT (off_id) DO UPDATE SET name=$2, last_seen=$3`,
        [offId, t.name, t.lastSeen || null]
      );
      for (const p of t.pts || []) {
        await client.query(
          `INSERT INTO track_points (off_id, lat, lng, ts) VALUES ($1,$2,$3,$4)`,
          [offId, p.lat, p.lng, p.ts]
        );
      }
    }
    console.log(`✔ track: ${trackEntries.length} officers`);

    // ---- alerts ----
    for (const a of data.alerts || []) {
      await client.query(
        `INSERT INTO alerts (id, off_id, off_name, co, asn, reason, ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.offId, a.offName, a.co, a.asn, a.reason, a.ts || new Date().toISOString()]
      );
    }
    console.log(`✔ alerts: ${(data.alerts || []).length}`);

    // ---- attendance ----
    for (const at of data.attendance || []) {
      await client.query(
        `INSERT INTO attendance (id, off_id, off_name, date, status, present_time, remarks, lat, lng, ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (off_id, date) DO UPDATE SET
           status=$5, present_time=$6, remarks=$7, lat=$8, lng=$9, ts=$10`,
        [at.id, at.offId, at.offName, at.date, at.status, at.presentTime, at.remarks, at.lat, at.lng, at.ts || new Date().toISOString()]
      );
    }
    console.log(`✔ attendance: ${(data.attendance || []).length}`);

    // ---- permissions ----
    for (const p of data.permissions || []) {
      await client.query(
        `INSERT INTO permissions (id, off_id, off_name, date, duration, reason, remarks, status, ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.offId, p.offName, p.date, p.duration, p.reason, p.remarks, p.status, p.ts || new Date().toISOString()]
      );
    }
    console.log(`✔ permissions: ${(data.permissions || []).length}`);

    await client.query('COMMIT');
    console.log('\n✅ Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
