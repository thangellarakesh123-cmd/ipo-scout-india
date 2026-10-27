# IPO Scout India — Live Public Data Fix v8

This version keeps the existing dashboard, ranking model, risk labels, and bid guidance. It adds a primary structured public IPO feed from Xflot (no API key), retaining IPOMarkets/InvestorGain HTML parsing as a fallback.

- Xflot API documentation: https://www.xflot.com/api-docs
- Attribution is included in the UI as required by that feed's published terms.
- The API is polled no more than once per minute (server cache is 60 seconds; UI refresh is 5 minutes).
- If live feeds fail, the UI shows an explicit unavailable message instead of fictional demo IPOs.
- GMP is unofficial and may be delayed; always verify prices, lot sizes and dates before applying.

Deploy to Vercel from this project. No API key or environment variable is required.
