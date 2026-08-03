const fs=require("fs");
const HOME="https://claude.ai/code/artifact/5941499c-bbe3-48a8-95c1-3daa052d6065";
const a=JSON.parse(fs.readFileSync("assets.json","utf8"));
const baseTpl=fs.readFileSync("home_v2.html","utf8");

// ---- extra icon symbols needed across subpages ----
const EXTRA_SYMBOLS=`
  <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></symbol>
  <symbol id="i-trend" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></symbol>
  <symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol>
  <symbol id="i-map" viewBox="0 0 24 24"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></symbol>
  <symbol id="i-pie" viewBox="0 0 24 24"><path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></symbol>
  <symbol id="i-msg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol>
  <symbol id="i-bot" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></symbol>
  <symbol id="i-linechart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></symbol>
  <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></symbol>
  <symbol id="i-terminal" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></symbol>
  <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></symbol>
  <symbol id="i-shieldalert" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></symbol>
  <symbol id="i-infinity" viewBox="0 0 24 24"><path d="M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4Zm0 0c2 2.7 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.3-6 4Z"/></symbol>
  <symbol id="i-database" viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></symbol>
  <symbol id="i-brain" viewBox="0 0 24 24"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></symbol>
  <symbol id="i-server" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><line x1="6" y1="7" x2="6" y2="7"/><line x1="6" y1="17" x2="6" y2="17"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
</defs>`;

