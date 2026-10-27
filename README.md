# IPO Scout India — v2 parser fix

This version fixes the issue where status text such as **"Opens in 2d"** was incorrectly displayed as the IPO company name.

## What changed
- Company names are now extracted from the IPO detail link in each table row.
- Status cells such as `Closes in 2d` and `Opens in 3d` are parsed separately.
- Added frontend validation so status text can never be rendered as a company name.
- IPOMarkets remains the primary public source.
- InvestorGain remains a fallback.
- No API key is required.

## Upload these files to GitHub
Replace:
- `api/ipos.js`
- `src/main.jsx`

You may upload the full project if that's easier.

After the GitHub commit, Vercel should automatically redeploy.

## Test
Open:
https://ipo-scout-india.vercel.app/api/ipos

Each item should contain a real `"name"` such as:
- `"Tempsens Instruments (India)"`
- `"Augmont Enterprises"`

Then open the main dashboard.
