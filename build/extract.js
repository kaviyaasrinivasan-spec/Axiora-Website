const fs = require("fs");
const s = fs.readFileSync("bundle.js", "utf8");
const re = /"((?:[^"\\]|\\.){6,300})"|'((?:[^'\\]|\\.){6,300})'|`((?:[^`\\]|\\.){6,300})`/g;
let m;
const out = new Set();
while ((m = re.exec(s))) {
  let t = m[1] || m[2] || m[3];
  if (!t) continue;
  t = t.replace(/\\n/g, " ").replace(/\\t/g, " ").replace(/\s+/g, " ").trim();
  if (!/\s/.test(t)) continue;
  if (/[{}<>;]|=>|http|\.js|\.css|rgba|var\(|childNodes|useState|className|componentDid|toISOString|application\//.test(t)) continue;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters / t.length < 0.6) continue;
  if (t.split(" ").length < 2) continue;
  out.add(t);
}
fs.writeFileSync("extracted.txt", [...out].join("\n"));
console.log("Extracted lines:", out.size);
