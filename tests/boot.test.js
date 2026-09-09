const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

/**
 * 启动回归测试：模拟浏览器按 index.html 的脚本顺序加载全部模块并执行 main.js 引导，
 * 验证 app 能在真实页面环境中完成初始化并渲染首页（防止"缺少引导/脚本顺序错误"类回归）。
 */
async function bootPage() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // 按序内联所有 <script src="js/...">
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    return '<script>\n' + code + '\n</script>';
  });
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('error', (...args) => errors.push(args.map(String).join(' ')));
  vc.on('jsdomError', (e) => errors.push(String(e && e.message)));
  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  // 等待异步初始化（IndexedDB 适配器初始化是异步的）
  await new Promise(r => setTimeout(r, 150));
  return { dom, errors };
}

test('页面启动：脚本按序加载、main.js 引导成功并渲染首页', async () => {
  const { dom, errors } = await bootPage();
  const win = dom.window;
  const doc = win.document;
  assert.ok(win.LifeApp && win.LifeApp.App, 'LifeApp.App 应被定义');
  assert.deepStrictEqual(errors, [], '不应有脚本执行错误');
  const appEl = doc.getElementById('app');
  assert.ok(appEl.innerHTML.length > 100, '首页应完成渲染');
  assert.match(appEl.innerHTML, /今日打卡/, '首页应包含今日打卡卡片');
  assert.match(appEl.innerHTML, /今日记账/, '首页应包含今日记账卡片');
  assert.ok(doc.querySelector('nav a[data-nav="home"]'), '导航应渲染');
  win.close();
});

test('页面启动：导航可用，hash 路由能切到打卡页', async () => {
  const { dom, errors } = await bootPage();
  const win = dom.window;
  const doc = win.document;
  assert.deepStrictEqual(errors, [], '不应有脚本执行错误');
  doc.querySelector('nav a[data-nav="checkin"]').click();
  await new Promise(r => setTimeout(r, 120));
  assert.ok(win.location.hash === '#/checkin', 'hash 应变为 #/checkin');
  assert.ok(doc.querySelector('.checkin-list-view'), '打卡列表视图应渲染');
  win.close();
});
