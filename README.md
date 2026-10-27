# IPO Scout India — Fundamentals Fix v6.2

This fixes `Investment Quality: Pending` by using each IPO's IPOMarkets detail page as the primary fundamentals source.

## Why this should work better
The live dashboard already gets current IPO rows from IPOMarkets. Those rows link to IPO detail pages that expose:
- Revenue CAGR / financials
- PAT growth
- RoNW / ROE
- ROCE
- Debt / Equity
- P/E
- Lot size and other issue details

The backend now stores that detail URL and fetches the same company's fundamentals from it.

InvestorGain remains only a fallback.

## Upload to GitHub
Replace only:
- `api/ipos.js`

Keep your current `src/main.jsx` and `src/styles.css`.

Then redeploy Vercel.

Test:
https://ipo-scout-india.vercel.app/api/ipos

Look for:
`"fundamentals":{"verified":true,...}`
