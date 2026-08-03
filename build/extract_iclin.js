const fs=require("fs");
const s=fs.readFileSync("iclin.js","utf8");
const re=/"((?:[^"\\]|\\.){6,140})"|`((?:[^`\\]|\\.){6,140})`/g;
let m; const out=new Set();
while((m=re.exec(s))){
  let t=(m[1]||m[2]||"").replace(/\\n/g," ").replace(/\s+/g," ").trim();
  if(!/\s/.test(t)) continue;
  if(/[{}<>;=]|=>|http|\.js|px|rgba|function|className|useState|import|childNodes/.test(t)) continue;
  const L=(t.match(/[A-Za-z]/g)||[]).length;
  if(L/t.length<0.6) continue;
  if(t.split(" ").length<2) continue;
  out.add(t);
}
console.log([...out].slice(0,80).join("\n"));
