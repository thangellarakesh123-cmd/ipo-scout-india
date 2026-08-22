function numberFrom(value) {
  if (value === null || value === undefined) return 0;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parsePriceBand(value, fallbackIssuePrice) {
  const nums = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  const issue = numberFrom(fallbackIssuePrice);
  if (!nums.length) return [issue, issue];
  if (nums.length === 1) return [nums[0], nums[0]];
  return [Math.min(...nums), Math.max(...nums)];
}

function normalizeGuru(x, index) {
  const [priceMin, priceMax] = parsePriceBand(x.price_band, x.issue_price);
  return {
    id: x.slug || x.symbol || `${x.name || "ipo"}-${index}`,
    name: x.name || "Unnamed IPO",
    symbol: x.symbol || "",
    type: String(x.type || "Mainboard").toLowerCase().includes("sme") ? "sme" : "mainboard",
    status: String(x.status || "open").toLowerCase(),
    sector: x.sector || x.industry || "—",
    exchange: x.listing_on || x.sub_type || "",
    priceMin,
    priceMax,
    lotSize: numberFrom(x.lot_size),
    issueSize: numberFrom(x.issue_size),
    openDate: x.open_date || "",
    closeDate: x.close_date || "",
    gmp: numberFrom(x.gmp?.price),
    gmpPercentage: numberFrom(x.gmp?.percentage),
    gmpUpdatedAt: x.gmp?.updated_at || null,
    subscription: {
      qib: numberFrom(x.subscription?.qib),
      nii: numberFrom(x.subscription?.nii),
      retail: numberFrom(x.subscription?.retail),
      total: numberFrom(x.subscription?.total),
      updatedAt: x.subscription?.updated_at || null
    },
    source: "IPO Guru"
  };
}

function normalizeNotify(x, index) {
  const [priceMin, priceMax] = parsePriceBand(x.priceBand || x.price_band, x.issuePrice || x.issue_price);
  const sub = x.subscription || {};
  const g = x.gmp || {};
  return {
    id: x.searchId || x.id || x.symbol || `${x.company || x.name || "ipo"}-${index}`,
    name: x.company || x.name || "Unnamed IPO",
    symbol: x.symbol || "",
    type: String(x.type || x.issueType || x.board || "mainboard").toLowerCase().includes("sme") ? "sme" : "mainboard",
    status: String(x.status || "open").toLowerCase(),
    sector: x.sector || x.industry || "—",
    exchange: x.exchange || "",
    priceMin,
    priceMax,
    lotSize: numberFrom(x.lotSize ?? x.lot_size),
    issueSize: numberFrom(x.issueSize ?? x.issue_size),
    openDate: x.openDate || x.open_date || "",
    closeDate: x.closeDate || x.close_date || "",
    gmp: numberFrom(g.price ?? g.amount ?? g.value ?? x.gmpPrice ?? x.gmp_amount),
    subscription: {
      qib: numberFrom(sub.qib ?? x.qibSubscription),
      nii: numberFrom(sub.nii ?? x.niiSubscription),
      retail: numberFrom(sub.retail ?? sub.rii ?? x.retailSubscription),
      total: numberFrom(sub.total ?? x.totalSubscription)
    },
    source: "IPO Notify"
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (!response.ok) {
    const providerMessage = json?.message || json?.error || text.slice(0, 180);
    const err = new Error(providerMessage || `Provider returned HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return json;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const provider = (process.env.IPO_PROVIDER || "ipoguru").toLowerCase();
  const apiKey = process.env.IPO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      message: "IPO_API_KEY is not configured in Vercel Environment Variables."
    });
  }

  try {
    let data = [];

    if (provider === "ipoguru") {
      const json = await fetchJson("https://www.ipoguru.in/api/v1/ipos", {
        headers: {
          "X-API-KEY": apiKey,
          "Accept": "application/json",
          "User-Agent": "IPO-Scout-India/1.0"
        }
      });
      data = (json.data || []).map(normalizeGuru);
    } else if (provider === "iponotify") {
      const openJson = await fetchJson("https://iponotify.me/api/ipo/open?limit=100", {
        headers: {"X-API-KEY": apiKey, "Accept": "application/json"}
      });
      data = (openJson.data || []).map(normalizeNotify);
    } else {
      return res.status(500).json({ok:false, message:`Unsupported IPO_PROVIDER: ${provider}`});
    }

    return res.status(200).json({
      ok: true,
      provider,
      fetchedAt: new Date().toISOString(),
      count: data.length,
      data
    });
  } catch (error) {
    const status = error.status || 502;
    let message = error.message || "Unable to fetch IPO data.";
    if (status === 401 || status === 403) {
      message = `IPO provider rejected the API key (HTTP ${status}). Check IPO_API_KEY in Vercel and confirm the key is active.`;
    } else if (status === 429) {
      message = "IPO provider rate limit reached. Please try again later.";
    }
    return res.status(status >= 400 && status < 600 ? status : 502).json({ok:false, message});
  }
}
