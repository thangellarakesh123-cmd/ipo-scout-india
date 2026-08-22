import React, {useEffect, useMemo, useState} from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const DEMO_IPOS = [
  {id:"demo-main-1", name:"Demo Mainboard Technologies Ltd.", symbol:"DMTL", type:"mainboard", status:"open", sector:"Technology", priceMin:118, priceMax:124, lotSize:120, issueSize:820, openDate:"2026-08-20", closeDate:"2026-08-25", gmp:34, subscription:{qib:12.4, nii:8.1, retail:5.8, total:8.7}, source:"Demo fallback"},
  {id:"demo-main-2", name:"Demo Healthcare Ltd.", symbol:"DHC", type:"mainboard", status:"open", sector:"Healthcare", priceMin:92, priceMax:98, lotSize:150, issueSize:510, openDate:"2026-08-21", closeDate:"2026-08-26", gmp:14, subscription:{qib:4.8, nii:3.1, retail:2.7, total:3.9}, source:"Demo fallback"},
  {id:"demo-sme-1", name:"Demo Infra SME Ltd.", symbol:"DISME", type:"sme", status:"open", sector:"Infrastructure", priceMin:76, priceMax:80, lotSize:1600, issueSize:46, openDate:"2026-08-20", closeDate:"2026-08-25", gmp:8, subscription:{qib:2.3, nii:4.7, retail:3.2, total:3.5}, source:"Demo fallback"},
  {id:"demo-upcoming-1", name:"Demo Consumer Brands Ltd.", symbol:"DCB", type:"mainboard", status:"upcoming", sector:"Consumer", priceMin:210, priceMax:220, lotSize:65, issueSize:1250, openDate:"2026-08-28", closeDate:"2026-09-01", gmp:0, subscription:{qib:0, nii:0, retail:0, total:0}, source:"Demo fallback"}
];

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function formatX(v){ return `${num(v).toFixed(2)}x`; }
function formatINR(v){ return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(num(v)); }

function scoreIPO(ipo){
  const p = Math.max(num(ipo.priceMax), 1);
  const gmpPct = num(ipo.gmp) / p * 100;
  const gmpScore = clamp(gmpPct / 25 * 35, 0, 35);
  const total = num(ipo.subscription?.total);
  const demandScore = clamp(Math.log10(total + 1) / Math.log10(31) * 30, 0, 30);
  const qib = num(ipo.subscription?.qib);
  const qibScore = clamp(Math.log10(qib + 1) / Math.log10(31) * 20, 0, 20);
  const issue = num(ipo.issueSize);
  const issueScore = clamp((1 - Math.min(issue, 5000)/5000) * 10, 0, 10);
  const typeScore = ipo.type === "mainboard" ? 5 : 2;
  const freshness = ipo.status === "open" ? 1 : 0.55;
  return Math.round(clamp((gmpScore + demandScore + qibScore + issueScore + typeScore) * freshness, 0, 100));
}
function recommendation(score, ipo){
  if(ipo.status !== "open") return "Upcoming";
  if(score >= 80) return "Strong Apply";
  if(score >= 65) return "Apply";
  if(score >= 50) return "Wait";
  return "Avoid";
}
function risk(ipo){
  let r = 50;
  if(ipo.type === "sme") r += 15;
  if(num(ipo.issueSize) < 100) r += 10;
  if(num(ipo.subscription?.qib) < 1) r += 10;
  return r >= 70 ? "High" : r >= 55 ? "Medium" : "Low";
}

async function fetchIPOData(){
  const response = await fetch(`/api/ipos?t=${Date.now()}`, {cache:"no-store"});
  let payload = {};
  try { payload = await response.json(); } catch {}
  if(!response.ok){
    throw new Error(payload?.message || `Server returned ${response.status}`);
  }
  if(!Array.isArray(payload.data) || payload.data.length === 0){
    throw new Error("No IPO records returned by the live provider.");
  }
  return payload;
}


