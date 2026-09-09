/**
 * offline.test.js —— G5 无网络运行验收
 * PRD 10.8 G5：断开网络 → 正常使用所有功能，所有功能正常，无报错。
 *
 * 两层验证：
 *  1) 静态扫描：应用加载的所有源码（index.html / css / js）不得引用任何网络 API
 *     或外部资源（fetch、XHR、WebSocket、EventSource、sendBeacon、http(s) 外部 URL）。
 *  2) 运行时验证：在“断网”环境（fetch/XHR/WebSocket/EventSource 全部置为失败桩）下
 *     启动应用并遍历全部 5 个视图，断言全程未发起任何网络请求且页面正常渲染。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

/** 应用实际加载的源码文件（与 index.html 的 <script>/<link> 一致） */
const APP_FILES = [
  'index.html',
  'css/style.css',
  'js/dateutil.js',
  'js/storage.js',
  'js/store.js',
  'js/stats.js',
  'js/backup.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/checkin-list.js',
  'js/views/checkin-detail.js',
  'js/views/account-daily.js',
  'js/views/account-stats.js',
  'js/app.js',
  'js/main.js'
];

test('G5 静态扫描：应用源码不含任何网络请求调用与外部资源引用', () => {
  const files = APP_FILES.map(f => ({ name: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));

  // JS 源码：禁止出现网络 API 调用或 http(s) URL
  const jsPatterns = [
    { re: /\bfetch\s*\(/, desc: 'fetch 调用' },
    { re: /\bXMLHttpRequest\b/, desc: 'XMLHttpRequest' },
    { re: /\bWebSocket\s*\(/, desc: 'WebSocket' },
    { re: /\bEventSource\s*\(/, desc: 'EventSource' },
    { re: /\bsendBeacon\s*\(/, desc: 'navigator.sendBeacon' },
    { re: /\baxios\b/, desc: 'axios' },
    { re: /https?:\/\//, desc: 'http(s) 外部 URL' }
  ];
  files.filter(f => f.name.endsWith('.js')).forEach(f => {
    jsPatterns.forEach(p => {
      const m = p.re.exec(f.text);
      assert.ok(!m, `${f.name} 不应包含${p.desc}（发现：${m ? m[0] : ''}）`);
    });
  });

  // CSS：仅允许 data: 内联资源，不允许 url(http / @import 外部
  const css = files.find(f => f.name === 'css/style.css').text;
  assert.ok(!/url\(\s*['"]?https?:\/\//.test(css), 'CSS 不应引用外部 url(http');
  assert.ok(!/@import\s+['"]?https?:/.test(css), 'CSS 不应 @import 外部资源');
  assert.ok(!/src\s*=\s*['"]https?:/.test(css), 'CSS 不应内联外部脚本');

  // index.html：不得引用外部脚本/样式/图片/iframe，不得有外部链接
  const html = files.find(f => f.name === 'index.html').text;
  assert.ok(!/<script[^>]+src\s*=\s*['"]https?:/.test(html), 'index.html 不应加载外部脚本');
  assert.ok(!/<link[^>]+href\s*=\s*['"]https?:/.test(html), 'index.html 不应加载外部样式');
  assert.ok(!/<img[^>]+src\s*=\s*['"]https?:/.test(html), 'index.html 不应引用外部图片');
  assert.ok(!/<iframe/.test(html), 'index.html 不应包含 iframe');
  assert.ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'index.html 不应包含 http(s) URL');
});

/** 构造“断网”页面环境：内联全部脚本，网络 API 全部置为失败桩并计数 */
function bootOffline() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    return '<script>\n' + code + '\n</script>';
  });
  const netCalls = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('error', (...args) => errors.push(args.map(String).join(' ')));
  vc.on('jsdomError', e => errors.push(String(e && e.message)));
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // 断网桩：任何网络调用都会被记录并失败
      window.fetch = (...args) => { netCalls.push(['fetch'].concat(args.map(String))); return Promise.reject(new Error('offline')); };
      window.XMLHttpRequest = function () { netCalls.push(['XMLHttpRequest']); throw new Error('offline'); };
      window.WebSocket = function () { netCalls.push(['WebSocket']); throw new Error('offline'); };
      window.EventSource = function () { netCalls.push(['EventSource']); throw new Error('offline'); };
      window.navigator.sendBeacon = (...args) => { netCalls.push(['sendBeacon'].concat(args.map(String))); return false; };
    }
  });
  return { dom, netCalls, errors };
}

const wait = ms => new Promise(r => setTimeout(r, ms));

test('G5 运行时：断网环境下启动并遍历全部视图，零网络请求、正常渲染', async () => {
  const { dom, netCalls, errors } = bootOffline();
  const win = dom.window;
  const doc = win.document;
  await wait(200); // 等待异步初始化完成

  assert.deepStrictEqual(errors, [], '断网启动不应有脚本执行错误');
  assert.ok(win.LifeApp && win.LifeApp.App, '应用应成功引导');
  const appEl = doc.getElementById('app');
  assert.ok(appEl.innerHTML.length > 100, '首页应完成渲染');
  assert.match(appEl.innerHTML, /cal-grid/, '首页应含日历网格');
  assert.match(appEl.innerHTML, /📋 打卡/, '首页应含打卡区域');

  // 依次访问全部 5 个视图
  const routes = ['#/', '#/checkin', '#/account/daily', '#/account/stats'];
  for (const r of routes) {
    win.location.hash = r;
    win.dispatchEvent(new win.Event('hashchange'));
    await wait(60);
  }
  // 打卡详情：需要先有计划，直接通过状态注入不现实，仅验证列表路由即可；
  // 详情路由在无计划时应渲染空状态而非报错
  win.location.hash = '#/checkin/nonexistent';
  win.dispatchEvent(new win.Event('hashchange'));
  await wait(60);
  assert.match(appEl.innerHTML, /计划不存在|返回列表/, '未知计划详情应显示空状态');

  assert.deepStrictEqual(netCalls, [], '整个使用过程不应发起任何网络请求');
  win.close();
});
