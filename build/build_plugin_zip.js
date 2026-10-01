// Packs ../<plugin> into ../<plugin>.zip as a WordPress-safe ZIP (classic
// PKZIP, deflate, CRC in the local header, no data descriptors, forward
// slashes). Same writer as build_zip.js — Windows "Compress to zip" produces
// archives WP's unzipper sometimes rejects.
//
//   node build/build_plugin_zip.js [plugin-folder-name]  (defaults to axiora-internship)
const fs = require("fs"), path = require("path"), zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN = process.argv[2] || "axiora-internship";
const OUTZIP = path.join(ROOT, PLUGIN + ".zip");
const SKIP = new Set([".git", ".DS_Store", "node_modules", "Thumbs.db"]);

const T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function walk(dir, base, list) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const fp = path.join(dir, name);
    const rel = (base ? base + "/" : "") + name;
    if (fs.statSync(fp).isDirectory()) walk(fp, rel, list);
    else list.push({ rel, fp });
  }
  return list;
}

const files = walk(path.join(ROOT, PLUGIN), PLUGIN, []);
const locals = [], central = [];
let offset = 0;
const DOSTIME = 0, DOSDATE = (1 << 0) | (1 << 5) | ((2024 - 1980) << 9);

for (const f of files) {
  const data = fs.readFileSync(f.fp);
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const nameBuf = Buffer.from(f.rel, "utf8");

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(8, 8);
  lh.writeUInt16LE(DOSTIME, 10);
  lh.writeUInt16LE(DOSDATE, 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);
  locals.push(lh, nameBuf, comp);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(20, 4);
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0, 8);
  ch.writeUInt16LE(8, 10);
  ch.writeUInt16LE(DOSTIME, 12);
  ch.writeUInt16LE(DOSDATE, 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, nameBuf);

  offset += lh.length + nameBuf.length + comp.length;
}

const localBuf = Buffer.concat(locals);
const centralBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(localBuf.length, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(OUTZIP, Buffer.concat([localBuf, centralBuf, eocd]));
console.log("ZIP written:", OUTZIP, (fs.statSync(OUTZIP).size / 1024).toFixed(1) + "KB, files:", files.length);
files.forEach(f => console.log("  " + f.rel));
