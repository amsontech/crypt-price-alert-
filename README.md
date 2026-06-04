# PriceWatch Pro 📡

A 24/7 personal trading price alert system for **Crypto, Forex & Indices**.
Set your levels after analysis — the engine watches the market and fires alerts to
**Telegram, SMS (Twilio), and your browser** even when you're away from your screen.

---

## Stack

| Layer | Tool | Cost |
|---|---|---|
| Backend engine | Node.js + Express | Free |
| Crypto prices | CoinMarketCap API | Free (333 calls/day) |
| Forex & Indices | Twelve Data API | Free (800 calls/day) |
| Telegram alerts | Telegram Bot API | Free |
| SMS alerts | Twilio | Free trial ($15 credit) |
| Hosting | Render.com | Free tier |

---

## Step 1 — Get Your Free API Keys

### CoinMarketCap (Crypto prices)
1. Go to https://coinmarketcap.com/api/
2. Click "Get Your Free API Key"
3. Sign up → verify email → copy your API key

### Twelve Data (Forex & Indices)
1. Go to https://twelvedata.com/
2. Click "Get free API key"
3. Sign up → copy your API key from the dashboard

### Telegram Bot
1. Open Telegram → search for **@BotFather**
2. Send `/newbot` → follow instructions → copy the **Bot Token**
3. Search for **@userinfobot** → start it → copy your **Chat ID**
4. Send any message to your new bot first (so it can message you)

### Twilio SMS (optional)
1. Sign up free at https://twilio.com
2. Get a free trial phone number
3. Copy your **Account SID**, **Auth Token**, and **Twilio phone number**

---

## Step 2 — Deploy to Render (Free, 5 minutes)

### Option A — Deploy via GitHub (recommended)

1. Create a free account at https://github.com
2. Create a new repository called `pricewatch-pro`
3. Upload all files from this folder to the repository
4. Go to https://render.com → sign up free
5. Click **New → Web Service**
6. Connect your GitHub account → select `pricewatch-pro` repo
7. Render auto-detects `render.yaml` — click **Create Web Service**
8. Wait ~2 minutes for the build to complete
9. Your app URL will be: `https://pricewatch-pro.onrender.com`

### Option B — Deploy via Render CLI

```bash
npm install -g @render/cli
render deploy
```

### Important: Set the API URL in the frontend

After deploy, open `public/index.html` and update line 1 of the script:
```js
const API = 'https://your-app-name.onrender.com';
```

Then re-deploy (or just use the app directly from your Render URL — it serves the frontend too).

---

## Step 3 — Configure Your App

1. Open your app URL in the browser
2. Go to **Settings tab**
3. Enter your API keys:
   - CoinMarketCap key → Save
   - Twelve Data key → Save
4. Enter Telegram Bot Token + Chat ID → Save
5. (Optional) Enter Twilio credentials → Save
6. Click **Enable** for browser push notifications
7. Set polling interval (1 minute recommended)

---

## Step 4 — Set Your First Alert

1. Go to **Alerts tab**
2. Click **+ New Alert**
3. Choose market: Crypto / Forex / Index
4. Enter symbol:
   - Crypto: `BTC`, `ETH`, `SOL`, `DOGE`
   - Forex: `EUR/USD`, `GBP/USD`, `USD/JPY`, `XAU/USD`
   - Indices: `NAS100`, `SPX`, `US30`, `GER40`
5. Choose alert type: above / below / zone
6. Enter your target price (from your analysis)
7. Add a note (optional — e.g. "Key resistance", "Fib 0.618")
8. Choose notification channels
9. Click **Set Alert**

The backend engine polls prices every minute and fires your alerts immediately.

---

## Symbol Reference

### Crypto (via CoinMarketCap)
`BTC` `ETH` `SOL` `BNB` `XRP` `DOGE` `ADA` `MATIC` `AVAX` `LINK` `DOT`

### Forex (via Twelve Data)
`EUR/USD` `GBP/USD` `USD/JPY` `USD/CHF` `AUD/USD` `USD/CAD` `NZD/USD`
`GBP/JPY` `EUR/GBP` `XAU/USD` (Gold) `XAG/USD` (Silver)

### Indices (via Twelve Data)
`NAS100` `SPX` `US30` (Dow Jones) `GER40` (DAX) `UK100` (FTSE) `JP225` (Nikkei)

---

## Folder Structure

```
pricewatch/
├── src/
│   ├── server.js      ← Express API + routes
│   └── engine.js      ← Price polling + alert firing
├── public/
│   └── index.html     ← Full web dashboard
├── data/              ← Auto-created, stores alerts.json
├── package.json
├── render.yaml        ← Render deployment config
└── README.md
```

---

## Notes

- **Free tier Render caveat**: The free tier spins down after 15 min of inactivity.
  To keep it always-on, upgrade to Render Starter ($7/mo) or use a free cron ping
  service like https://cron-job.org to ping your URL every 10 minutes.
- **API rate limits**: At 1-min polling with 10 alerts, you use ~600 CMC calls/day
  and ~600 Twelve Data calls/day — both within free tiers.
- **Data persistence**: Alerts are saved to `data/alerts.json` on Render's disk.
  The `render.yaml` mounts a persistent disk so your alerts survive restarts.
