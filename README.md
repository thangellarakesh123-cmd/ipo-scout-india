# IPO Scout India — Secure Live Data Version

This version routes live IPO requests through a Vercel Serverless Function so the API key stays server-side.

## Repository structure

```text
ipo-scout-india/
├── api/
│   └── ipos.js
├── src/
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── vercel.json
```

## Vercel environment variables

In Vercel → Project → Settings → Environment Variables, remove old `VITE_IPO_*` variables and add:

```text
IPO_PROVIDER=ipoguru
IPO_API_KEY=YOUR_REAL_IPO_GURU_API_KEY
```

Then redeploy.

## Test after deployment

Open:

```text
https://YOUR-SITE.vercel.app/api/ipos
```

A working setup returns JSON with `"ok": true` and a `data` array.

If you get HTTP 401/403, the provider rejected the key. Confirm the key is active and copied without spaces, then redeploy.

Official IPO Guru API docs: https://www.ipoguru.in/ipo-gmp-details-developer-api

## Security

Do not upload `.env` to GitHub. `.gitignore` excludes it.

## Disclaimer

The ranking is informational and algorithmic, not investment advice. GMP is unofficial and does not guarantee listing gains.
