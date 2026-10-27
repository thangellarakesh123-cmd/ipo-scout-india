# IPO Scout India — Auto Fundamentals v6

This version keeps the working live/free IPO feed and automatically enriches IPO cards with public financial data when an InvestorGain IPO detail page is available.

## New
- Revenue growth
- PAT growth
- ROE
- ROCE
- Debt/Equity
- Pre-IPO P/E
- Automatic Investment Quality Score
- Overall Score = 45% Listing Gain + 55% Investment Quality

The financial highlights are taken from InvestorGain IPO detail pages, which publish restated financial/KPI data derived from IPO RHP/DRHP disclosures.

If the detail page cannot be found or parsed reliably, Investment Quality remains `Pending` rather than being fabricated.

## Valuation
The current valuation sub-score is based on an absolute pre-IPO P/E heuristic. It is deliberately conservative and is not a full peer-relative valuation.

## Upload to GitHub
Replace:
- `api/ipos.js`
- `src/main.jsx`
- `src/styles.css`

No API key is required.
