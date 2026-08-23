
import * as cheerio from "cheerio";

const SOURCES = [
  { name: "IPOMarkets", url: "https://ipomarkets.com/", parser: parseIPOMarkets },
  { name: "InvestorGain", url: "https://investorgain.in/", parser: parseInvestorGain }
];

function clean(s=""){ return String(s).replace(/\s+/g," ").trim(); }
function n(v){
  const m = clean(v).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
function money(v){ return n(String(v).replace(/[₹+]/g,"")); }

function statusFromText(t){
  t = clean(t).toLowerCase();
  if(t.includes("opens in") || t.includes("upcoming")) return "upcoming";
  if(t.includes("closes in") || t.includes("open") || t.includes("closes today") || t.includes("closes tomorrow")) return "open";
  if(t.includes("allotted") || t.includes("allotment") || t.includes("closed") || t.includes("listed")) return "closed";
  return "";
}

function boardFromText(t){
  return clean(t).toLowerCase().includes("sme") ? "sme" : "mainboard";
}

function parsePercent(text){
  const m = clean(text).match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : 0;
}

function parseSubscription(text){
  const m = clean(text).match(/(\d+(?:\.\d+)?)\s*[x×]/i);
  return m ? Number(m[1]) : 0;
}

function parsePriceBand(text){
  const vals = clean(text).replace(/,/g,"").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if(!vals.length) return [0,0];
  if(vals.length === 1) return [vals[0],vals[0]];
  return [vals[0], vals[1]];
}

function parseDateRange(text){
  const t = clean(text);
  const m = t.match(/(.+?)\s+[–—-]\s+(.+)/);
  return m ? {openDate:clean(m[1]), closeDate:clean(m[2])} : {openDate:"",closeDate:t};
}

function companyFromRow($, tr){
  // Use the actual IPO detail link, not the first <td>. Responsive tables can
  // put the status cell before the company cell in DOM order.
  const anchors = $(tr).find("a").toArray();
  for(const a of anchors){
    const txt = clean($(a).text());
    const href = String($(a).attr("href") || "");
    if(!txt) continue;
    if(/view all|allotment|gmp trend|logo/i.test(txt)) continue;
    if(/\/ipo\/|\/ipos\/|ipo-/i.test(href) || txt.length > 3){
      // reject status-like labels
      if(!/^(opens|closes|open|upcoming|allotted|listed|view)/i.test(txt)) return txt;
    }
  }
  return "";
}
function investorGainDetailUrl($, tr){
  const anchors = $(tr).find("a").toArray();
  for(const a of anchors){
    const href = String($(a).attr("href") || "");
    if(/investorgain\.com\/ipo\//i.test(href)) return href;
    if(/^\/ipo\//i.test(href)) return `https://www.investorgain.com${href}`;
  }
  return "";
}



function ipoMarketsDetailUrl($, tr){
  const anchors = $(tr).find("a").toArray();
  for(const a of anchors){
    const hrefRaw = String($(a).attr("href") || "");
    if(!hrefRaw) continue;
    let href = hrefRaw;
    if(href.startsWith("/")) href = `https://ipomarkets.com${href}`;
    if(/^https?:\/\/(www\.)?ipomarkets\.com\/ipo\/[^/]+\/?$/i.test(href)){
      return href.replace(/\/$/,"");
    }
  }
  return "";
}

function parseIPOMarkets(html){
  const $ = cheerio.load(html);
  const items = [];

  $("table tr").each((idx,tr)=>{
    const rawCells = $(tr).find("th,td").map((_,td)=>clean($(td).text())).get();
    const joined = rawCells.join(" | ");
    const status = statusFromText(joined);
    if(status !== "open" && status !== "upcoming") return;

    const company = companyFromRow($, tr);
    if(!company) return;

    // IPOMarkets visible columns:
    // Company | Status | Band / Price | GMP | Sub | Dates | Listing
    const statusCell = rawCells.find(x => /closes|opens|upcoming|open/i.test(x)) || "";
    const bandCell = rawCells.find(x => /₹\s*\d+\s*[–—-]\s*₹?\s*\d+/.test(x)) || "";
    const gmpCell = rawCells.find(x => /₹/.test(x) && /%/.test(x)) || "";
    const subCell = rawCells.find(x => /\d+(?:\.\d+)?\s*[x×]/i.test(x)) || "";
    const dateCell = rawCells.find(x => /\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}\s*[–—-]\s*\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}/.test(x)) || "";

    const [priceMin,priceMax] = parsePriceBand(bandCell);
    const dates = parseDateRange(dateCell);
    const boardText = clean($(tr).text());

    items.push({
      id:`ipom-${company.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name:company,
      symbol:"",
      type:boardFromText(boardText),
      status,
      statusLabel:statusCell,
      sector:"—",
      exchange:"NSE/BSE",
      priceMin, priceMax,
      lotSize:0,
      issueSize:0,
      openDate:dates.openDate,
      closeDate:dates.closeDate,
      gmp:money(gmpCell),
      gmpPercentage:parsePercent(gmpCell),
      subscription:{qib:0,nii:0,retail:0,total:parseSubscription(subCell)},
      source:"IPOMarkets",
      detailUrl: ipoMarketsDetailUrl($,tr)
    });
  });

  return items;
}

function parseInvestorGain(html){
  const $ = cheerio.load(html);
  const items = [];

  // First parse any server-rendered table rows.
  $("table tr").each((idx,tr)=>{
    const cells = $(tr).find("th,td").map((_,td)=>clean($(td).text())).get();
    const joined = cells.join(" | ");
    const status = statusFromText(joined);
    if(status !== "open" && status !== "upcoming") return;

    const company = companyFromRow($,tr);
    if(!company) return;

    const gmpCell = cells.find(x=>/₹/.test(x) && /%/.test(x)) || cells.find(x=>/^₹/.test(x)) || "";
    const subCell = cells.find(x=>/\d+(?:\.\d+)?\s*[x×]/i.test(x)) || "";
    const issuePriceCell = cells.find((x,i)=>i>0 && /^₹?\d+(?:\.\d+)?$/.test(x)) || "";
    const lotLabelIndex = cells.findIndex(x=>/lot\s*size/i.test(x));
    let lotCell = lotLabelIndex >= 0 ? (cells[lotLabelIndex + 1] || cells[lotLabelIndex]) : "";
    if(!lotCell){
      const joinedWithLabels = clean($(tr).text());
      const lotMatch = joinedWithLabels.match(/Lot\s*Size\s*[:\-]?\s*(\d{1,6})/i);
      lotCell = lotMatch ? lotMatch[1] : "";
    }
    const dateCell = cells.find(x=>/\d{1,2}\s+[A-Za-z]{3}/.test(x)) || "";

    const issuePrice = money(issuePriceCell);
    items.push({
      id:`ig-${company.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name:company,
      symbol:"",
      type:boardFromText(joined),
      status,
      sector:"—",
      exchange:/nse/i.test(joined) ? "NSE" : /bse/i.test(joined) ? "BSE" : "NSE/BSE",
      priceMin:issuePrice,
      priceMax:issuePrice,
      lotSize:n(lotCell),
      issueSize:0,
      openDate:"",
      closeDate:dateCell,
      gmp:money(gmpCell),
      gmpPercentage:parsePercent(gmpCell),
      subscription:{qib:0,nii:0,retail:0,total:parseSubscription(subCell)},
      source:"InvestorGain",
      detailUrl: investorGainDetailUrl($,tr)
    });
  });

  // InvestorGain homepage also has a server-rendered "Right Now" hero.
  // Parse it as a fallback. Example:
  // Tempsens Instruments (India) MAINBOARD ... OPEN ₹270 ▲ 90.00%
  // Expected listing: ₹300 issue + ₹270 GMP ... Lot Size 50 Subscription 5.95x Closes 24 Aug
  if(!items.some(x=>x.status==="open")){
    const body = clean($("body").text());
    const hero = body.match(
      /([A-Za-z0-9&().,'’ -]{3,100})\s+(MAINBOARD|SME)[^₹]{0,120}?OPEN[^₹]{0,40}?₹\s*(\d+(?:\.\d+)?)\s*[▲+]?[\s(]*(\d+(?:\.\d+)?)%[^]{0,180}?Expected listing:\s*₹\s*(\d+(?:\.\d+)?)\s*issue\s*\+\s*₹\s*\d+(?:\.\d+)?\s*GMP[^]{0,160}?Lot Size\s*(\d+)[^]{0,120}?Subscription\s*(\d+(?:\.\d+)?)x[^]{0,120}?Closes\s*([0-9]{1,2}\s+[A-Za-z]{3})/i
    );
    if(hero){
      items.push({
        id:`ig-hero-${clean(hero[1]).toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
        name:clean(hero[1]),
        symbol:"",
        type:hero[2].toLowerCase()==="sme" ? "sme" : "mainboard",
        status:"open",
        sector:"—",
        exchange:"NSE/BSE",
        priceMin:Number(hero[5]),
        priceMax:Number(hero[5]),
        lotSize:Number(hero[6]),
        issueSize:0,
        openDate:"",
        closeDate:clean(hero[8]),
        gmp:Number(hero[3]),
        gmpPercentage:Number(hero[4]),
        subscription:{qib:0,nii:0,retail:0,total:Number(hero[7])},
        source:"InvestorGain",
        detailUrl:""
      });
    }
  }

  return items;
}

async function fetchPage(url){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(),8000);
  try{
    const r = await fetch(url,{
      signal:ctl.signal,
      headers:{
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept":"text/html,application/xhtml+xml"
      }
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(timer); }
}

function normalizeCompanyKey(name){
  return clean(name)
    .toLowerCase()
    .replace(/(limited|ltd|india|private|pvt|ipo|mainboard|sme)/g," ")
    .replace(/[^a-z0-9]/g,"")
    .trim();
}

function isGarbageName(name){
  const t = clean(name);
  if(!t) return true;
  if(t.length < 3 || t.length > 120) return true;
  if(/How GMP Works|Refresh cycle|IPOs tracked|Open right now/i.test(t)) return true;
  if(/^(opens?|closes?|open|upcoming|listed|allotted|view all)/i.test(t)) return true;
  return false;
}

function scoreRecord(x){
  let s = 0;
  if(x.source === "IPOMarkets") s += 10;
  if(x.priceMax > 0) s += 3;
  if(x.gmp > 0) s += 3;
  if(x.gmpPercentage > 0) s += 2;
  if(x.subscription?.total > 0) s += 3;
  if(x.closeDate) s += 1;
  return s;
}

function mergeRecords(a,b){
  const aScore = scoreRecord(a);
  const bScore = scoreRecord(b);
  const primary = aScore >= bScore ? {...a} : {...b};
  const other = aScore >= bScore ? b : a;

  primary.priceMin = primary.priceMin || other.priceMin || 0;
  primary.priceMax = primary.priceMax || other.priceMax || 0;
  primary.gmp = primary.gmp || other.gmp || 0;
  primary.gmpPercentage = primary.gmpPercentage || other.gmpPercentage || 0;
  primary.lotSize = primary.lotSize || other.lotSize || 0;
  primary.issueSize = primary.issueSize || other.issueSize || 0;
  primary.openDate = primary.openDate || other.openDate || "";
  primary.closeDate = primary.closeDate || other.closeDate || "";
  primary.detailUrl = primary.detailUrl || other.detailUrl || "";
  primary.subscription = {
    qib: primary.subscription?.qib || other.subscription?.qib || 0,
    nii: primary.subscription?.nii || other.subscription?.nii || 0,
    retail: primary.subscription?.retail || other.subscription?.retail || 0,
    total: primary.subscription?.total || other.subscription?.total || 0
  };
  return primary;
}

function dedupe(items){
  const map = new Map();

  for(const x of items){
    if(isGarbageName(x.name)) continue;

    const key = normalizeCompanyKey(x.name);
    if(!key) continue;

    const issuePrice = Number(x.priceMax || x.priceMin || 0);
    if(issuePrice > 0 && x.gmpPercentage > 0){
      const implied = issuePrice * x.gmpPercentage / 100;
      if(x.gmp > issuePrice * 3 || x.gmp > implied * 4){
        x.gmp = Math.round(implied * 100) / 100;
      }
    }

    const existing = map.get(key);
    if(!existing) map.set(key,x);
    else map.set(key, mergeRecords(existing,x));
  }

  return [...map.values()];
}



function companyKey(name){
  return clean(name)
    .toLowerCase()
    .replace(/\b(limited|ltd|india|private|pvt|ipo|mainboard|sme)\b/g," ")
    .replace(/[^a-z0-9]/g,"");
}

function discoverInvestorGainLinks(html){
  const $ = cheerio.load(html);
  const links = [];

  $('a[href*="/ipo/"]').each((_,a)=>{
    const hrefRaw = String($(a).attr("href") || "");
    let href = hrefRaw;
    if(href.startsWith("/")) href = `https://www.investorgain.com${href}`;
    if(!/^https?:\/\/(www\.)?investorgain\.com\/ipo\//i.test(href)) return;

    const text = clean($(a).text());
    const imgAlt = clean($(a).find("img").first().attr("alt") || "");
    const title = clean($(a).attr("title") || "");
    const label = [text, imgAlt, title].filter(Boolean).join(" ");
    if(!label) return;

    links.push({
      href,
      label,
      key: companyKey(label)
    });
  });

  // unique by URL
  return [...new Map(links.map(x=>[x.href,x])).values()];
}

function bestInvestorGainLink(name, links){
  const target = companyKey(name);
  if(!target) return "";

  // Exact/contained normalized name is most reliable.
  let hit = links.find(x => x.key === target || x.key.includes(target) || target.includes(x.key));
  if(hit) return hit.href;

  // Token overlap fallback.
  const tokens = clean(name).toLowerCase()
    .replace(/\b(limited|ltd|india|private|pvt|ipo|mainboard|sme)\b/g," ")
    .split(/[^a-z0-9]+/)
    .filter(t=>t.length>=3);

  let best = null, bestScore = 0;
  for(const x of links){
    const l = x.label.toLowerCase();
    const matched = tokens.filter(t=>l.includes(t)).length;
    const score = tokens.length ? matched / tokens.length : 0;
    if(score > bestScore){
      bestScore = score;
      best = x;
    }
  }
  return bestScore >= 0.6 ? best.href : "";
}

function pctGrowth(current, previous){
  current = Number(current || 0);
  previous = Number(previous || 0);
  if(!previous) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function valuationScoreFromPE(pe){
  pe = Number(pe || 0);
  if(!pe) return 10; // neutral if not available
  if(pe <= 15) return 19;
  if(pe <= 25) return 16;
  if(pe <= 40) return 12;
  if(pe <= 60) return 8;
  if(pe <= 90) return 5;
  return 2;
}

function parseFundamentals(html, url){
  const $ = cheerio.load(html);

  let latestIncome = 0, previousIncome = 0;
  let latestPAT = 0, previousPAT = 0;
  let roe = 0, roce = 0, debtEquity = 0, prePE = 0, postPE = 0, pbv = 0;

  $("table").each((_,table)=>{
    const rows = $(table).find("tr").toArray();
    for(const row of rows){
      const cells = $(row).find("th,td").map((_,td)=>clean($(td).text())).get();
      if(cells.length < 2) continue;
      const key = clean(cells[0]).toLowerCase();

      if(/^(total income|revenue from operations|revenue)$/.test(key)){
        latestIncome = n(cells[1]);
        previousIncome = n(cells[2]);
      }
      if(/^(profit after tax|pat)$/.test(key)){
        latestPAT = n(cells[1]);
        previousPAT = n(cells[2]);
      }

      if(/^roe\b/.test(key)) roe = parsePercent(cells[1]);
      if(/^roce\b/.test(key)) roce = parsePercent(cells[1]);
      if(/debt\s*\/?\s*equity/.test(key)) debtEquity = n(cells[1]);
      if(/price to book value/.test(key)) pbv = n(cells[1]);

      if(/^p\/e\b/.test(key) || /^p\/e \(x\)/.test(key)){
        prePE = n(cells[1]);
        postPE = n(cells[2]);
      }
    }
  });

  // Fallback text parsing for layouts that are not standard HTML tables.
  const body = clean($("body").text());

  if(!roe){
    const m = body.match(/\bROE\s+([0-9]+(?:\.[0-9]+)?)%/i);
    if(m) roe = Number(m[1]);
  }
  if(!roce){
    const m = body.match(/\bROCE\s+([0-9]+(?:\.[0-9]+)?)%/i);
    if(m) roce = Number(m[1]);
  }
  if(!debtEquity){
    const m = body.match(/Debt\s*\/\s*Equity\s+([0-9]+(?:\.[0-9]+)?)/i);
    if(m) debtEquity = Number(m[1]);
  }
  if(!prePE){
    const m = body.match(/P\/E\s*\(x\)\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)/i);
    if(m){ prePE = Number(m[1]); postPE = Number(m[2]); }
  }
  if(!pbv){
    const m = body.match(/Price to Book Value\s+([0-9]+(?:\.[0-9]+)?)/i);
    if(m) pbv = Number(m[1]);
  }

  // InvestorGain often states growth explicitly in prose. Use that only as
  // fallback when table-based calculation is unavailable.
  let revenueGrowthPct = latestIncome && previousIncome ? pctGrowth(latestIncome, previousIncome) : 0;
  let profitGrowthPct = latestPAT && previousPAT ? pctGrowth(latestPAT, previousPAT) : 0;

  if(!revenueGrowthPct){
    const m = body.match(/revenue increased by\s+([0-9]+(?:\.[0-9]+)?)%/i);
    if(m) revenueGrowthPct = Number(m[1]);
  }
  if(!profitGrowthPct){
    const m = body.match(/profit after tax\s*\(PAT\)\s*rose by\s+([0-9]+(?:\.[0-9]+)?)%/i)
      || body.match(/profit after tax.*?increased by\s+([0-9]+(?:\.[0-9]+)?)%/i);
    if(m) profitGrowthPct = Number(m[1]);
  }

  const metricCount = [
    revenueGrowthPct !== 0,
    profitGrowthPct !== 0,
    roe > 0,
    roce > 0,
    prePE > 0,
    pbv > 0
  ].filter(Boolean).length;

  const enoughData = metricCount >= 3;

  return {
    verified: Boolean(enoughData),
    revenueGrowthPct: Math.round(revenueGrowthPct * 100) / 100,
    profitGrowthPct: Math.round(profitGrowthPct * 100) / 100,
    roePct: roe,
    rocePct: roce,
    debtToEquity: debtEquity,
    preIPOPE: prePE,
    postIPOPE: postPE,
    priceToBook: pbv,
    valuationScore: valuationScoreFromPE(prePE),
    valuationMethod: prePE ? "Absolute pre-IPO P/E heuristic" : "Neutral fallback; P/E unavailable",
    source: url,
    sourceLabel: "InvestorGain financial highlights (from RHP/DRHP data)"
  };
}


function parseIPOMarketsFundamentals(html, url){
  const $ = cheerio.load(html);

  // IPOMarkets detail pages are server rendered enough that body + script text
  // contains the financial labels. Keep both to survive Next.js layout changes.
  let text = clean(
    $("body").text() + " " +
    $("script").map((_,s)=>$(s).html() || "").get().join(" ")
  );

  // Decode common escaped characters found in Next.js payloads.
  text = text
    .replace(/\\u20b9/gi, "₹")
    .replace(/\\u00d7/gi, "×")
    .replace(/\\u0025/gi, "%")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\"/g, '"');

  function rx(re){
    const m = text.match(re);
    return m ? Number(String(m[1]).replace(/,/g,"")) : 0;
  }

  // These exact labels are currently present on IPOMarkets IPO detail pages.
  const roe =
    rx(/Return on net worth\s+([0-9]+(?:\.[0-9]+)?)%/i) ||
    rx(/RoNW\s+([0-9]+(?:\.[0-9]+)?)%/i) ||
    rx(/ROE\s+([0-9]+(?:\.[0-9]+)?)%/i);

  const roce =
    rx(/ROCE\s+([0-9]+(?:\.[0-9]+)?)%/i);

  const debtEquity =
    rx(/Debt\s*\/\s*Equity\s+([0-9]+(?:\.[0-9]+)?)/i);

  const pe =
    rx(/P\/E at issue price\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i) ||
    rx(/P\/E\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);

  let revenueGrowthPct =
    rx(/Revenue CAGR\s*\+?(-?[0-9]+(?:\.[0-9]+)?)%/i);

  let profitGrowthPct =
    rx(/PAT growth\s*\(YoY\)\s*\+?(-?[0-9]+(?:\.[0-9]+)?)%/i) ||
    rx(/PAT growth\s*\+?(-?[0-9]+(?:\.[0-9]+)?)%/i);

  // Financial table fallback: calculate growth from the latest two FY rows.
  if(!revenueGrowthPct || !profitGrowthPct){
    $("table").each((_,table)=>{
      const rows = $(table).find("tr").toArray();
      const header = rows[0]
        ? $(rows[0]).find("th,td").map((_,td)=>clean($(td).text())).get()
        : [];

      if(!header.some(x=>/^Period$/i.test(x)) ||
         !header.some(x=>/^Revenue$/i.test(x)) ||
         !header.some(x=>/^PAT$/i.test(x))) return;

      const dataRows = rows.slice(1)
        .map(row => $(row).find("th,td").map((_,td)=>clean($(td).text())).get())
        .filter(cells => cells.length >= 3 && /FY20\d{2}/i.test(cells[0]));

      if(dataRows.length >= 2){
        const latestRev = numberFrom(dataRows[0][1]);
        const prevRev = numberFrom(dataRows[1][1]);
        const latestPat = numberFrom(dataRows[0][2]);
        const prevPat = numberFrom(dataRows[1][2]);

        if(!revenueGrowthPct && prevRev)
          revenueGrowthPct = ((latestRev-prevRev)/Math.abs(prevRev))*100;

        if(!profitGrowthPct && prevPat)
          profitGrowthPct = ((latestPat-prevPat)/Math.abs(prevPat))*100;
      }
    });
  }

  // Lot/minimum investment.
  let lotSize = 0;
  let minInvestment = 0;

  const lot = text.match(/Retail\s*\(min\)\s*\|?\s*1\s*\|?\s*([0-9,]+)\s*\|?\s*₹\s*([0-9,]+)/i)
    || text.match(/One lot is\s*([0-9,]+)\s*shares.*?₹\s*([0-9,]+)/i)
    || text.match(/Lot\s*\/\s*min\s*([0-9,]+)\s*sh\s*₹\s*([0-9,]+)/i);

  if(lot){
    lotSize = numberFrom(lot[1]);
    minInvestment = numberFrom(lot[2]);
  }

  const issueSize =
    rx(/Issue size\s+₹\s*([0-9,.]+)\s*Cr/i);

  // Subscription category values when live.
  const qib = rx(/QIB\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);
  const nii = rx(/NII\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);
  const retail = rx(/Retail\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);
  const total = rx(/Total\s+([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);

  const metricCount = [
    revenueGrowthPct !== 0,
    profitGrowthPct !== 0,
    roe > 0,
    roce > 0,
    pe > 0
  ].filter(Boolean).length;

  return {
    verified: metricCount >= 3,
    revenueGrowthPct: Math.round(revenueGrowthPct*100)/100,
    profitGrowthPct: Math.round(profitGrowthPct*100)/100,
    roePct: roe,
    rocePct: roce,
    debtToEquity: debtEquity,
    preIPOPE: pe,
    postIPOPE: pe,
    priceToBook: 0,
    valuationScore: valuationScoreFromPE(pe),
    valuationMethod: pe ? "Absolute issue P/E heuristic" : "Neutral fallback; P/E unavailable",
    source: url,
    sourceLabel: "IPOMarkets public RHP/DRHP-derived financial data",
    _detail: {
      lotSize,
      minInvestment,
      issueSize,
      subscription:{qib,nii,retail,total}
    },
    _debug: {
      metricCount,
      found: {
        revenueGrowthPct: revenueGrowthPct !== 0,
        profitGrowthPct: profitGrowthPct !== 0,
        roe: roe > 0,
        roce: roce > 0,
        pe: pe > 0
      }
    }
  };
}

async function enrichFundamentals(items, errors, investorGainHomeHtml){
  const investorLinks = discoverInvestorGainLinks(investorGainHomeHtml || "");

  return await Promise.all(items.map(async item => {
    let enriched = {...item};

    // Primary: same IPOMarkets detail page already linked from the live IPO row.
    if(item.detailUrl && /ipomarkets\.com\/ipo\//i.test(item.detailUrl)){
      try{
        const html = await fetchPage(item.detailUrl);
        const parsed = parseIPOMarketsFundamentals(html, item.detailUrl);

        const d = parsed._detail || {};
        if(d.lotSize) enriched.lotSize = d.lotSize;
        if(d.minInvestment) enriched.minInvestment = d.minInvestment;
        if(d.issueSize) enriched.issueSize = d.issueSize;

        if(d.subscription){
          enriched.subscription = {
            qib: d.subscription.qib || enriched.subscription?.qib || 0,
            nii: d.subscription.nii || enriched.subscription?.nii || 0,
            retail: d.subscription.retail || enriched.subscription?.retail || 0,
            total: d.subscription.total || enriched.subscription?.total || 0
          };
        }

        const debug = parsed._debug;
        delete parsed._detail;
        delete parsed._debug;

        if(parsed.verified){
          return {...enriched, fundamentals:parsed};
        }

        errors.push(
          `${item.name} fundamentals parsed ${debug?.metricCount || 0}/5 core metrics ` +
          `(rev=${debug?.found?.revenueGrowthPct||false}, pat=${debug?.found?.profitGrowthPct||false}, ` +
          `roe=${debug?.found?.roe||false}, roce=${debug?.found?.roce||false}, pe=${debug?.found?.pe||false})`
        );
      }catch(e){
        errors.push(`${item.name} IPOMarkets fundamentals: ${e.message}`);
      }
    }

    // Secondary fallback: InvestorGain public detail page.
    const investorUrl = bestInvestorGainLink(item.name, investorLinks);
    if(investorUrl){
      try{
        const html = await fetchPage(investorUrl);
        const fundamentals = parseFundamentals(html, investorUrl);
        if(fundamentals.verified) return {...enriched, fundamentals};
      }catch(e){
        errors.push(`${item.name} InvestorGain fundamentals: ${e.message}`);
      }
    }

    return {...enriched, fundamentals:null};
  }));
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300");
  const errors=[];
  let collected=[];
  let investorGainHomeHtml = "";

  for(const source of SOURCES){
    try{
      const html=await fetchPage(source.url);
      if(source.name === "InvestorGain") investorGainHomeHtml = html;
      const rows=source.parser(html);
      collected.push(...rows);
      if(!rows.length) errors.push(`${source.name}: no current IPO rows parsed`);
    }catch(e){
      errors.push(`${source.name}: ${e.message}`);
    }
  }

  collected=dedupe(collected)
    .filter(x=>x.name && x.name.length>2)
    .filter(x=>!isGarbageName(x.name))
    .filter(x=>x.status==="open" || x.status==="upcoming")
    .map(x=>({
      ...x,
      minInvestment:
        Number(x.lotSize || 0) > 0 && Number(x.priceMax || 0) > 0
          ? Number(x.lotSize) * Number(x.priceMax)
          : 0
    }));

  if(collected.length){
    collected = await enrichFundamentals(collected, errors, investorGainHomeHtml);
  }

  if(!collected.length){
    return res.status(502).json({
      ok:false,
      message:"Public IPO pages were reachable but no valid current IPO names could be parsed.",
      errors
    });
  }

  return res.status(200).json({
    ok:true,
    provider:"Public web sources",
    sourceNote:"GMP is unofficial and may be delayed.",
    fetchedAt:new Date().toISOString(),
    count:collected.length,
    data:collected,
    errors
  });
}
