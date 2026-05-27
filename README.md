# 🇹🇭 กองทุนไทย Research Dashboard

แพลตฟอร์มค้นหาข้อมูลกองทุนรวมไทยเพื่อการศึกษา  
ข้อมูลจาก [SEC Open API Thailand](https://api.sec.or.th)

> **⚠️ ข้อจำกัด:** เว็บไซต์นี้จัดทำเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน

---

## Features

- 🔍 **ค้นหากองทุน** — ค้นด้วยชื่อ รหัส บลจ. ประเภท หรือระดับความเสี่ยง
- 📊 **เปรียบเทียบกองทุน** — สูงสุด 5 กองทุน พร้อมกราฟ Normalized
- 🏆 **จัดอันดับกองทุน** — กรองตาม Return, Volatility, Drawdown, Sharpe Ratio
- 📈 **กราฟ NAV** — ย้อนหลังสูงสุด 5 ปี
- 📚 **ศูนย์เรียนรู้** — อธิบาย NAV, Return, Volatility, Drawdown, Sharpe ในภาษาไทย
- 🔄 **อัปเดตอัตโนมัติ** — ทุกวัน 18:30 น. ผ่าน Vercel Cron (11:30 UTC)

## Tech Stack

- **Framework:** Next.js 15/16 App Router + TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Database:** PostgreSQL (Neon via Vercel Marketplace)
- **ORM:** Prisma 7 + `@prisma/adapter-pg`
- **Validation:** Zod
- **Deployment:** Vercel Hobby Plan

---

## Quick Start

### Prerequisites

1. Node.js 22+
2. Neon PostgreSQL account (free tier) — or any PostgreSQL
3. SEC Open API keys ([register here](https://developer.sec.or.th))

### Installation

```bash
git clone <repo>
cd thai-fund-dashboard
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local — fill in DATABASE_URL, SEC_API_KEY, SEC_NAV_API_KEY, CRON_SECRET
```

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates all tables)
npm run db:push
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `DIRECT_URL` | optional | Direct (non-pooled) URL for migrations |
| `SEC_API_KEY` | ✅ | SEC Factsheet API subscription key |
| `SEC_NAV_API_KEY` | ✅ | SEC NAV API subscription key |
| `CRON_SECRET` | ✅ | Secret to protect `/api/sync/daily` |
| `NEXT_PUBLIC_APP_URL` | optional | Your deployment URL |
| `RISK_FREE_RATE` | optional | Sharpe ratio risk-free rate (default: 0.015) |

**Security rules:**
- `SEC_API_KEY` and `SEC_NAV_API_KEY` are **server-side only** — never prefix with `NEXT_PUBLIC_`
- All SEC API calls happen server-side in Route Handlers or lib/sync.ts
- `CRON_SECRET` must match the `x-cron-secret` header sent by Vercel Cron

---

## Deployment to Vercel

### Step-by-step

1. **Push to GitHub** — create a repo and push this code

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repo
   - Vercel auto-detects Next.js

3. **Add Neon PostgreSQL**
   - Vercel Dashboard → Storage → Add → Neon
   - Free tier is sufficient for starter use
   - Neon will auto-populate `DATABASE_URL` in Vercel env vars

4. **Set Environment Variables** in Vercel Dashboard:
   ```
   SEC_API_KEY=your-key
   SEC_NAV_API_KEY=your-nav-key
   CRON_SECRET=generate-with-openssl-rand-hex-32
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

5. **Deploy** — Vercel builds and deploys automatically

6. **Run DB Schema Push** — in Vercel terminal or via local with production DATABASE_URL:
   ```bash
   npx prisma db push
   ```

7. **Trigger First Sync** — manually or wait for the next 11:30 UTC:
   ```bash
   curl -X POST https://your-app.vercel.app/api/sync/daily \
     -H "x-cron-secret: your-cron-secret"
   ```

8. **Verify** — visit `https://your-app.vercel.app/api/health`

### Vercel Cron

`vercel.json` already has the cron configured:
```json
{
  "crons": [
    {
      "path": "/api/sync/daily",
      "schedule": "30 11 * * *"
    }
  ]
}
```
This runs at 11:30 UTC = 18:30 Thailand time, every day.

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/search?q=TEXT` | GET | Search funds by name/code/AMC |
| `/api/funds` | GET | List/filter/sort funds (paginated) |
| `/api/funds/[projId]` | GET | Fund detail with metrics |
| `/api/funds/[projId]/nav?period=1Y` | GET | NAV history |
| `/api/funds/[projId]/metrics` | GET | All period metrics |
| `/api/compare?funds=A,B&period=1Y` | GET | Compare up to 5 funds |
| `/api/rankings?metric=return1Y` | GET | Rankings/screener |
| `/api/sync/daily` | POST | Daily sync (CRON_SECRET required) |
| `/api/health` | GET | Health check |

---

## Project Structure

```
app/
  page.tsx              # Homepage
  funds/
    page.tsx            # Fund browser (server)
    fund-browser.tsx    # Fund browser (client)
    [projId]/
      page.tsx          # Fund detail (server)
      fund-charts.tsx   # Fund charts (client)
  compare/
    page.tsx            # Compare page
    compare-client.tsx  # Compare logic (client)
  rankings/
    page.tsx            # Rankings page
    rankings-client.tsx # Rankings logic (client)
  learn/page.tsx        # Learning center
  methodology/page.tsx  # Methodology docs
  about/page.tsx        # About page
  api/                  # All API routes

lib/
  db.ts                 # Prisma singleton (Prisma 7 adapter)
  sec-api.ts            # SEC API client (server-side only)
  calculations.ts       # Financial metric calculations
  sync.ts               # Daily sync orchestrator
  rate-limit.ts         # In-memory rate limiter
  utils.ts              # Shared utilities
  errors.ts             # Structured error handling

components/
  layout/navbar.tsx     # Navigation
  layout/footer.tsx     # Footer
  ui/                   # UI primitives (button, card, badge, etc.)
  fund/fund-search.tsx  # Autocomplete fund search
  fund/fund-table.tsx   # Sortable fund table
  charts/nav-chart.tsx  # NAV line chart
  charts/normalized-chart.tsx  # Multi-fund normalized chart
  charts/drawdown-chart.tsx    # Drawdown area chart
  metrics/metric-card.tsx      # Metric display card
  metrics/risk-badge.tsx       # Risk level badge

types/index.ts           # All shared TypeScript types
prisma/schema.prisma     # Database schema
vercel.json              # Cron configuration
```

---

## Calculations Reference

| Metric | Formula |
|---|---|
| Period Return | `(NAV_end - NAV_start) / NAV_start × 100` |
| Daily Return | `NAV_t / NAV_{t-1} - 1` |
| Annualized Volatility | `StdDev(daily_returns) × √252 × 100` |
| Max Drawdown | `min((NAV_t - peak_t) / peak_t × 100)` |
| Sharpe Ratio | `(return_1Y% / 100 - 0.015) / (volatility% / 100)` |
| Normalized NAV | `NAV_t / NAV_first × 100` |

Risk-free rate: 1.5% per year (configurable via `RISK_FREE_RATE` env var)

---

## Known Limitations

1. **SEC API rate limits** — NAV sync is batched with delays; initial sync for many funds takes time
2. **One date at a time** — DailyInfo API doesn't support date ranges
3. **Holiday handling** — System only fetches weekdays; Thai public holidays still return no data from API
4. **Free tier limits** — Vercel Hobby plan cron runs limited to 2 per day; Neon free tier has storage limits
5. **Class matching** — `proj_abbr_name` ≠ `class_abbr_name`; default class uses "-A" suffix rule

## Future Roadmap

- [ ] Add Thai public holiday calendar to skip non-trading days
- [ ] Add fund category benchmarks (e.g., SET index comparison)
- [ ] Portfolio allocation simulator
- [ ] Email alerts for significant NAV changes
- [ ] Expand history to 10 years as storage permits
- [ ] Add fund document links (หนังสือชี้ชวน)
- [ ] Mobile-optimized charts
- [ ] Dark mode

---

## Disclaimer

This project is for educational purposes only. It is not affiliated with or endorsed by the SEC (Office of the Securities and Exchange Commission of Thailand). All fund information comes from SEC Open API. Past performance does not guarantee future results. This is **not** investment advice.
