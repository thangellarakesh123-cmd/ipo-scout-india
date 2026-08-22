# IPO Scout India — Free Public Sources Version

This build does **not require any API key**.

It uses a Vercel serverless function (`api/ipos.js`) to read publicly accessible IPO tracking pages and extract:
- Open/upcoming IPOs
- GMP / GMP %
- Total subscription when available
- Price band
- Dates
- Mainboard vs SME

Primary sources:
- InvestorGain: https://investorgain.in/
- IPOMarkets: https://ipomarkets.com/

The dashboard refreshes manually with the Refresh button and automatically every 5 minutes.

## Ranking
Because free public pages do not always expose QIB/Retail category splits consistently, the score is:
- 50% GMP strength
- 35% total subscription
- 15% Mainboard/SME risk adjustment

## GitHub files
Upload/replace:
- `api/ipos.js`
- `src/main.jsx`
- `src/styles.css`
- `package.json`
- `.env.example`
- `README.md`
- `vercel.json`

## Vercel
No Environment Variables are needed.

After committing to GitHub, Vercel should redeploy automatically. If not:
Deployments → latest → Redeploy.

Test:
`https://ipo-scout-india.vercel.app/api/ipos`

Successful response starts with:
`{"ok":true,...}`

## Important
This uses public webpage scraping, not an official API. It may break if a source changes its HTML or blocks automated requests. The server uses two sources so one can act as a fallback.

GMP is unofficial and is not a guarantee of listing gains. The ranking is informational, not financial advice.
