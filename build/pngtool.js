const fs=require("fs"),zlib=require("zlib");

// ---- CRC32 ----
const crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(let i=0;i<buf.length;i++)c=crcTable[(c^buf[i])&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}

function readChunks(b){
  let p=8,chunks=[];
  while(p<b.length){const len=b.readUInt32BE(p);const type=b.toString("ascii",p+4,p+8);const data=b.slice(p+8,p+8+len);chunks.push({type,data});p+=12+len;}
  return chunks;
}
function decode(file){
  const b=fs.readFileSync(file);
  const w=b.readUInt32BE(16),h=b.readUInt32BE(20),bd=b[24],ct=b[25];
  if(bd!==8||ct!==6)throw new Error("need 8-bit RGBA, got bd="+bd+" ct="+ct);
  const chunks=readChunks(b);
  const idat=Buffer.concat(chunks.filter(c=>c.type==="IDAT").map(c=>c.data));
  const raw=zlib.inflateSync(idat);
  const bpp=4,stride=w*bpp;
  const out=Buffer.alloc(h*stride);
  let pos=0;
  for(let y=0;y<h;y++){
    const ft=raw[pos++];
    for(let x=0;x<stride;x++){
      const v=raw[pos++];
      const a=x>=bpp?out[y*stride+x-bpp]:0;
      const bb=y>0?out[(y-1)*stride+x]:0;
      const c=(x>=bpp&&y>0)?out[(y-1)*stride+x-bpp]:0;
      let r;
      switch(ft){case 0:r=v;break;case 1:r=v+a;break;case 2:r=v+bb;break;case 3:r=v+((a+bb)>>1);break;
        case 4:{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);r=v+((pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c));break;}
        default:throw new Error("bad filter "+ft);}
      out[y*stride+x]=r&0xff;
    }
  }
  return {w,h,px:out};
}
function encode(w,h,px){
  const stride=w*4;const raw=Buffer.alloc(h*(stride+1));
  for(let y=0;y<h;y++){raw[y*(stride+1)]=0;px.copy(raw,y*(stride+1)+1,y*stride,y*stride+stride);}
  const idat=zlib.deflateSync(raw,{level:9});
  function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const t=Buffer.from(type,"ascii");
    const crcbuf=Buffer.concat([t,data]);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(crcbuf));return Buffer.concat([len,t,data,crc]);}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",idat),chunk("IEND",Buffer.alloc(0))]);
}

const cmd=process.argv[2];
if(cmd==="inspect"){
  const {w,h,px}=decode(process.argv[3]);
  const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{const i=(y*w+x)*4;return px.slice(i,i+4).join(",");});
  let transparent=0,whiteOpaque=0,total=w*h;
  for(let i=0;i<total;i++){const a=px[i*4+3],r=px[i*4],g=px[i*4+1],b=px[i*4+2];if(a<10)transparent++;else if(r>245&&g>245&&b>245)whiteOpaque++;}
  console.log("corners RGBA:",corners.join(" | "));
  console.log("transparent px %:",(transparent/total*100).toFixed(1),"| near-white-opaque %:",(whiteOpaque/total*100).toFixed(1));
}
if(cmd==="whiteout"){
  const {w,h,px}=decode(process.argv[3]);
  const total=w*h;let cleared=0,soft=0;
  for(let i=0;i<total;i++){
    const r=px[i*4],g=px[i*4+1],b=px[i*4+2];const m=Math.min(r,g,b);
    if(m>=240){px[i*4+3]=0;cleared++;}
    else if(m>=210){px[i*4+3]=Math.round(px[i*4+3]*(240-m)/30);soft++;}
  }
  fs.writeFileSync(process.argv[4],encode(w,h,px));
  console.log("cleared:",cleared,"softened:",soft,"->",process.argv[4]);
}
if(cmd==="detransp"){
  const {w,h,px}=decode(process.argv[3]);
  // flood-fill from edges over near-white -> transparent (avoids nuking white inside the rocket)
  const total=w*h;const vis=new Uint8Array(total);const isWhite=i=>{const r=px[i*4],g=px[i*4+1],b=px[i*4+2];return r>238&&g>238&&b>238;};
  const stack=[];
  for(let x=0;x<w;x++){stack.push(x);stack.push((h-1)*w+x);}
  for(let y=0;y<h;y++){stack.push(y*w);stack.push(y*w+w-1);}
  while(stack.length){const i=stack.pop();if(vis[i])continue;if(!isWhite(i))continue;vis[i]=1;
    const x=i%w,y=(i/w)|0;
    if(x>0)stack.push(i-1);if(x<w-1)stack.push(i+1);if(y>0)stack.push(i-w);if(y<h-1)stack.push(i+w);}
  let cleared=0;for(let i=0;i<total;i++){if(vis[i]){px[i*4+3]=0;cleared++;}}
  // soften edge: set semi for pixels adjacent to cleared that are light
  fs.writeFileSync(process.argv[4],encode(w,h,px));
  console.log("cleared px:",cleared,"->",process.argv[4]);
}
