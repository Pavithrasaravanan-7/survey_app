import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, waitForDb } from './db.js';
import { ensureSchema } from './initDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'https://survey-app-seven-sand.vercel.app',
  'https://survey-app-newdev3.vercel.app',
  'https://survey-app-7h98.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:')
    ) {
      return callback(null, true);
    }
    callback(new Error('CORS policy does not allow access from the specified Origin.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Format any date object or string safely to YYYY-MM-DD in local time
const formatDate = (d) => {
  if (!d) return '';
  if (d instanceof Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof d === 'string') {
    return d.includes('T') ? d.split('T')[0] : d;
  }
  return String(d);
};

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
  payMode: r.pay_mode || '',
  receiptCollected: r.receipt_collected || '',
  receiptPhoto: r.receipt_photo || '',
  ts: r.ts,
  date: formatDate(r.date),
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

app.get('/api/visits/today/:offId', async (req, res) => {
  const { offId } = req.params;

  const { rows } = await query(
    `SELECT *
     FROM visits
     WHERE off_id = $1
     AND date = CURRENT_DATE
     ORDER BY ts DESC`,
    [offId]
  );

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
        wd, zn, is_new, pay, amt, app_status, app_remarks, lat, lng, ph, phf, ts, date, pay_mode, receipt_collected, receipt_photo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
     RETURNING *`,
    [
      id, v.offId, v.offName, v.co, v.asn || '', v.dno || '', v.st || '', v.reg || '',
      v.contact || '', JSON.stringify(v.docs || {}), v.desc || '', v.wd || '', v.zn || '',
      !!v.isNew, v.pay || '', v.amt || 0, v.appStatus || '', v.appRemarks || '',
      v.lat, v.lng, v.ph, v.phf, ts, date, v.payMode || '', v.receiptCollected || '', v.receiptPhoto || '',
    ]
  );
  res.status(201).json(rowToVisit(rows[0]));
});

app.delete('/api/visits', async (req, res) => {
  await query(`DELETE FROM visits`);
  res.json({ message: 'All visits cleared' });
});

app.get('/api/visits/:id/photo/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    const result = await query('SELECT ph, receipt_photo, docs FROM visits WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Visit not found');
    }
    const row = result.rows[0];
    let base64 = '';
    if (type === 'visit') {
      base64 = row.ph;
    } else if (type === 'receipt') {
      base64 = row.receipt_photo || row.docs?.receiptPhoto;
    } else if (type === 'gst') {
      base64 = row.docs?.gstPhoto;
    } else if (type === 'pan') {
      base64 = row.docs?.panPhoto;
    } else if (type === 'rental') {
      base64 = row.docs?.rentalPhoto;
    }

    if (!base64) {
      return res.status(404).send('Photo not found');
    }

    if (base64.startsWith('data:image')) {
      const parts = base64.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const imgBuffer = Buffer.from(parts[1], 'base64');
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': imgBuffer.length
      });
      res.end(imgBuffer);
    } else {
      res.status(400).send('Invalid image format');
    }
  } catch (err) {
    console.error('Failed to serve photo:', err);
    res.status(500).send('Server error');
  }
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
const rowToAttendance = (a) => ({
  id: Number(a.id),
  offId: a.off_id,
  offName: a.off_name,
  date: formatDate(a.date),
  status: a.status,
  presentTime: a.present_time,
  remarks: a.remarks,
  photo: a.photo,
  lat: a.lat,
  lng: a.lng,
  ts: a.ts,
});

app.get('/api/attendance', async (req, res) => {
  const { rows } = await query(`SELECT * FROM attendance ORDER BY date DESC`);
  res.json(rows.map(rowToAttendance));
});

app.post('/api/attendance', async (req, res) => {
  const record = req.body;
  if (!record.offId || !record.date || !record.status) {
    return res.status(400).json({ error: 'OffId, date, and status are required' });
  }

  const id = record.id || Date.now();
  const ts = record.ts || new Date().toISOString();

  const { rows } = await query(
    `INSERT INTO attendance (id, off_id, off_name, date, status, present_time, remarks, photo, lat, lng, ts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (off_id, date) DO UPDATE SET
       status=$5, present_time=$6, remarks=$7, photo=$8, lat=$9, lng=$10, ts=$11
     RETURNING *`,
    [id, record.offId, record.offName, record.date, record.status, record.presentTime, record.remarks, record.photo || null, record.lat, record.lng, ts]
  );
  const a = rows[0];
  res.json(rowToAttendance(a));
});

// ═════════════════════ SERVE FRONTEND (production build) ═════════════════════
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Backend service is running. Frontend is not served from this backend.');
  });
}

async function startServer() {
  await waitForDb();
  await ensureSchema();
  app.listen(PORT, () => {
    console.log(`🚀 Survey Backend Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('❌ Failed to apply database schema or connect to PostgreSQL, exiting:', err);
  process.exit(1);
});
