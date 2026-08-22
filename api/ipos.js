
import * as cheerio from "cheerio";

const SOURCE_URL = "https://ipomarkets.com/upcoming-ipo";

function clean(s=""){ return String(s).replace(/\s+/g," ").trim(); }

function numberFrom(v){
  const m = clean(v).replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function parsePriceBand(text){
  const nums = clean(text).replace(/,/g,"").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if(!nums.length) return [0,0];
  if(nums.length === 1) return [nums[0],nums[0]];
  return [nums[0],nums[1]];
}

function parseGmp(text){
  // Examples: "₹30+22.73%", "₹1.7+2.83%", "₹0"
  const t = clean(text).replace(/,/g,"");
  const amount = t.match(/₹\s*([0-9]+(?:\.[0-9]+)?)/);
  const pct = t.match(/([+-]?[0-9]+(?:\.[0-9]+)?)\s*%/);
  return {
    amount: amount ? Number(amount[1]) : 0,
    percentage: pct ? Number(pct[1]) : 0
  };
}

function parseSubscription(text){
  const m = clean(text).match(/([0-9]+(?:\.[0-9]+)?)\s*[×x]/i);
  return m ? Number(m[1]) : 0;
}

function parseDates(text){
  const t = clean(text);
  const m = t.match(/(.+?)\s+[–—-]\s+(.+)/);
  return m ? {openDate:clean(m[1]), closeDate:clean(m[2])} : {openDate:"",closeDate:t};
}

function classifyStatus(text){
  const t = clean(text).toLowerCase();
  if(t.includes("closes today") || t.includes("closes tomorrow") || t.includes("closes in") || t === "open") return "open";
  if(t.includes("opens today") || t.includes("opens tomorrow") || t.includes("opens in") || t.includes("opening soon") || t.includes("upcoming")) return "upcoming";
  return "";
}

function companyNameFromFirstCell($, td){
  const cell = $(td);
  // IPOMarkets uses an image alt like "Company Name logo".
  const alt = clean(cell.find("img").first().attr("alt") || "");
  if(alt){
    const fromAlt = clean(alt.replace(/\s+logo$/i,""));
    if(fromAlt) return fromAlt;
  }

  // Fallback: link text in first cell, with board suffix removed.
  const a = cell.find("a").first();
  let txt = clean(a.text() || cell.text());
  txt = txt.replace(/\b(Mainboard|SME)\b/gi,"").trim();
  return txt;
}

function isValidCompanyName(name){
  if(!name || name.length < 3 || name.length > 120) return false;
  if(/^(opens?|closes?|open|upcoming|listed|allotted|view all|how gmp works|refresh cycle|ipos tracked)/i.test(name)) return false;
  if(/How GMP Works|Refresh cycle|IPOs tracked|Open right now/i.test(name)) return false;
  return /[A-Za-z]/.test(name);
}

function parseIPOPage(html){
  const $ = cheerio.load(html);
  const items = [];

  $("table tbody tr, table tr").each((_,tr)=>{
    const tds = $(tr).find("td").toArray();
    if(tds.length < 6) return;

    const cells = tds.map(td=>clean($(td).text()));
    // Based on IPOMarkets table:
    // 0 Company | 1 Status | 2 Band / Price | 3 GMP | 4 Sub | 5 Dates | 6 Listing
    const name = companyNameFromFirstCell($, tds[0]);
    if(!isValidCompanyName(name)) return;

    const statusText = cells[1] || "";
    const status = classifyStatus(statusText);
    if(!status) return;

    const firstCellText = clean($(tds[0]).text());
    const type = /\bSME\b/i.test(firstCellText) ? "sme" : "mainboard";

    const [priceMin,priceMax] = parsePriceBand(cells[2] || "");
    const gmp = parseGmp(cells[3] || "");
    const totalSub = parseSubscription(cells[4] || "");
    const dates = parseDates(cells[5] || "");

    items.push({
      id:`ipom-${name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
      name,
      symbol:"",
      type,
      status,
      statusLabel:statusText,
      sector:"—",
      exchange:"NSE/BSE",
      priceMin,
      priceMax,
      lotSize:0,
      issueSize:0,
      openDate:dates.openDate,
      closeDate:dates.closeDate,
      gmp:gmp.amount,
      gmpPercentage:gmp.percentage,
      subscription:{qib:0,nii:0,retail:0,total:totalSub},
      source:"IPOMarkets"
    });
  });

  // Deduplicate by normalized company name.
  const seen = new Map();
  for(const item of items){
    const key = item.name.toLowerCase().replace(/[^a-z0-9]/g,"");
    if(!seen.has(key)) seen.set(key,item);
  }
  return [...seen.values()];
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

export default async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=60, stale-while-revalidate=300");

  try{
    const html = await fetchPage(SOURCE_URL);
    const data = parseIPOPage(html);

    if(!data.length){
      return res.status(502).json({
        ok:false,
        message:"IPOMarkets was reachable but no current IPO rows could be parsed."
      });
    }

    return res.status(200).json({
      ok:true,
      provider:"IPOMarkets public data",
      sourceNote:"GMP is unofficial and may be delayed.",
      fetchedAt:new Date().toISOString(),
      count:data.length,
      data
    });
  }catch(e){
    return res.status(502).json({
      ok:false,
      message:`Unable to refresh IPOMarkets data: ${e.message}`
    });
  }
}
