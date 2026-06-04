const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { startEngine } = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, '../data/alerts.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Ensure data dir exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return { alerts: [], history: [], settings: {} };
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch { return { alerts: [], history: [], settings: {} }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ── Alerts CRUD ──────────────────────────────────────────────

app.get('/api/alerts', (req, res) => {
  const db = readDB();
  res.json(db.alerts);
});

app.post('/api/alerts', (req, res) => {
  const db = readDB();
  const alert = { ...req.body, id: Date.now(), active: true, triggered: false, createdAt: new Date().toISOString() };
  db.alerts.unshift(alert);
  writeDB(db);
  res.json(alert);
});

app.put('/api/alerts/:id', (req, res) => {
  const db = readDB();
  const idx = db.alerts.findIndex(a => a.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.alerts[idx] = { ...db.alerts[idx], ...req.body };
  writeDB(db);
  res.json(db.alerts[idx]);
});

app.delete('/api/alerts/:id', (req, res) => {
  const db = readDB();
  db.alerts = db.alerts.filter(a => a.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── History ──────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  const db = readDB();
  res.json(db.history || []);
});

// ── Settings ─────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const db = readDB();
  // Never expose secrets fully — mask them
  const s = db.settings || {};
  res.json({
    tgToken: s.tgToken ? s.tgToken.slice(0,10) + '***' : '',
    tgChatId: s.tgChatId || '',
    twilioSid: s.twilioSid ? s.twilioSid.slice(0,6) + '***' : '',
    twilioPhone: s.twilioPhone || '',
    myPhone: s.myPhone || '',
    cmcKey: s.cmcKey ? s.cmcKey.slice(0,6) + '***' : '',
    tdKey: s.tdKey ? s.tdKey.slice(0,6) + '***' : '',
    pollInterval: s.pollInterval || 60000,
    configured: {
      telegram: !!(s.tgToken && s.tgChatId),
      sms: !!(s.twilioSid && s.twilioToken && s.myPhone),
      cmc: !!s.cmcKey,
      twelvedata: !!s.tdKey,
    }
  });
});

app.post('/api/settings', (req, res) => {
  const db = readDB();
  // Merge — only update fields that aren't masked
  const incoming = req.body;
  const current = db.settings || {};
  for (const key of Object.keys(incoming)) {
    if (incoming[key] && !incoming[key].includes('***')) {
      current[key] = incoming[key];
    }
  }
  db.settings = current;
  writeDB(db);
  res.json({ ok: true });
});

// ── Status ───────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  const db = readDB();
  res.json({
    uptime: Math.floor(process.uptime()),
    alerts: db.alerts.length,
    active: db.alerts.filter(a => a.active && !a.triggered).length,
    triggered: db.alerts.filter(a => a.triggered).length,
    lastPoll: global.lastPoll || null,
  });
});

app.listen(PORT, () => {
  console.log(`PriceWatch server running on port ${PORT}`);
  startEngine(readDB, writeDB);
});