const CSS=`
  /* ===== INNER PAGE / SOLUTIONS ===== */
  .page-hero{position:relative;overflow:hidden;padding:74px 0 44px;background:
    radial-gradient(55% 60% at 20% -10%,rgba(60,89,231,.10),transparent 70%),
    radial-gradient(40% 40% at 95% 10%,rgba(107,124,239,.10),transparent 70%),var(--bg);}
  .page-hero::before{content:"";position:absolute;inset:0;background-image:
    linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
    background-size:52px 52px;mask-image:radial-gradient(circle at 25% 15%,#000,transparent 72%);
    -webkit-mask-image:radial-gradient(circle at 25% 15%,#000,transparent 72%);opacity:.5;}
  .sol-hero-inner{position:relative;z-index:2;max-width:920px;display:flex;flex-direction:column;gap:20px;align-items:flex-start;}
  .sol-hero h1{font-size:clamp(32px,5.2vw,56px);font-weight:800;letter-spacing:-.035em;line-height:1.08;color:#141a2e;}
  .grad2{background:linear-gradient(100deg,var(--brand),var(--violet));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .accent-bar{width:64px;height:5px;border-radius:100px;background:linear-gradient(90deg,var(--brand),var(--violet));}
  .sol-hero .lead{font-family:var(--display);font-weight:700;font-size:clamp(18px,2.2vw,22px);color:var(--brand);max-width:780px;line-height:1.4;}
  .sol-hero .sub-p{font-size:16px;color:var(--body);line-height:1.8;max-width:780px;}
  .section-head.left{max-width:none;margin:0 0 42px;align-items:flex-start;text-align:left;}
  .deliver-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(188px,1fr));gap:20px;max-width:1080px;margin:0 auto;}
  .dcard{position:relative;background:#fff;border:1px solid var(--line);border-radius:18px;padding:30px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;box-shadow:var(--shadow-sm);overflow:hidden;transition:transform .4s cubic-bezier(.22,.61,.36,1),box-shadow .4s,border-color .4s;}
  .dcard::after{content:"";position:absolute;left:0;top:0;height:4px;width:100%;background:linear-gradient(90deg,var(--c1),var(--c2));transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.22,.61,.36,1);}
  .dcard:hover{transform:translateY(-6px);box-shadow:var(--shadow-lg);border-color:transparent;}
  .dcard:hover::after{transform:scaleX(1);}
  .dico{width:60px;height:60px;border-radius:16px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 12px 22px -10px var(--c1);transition:transform .4s cubic-bezier(.22,.61,.36,1);}
  .dcard:hover .dico{transform:scale(1.1) rotate(-6deg);}
  .dico .icon{width:27px;height:27px;}
  .dcard h3{font-size:15px;font-family:var(--display);font-weight:600;color:var(--ink);line-height:1.35;}
  .models-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(184px,1fr));gap:20px;max-width:1080px;margin:0 auto;}
  .mcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px 18px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:13px;box-shadow:var(--shadow-sm);transition:transform .35s cubic-bezier(.22,.61,.36,1),box-shadow .35s,border-color .35s;}
  .mcard:hover{transform:translateY(-5px);box-shadow:var(--shadow-md);border-color:var(--brand);}
  .mico{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;color:#10b981;background:#10b9811a;transition:transform .35s cubic-bezier(.22,.61,.36,1),background .35s,color .35s;}
  .mcard:hover .mico{background:#10b981;color:#fff;transform:scale(1.08);}
  .mico .icon{width:25px;height:25px;}
  .mcard h3{font-size:15px;font-family:var(--display);font-weight:600;color:var(--ink);}
  .sol-cta-sec{padding:24px 0 96px;}
  .sol-cta{position:relative;overflow:hidden;background:linear-gradient(120deg,#0b1440,#1a4bc5);border-radius:26px;padding:46px;display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap;box-shadow:var(--shadow-lg);}
  .sol-cta::after{content:"";position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(60,110,255,.4),transparent 65%);}
  .sol-cta .txt{position:relative;z-index:1;max-width:620px;}
  .sol-cta h3{color:#fff;font-size:clamp(22px,3vw,30px);font-weight:800;letter-spacing:-.02em;}
  .sol-cta p{color:#c3cdf0;margin-top:10px;font-size:15px;line-height:1.6;}
  .sol-cta .btn{position:relative;z-index:1;background:#fff;color:var(--brand-deep);}
  .sol-cta .btn:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg);}
  @media(max-width:560px){.sol-cta{padding:32px 24px;}}

  /* ===== HERO TWO-COLUMN + VISUALS ===== */
  .sol-hero-grid{display:grid;grid-template-columns:1.04fr .96fr;gap:48px;align-items:center;position:relative;z-index:2;}
  .sol-viz{position:relative;perspective:1400px;}
  .viz{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow-lg);overflow:hidden;transform:rotateY(-6deg) rotateX(2deg);transition:transform .55s cubic-bezier(.22,.61,.36,1);}
  .sol-viz:hover .viz{transform:rotateY(0) rotateX(0);}
  .viz-top{display:flex;align-items:center;gap:9px;padding:13px 16px;background:linear-gradient(90deg,#0b1440,#16225a);color:#aebbec;font-family:var(--display);font-weight:600;font-size:12.5px;}
  .viz-top .dots{display:flex;gap:6px;} .viz-top .dots i{width:9px;height:9px;border-radius:50%;display:block;}
  .viz-top .vt{margin-left:4px;display:flex;align-items:center;gap:7px;} .viz-top .vt .icon{width:14px;height:14px;color:#6ea0ff;}
  .viz-body{padding:20px;display:flex;flex-direction:column;gap:11px;background:linear-gradient(180deg,#fbfcff,#f4f7fe);}
  .viz-kpi{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow-sm);}
  .viz-kpi .k-label{font-size:11px;color:var(--muted);display:block;} .viz-kpi .k-val{font-family:var(--display);font-weight:800;font-size:21px;color:var(--ink);letter-spacing:-.02em;}
  .k-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--display);font-weight:600;font-size:11.5px;color:#10b981;background:#10b9811a;padding:6px 11px;border-radius:100px;white-space:nowrap;} .k-chip .icon{width:14px;height:14px;}
  .viz-bar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 13px;box-shadow:var(--shadow-sm);}
  .viz-bar .b-name{font-size:12px;color:var(--ink);font-weight:500;width:118px;flex:none;}
  .viz-bar .b-track{flex:1;height:7px;border-radius:100px;background:#e7ebf7;overflow:hidden;}
  .viz-bar .b-fill{display:block;height:100%;width:0;border-radius:100px;background:linear-gradient(90deg,var(--brand),var(--violet));transition:width 1s cubic-bezier(.22,.61,.36,1);}
  .sol-viz.in .viz-bar .b-fill{width:var(--w);}
  .viz-bar .b-pct{font-family:var(--display);font-weight:700;font-size:12px;color:var(--brand);width:34px;text-align:right;font-variant-numeric:tabular-nums;}
  .chat-msg{max-width:84%;padding:11px 14px;border-radius:14px;font-size:12.5px;line-height:1.5;box-shadow:var(--shadow-sm);}
  .chat-msg.ai{background:#fff;border:1px solid var(--line);color:var(--ink);border-bottom-left-radius:4px;align-self:flex-start;}
  .chat-msg.user{background:linear-gradient(135deg,var(--brand),var(--brand-deep));color:#fff;border-bottom-right-radius:4px;align-self:flex-end;}
  .chat-typing{align-self:flex-start;display:flex;gap:4px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:13px 14px;}
  .chat-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite;}
  .chat-typing i:nth-child(2){animation-delay:.2s}.chat-typing i:nth-child(3){animation-delay:.4s}
  @keyframes blink{0%,60%,100%{opacity:.3}30%{opacity:1}}
  .chat-input{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid var(--line-strong);border-radius:100px;padding:8px 8px 8px 15px;color:var(--muted);font-size:12.5px;margin-top:2px;}
  .chat-input .send{margin-left:auto;width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;flex:none;} .chat-input .send .icon{width:15px;height:15px;}
  .pipe{display:flex;flex-direction:column;gap:0;}
  .pipe-node{position:relative;display:flex;align-items:center;gap:13px;padding:10px 0;}
  .pipe-node:not(:last-child)::before{content:"";position:absolute;left:19px;top:46px;bottom:-2px;width:2px;background:linear-gradient(180deg,var(--brand),var(--violet));opacity:.28;}
  .pipe-ico{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--c1),var(--c2));flex:none;box-shadow:0 8px 16px -8px var(--c1);z-index:1;} .pipe-ico .icon{width:20px;height:20px;}
  .pipe-node .p-txt b{font-family:var(--display);font-size:14px;color:var(--ink);display:block;} .pipe-node .p-txt span{font-size:11.5px;color:var(--muted);}
  .pipe-node .p-tag{margin-left:auto;font-family:var(--display);font-weight:600;font-size:10.5px;padding:4px 10px;border-radius:100px;background:#10b9811a;color:#10b981;white-space:nowrap;}
  .roster{display:flex;flex-direction:column;gap:9px;}
  .r-row{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 13px;box-shadow:var(--shadow-sm);}
  .r-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#fff;font-family:var(--display);font-weight:700;font-size:12.5px;background:linear-gradient(135deg,var(--c1),var(--c2));flex:none;}
  .r-row .r-txt b{font-family:var(--display);font-size:13.5px;color:var(--ink);display:block;} .r-row .r-txt span{font-size:11px;color:var(--muted);}
  .r-row .r-dot{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#10b981;font-weight:600;white-space:nowrap;} .r-row .r-dot::before{content:"";width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px #10b98122;}
  @media(max-width:900px){.sol-hero-grid{grid-template-columns:1fr;gap:40px;} .viz{transform:none;} .sol-viz{max-width:460px;margin:0 auto;width:100%;}}
`;

