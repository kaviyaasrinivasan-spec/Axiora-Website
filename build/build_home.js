const fs=require("fs");
const a=JSON.parse(fs.readFileSync("assets.json","utf8"));
let b=fs.readFileSync("home_v2.html","utf8");
b=b.replace(/__OUTFIT__/g,a.outfit).replace(/__INTER__/g,a.inter).replace(/__LOGOT__/g,a.logot)
   .replace(/__KSS__/g,a.kss).replace(/__DHI__/g,a.dhi).replace(/__FOURS__/g,a.fours)
   .replace(/__CLIENT4__/g,a.client4).replace(/__FOUNDER__/g,a.founder||"").replace(/__TEAM__/g,a.team||"")
   .replace(/__HEROLOGI__/g,a.heroLogi).replace(/__HEROTRACK__/g,a.heroTrack).replace(/__HEROICLIN__/g,a.heroIclin).replace(/__HEROMEET__/g,a.heroMeet);
fs.writeFileSync("workbooster-home.html",b);
const left=(b.match(/__[A-Z]+__/g)||[]);
console.log("workbooster-home.html ->",(b.length/1024).toFixed(0),"KB | leftover:",left.length,left.slice(0,5).join(","));
