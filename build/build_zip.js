// Builds a WordPress-safe ZIP (classic PKZIP, deflate, CRC in local header, no data descriptors, forward slashes)
const fs=require("fs"), path=require("path"), zlib=require("zlib");
const ROOT="C:/Users/abcom/Desktop/office/Workboosterai_WP";
const THEME="axioralabs_wp";
const OUTZIP=path.join(ROOT,"axioralabs_wp.zip");

// CRC32
const T=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=T[(c^b[i])&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}

function walk(dir,base,list){
  for(const name of fs.readdirSync(dir)){
    const fp=path.join(dir,name);
    const st=fs.statSync(fp);
    const rel=(base?base+"/":"")+name;
    if(st.isDirectory()) walk(fp,rel,list);
    else list.push({rel,fp});
  }
  return list;
}

const themeDir=path.join(ROOT,THEME);
const files=walk(themeDir,THEME,[]); // entry names prefixed with workbooster-theme/
const locals=[]; const central=[]; let offset=0;
const DOSTIME=0, DOSDATE=0x21<<0|0x01<<5|((2024-1980)<<9); // arbitrary valid date (2024-01-01)

for(const f of files){
  const data=fs.readFileSync(f.fp);
  const comp=zlib.deflateRawSync(data,{level:9});
  const crc=crc32(data);
  const nameBuf=Buffer.from(f.rel,"utf8");
  // local header
  const lh=Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50,0);
  lh.writeUInt16LE(20,4);          // version needed
  lh.writeUInt16LE(0,6);           // flags (no data descriptor)
  lh.writeUInt16LE(8,8);           // method deflate
  lh.writeUInt16LE(DOSTIME,10);
  lh.writeUInt16LE(DOSDATE,12);
  lh.writeUInt32LE(crc,14);
  lh.writeUInt32LE(comp.length,18);
  lh.writeUInt32LE(data.length,22);
  lh.writeUInt16LE(nameBuf.length,26);
  lh.writeUInt16LE(0,28);
  locals.push(lh,nameBuf,comp);
  // central dir
  const ch=Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50,0);
  ch.writeUInt16LE(20,4);          // version made by
  ch.writeUInt16LE(20,6);          // version needed
  ch.writeUInt16LE(0,8);
  ch.writeUInt16LE(8,10);
  ch.writeUInt16LE(DOSTIME,12);
  ch.writeUInt16LE(DOSDATE,14);
  ch.writeUInt32LE(crc,16);
  ch.writeUInt32LE(comp.length,20);
  ch.writeUInt32LE(data.length,24);
  ch.writeUInt16LE(nameBuf.length,28);
  ch.writeUInt16LE(0,30); ch.writeUInt16LE(0,32); ch.writeUInt16LE(0,34);
  ch.writeUInt16LE(0,36); ch.writeUInt32LE(0,38);
  ch.writeUInt32LE(offset,42);
  central.push(ch,nameBuf);
  offset+=lh.length+nameBuf.length+comp.length;
}
const localBuf=Buffer.concat(locals);
const centralBuf=Buffer.concat(central);
const eocd=Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50,0);
eocd.writeUInt16LE(0,4); eocd.writeUInt16LE(0,6);
eocd.writeUInt16LE(files.length,8);
eocd.writeUInt16LE(files.length,10);
eocd.writeUInt32LE(centralBuf.length,12);
eocd.writeUInt32LE(localBuf.length,16);
eocd.writeUInt16LE(0,20);
fs.writeFileSync(OUTZIP,Buffer.concat([localBuf,centralBuf,eocd]));
console.log("ZIP written:",OUTZIP,(fs.statSync(OUTZIP).size/1024).toFixed(0)+"KB, files:",files.length);
console.log("first files:",files.slice(0,3).map(f=>f.rel).join(", "));
