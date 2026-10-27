
import * as cheerio from "cheerio";

const SOURCES = [
  {
    name: "InvestorGain",
    url: "https://investorgain.in/",
    parser: parseInvestorGain
  },
  {
    name: "IPOMarkets",
    url: "https://ipomarkets.com/",
    parser: parseIPOMarkets
  }
];

function clean(s=""){ return String(s).replace(/\s+/g," ").trim(); }
function n(v){
  const m = clean(v).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
function money(v){ return n(String(v).replace(/[₹+]/g,"")); }

function statusFromText(t){
  t = clean(t).toLowerCase();
  if(t.includes("upcoming")) return "upcoming";
  if(t.includes("open") || t.includes("closes today") || t.includes("closes tomorrow")) return "open";
  if(t.includes("closed") || t.includes("allotment")) return "closed";
  return "";
}

function boardFromText(t){
  t = clean(t).toLowerCase();
  return t.includes("sme") ? "sme" : "mainboard";
}

function parsePercent(text){
  const m = clean(text).match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : 0;
}

function parseSubscription(text){
  const m = clean(text).match(/(\d+(?:\.\d+)?)\s*[x×]/i);
  return m ? Number(m[1]) : 0;
}

function parsePriceBand(text){
  const vals = clean(text).replace(/,/g,"").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if(!vals.length) return [0,0];
  if(vals.length === 1) return [vals[0], vals[0]];
  return [Math.min(...vals.slice(0,2)), Math.max(...vals.slice(0,2))];
}

function parseDates(text){
  const parts = clean(text).split(/[–—-]/).map(x=>x.trim()).filter(Boolean);
  return {openDate: parts[0] || "", closeDate: parts[1] || ""};
}

function parseInvestorGain(html){
  const $ = cheerio.load(html);
  const items = [];

  $("table tr").each((idx, tr) => {
    const cells = $(tr).find("td").map((_,td)=>clean($(td).text())).get();
    if(cells.length < 7) return;

    const joined = cells.join(" | ");
    const st = statusFromText(joined);
    if(!st || st === "closed") return;

    const first = cells[0];
    const name = clean(first.replace(/Mainboard|BSE SME|NSE SME|SME|NSE\s*\/\s*BSE/gi,""));
    if(!name || /IPO Name/i.test(name)) return;

    const gmpCell = cells[1] || "";
    const subCell = cells[3] || "";
    const issuePrice = money(cells[4] || "");
    const lot = n(cells[5] || "");
    const size = n(cells[6] || "");
    const statusText = cells[7] || joined;
    const dates = parseDates(cells[8] || "");

    items.push({
      id:`ig-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name,
      symbol:"",
      type: boardFromText(first),
      status: statusFromText(statusText) || st,
      sector:"—",
      exchange:first.toLowerCase().includes("bse") ? "BSE" : first.toLowerCase().includes("nse") ? "NSE" : "NSE/BSE",
      priceMin:issuePrice,
      priceMax:issuePrice,
      lotSize:lot,
      issueSize:size,
      openDate:dates.openDate,
      closeDate:dates.closeDate,
      gmp:money(gmpCell),
      gmpPercentage:parsePercent(gmpCell),
      subscription:{qib:0,nii:0,retail:0,total:parseSubscription(subCell)},
      source:"InvestorGain"
    });
  });

  // Fallback: InvestorGain's hero card often contains the current top open IPO even
  // if the table is rendered in a way Cheerio cannot see.
  if(!items.length){
    const body = clean($("body").text());
    const hero = body.match(/([A-Za-z0-9&().,' -]{3,80})\s+MAINBOARD[^₹]*₹\s*(\d+(?:\.\d+)?)\s+▲?\s*(\d+(?:\.\d+)?)%[^L]*Lot Size\s*(\d+)[^S]*Subscription\s*(\d+(?:\.\d+)?)x[^C]*Closes\s*([A-Za-z0-9 ]{3,20})/i);
    if(hero){
      const issueMatch = body.match(/Expected listing:\s*₹\s*(\d+(?:\.\d+)?)\s*issue/i);
      items.push({
        id:"ig-hero",
        name:clean(hero[1]),
        symbol:"",
        type:"mainboard",
        status:"open",
        sector:"—",
        exchange:"NSE/BSE",
        priceMin:issueMatch ? Number(issueMatch[1]) : 0,
        priceMax:issueMatch ? Number(issueMatch[1]) : 0,
        lotSize:Number(hero[4]),
        issueSize:0,
        openDate:"",
        closeDate:clean(hero[6]),
        gmp:Number(hero[2]),
        gmpPercentage:Number(hero[3]),
        subscription:{qib:0,nii:0,retail:0,total:Number(hero[5])},
        source:"InvestorGain"
      });
    }
  }
  return items;
}

function parseIPOMarkets(html){
  const $ = cheerio.load(html);
  const items = [];

  $("table tr").each((idx,tr)=>{
    const cells = $(tr).find("td").map((_,td)=>clean($(td).text())).get();
    if(cells.length < 5) return;

    const joined = cells.join(" | ");
    const status = statusFromText(joined);
    if(!status || status === "closed") return;

    const nameCell = cells[0] || "";
    const name = clean(nameCell.replace(/Mainboard|SME/gi,""));
    if(!name) return;

    const bandCell = cells.find(x=>x.includes("₹") && (x.includes("–") || x.includes("-"))) || cells[2] || "";
    const [priceMin,priceMax] = parsePriceBand(bandCell);
    const gmpCell = cells.find((x,i)=>i>1 && /₹/.test(x) && /%/.test(x)) || cells[3] || "";
    const subCell = cells.find(x=>/[x×]/i.test(x)) || cells[4] || "";
    const dateCell = cells.find(x=>/\d{1,2}\s+[A-Za-z]{3}\s+20\d{2}/.test(x)) || cells[5] || "";
    const dates = parseDates(dateCell);

    items.push({
      id:`ipom-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name,
      symbol:"",
      type:boardFromText(nameCell),
      status,
      sector:"—",
      exchange:"NSE/BSE",
      priceMin,
      priceMax,
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

async function fetchPage(url){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), 8000);
  try{
    const r = await fetch(url,{
      signal:ctl.signal,
      headers:{
        "User-Agent":"Mozilla/5.0 (compatible; IPOScoutIndia/2.0; +https://ipo-scout-india.vercel.app)",
        "Accept":"text/html,application/xhtml+xml"
      }
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

function dedupe(items){
  const map = new Map();
  for(const x of items){
    const key = x.name.toLowerCase().replace(/[^a-z0-9]/g,"");
    if(!key) continue;
    const old = map.get(key);
    if(!old || (x.subscription.total + x.gmpPercentage) > (old.subscription.total + old.gmpPercentage)){
      map.set(key,x);
    }
  }
  return [...map.values()];
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=120, stale-while-revalidate=600");

  const errors = [];
  let collected = [];

  for(const source of SOURCES){
    try{
      const html = await fetchPage(source.url);
      const rows = source.parser(html);
      if(rows.length) collected.push(...rows);
      else errors.push(`${source.name}: no parseable IPO rows`);
    }catch(e){
      errors.push(`${source.name}: ${e.message}`);
    }
  }

  collected = dedupe(collected).filter(x=>x.status==="open" || x.status==="upcoming");

  if(!collected.length){
    return res.status(502).json({
      ok:false,
      message:"Public IPO sources could not be read right now. No API key is required; the source pages may have changed or temporarily blocked automated access.",
      errors
    });
  }

  return res.status(200).json({
    ok:true,
    provider:"Public web sources",
    sourceNote:"GMP is unofficial. Data is collected from publicly accessible IPO tracking pages and may be delayed.",
    fetchedAt:new Date().toISOString(),
    count:collected.length,
    data:collected,
    errors
  });
}
