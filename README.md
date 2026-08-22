# IPO Scout India

Responsive IPO dashboard with:
- Manual Refresh button
- 5-minute auto refresh
- Mainboard / SME filtering
- IPO investment ranking score
- GMP and subscription metrics
- Best IPO card
- Demo fallback when API is not configured

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open the local URL shown by Vite.

## Live data

Add an API key to `.env`.

Supported providers:
- `ipoguru` — set `VITE_IPO_PROVIDER=ipoguru`
- `iponotify` — set `VITE_IPO_PROVIDER=iponotify`

The dashboard is built so the frontend works immediately with demo data and automatically switches to live API data after configuration.

## Deploy to Vercel

```bash
npm run build
```

Then import the repository into Vercel and add the same environment variables from `.env` in Project Settings → Environment Variables.

## Important security note

Vite environment variables are exposed to the browser. For a production application with a private API key, place the API calls in a serverless backend (Vercel Function/Netlify Function) and keep the secret key server-side.

## Ranking

- 35% GMP strength
- 30% total subscription
- 20% QIB subscription
- 10% issue-size/risk signal
- 5% board quality

This is an informational ranking, not investment advice. GMP is unofficial and does not guarantee listing gains.