const PAL=[["#3c59e7","#22d3ee"],["#a855f7","#ec4899"],["#f97316","#ef4444"],["#10b981","#34d399"],["#6366f1","#8b5cf6"],["#f59e0b","#f97316"],["#0ea5e9","#3c59e7"],["#ef4444","#f43f5e"],["#14b8a6","#0ea5e9"],["#8b5cf6","#a855f7"]];

function card(item,i){const [c1,c2]=PAL[i%PAL.length];
  return `<div class="dcard reveal" style="--c1:${c1};--c2:${c2}"><div class="dico"><svg class="icon"><use href="#${item.ic}"/></svg></div><h3>${item.t}</h3></div>`;}
function mcard(item){return `<div class="mcard reveal"><div class="mico"><svg class="icon"><use href="#${item.ic}"/></svg></div><h3>${item.t}</h3></div>`;}

const DOTS=`<span class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span>`;
const VIZ={
"ai-consulting":`<div class="viz">
        <div class="viz-top">${DOTS}<span class="vt"><svg class="icon"><use href="#i-pie"/></svg> AI Opportunity Report</span></div>
        <div class="viz-body">
          <div class="viz-kpi"><div><span class="k-label">Estimated efficiency gain</span><span class="k-val">3.4&times; faster</span></div><span class="k-chip"><svg class="icon"><use href="#i-trend"/></svg> High impact</span></div>
          <div class="viz-bar"><span class="b-name">Invoice processing</span><span class="b-track"><span class="b-fill" style="--w:86%"></span></span><span class="b-pct">86%</span></div>
          <div class="viz-bar"><span class="b-name">Customs filing</span><span class="b-track"><span class="b-fill" style="--w:74%"></span></span><span class="b-pct">74%</span></div>
          <div class="viz-bar"><span class="b-name">Data entry</span><span class="b-track"><span class="b-fill" style="--w:92%"></span></span><span class="b-pct">92%</span></div>
          <div class="viz-bar"><span class="b-name">Reporting</span><span class="b-track"><span class="b-fill" style="--w:65%"></span></span><span class="b-pct">65%</span></div>
        </div>
      </div>`,
"custom-ai-solutions":`<div class="viz">
        <div class="viz-top">${DOTS}<span class="vt"><svg class="icon"><use href="#i-bot"/></svg> AI Assistant</span></div>
        <div class="viz-body">
          <div class="chat-msg user">Where's shipment INV-4821?</div>
          <div class="chat-msg ai">It cleared customs at 09:14 and is out for delivery — ETA today 4 PM. Want me to notify the client?</div>
          <div class="chat-msg user">Yes, send the update.</div>
          <div class="chat-typing"><i></i><i></i><i></i></div>
          <div class="chat-input">Ask anything&hellip;<span class="send"><svg class="icon"><use href="#i-arrow"/></svg></span></div>
        </div>
      </div>`,
"ai-product-engineering":`<div class="viz">
        <div class="viz-top">${DOTS}<span class="vt"><svg class="icon"><use href="#i-rocket"/></svg> Build Pipeline</span></div>
        <div class="viz-body">
          <div class="pipe">
            <div class="pipe-node" style="--c1:#3c59e7;--c2:#22d3ee"><span class="pipe-ico"><svg class="icon"><use href="#i-bulb"/></svg></span><span class="p-txt"><b>Idea &amp; Strategy</b><span>Scope + architecture</span></span><span class="p-tag">Done</span></div>
            <div class="pipe-node" style="--c1:#a855f7;--c2:#ec4899"><span class="pipe-ico"><svg class="icon"><use href="#i-rocket"/></svg></span><span class="p-txt"><b>MVP Build</b><span>Core features shipped</span></span><span class="p-tag">Done</span></div>
            <div class="pipe-node" style="--c1:#f97316;--c2:#ef4444"><span class="pipe-ico"><svg class="icon"><use href="#i-layers"/></svg></span><span class="p-txt"><b>LLM + RAG</b><span>Models integrated</span></span><span class="p-tag">Active</span></div>
            <div class="pipe-node" style="--c1:#10b981;--c2:#34d399"><span class="pipe-ico"><svg class="icon"><use href="#i-cloud"/></svg></span><span class="p-txt"><b>Deploy &amp; Scale</b><span>Secure cloud rollout</span></span><span class="p-tag" style="background:#f59e0b1a;color:#f59e0b">Next</span></div>
          </div>
        </div>
      </div>`,
"dedicated-ai-engineering":`<div class="viz">
        <div class="viz-top">${DOTS}<span class="vt"><svg class="icon"><use href="#i-users"/></svg> Your AI Team</span></div>
        <div class="viz-body">
          <div class="roster">
            <div class="r-row"><span class="r-av" style="--c1:#3c59e7;--c2:#22d3ee">AI</span><span class="r-txt"><b>AI Engineer</b><span>LLM apps &amp; agents</span></span><span class="r-dot">Allocated</span></div>
            <div class="r-row"><span class="r-av" style="--c1:#a855f7;--c2:#ec4899">ML</span><span class="r-txt"><b>ML Engineer</b><span>Model training</span></span><span class="r-dot">Allocated</span></div>
            <div class="r-row"><span class="r-av" style="--c1:#f97316;--c2:#ef4444">DE</span><span class="r-txt"><b>Data Engineer</b><span>Pipelines &amp; RAG</span></span><span class="r-dot">Allocated</span></div>
            <div class="r-row"><span class="r-av" style="--c1:#10b981;--c2:#34d399">TA</span><span class="r-txt"><b>Technical Architect</b><span>System design</span></span><span class="r-dot">Allocated</span></div>
          </div>
        </div>
      </div>`
};

