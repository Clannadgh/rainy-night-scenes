/* PNG 取色工具（开发用）
   用法:
     node tools/pixel.js output/final_wide.png 10,20 640,360
     node tools/pixel.js output/final_wide.png --grid 8,8
   打印若干采样点的 sRGB 十六进制值。 */
const fs = require('fs');
const zlib = require('zlib');

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8;
  let width = 0, height = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace) throw new Error('不支持隔行 PNG');
  if (bitDepth !== 8) throw new Error('仅支持 8bit PNG');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4;
  const bpp = channels;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
        v = (v + pr) & 255;
      }
      cur[i] = v;
    }
  }
  return { width, height, channels, data: out };
}

function px(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const i = (y * img.width + x) * img.channels;
  const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
  return { x, y, hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), rgb: [r, g, b] };
}

const file = process.argv[2];
if (!file) { console.error('用法: node tools/pixel.js <png> [x,y ...] [--grid N]'); process.exit(1); }
const img = decodePNG(file);
console.log(file + '  ' + img.width + 'x' + img.height + ' ch=' + img.channels);

const rest = process.argv.slice(3);
const gridIdx = rest.indexOf('--grid');
const grid = gridIdx >= 0 ? parseInt(rest[gridIdx + 1], 10) : 0;
const pts = rest.filter(a => /^\d+,\d+$/.test(a));

// --crop x,y,w,h[,scale] out.png   裁剪并放大，方便看细节
const cropIdx = rest.indexOf('--crop');
if (cropIdx >= 0) {
  const spec = rest[cropIdx + 1].split(',').map(Number);
  const cx = spec[0], cy = spec[1], cw = spec[2], ch = spec[3];
  const scale = spec[4] || 1;
  const outFile = rest[cropIdx + 2] || 'output/_crop.png';
  const ow = cw * scale, oh = ch * scale;
  const rows = [];
  for (let y = 0; y < oh; y++) {
    const row = Buffer.alloc(1 + ow * 3);
    row[0] = 0;
    for (let x = 0; x < ow; x++) {
      const sx = Math.min(img.width - 1, cx + Math.floor(x / scale));
      const sy = Math.min(img.height - 1, cy + Math.floor(y / scale));
      const i = (sy * img.width + sx) * img.channels;
      row[1 + x * 3] = img.data[i];
      row[2 + x * 3] = img.data[i + 1];
      row[3 + x * 3] = img.data[i + 2];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const chunks = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ow, 0); ihdr.writeUInt32BE(oh, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', zlib.deflateSync(raw)));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  fs.writeFileSync(outFile, Buffer.concat(chunks));
  console.log('crop -> ' + outFile + ' (' + ow + 'x' + oh + ')');
  process.exit(0);
}

if (grid > 0) {
  for (let gy = 0; gy < grid; gy++) {
    const row = [];
    for (let gx = 0; gx < grid; gx++) {
      const x = (gx + 0.5) / grid * img.width;
      const y = (gy + 0.5) / grid * img.height;
      row.push(px(img, x, y).hex);
    }
    console.log(row.join('  '));
  }
}
pts.forEach(p => {
  const [x, y] = p.split(',').map(Number);
  const c = px(img, x, y);
  console.log('(' + c.x + ',' + c.y + ') ' + c.hex + '  rgb(' + c.rgb.join(',') + ')');
});
