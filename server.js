const express = require('express');
const initSqlJs = require('sql.js');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
let db;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
});
function imageOnlyFilter(req, file, cb) {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
}
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: imageOnlyFilter });
app.use('/uploads', express.static(uploadDir));

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, 'lamatrak.db'), buffer);
}

function query(sql, params) {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params) {
  if (params) db.run(sql, params);
  else db.run(sql);
  saveDB();
}

async function startServer() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'lamatrak.db');

  if (fs.existsSync(dbPath)) {
    const file = fs.readFileSync(dbPath);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      role TEXT NOT NULL, pin_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS patrols (
      id TEXT PRIMARY KEY, ranger_id TEXT NOT NULL,
      patrol_type TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT,
      start_lat REAL, start_lng REAL, end_lat REAL, end_lng REAL,
      notes TEXT, status TEXT DEFAULT 'active',
      synced_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS patrol_tracks (
      id TEXT PRIMARY KEY, patrol_id TEXT NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL, altitude REAL, accuracy REAL,
      recorded_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY, patrol_id TEXT NOT NULL,
      type TEXT NOT NULL, lat REAL, lng REAL,
      data TEXT NOT NULL, photo_paths TEXT,
      is_restricted INTEGER DEFAULT 0, recorded_at TEXT NOT NULL,
      synced_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY, ranger_id TEXT NOT NULL, patrol_id TEXT,
      lat REAL, lng REAL, status TEXT DEFAULT 'ok',
      recorded_at TEXT NOT NULL, synced_at TEXT
    )
  `);
  saveDB();

  const userCount = query('SELECT COUNT(*) as c FROM users')[0].c;
  if (userCount === 0) {
    run("INSERT INTO users (id, name, role) VALUES ('u-elder-001', 'Karen Liddy', 'elder')");
    run("INSERT INTO users (id, name, role) VALUES ('u-senior-001', 'Senior Ranger', 'senior_ranger')");
    run("INSERT INTO users (id, name, role) VALUES ('u-ranger-001', 'Ranger 1', 'ranger')");
    run("INSERT INTO users (id, name, role) VALUES ('u-ranger-002', 'Junior Ranger', 'ranger')");
    console.log('Seeded default users');
  }

  app.get('/api/users', (req, res) => {
    res.json(query('SELECT id, name, role, created_at FROM users'));
  });
  app.post('/api/users', (req, res) => {
    const { id, name, role } = req.body;
    const VALID_ROLES = ['ranger', 'senior_ranger', 'elder'];
    if (!id || !name || !role) return res.status(400).json({ error: 'id, name and role are required' });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    try { run('INSERT INTO users (id, name, role) VALUES (?, ?, ?)', [id, name, role]); res.json({ success: true }); }
    catch (e) { res.status(400).json({ error: 'Could not create user' }); }
  });

  app.get('/api/patrols', (req, res) => {
    const { ranger_id, status } = req.query;
    let sql = 'SELECT * FROM patrols WHERE 1=1';
    const params = [];
    if (ranger_id) { sql += ' AND ranger_id = ?'; params.push(ranger_id); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY start_time DESC';
    res.json(query(sql, params.length ? params : undefined));
  });
  app.post('/api/patrols', (req, res) => {
    const { id, ranger_id, patrol_type, start_time, start_lat, start_lng, notes } = req.body;
    const VALID_TYPES = ['land', 'sea', 'cultural_site'];
    if (!id || !ranger_id || !patrol_type || !start_time) return res.status(400).json({ error: 'id, ranger_id, patrol_type and start_time are required' });
    if (!VALID_TYPES.includes(patrol_type)) return res.status(400).json({ error: 'Invalid patrol_type' });
    try { run('INSERT INTO patrols (id,ranger_id,patrol_type,start_time,start_lat,start_lng,notes) VALUES (?,?,?,?,?,?,?)', [id,ranger_id,patrol_type,start_time,start_lat||null,start_lng||null,notes||'']); res.json({success:true}); }
    catch (e) { res.status(400).json({ error: 'Could not create patrol' }); }
  });
  app.put('/api/patrols/:id', (req, res) => {
    const { end_time, end_lat, end_lng, status, notes } = req.body;
    const VALID_STATUS = ['active', 'completed', 'cancelled'];
    if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try { run("UPDATE patrols SET end_time=?,end_lat=?,end_lng=?,status=?,notes=?,updated_at=datetime('now') WHERE id=?", [end_time||null,end_lat||null,end_lng||null,status||'active',notes||'',req.params.id]); res.json({success:true}); }
    catch (e) { res.status(400).json({ error: 'Could not update patrol' }); }
  });

  app.post('/api/tracks', (req, res) => {
    const { points } = req.body;
    try { for (const p of points) run('INSERT OR IGNORE INTO patrol_tracks (id,patrol_id,lat,lng,altitude,accuracy,recorded_at) VALUES (?,?,?,?,?,?,?)', [p.id,p.patrol_id,p.lat,p.lng,p.altitude||null,p.accuracy||null,p.recorded_at]); res.json({ success: true, count: points.length }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get('/api/tracks/:patrolId', (req, res) => {
    res.json(query('SELECT * FROM patrol_tracks WHERE patrol_id = ? ORDER BY recorded_at', [req.params.patrolId]));
  });

  app.get('/api/observations', (req, res) => {
    const { patrol_id, type } = req.query;
    let sql = 'SELECT * FROM observations WHERE 1=1';
    const params = [];
    if (patrol_id) { sql += ' AND patrol_id = ?'; params.push(patrol_id); }
    if (type) { sql += ' AND type = ?'; params.push(type); }
    sql += ' ORDER BY recorded_at DESC';
    res.json(query(sql, params.length ? params : undefined));
  });
  app.post('/api/observations', (req, res) => {
    const { id, patrol_id, type, lat, lng, data, photo_paths, is_restricted, recorded_at } = req.body;
    const VALID_OBS_TYPES = ['weed', 'feral_animal', 'marine', 'water_quality', 'cultural_site'];
    if (!id || !patrol_id || !type || !recorded_at) return res.status(400).json({ error: 'id, patrol_id, type and recorded_at are required' });
    if (!VALID_OBS_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid observation type' });
    try {
      run('INSERT INTO observations (id,patrol_id,type,lat,lng,data,photo_paths,is_restricted,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, patrol_id, type, lat||null, lng||null, typeof data === 'string' ? data : JSON.stringify(data), typeof photo_paths === 'string' ? photo_paths : JSON.stringify(photo_paths || []), is_restricted || 0, recorded_at]);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: 'Could not create observation' }); }
  });

  app.post('/api/upload', upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ path: `/uploads/${req.file.filename}`, filename: req.file.filename });
  });

  app.get('/api/checkins', (req, res) => {
    const { ranger_id, patrol_id } = req.query;
    let sql = 'SELECT * FROM checkins WHERE 1=1';
    const params = [];
    if (ranger_id) { sql += ' AND ranger_id = ?'; params.push(ranger_id); }
    if (patrol_id) { sql += ' AND patrol_id = ?'; params.push(patrol_id); }
    sql += ' ORDER BY recorded_at DESC';
    res.json(query(sql, params.length ? params : undefined));
  });
  app.post('/api/checkins', (req, res) => {
    const { id, ranger_id, patrol_id, lat, lng, status, recorded_at } = req.body;
    const VALID_CHECKIN_STATUS = ['ok', 'help', 'sos', 'missed'];
    if (!id || !ranger_id || !recorded_at) return res.status(400).json({ error: 'id, ranger_id and recorded_at are required' });
    if (status && !VALID_CHECKIN_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid checkin status' });
    try { run('INSERT INTO checkins (id,ranger_id,patrol_id,lat,lng,status,recorded_at) VALUES (?,?,?,?,?,?,?)', [id,ranger_id,patrol_id||null,lat||null,lng||null,status||'ok',recorded_at]); res.json({success:true}); }
    catch (e) { res.status(400).json({ error: 'Could not create checkin' }); }
  });

  app.post('/api/sync', (req, res) => {
    const { patrols = [], observations = [], tracks = [], checkins: ck = [] } = req.body;
    const r = { patrols: 0, observations: 0, tracks: 0, checkins: 0, conflicts: [] };
    try {
      for (const p of patrols) {
        const ex = query('SELECT updated_at FROM patrols WHERE id = ?', [p.id]);
        if (ex.length === 0) {
          run("INSERT INTO patrols (id,ranger_id,patrol_type,start_time,end_time,start_lat,start_lng,end_lat,end_lng,notes,status,synced_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?)", [p.id,p.ranger_id,p.patrol_type,p.start_time,p.end_time||null,p.start_lat||null,p.start_lng||null,p.end_lat||null,p.end_lng||null,p.notes||'',p.status,p.updated_at]);
          r.patrols++;
        } else if (p.updated_at > ex[0].updated_at) {
          run("UPDATE patrols SET ranger_id=?,patrol_type=?,start_time=?,end_time=?,start_lat=?,start_lng=?,end_lat=?,end_lng=?,notes=?,status=?,synced_at=datetime('now'),updated_at=? WHERE id=?", [p.ranger_id,p.patrol_type,p.start_time,p.end_time||null,p.start_lat||null,p.start_lng||null,p.end_lat||null,p.end_lng||null,p.notes||'',p.status,p.updated_at,p.id]);
          r.patrols++;
        } else { r.conflicts.push({ table: 'patrols', id: p.id, reason: 'server_newer' }); }
      }
      for (const o of observations) {
        const ex = query('SELECT updated_at FROM observations WHERE id = ?', [o.id]);
        if (ex.length === 0) {
          run("INSERT INTO observations (id,patrol_id,type,lat,lng,data,photo_paths,is_restricted,recorded_at,synced_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now'),?)", [o.id,o.patrol_id,o.type,o.lat||null,o.lng||null,typeof o.data==='string'?o.data:JSON.stringify(o.data),typeof o.photo_paths==='string'?o.photo_paths:JSON.stringify(o.photo_paths||[]),o.is_restricted||0,o.recorded_at,o.updated_at]);
          r.observations++;
        } else if (o.updated_at && o.updated_at > ex[0].updated_at) {
          run("UPDATE observations SET patrol_id=?,type=?,lat=?,lng=?,data=?,photo_paths=?,is_restricted=?,recorded_at=?,synced_at=datetime('now'),updated_at=? WHERE id=?", [o.patrol_id,o.type,o.lat||null,o.lng||null,typeof o.data==='string'?o.data:JSON.stringify(o.data),typeof o.photo_paths==='string'?o.photo_paths:JSON.stringify(o.photo_paths||[]),o.is_restricted||0,o.recorded_at,o.updated_at,o.id]);
          r.observations++;
        } else { r.conflicts.push({ table: 'observations', id: o.id, reason: 'server_newer' }); }
      }
      for (const t of tracks) { run('INSERT OR IGNORE INTO patrol_tracks (id,patrol_id,lat,lng,altitude,accuracy,recorded_at) VALUES (?,?,?,?,?,?,?)', [t.id,t.patrol_id,t.lat,t.lng,t.altitude||null,t.accuracy||null,t.recorded_at]); r.tracks++; }
      for (const c of ck) {
        const exc = query('SELECT recorded_at FROM checkins WHERE id = ?', [c.id]);
        if (exc.length === 0) {
          run("INSERT INTO checkins (id,ranger_id,patrol_id,lat,lng,status,recorded_at,synced_at) VALUES (?,?,?,?,?,?,?,datetime('now'))", [c.id,c.ranger_id,c.patrol_id||null,c.lat||null,c.lng||null,c.status,c.recorded_at]);
          r.checkins++;
        } else if (c.recorded_at && c.recorded_at > exc[0].recorded_at) {
          run("UPDATE checkins SET ranger_id=?,patrol_id=?,lat=?,lng=?,status=?,recorded_at=?,synced_at=datetime('now') WHERE id=?", [c.ranger_id,c.patrol_id||null,c.lat||null,c.lng||null,c.status,c.recorded_at,c.id]);
          r.checkins++;
        }
      }
      res.json({ success: true, results: r });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/reports/niaa', (req, res) => {
    const { month, year } = req.query;
    const s = `${year}-${String(month).padStart(2,'0')}-01`;
    const e = `${year}-${String(Number(month)+1).padStart(2,'0')}-01`;
    const ps = query('SELECT patrol_type, COUNT(*) as count FROM patrols WHERE start_time >= ? AND start_time < ? GROUP BY patrol_type', [s,e]);
    const os = query('SELECT type, COUNT(*) as count FROM observations WHERE recorded_at >= ? AND recorded_at < ? GROUP BY type', [s,e]);
    res.json({ report_type:'NIAA Monthly Activity Summary', period:`${year}-${String(month).padStart(2,'0')}`, generated_at:new Date().toISOString(), patrol_summary:ps, observation_summary:os });
  });

  app.get('/api/stats', (req, res) => {
    const tp = query('SELECT COUNT(*) as c FROM patrols')[0].c;
    const ap = query("SELECT COUNT(*) as c FROM patrols WHERE status='active'")[0].c;
    const to = query('SELECT COUNT(*) as c FROM observations')[0].c;
    const obt = query('SELECT type, COUNT(*) as count FROM observations GROUP BY type');
    res.json({ totalPatrols:tp, activePatrols:ap, totalObservations:to, observationsByType:obt });
  });

  app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

  app.listen(PORT, () => { console.log('\nLamaTrak server running at http://localhost:' + PORT + '\n'); });
}

startServer().catch(err => { console.error('Failed to start:', err); });