import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { ensureSchema } from './initDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Map a DB `visits` row back to the camelCase shape the frontend expects
const rowToVisit = (r) => ({
  id: Number(r.id),
  offId: Number(r.off_id),
  offName: r.off_name,
  co: r.co,
  asn: r.asn,
  dno: r.dno,
  st: r.st,
  reg: r.reg,
  contact: r.contact,
  docs: r.docs,
  desc: r.description,
  wd: r.wd,
  zn: r.zn,
  isNew: r.is_new,
  pay: r.pay,
  amt: Number(r.amt),
  appStatus: r.app_status,
  appRemarks: r.app_remarks,
  lat: r.lat,
  lng: r.lng,
  ph: r.ph,
  phf: r.phf,
  ts: r.ts,
  date: r.date,
});

const rowToUser = (r) => ({
  id: Number(r.id),
  name: r.name,
  user: r.username,
  pass: r.pass,
  role: r.role,
  zone: r.zone,
  co: r.co,
});

// ═════════════════════ AUTH API ═════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  const { rows } = await query(
    `SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND pass = $2 AND role = $3 LIMIT 1`,
    [username.trim(), password, role]
  );

  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials or wrong role' });
  }

  const { pass, ...userResponse } = rowToUser(rows[0]);
  res.json(userResponse);
});

// ═════════════════════ USERS API (Admin settings CRUD) ═════════════════════
app.get('/api/users', async (req, res) => {
  const { rows } = await query(`SELECT * FROM users ORDER BY id`);
  res.json(rows.map(rowToUser));
});