function buildMain(p){
  const paras=p.paras.map(t=>`<p class="sub-p">${t}</p>`).join("\n        ");
  const grid=p.items.map(card).join("\n        ");
  let models="";
  if(p.models){models=`
  <section class="section bg-soft">
    <div class="wrap">
      <div class="section-head left reveal"><span class="eyebrow">Flexible engagement</span><h2>${p.secondHeading}</h2></div>
      <div class="models-grid">
        ${p.models.map(mcard).join("\n        ")}
      </div>
    </div>
  </section>`;}
  return `<main id="top">
  <section class="page-hero">
    <div class="wrap sol-hero-grid">
      <div class="sol-hero-inner reveal">
        <span class="eyebrow">${p.eyebrow}</span>
        <h1>${p.h1a} <span class="grad2">${p.h1b}.</span></h1>
        <span class="accent-bar"></span>
        <p class="lead">${p.lead}</p>
        ${paras}
      </div>
      <div class="sol-viz reveal">
        ${VIZ[p.slug]||""}
      </div>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="section-head left reveal"><span class="eyebrow">${p.gridEyebrow}</span><h2>${p.gridHeading}</h2></div>
      <div class="deliver-grid">
        ${grid}
      </div>
    </div>
  </section>${models}
  <section class="sol-cta-sec">
    <div class="wrap">
      <div class="sol-cta reveal">
        <div class="txt"><h3>${p.ctaTitle}</h3><p>${p.ctaText}</p></div>
        <a class="btn" href="#contact">${p.ctaBtn} <svg class="icon"><use href="#i-arrow"/></svg></a>
      </div>
    </div>
  </section>
</main>`;
}

