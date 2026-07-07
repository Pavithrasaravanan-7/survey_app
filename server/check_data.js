import { query } from './db.js';

async function run() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('Today is:', today);

    const { rows: trackRows } = await query('SELECT * FROM track');
    console.log('Officers registered in track table:', trackRows);

    const { rows: ptsRows } = await query('SELECT * FROM track_points WHERE ts::text LIKE $1', [`${today}%`]);
    console.log(`Track points for today (${ptsRows.length}):`, ptsRows);

    const { rows: visitsRows } = await query('SELECT id, off_name, co, lat, lng, date FROM visits WHERE date = $1', [today]);
    console.log(`Visits for today (${visitsRows.length}):`, visitsRows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
