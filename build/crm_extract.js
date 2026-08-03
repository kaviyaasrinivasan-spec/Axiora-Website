const fs=require("fs");
const s=fs.readFileSync("crm_sheet.csv","utf8");
function parse(str){const rows=[];let row=[],cur="",q=false;for(let i=0;i<str.length;i++){const c=str[i];
 if(q){ if(c=='"'){ if(str[i+1]=='"'){cur+='"';i++;} else q=false; } else cur+=c; }
 else { if(c=='"'){q=true;} else if(c==','){row.push(cur);cur="";} else if(c=='\n'){row.push(cur);rows.push(row);row=[];cur="";} else if(c=='\r'){} else cur+=c; } }
 if(cur.length||row.length){row.push(cur);rows.push(row);} return rows;}
const rows=parse(s), hdr=rows[0].map(h=>h.trim());
const data=rows.slice(1).filter(r=>(r[0]||"").trim());
const idx=n=>hdr.findIndex(h=>h.toLowerCase()===n.toLowerCase());
const g=(r,n)=>(r[idx(n)]||"").trim();
// normalizers
const norm=v=>v.trim();
function so(v){v=norm(v).toLowerCase();if(!v)return "";if(v.startsWith("anu"))return "Anu";if(v.startsWith("sad")||v.startsWith("sal"))return "Sadam";return v.charAt(0).toUpperCase()+v.slice(1);}
function ctype(v){v=norm(v).toLowerCase();if(v.startsWith("retur"))return "Returning";if(!v)return "New";return v.charAt(0).toUpperCase()+v.slice(1);}
function vendor(v){v=norm(v);const l=v.toLowerCase();if(l.includes("mubas"))return "Mubas Clothings";if(l==="pti"||l.includes("plain t")||l.includes("reordered to pti")||l.includes("pti"))return "Plain T Shirts India (PTI)";if(l.includes("ashna"))return "Ashna Garments";if(l.includes("print wear")||l.includes("print wears"))return "Print Wear";if(l.includes("dutees"))return "Dutees";if(l.includes("tpr"))return "TPR Garments";return v;}
function pay(v){v=norm(v);if(/full/i.test(v))return "Fully Paid";if(/50/.test(v))return "50% Paid";if(/pend/i.test(v))return "Pending";return v||"Pending";}
function status(v){v=norm(v);const l=v.toLowerCase();if(l.includes("dispatched"))return "Dispatched";if(l.includes("ready"))return "Ready for Dispatch";if(l.includes("production")||l.includes("ongoing"))return "Ongoing Production";if(l.includes("consignment")||l.includes("ordered"))return "Consignment Ordered";return v||"Consignment Ordered";}
function layout(v){v=norm(v);if(/done/i.test(v))return "Done";if(/prog/i.test(v))return "In Progress";return "Pending";}
const out=data.map((r,i)=>({
 id:parseInt(g(r,"Sl No"))||i+1,
 date:g(r,"Date"),
 customer:g(r,"Customer Name"),
 contact:g(r,"Contact number"),
 desc:g(r,"Order description"),
 mock:g(r,"Mock Folder"),
 layout:layout(g(r,"Layout Status")),
 color:g(r,"Color"),
 size:g(r,"Size"),
 qty:g(r,"Qty"),
 orderDate:g(r,"Advance Payment Date / Order Date"),
 deadline:g(r,"Deadline Date"),
 cost:g(r,"Total Cost"),
 notes:g(r,"Notes"),
 ctype:ctype(g(r,"Customer Type")),
 so:so(g(r,"SO")),
 payment:pay(g(r,"Payment Status")),
 status:status(g(r,"Status")),
 vendor:vendor(g(r,"Vendor")),
 dispatch:g(r,"Dispatch Date"),
 mot:g(r,"MOT")
}));
fs.writeFileSync("crewfit_data.json",JSON.stringify(out));
console.log("records:",out.length,"| json KB:",(fs.statSync("crewfit_data.json").size/1024).toFixed(0));
const sum=(k)=>{const m={};out.forEach(o=>m[o[k]]=(m[o[k]]||0)+1);return m;};
console.log("status:",JSON.stringify(sum("status")));
console.log("payment:",JSON.stringify(sum("payment")));
console.log("so:",JSON.stringify(sum("so")));
console.log("sample:",JSON.stringify(out[0]).slice(0,300));