function assemble(mainHtml,title,outFile){
  let b=baseTpl;
  b=b.replace(/<title>[\s\S]*?<\/title>/,`<title>${title}</title>`);
  b=b.replace("</style>", CSS+"\n</style>");
  b=b.replace("</defs>", EXTRA_SYMBOLS);
  b=b.replace(/<main id="top">[\s\S]*?<\/main>/, mainHtml);
  b=b.replace(/href="#(?!i-)([a-zA-Z-]+)"/g,(m,f)=> f==="top"?`href="${HOME}"`:`href="${HOME}#${f}"`);
  b=b.replace(/__OUTFIT__/g,a.outfit).replace(/__INTER__/g,a.inter).replace(/__LOGOT__/g,a.logot)
     .replace(/__KSS__/g,a.kss).replace(/__DHI__/g,a.dhi).replace(/__FOURS__/g,a.fours);
  fs.writeFileSync(outFile,b);
  console.log(outFile,(b.length/1024).toFixed(0)+"KB","leftover:",(b.match(/__[A-Z]+__/g)||[]).length);
}

const pages=[
{slug:"ai-consulting",title:"Axiora Labs — AI Automation Assessment & Consulting",
 eyebrow:"AI Automation Assessment & Consulting",h1a:"Understand Where AI Can Create",h1b:"the Biggest Business Impact",
 lead:"Most businesses know AI is important, but few know where to start.",
 paras:["Our AI consultants analyze your current business processes, identify repetitive manual tasks, and create a practical AI automation roadmap with measurable ROI. Instead of replacing your existing systems, we help AI work alongside your ERP, CRM, accounting software, and internal applications.",
  "Whether you're in logistics, healthcare, manufacturing, finance, legal services, or professional services, we help you discover high-impact automation opportunities that save time, reduce costs, and improve productivity."],
 gridEyebrow:"Deliverables",gridHeading:"What We Deliver",
 items:[{t:"Business Process Assessment",ic:"i-search"},{t:"AI Opportunity Analysis",ic:"i-target"},{t:"Automation Roadmap",ic:"i-map"},{t:"ROI & Cost Savings Report",ic:"i-pie"},{t:"Technology Recommendation",ic:"i-bulb"},{t:"Implementation Strategy",ic:"i-rocket"}],
 ctaTitle:"Ready to find your AI use cases?",ctaText:"Schedule an assessment today to discover exactly how automation can improve your bottom line.",ctaBtn:"Book an Assessment"},

{slug:"custom-ai-solutions",title:"Axiora Labs — Custom AI Solutions",
 eyebrow:"Custom AI Solutions",h1a:"AI Built Specifically",h1b:"for Your Business",
 lead:"Every business is different. Off-the-shelf AI tools rarely solve unique operational challenges.",
 paras:["We design and build custom AI applications tailored to your workflows, industry, and business goals. From intelligent assistants and document AI to predictive analytics and workflow automation, every solution is developed around your requirements.",
  "Whether you need a customer-facing AI assistant or an internal productivity platform, we create scalable AI solutions that deliver measurable business value."],
 gridEyebrow:"Capabilities",gridHeading:"Custom AI Capabilities",
 items:[{t:"AI Chatbots",ic:"i-msg"},{t:"AI Copilots",ic:"i-bot"},{t:"Document Intelligence",ic:"i-file"},{t:"OCR & Data Extraction",ic:"i-search"},{t:"Knowledge Base Assistants",ic:"i-book"},{t:"Predictive Analytics",ic:"i-linechart"},{t:"AI Search",ic:"i-search"},{t:"Recommendation Engines",ic:"i-target"},{t:"Computer Vision",ic:"i-image"},{t:"Generative AI Applications",ic:"i-spark"}],
 ctaTitle:"Ready to build custom AI?",ctaText:"Tell us about your unique challenges, and our engineering team will design a solution tailored to your exact needs.",ctaBtn:"Talk to an Expert"},

{slug:"ai-product-engineering",title:"Axiora Labs — AI Product Engineering",
 eyebrow:"AI Product Engineering",h1a:"Build AI Products",h1b:"That Scale",
 lead:"Have an AI product idea?",
 paras:["We help startups and enterprises transform ideas into production-ready AI products. From product strategy and architecture to development, testing, deployment, and continuous improvement, our engineering team manages the complete product lifecycle.",
  "Our focus is building secure, scalable, and enterprise-ready AI platforms that are easy to maintain and grow."],
 gridEyebrow:"Expertise",gridHeading:"Our Expertise",
 items:[{t:"AI Product Strategy",ic:"i-bulb"},{t:"MVP Development",ic:"i-rocket"},{t:"LLM Integration",ic:"i-cpu"},{t:"RAG Applications",ic:"i-layers"},{t:"AI Agent Development",ic:"i-terminal"},{t:"Cloud Deployment",ic:"i-cloud"},{t:"API Development",ic:"i-code"},{t:"Security & Compliance",ic:"i-shieldalert"},{t:"DevOps & MLOps",ic:"i-infinity"},{t:"Continuous AI Improvement",ic:"i-database"}],
 ctaTitle:"Ready to build your AI product?",ctaText:"From MVP to scalable enterprise platform, our engineering team is ready to bring your vision to life.",ctaBtn:"Talk to an Engineer"},

{slug:"dedicated-ai-engineering",title:"Axiora Labs — AI Development Outsourcing & IT Staffing",
 eyebrow:"AI Development Outsourcing & IT Staffing",h1a:"Extend Your Team with",h1b:"Experienced AI Engineers",
 lead:"Need AI expertise without long hiring cycles?",
 paras:["Our dedicated AI engineers work as an extension of your internal team. Whether you need a single AI developer or a complete engineering team, we provide experienced professionals who can quickly contribute to your projects.",
  "We support startups, software companies, and enterprises with flexible engagement models that reduce hiring costs while accelerating delivery."],
 gridEyebrow:"Talent",gridHeading:"Resources Available",
 items:[{t:"AI Engineers",ic:"i-brain"},{t:"Machine Learning Engineers",ic:"i-server"},{t:"Python Developers",ic:"i-code"},{t:"Data Engineers",ic:"i-database"},{t:"Prompt Engineers",ic:"i-terminal"},{t:"GenAI Developers",ic:"i-brain"},{t:"MLOps Engineers",ic:"i-layers"},{t:"Full Stack Developers",ic:"i-code"},{t:"DevOps Engineers",ic:"i-server"},{t:"Technical Architects",ic:"i-building"}],
 secondHeading:"Engagement Models",
 models:[{t:"Dedicated Resource",ic:"i-users"},{t:"Dedicated Team",ic:"i-users"},{t:"Project-Based Development",ic:"i-rocket"},{t:"Staff Augmentation",ic:"i-users"},{t:"Offshore Development Center",ic:"i-globe"}],
 ctaTitle:"Need to scale your team?",ctaText:"Tell us about your project requirements, and we'll match you with the right engineers.",ctaBtn:"Hire AI Engineers"},
];

if(require.main===module){
  for(const p of pages){assemble(buildMain(p),p.title,"wb-sol-"+p.slug+".html");}
}
module.exports={pages,buildMain,CSS,VIZ,EXTRA_SYMBOLS};