function App(){
  const [ipos,setIpos] = useState(DEMO_IPOS);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("Demo data");
  const [lastUpdated,setLastUpdated] = useState(new Date());
  const [filter,setFilter] = useState("all");
  const [search,setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    try{
      const result = await fetchIPOData();
      setIpos(result.data);
      setMessage(`Live public data · ${result.count || result.data.length} IPOs · no API key`);
      setLastUpdated(new Date(result.fetchedAt || Date.now()));
    }catch(e){
      setIpos(DEMO_IPOS);
      setMessage(`Live refresh failed — demo data shown. ${e.message}`);
      setLastUpdated(new Date());
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ refresh(); const id=setInterval(refresh, 5*60*1000); return ()=>clearInterval(id); },[]);

  const ranked = useMemo(()=>ipos
    .filter(i => i.name && !/^(opens|closes|open|upcoming)\b/i.test(i.name))
    .map(i=>({...i, score:scoreIPO(i)}))
    .sort((a,b)=>b.score-a.score),[ipos]);
  const open = ranked.filter(i=>i.status==="open");
  const best = open[0] || null;
  const filtered = ranked.filter(i => {
    const board = filter==="all" || i.type===filter;
    const status = filter==="open" ? i.status==="open" : board;
    return board && status && `${i.name} ${i.symbol} ${i.sector}`.toLowerCase().includes(search.toLowerCase());
  });

  return <main className="app">
    <header>
      <div>
        <p className="eyebrow">INDIAN PRIMARY MARKET DASHBOARD</p>
        <h1>IPO Scout <span>India</span></h1>
        <p className="sub">Rank IPOs using GMP, subscription demand, QIB interest and risk signals.</p>
      </div>
      <div className="actions">
        <button className="refresh" onClick={refresh} disabled={loading}>{loading ? "Refreshing…" : "↻ Refresh Data"}</button>
        <div className="updated">Last update: {lastUpdated.toLocaleString("en-IN")}<br/><span>{message}</span></div>
      </div>
    </header>

    <section className="stats">
      <div><b>{open.length}</b><span>Open IPOs</span></div>
      <div><b>{ranked.filter(i=>i.status==="upcoming").length}</b><span>Upcoming</span></div>
      <div><b>{best ? best.score : 0}/100</b><span>Best Score</span></div>
      <div><b>{best ? recommendation(best.score,best) : "—"}</b><span>Top Recommendation</span></div>
    </section>

    {!best && <section className="hero-card"><div><p className="eyebrow">NO IPO CURRENTLY OPEN</p><h2>Nothing available to apply right now</h2><p>Upcoming IPOs are listed below. The dashboard will rank them once bidding opens.</p></div></section>}
    {best && <section className="hero-card">
      <div>
        <p className="eyebrow">BEST OPEN IPO TO APPLY</p>
        <h2>{best.name}</h2>
        <p>{best.sector} · {best.type === "sme" ? "SME" : "Mainboard"} · {best.symbol}</p>
        <div className="chips"><span>{recommendation(best.score,best)}</span><span>Risk: {risk(best)}</span><span>GMP: {formatINR(best.gmp)}</span></div>
      </div>
      <div className="score-ring"><strong>{best.score}</strong><small>/100</small></div>
      <div className="disclaimer">Ranking is algorithmic and informational only. IPO investing involves risk and GMP is unofficial.</div>
    </section>}

    <section className="toolbar">
      <div className="filters">
        <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All</button>
        <button className={filter==="open"?"active":""} onClick={()=>setFilter("open")}>Open</button>
        <button className={filter==="mainboard"?"active":""} onClick={()=>setFilter("mainboard")}>Mainboard</button>
        <button className={filter==="sme"?"active":""} onClick={()=>setFilter("sme")}>SME</button>
      </div>
      <input placeholder="Search IPO or sector…" value={search} onChange={e=>setSearch(e.target.value)} />
    </section>

    <section className="grid">
      {filtered.map(ipo => <article className="ipo-card" key={ipo.id}>
        <div className="card-top"><span className={`badge ${ipo.type}`}>{ipo.type}</span><span className={`rec ${recommendation(ipo.score,ipo).replace(" ","-").toLowerCase()}`}>{recommendation(ipo.score,ipo)}</span></div>
        <h3>{ipo.name}</h3><p className="muted">{ipo.sector} · {ipo.symbol || "NSE/BSE"}</p>
        <div className="big-score"><strong>{ipo.score}</strong><span>Investment Score</span></div>
        <div className="metrics">
          <div><span>Price Band</span><b>₹{ipo.priceMin || "—"}–₹{ipo.priceMax || "—"}</b></div>
          <div><span>GMP</span><b>{formatINR(ipo.gmp)}</b></div>
          <div><span>Total Sub.</span><b>{formatX(ipo.subscription.total)}</b></div>
          <div><span>GMP %</span><b>{num(ipo.gmpPercentage).toFixed(2)}%</b></div>
          <div><span>Source</span><b>{ipo.source || "Public web"}</b></div>
          <div><span>Risk</span><b>{risk(ipo)}</b></div>
        </div>
        <div className="card-foot">
          <span>Closes: {ipo.closeDate || "TBA"}</span>
          <span>Min. investment: {ipo.lotSize && ipo.priceMax ? formatINR(ipo.lotSize*ipo.priceMax) : "TBA"}</span>
        </div>
      </article>)}
    </section>

    <section className="logic">
      <h2>Ranking Logic</h2>
      <p><b>50%</b> GMP strength · <b>35%</b> total subscription · <b>15%</b> Mainboard/SME risk adjustment. Free public-source data only; no API key required.</p>
      <p>Score 80+ Strong Apply · 65–79 Apply · 50–64 Wait · below 50 Avoid.</p>
    </section>
  </main>
}

createRoot(document.getElementById("root")).render(<App/>);