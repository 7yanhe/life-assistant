/**
 * gen-icons.js —— 纯 Node.js 生成 PWA 应用图标（192x192 / 512x512 PNG）
 * 设计：蓝色背景 + 白色日历卡片 + 蓝色对勾
 * 运行：node gen-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- PNG 编码 ---------- */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    pixels.copy(raw, y * rowSize + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 绘图 ---------- */
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);

  function set(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }

  function rect(x, y, w, h, r, g, b, a) {
    for (let py = Math.max(0, y); py < Math.min(size, y + h); py++)
      for (let pxx = Math.max(0, x); pxx < Math.min(size, x + w); pxx++)
        set(pxx, py, r, g, b, a);
  }

  function disc(cx, cy, rad, r, g, b, a) {
    for (let py = cy - rad; py <= cy + rad; py++)
      for (let pxx = cx - rad; pxx <= cx + rad; pxx++)
        if ((pxx - cx) * (pxx - cx) + (py - cy) * (py - cy) <= rad * rad)
          set(pxx, py, r, g, b, a);
  }

  function thickLine(x0, y0, x1, y1, width, r, g, b, a) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    const half = Math.floor(width / 2);
    while (true) {
      disc(x, y, half, r, g, b, a);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  const BLUE = [0x2f, 0x6f, 0xed];
  const BLUE_DARK = [0x1a, 0x5a, 0xd6];
  const WHITE = [255, 255, 255];

  // 背景
  rect(0, 0, size, size, ...BLUE, 255);

  // 白色日历卡片
  const cx = Math.floor(size * 0.18);
  const cy = Math.floor(size * 0.20);
  const cw = Math.floor(size * 0.64);
  const ch = Math.floor(size * 0.60);
  rect(cx, cy, cw, ch, ...WHITE, 255);

  // 日历顶部深色条
  const barH = Math.floor(size * 0.13);
  rect(cx, cy, cw, barH, ...BLUE_DARK, 255);

  // 顶部两个装订环（白色圆点）
  const ringY = cy + Math.floor(barH / 2);
  const ringR = Math.floor(size * 0.028);
  disc(cx + Math.floor(cw * 0.28), ringY, ringR, ...WHITE, 255);
  disc(cx + Math.floor(cw * 0.72), ringY, ringR, ...WHITE, 255);

  // 对勾（蓝色粗线），位于白色区域中心
  const whiteTop = cy + barH;
  const whiteH = ch - barH;
  const midY = whiteTop + Math.floor(whiteH * 0.55);
  const leftX = cx + Math.floor(cw * 0.22);
  const bottomX = cx + Math.floor(cw * 0.42);
  const rightX = cx + Math.floor(cw * 0.78);
  const topY = midY - Math.floor(whiteH * 0.28);
  const bottomY = midY + Math.floor(whiteH * 0.12);
  const lineW = Math.max(6, Math.floor(size * 0.055));
  thickLine(leftX, midY, bottomX, bottomY, lineW, ...BLUE, 255);
  thickLine(bottomX, bottomY, rightX, topY, lineW, ...BLUE, 255);

  return px;
}

/* ---------- 生成 ---------- */
const outDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

[192, 512].forEach(size => {
  const png = encodePNG(size, size, drawIcon(size));
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`生成 ${file} (${png.length} bytes)`);
});