app.post('/api/users', async (req, res) => {
  const { name, user, pass, role, zone, co } = req.body;
  if (!name || !user || !pass || !role) {
    return res.status(400).json({ error: 'Name, username, password and role are required' });
  }

  const existing = await query(`SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)`, [user.trim()]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const newId = Date.now();
  const { rows } = await query(
    `INSERT INTO users (id, name, username, pass, role, zone, co)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [newId, name.trim(), user.trim(), pass, role, role === 'admin' ? '' : zone, co ? co.trim() : '']
  );
  res.status(201).json(rowToUser(rows[0]));
});

app.put('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);
  const { name, user, pass, role, zone, co } = req.body;

  if (!name || !user || !pass || !role) {
    return res.status(400).json({ error: 'Name, username, password and role are required' });
  }

  const existing = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const clash = await query(
    `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id != $2`,
    [user.trim(), userId]
  );
  if (clash.rows.length > 0) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const { rows } = await query(
    `UPDATE users SET name=$1, username=$2, pass=$3, role=$4, zone=$5, co=$6 WHERE id=$7 RETURNING *`,
    [name.trim(), user.trim(), pass, role, role === 'admin' ? '' : zone, co ? co.trim() : '', userId]
  );
  res.json(rowToUser(rows[0]));
});

app.delete('/api/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);
  const existing = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (existing.rows[0].role === 'admin') {
    const adminCount = await query(`SELECT COUNT(*) FROM users WHERE role = 'admin'`);
    if (parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only remaining Admin account' });
    }
  }

  await query(`DELETE FROM users WHERE id = $1`, [userId]);
  res.json({ message: 'User deleted successfully' });
});

// ═════════════════════ VISITS API ═════════════════════
app.get('/api/visits', async (req, res) => {
  const { rows } = await query(`SELECT * FROM visits ORDER BY ts DESC`);
  res.json(rows.map(rowToVisit));
});

app.post('/api/visits', async (req, res) => {
  const v = req.body;
  if (!v.co || !v.offName || !v.offId) {
    return res.status(400).json({ error: 'Invalid visit payload structure' });
  }

  const id = v.id || Date.now();
  const ts = v.ts || new Date().toISOString();
  const date = v.date || ts.split('T')[0];

  const { rows } = await query(
    `INSERT INTO visits
       (id, off_id, off_name, co, asn, dno, st, reg, contact, docs, description,
        wd, zn, is_new, pay, amt, app_status, app_remarks, lat, lng, ph, phf, ts, date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      id, v.offId, v.offName, v.co, v.asn || '', v.dno || '', v.st || '', v.reg || '',
      v.contact || '', JSON.stringify(v.docs || {}), v.desc || '', v.wd || '', v.zn || '',
      !!v.isNew, v.pay || '', v.amt || 0, v.appStatus || '', v.appRemarks || '',
      v.lat, v.lng, v.ph, v.phf, ts, date,
    ]
  );
  res.status(201).json(rowToVisit(rows[0]));
});

app.delete('/api/visits', async (req, res) => {
  await query(`DELETE FROM visits`);
  res.json({ message: 'All visits cleared' });
});

// ═════════════════════ TRACK API (GPS Waypoints) ═════════════════════
app.get('/api/track', async (req, res) => {
  const { rows: officers } = await query(`SELECT * FROM track`);
  const { rows: points } = await query(`SELECT * FROM track_points ORDER BY ts ASC`);

  const track = {};
  for (const o of officers) {
    track[o.off_id] = { name: o.name, lastSeen: o.last_seen, pts: [] };
  }
  for (const p of points) {
    if (track[p.off_id]) {
      track[p.off_id].pts.push({ lat: p.lat, lng: p.lng, ts: p.ts });
    }
  }
  res.json(track);
});

app.post('/api/track', async (req, res) => {
  const { userId, name, lat, lng, ts } = req.body;
  if (!userId || !name || !lat || !lng) {
    return res.status(400).json({ error: 'UserId, name, lat, and lng are required' });
  }

  const timestamp = ts || new Date().toISOString();

  await query(
    `INSERT INTO track (off_id, name, last_seen) VALUES ($1,$2,$3)
     ON CONFLICT (off_id) DO UPDATE SET name = $2, last_seen = $3`,
    [userId, name, timestamp]
  );
  await query(`INSERT INTO track_points (off_id, lat, lng, ts) VALUES ($1,$2,$3,$4)`, [userId, lat, lng, timestamp]);

  // Cap at 200 points per officer to save space
  await query(
    `DELETE FROM track_points WHERE off_id = $1 AND id NOT IN (
       SELECT id FROM track_points WHERE off_id = $1 ORDER BY ts DESC LIMIT 200
     )`,
    [userId]
  );

  res.status(201).json({ success: true });
});

// ═════════════════════ ALERTS API (Duplicate warnings) ═════════════════════
app.get('/api/alerts', async (req, res) => {
  const { rows } = await query(`SELECT * FROM alerts ORDER BY ts DESC`);
  res.json(rows.map((a) => ({
    id: Number(a.id), offId: a.off_id, offName: a.off_name, co: a.co, asn: a.asn, reason: a.reason, ts: a.ts,
  })));
});

app.post('/api/alerts', async (req, res) => {
  const alert = req.body;
  if (!alert.co || !alert.offName) {
    return res.status(400).json({ error: 'Invalid alert structure' });
  }

  const id = Date.now();
  const ts = new Date().toISOString();
  const { rows } = await query(
    `INSERT INTO alerts (id, off_id, off_name, co, asn, reason, ts) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, alert.offId, alert.offName, alert.co, alert.asn, alert.reason, ts]
  );
  const a = rows[0];
  res.status(201).json({ id: Number(a.id), offId: a.off_id, offName: a.off_name, co: a.co, asn: a.asn, reason: a.reason, ts: a.ts });
});

app.delete('/api/alerts', async (req, res) => {
  await query(`DELETE FROM alerts`);
  res.json({ message: 'All alerts cleared' });
});

// ═════════════════════ ATTENDANCE API ═════════════════════
app.get('/api/attendance', async (req, res) => {
  const { rows } = await query(`SELECT * FROM attendance ORDER BY date DESC`);
  res.json(rows.map((a) => ({
    id: Number(a.id), offId: a.off_id, offName: a.off_name, date: a.date, status: a.status,
    presentTime: a.present_time, remarks: a.remarks, lat: a.lat, lng: a.lng, ts: a.ts,
  })));
});

app.post('/api/attendance', async (req, res) => {
  const record = req.body;
  if (!record.offId || !record.date || !record.status) {
    return res.status(400).json({ error: 'OffId, date, and status are required' });
  }

  const id = record.id || Date.now();
  const ts = record.ts || new Date().toISOString();

  const { rows } = await query(
    `INSERT INTO attendance (id, off_id, off_name, date, status, present_time, remarks, lat, lng, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (off_id, date) DO UPDATE SET
       status=$5, present_time=$6, remarks=$7, lat=$8, lng=$9, ts=$10
     RETURNING *`,
    [id, record.offId, record.offName, record.date, record.status, record.presentTime, record.remarks, record.lat, record.lng, ts]
  );
  const a = rows[0];
  res.json({
    id: Number(a.id), offId: a.off_id, offName: a.off_name, date: a.date, status: a.status,
    presentTime: a.present_time, remarks: a.remarks, lat: a.lat, lng: a.lng, ts: a.ts,
  });
});

// ═════════════════════ SERVE FRONTEND (production build) ═════════════════════
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Survey Backend Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to apply database schema, exiting:', err);
    process.exit(1);
  });
