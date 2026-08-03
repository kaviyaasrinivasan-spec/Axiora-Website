const fs=require("fs");
const files=[
 "home_v2.html","automation_opportunities.html",
 "our_story_main.html","industries_main.html","platforms_main.html","contact_main.html",
 "careers_main.html","privacy_main.html","terms_main.html",
 "logistics_main.html","pharma_main.html","enterprise_it_main.html","manufacturing_main.html",
 "banking_main.html","insurance_main.html","healthcare_main.html","legal_main.html","government_main.html",
 "gen_solutions.js","build_theme.js"
];
// order matters: most specific first; bare "WorkBooster" last
const reps=[
 ["WorkBooster<b>AI</b>","Axiora<b>Labs</b>"],
 ["Work Booster AI™","Axiora Labs™"],
 ["Work Booster AI","Axiora Labs"],
 ["WorkBoosterAI.com","AxioraLabs.ai"],
 ["workboosterai.com","axioralabs.ai"],   // handles domains + sales@ email; skips lowercase linkedin company/workboosterai
 ["WorkBooster AI","Axiora Labs"],
 ["WorkBoosterAI","Axiora Labs"],
 ["© P SENTHIL KUMARAN","© Axiora Labs"],
 ["WorkBooster","Axiora Labs"]
];
let total=0;
for(const f of files){
  if(!fs.existsSync(f)) { console.log("MISSING",f); continue; }
  let s=fs.readFileSync(f,"utf8"), before=s;
  for(const [a,b] of reps){ s=s.split(a).join(b); }
  if(s!==before){ fs.writeFileSync(f,s); total++; }
}
console.log("rebranded files:",total);
// verify no leftover (case-sensitive brand refs, excluding lowercase linkedin handle)
let leftover=0;
for(const f of files){ const s=fs.readFileSync(f,"utf8"); leftover += (s.match(/WorkBooster|Work Booster|WorkBoosterAI|workboosterai\.com/g)||[]).length; }
console.log("leftover brand refs (should be 0):",leftover);
