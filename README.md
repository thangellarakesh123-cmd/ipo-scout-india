# IPO Scout India — Fixed v3

This update removes the problematic InvestorGain scraper completely and uses only the structured IPOMarkets IPO table.

## Fixed
- No more fake company names such as `How GMP Works...`
- No duplicate cards from multiple sources
- GMP is parsed only from the GMP column
- Price band is parsed only from the price-band column
- Status is parsed only from the status column
- Company name comes from the IPO logo `alt` text / company link
- The top recommendation is selected only from IPOs that are currently OPEN

## Replace only these files in GitHub
- `api/ipos.js`
- `src/main.jsx`

After committing, Vercel should redeploy automatically.

Then test:
https://ipo-scout-india.vercel.app/api/ipos

Each object should have a real company name and sensible GMP, for example:
- name: `Technocrats Plasma Systems`
- gmp: `30`
- gmpPercentage: `22.73`

No API key is required.

GMP is unofficial and may change rapidly.
