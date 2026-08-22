# IPO Scout India — Working Live Version + Dedup Fix

This version keeps the earlier working live-data logic and only fixes the bad duplicate cards.

## Fixed
- Removes junk cards such as `How GMP Works ... Tempsens Instruments (India)`
- Deduplicates the same IPO across InvestorGain and IPOMarkets
- Prefers the cleaner IPOMarkets record when both sources contain the same IPO
- Fills missing fields from the alternate source where useful
- Adds a sanity check for impossible GMP values
- Keeps the same public/free data sources and no API key requirement

## Replace only these files in GitHub
- `api/ipos.js`
- `src/main.jsx`

After committing, let Vercel redeploy automatically.

Then test:
https://ipo-scout-india.vercel.app/api/ipos

You should see each IPO only once.
