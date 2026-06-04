const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ── Price Fetchers ────────────────────────────────────────────

async function fetchCryptoPrice(symbol, cmcKey) {
  if (!cmcKey) return null;
  try {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol.toUpperCase()}&convert=USD`;
    const res = await fetch(url, { headers: { 'X-CMC_PRO_API_KEY': cmcKey } });
    const data = await res.json();
    const entry = data?.data?.[symbol.toUpperCase()];
    return entry ? entry.quote.USD.price : null;
  } catch (e) {
    console.error(`[CMC] Error fetching ${symbol}:`, e.message);
    return null;
  }
}

async function fetchForexOrIndexPrice(symbol, tdKey) {
  if (!tdKey) return null;
  try {
    // Twelve Data accepts forex pairs like EUR/USD and indices like NAS100, SPX
    const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${tdKey}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.price ? parseFloat(data.price) : null;
  } catch (e) {
    console.error(`[TwelveData] Error fetching ${symbol}:`, e.message);
    return null;
  }
}

async function getPrice(alert, settings) {
  const { market, symbol } = alert;
  if (market === 'crypto') return fetchCryptoPrice(symbol, settings.cmcKey);
  if (market === 'forex' || market === 'index') return fetchForexOrIndexPrice(symbol, settings.tdKey);
  return null;
}

// ── Notifications ─────────────────────────────────────────────

async function sendTelegram(settings, message) {
  if (!settings.tgToken || !settings.tgChatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${settings.tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: settings.tgChatId, text: message, parse_mode: 'HTML' }),
    });
    console.log('[Telegram] Sent:', message);
  } catch (e) {
    console.error('[Telegram] Error:', e.message);
  }
}

async function sendSMS(settings, message) {
  if (!settings.twilioSid || !settings.twilioToken || !settings.myPhone || !settings.twilioPhone) return;
  try {
    const auth = Buffer.from(`${settings.twilioSid}:${settings.twilioToken}`).toString('base64');
    const body = new URLSearchParams({ To: settings.myPhone, From: settings.twilioPhone, Body: message });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.twilioSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    console.log('[SMS] Sent:', message);
  } catch (e) {
    console.error('[SMS] Error:', e.message);
  }
}

function buildMessage(alert, currentPrice) {
  const dir = alert.type === 'above' ? '🟢 ABOVE' : alert.type === 'below' ? '🔴 BELOW' : '🟡 ZONE';
  const target = alert.type === 'range'
    ? `$${Number(alert.priceLow).toLocaleString()} – $${Number(alert.priceHigh).toLocaleString()}`
    : `$${Number(alert.price).toLocaleString()}`;

  return [
    `🔔 <b>PriceWatch Alert</b>`,
    ``,
    `<b>${alert.symbol}</b> hit your ${dir} target`,
    `Target: ${target}`,
    `Current price: <b>$${Number(currentPrice).toLocaleString()}</b>`,
    alert.note ? `Note: ${alert.note}` : '',
    ``,
    `⏰ ${new Date().toUTCString()}`,
  ].filter(l => l !== undefined).join('\n');
}

// ── Alert Checker ─────────────────────────────────────────────

function isTriggered(alert, price) {
  if (alert.type === 'above') return price >= Number(alert.price);
  if (alert.type === 'below') return price <= Number(alert.price);
  if (alert.type === 'range') return price >= Number(alert.priceLow) && price <= Number(alert.priceHigh);
  return false;
}

async function runPollCycle(readDB, writeDB) {
  const db = readDB();
  const settings = db.settings || {};
  const activeAlerts = db.alerts.filter(a => a.active && !a.triggered);

  if (!activeAlerts.length) {
    global.lastPoll = new Date().toISOString();
    return;
  }

  console.log(`[Engine] Polling ${activeAlerts.length} active alerts...`);

  for (const alert of activeAlerts) {
    const price = await getPrice(alert, settings);
    if (price === null) {
      console.warn(`[Engine] Could not fetch price for ${alert.symbol}`);
      continue;
    }

    // Update current price on alert record
    const alertIdx = db.alerts.findIndex(a => a.id === alert.id);
    if (alertIdx !== -1) db.alerts[alertIdx].currentPrice = price;

    if (isTriggered(alert, price)) {
      console.log(`[Engine] 🔔 TRIGGERED: ${alert.symbol} @ $${price}`);
      db.alerts[alertIdx].triggered = true;
      db.alerts[alertIdx].triggeredAt = new Date().toISOString();
      db.alerts[alertIdx].triggeredPrice = price;

      // Add to history
      if (!db.history) db.history = [];
      db.history.unshift({
        id: Date.now(),
        symbol: alert.symbol,
        market: alert.market,
        type: alert.type,
        target: alert.price,
        priceLow: alert.priceLow,
        priceHigh: alert.priceHigh,
        actual: price,
        note: alert.note,
        time: new Date().toISOString(),
      });
      if (db.history.length > 100) db.history = db.history.slice(0, 100);

      // Fire notifications
      const notif = alert.notif || [];
      const message = buildMessage(alert, price);
      const plainMsg = message.replace(/<[^>]+>/g, ''); // strip HTML for SMS

      if (notif.includes('telegram')) await sendTelegram(settings, message);
      if (notif.includes('sms')) await sendSMS(settings, plainMsg);
      // browser push is handled by frontend polling /api/alerts
    }
  }

  writeDB(db);
  global.lastPoll = new Date().toISOString();
}

// ── Engine Starter ────────────────────────────────────────────

function startEngine(readDB, writeDB) {
  const getInterval = () => {
    const db = readDB();
    return parseInt(db.settings?.pollInterval || 60000);
  };

  let timer = null;

  function schedule() {
    const interval = getInterval();
    console.log(`[Engine] Next poll in ${interval / 1000}s`);
    timer = setTimeout(async () => {
      try { await runPollCycle(readDB, writeDB); } catch (e) { console.error('[Engine] Poll error:', e.message); }
      schedule(); // reschedule after each run to pick up interval changes
    }, interval);
  }

  // Run once on startup after short delay, then schedule
  setTimeout(async () => {
    try { await runPollCycle(readDB, writeDB); } catch (e) { console.error('[Engine] Startup poll error:', e.message); }
    schedule();
  }, 5000);

  console.log('[Engine] Started ✓');
}

module.exports = { startEngine };
