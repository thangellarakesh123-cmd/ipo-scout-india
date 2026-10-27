
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
      source:"IPOMarkets"
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
    const lotCell = cells.find(x=>/lot/i.test(x)) || "";
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
      source:"InvestorGain"
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
        source:"InvestorGain"
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

function dedupe(items){
  const map = new Map();
  for(const x of items){
    const key = x.name.toLowerCase().replace(/[^a-z0-9]/g,"");
    if(!key || /^(opens|closes|open|upcoming)/.test(key)) continue;
    const old = map.get(key);
    // Prefer richer record (subscription + GMP + price).
    const richness = Number(x.subscription.total>0)+Number(x.gmp>0)+Number(x.priceMax>0);
    const oldRichness = old ? Number(old.subscription.total>0)+Number(old.gmp>0)+Number(old.priceMax>0) : -1;
    if(!old || richness > oldRichness) map.set(key,x);
  }
  return [...map.values()];
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300");
  const errors=[];
  let collected=[];

  for(const source of SOURCES){
    try{
      const html=await fetchPage(source.url);
      const rows=source.parser(html);
      collected.push(...rows);
      if(!rows.length) errors.push(`${source.name}: no current IPO rows parsed`);
    }catch(e){
      errors.push(`${source.name}: ${e.message}`);
    }
  }

  collected=dedupe(collected)
    .filter(x=>x.name && x.name.length>2)
    .filter(x=>x.status==="open" || x.status==="upcoming");

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
