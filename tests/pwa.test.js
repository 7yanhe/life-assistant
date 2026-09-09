/**
 * pwa.test.js —— PWA 支持验收
 * 验证 manifest.json、service-worker.js、图标、index.html 引用均正确，
 * 确保应用可"添加到主屏幕"并离线运行。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('manifest.json 存在且字段完整', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.strictEqual(m.name, '生活助手');
  assert.strictEqual(m.short_name, '生活助手');
  assert.strictEqual(m.display, 'standalone');
  assert.strictEqual(m.theme_color, '#2f6fed');
  assert.strictEqual(m.background_color, '#f4f6fa');
  assert.strictEqual(m.start_url, './index.html');
  assert.strictEqual(m.scope, './');
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, '应至少包含 192 和 512 两档图标');
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192'), '应包含 192x192 图标');
  assert.ok(sizes.includes('512x512'), '应包含 512x512 图标');
  m.icons.forEach(i => {
    assert.ok(fs.existsSync(path.join(ROOT, i.src)), `图标文件应存在: ${i.src}`);
    assert.strictEqual(i.type, 'image/png');
  });
});

test('图标文件存在且为有效 PNG', () => {
  ['icons/icon-192.png', 'icons/icon-512.png'].forEach(rel => {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    assert.strictEqual(buf[0], 0x89);
    assert.strictEqual(buf[1], 0x50);
    assert.strictEqual(buf[2], 0x4E);
    assert.strictEqual(buf[3], 0x47);
    assert.ok(buf.length > 100, `${rel} 文件大小应大于 100 字节`);
  });
});

test('service-worker.js 存在且包含离线缓存逻辑', () => {
  const sw = read('service-worker.js');
  assert.match(sw, /CACHE_VERSION/, '应定义缓存版本号');
  assert.match(sw, /addEventListener\(['"]install['"]/, '应监听 install 事件');
  assert.match(sw, /addEventListener\(['"]activate['"]/, '应监听 activate 事件');
  assert.match(sw, /addEventListener\(['"]fetch['"]/, '应监听 fetch 事件');
  assert.match(sw, /caches\.open/, '应使用 caches API');
  assert.match(sw, /skipWaiting/, '应调用 skipWaiting 立即激活');
  assert.match(sw, /clients\.claim/, '应调用 clients.claim 接管页面');
  // 应用外壳应包含核心文件
  assert.match(sw, /index\.html/, '应缓存 index.html');
  assert.match(sw, /style\.css/, '应缓存 style.css');
  assert.match(sw, /app\.js/, '应缓存 app.js');
  assert.match(sw, /icon-192\.png/, '应缓存图标');
});

test('index.html 引用 manifest 并注册 service worker', () => {
  const html = read('index.html');
  assert.match(html, /<link[^>]+rel=["']manifest["']/, '应引用 manifest.json');
  assert.match(html, /manifest\.json/, 'manifest 链接应指向 manifest.json');
  assert.match(html, /serviceWorker\.register/, '应注册 service worker');
  assert.match(html, /service-worker\.js/, '应指向 service-worker.js');
  assert.match(html, /theme-color[^>]+#2f6fed/, '应设置 theme-color');
  assert.match(html, /apple-mobile-web-app-capable/, '应设置 iOS 全屏 meta');
});

test('PWA 升级提示：修改代码后需递增 CACHE_VERSION', () => {
  // 这是一个约束性测试：确保 CACHE_VERSION 存在且格式合理，
  // 防止开发者忘记递增版本导致旧缓存不被清理。
  const sw = read('service-worker.js');
  const m = /CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(sw);
  assert.ok(m, 'CACHE_VERSION 应以字符串形式定义');
  assert.ok(m[1].length > 0, 'CACHE_VERSION 不应为空');
});
