const { test } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

const Store = require('../js/store.js');
const Storage = require('../js/storage.js');
const App = require('../js/app.js');

const TODAY = '2026-09-09';

const HTML = `<!DOCTYPE html><html><head></head><body>
<nav class="topnav">
  <div class="brand">生活助手</div>
  <div class="nav-links">
    <a href="#/" data-nav="home">首页</a>
    <a href="#/checkin" data-nav="checkin">打卡</a>
    <a href="#/account/daily" data-nav="account">记账</a>
  </div>
  <div class="nav-actions">
    <button type="button" class="btn btn-icon more-btn" data-action="nav-more" aria-label="更多操作">⋮</button>
    <div class="nav-more-menu" data-role="nav-more-menu" hidden>
      <button type="button" class="menu-item" data-action="export-backup">导出备份</button>
      <button type="button" class="menu-item" data-action="import-backup">导入恢复</button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
  </div>
</nav>
<main id="app" class="app-container"></main>
</body></html>`;

function buildApp(seed) {
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  const win = dom.window;
  const doc = win.document;
  const adapter = Storage.memoryAdapter(seed || null);
  const store = new Store(adapter, { todayFn: () => TODAY });
  const app = new App({ window: win, root: doc.getElementById('app'), store });
  // jsdom 无法覆写 location.reload，注入 _reload 以便断言刷新行为
  app._reload = function () { win.__reloaded = true; };
  return { dom, win, doc, app, store, adapter };
}

const tick = () => new Promise(r => setTimeout(r, 0));
const tickMs = ms => new Promise(r => setTimeout(r, ms));
// jsdom 的 hash 导航在异步任务队列中处理，点击锚点后需等待其完成
const navTick = () => tickMs(40);

function clickAction(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function seedPlanOld() {
  const d = Storage.createDefaultData();
  d.plans = [{ id: 'plan_old', name: '早起', createdAt: '2026-09-01' }];
  d.checkRecords = [{ planId: 'plan_old', date: TODAY, completed: true }];
  return d;
}

/* ============ 启动 / 导航（G1） ============ */

test('G1 启动默认进入首页，导航高亮正确', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  assert.ok(doc.querySelector('.home-view'), '默认应渲染首页');
  assert.ok(doc.querySelector('a[data-nav="home"]').classList.contains('active'));
  assert.ok(!doc.querySelector('a[data-nav="checkin"]').classList.contains('active'));
});

test('G1 导航切换：点击三个入口正确切换并高亮', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  // 打卡
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  assert.ok(doc.querySelector('.checkin-list-view'));
  assert.ok(doc.querySelector('a[data-nav="checkin"]').classList.contains('active'));
  // 记账（日记账）
  doc.querySelector('a[data-nav="account"]').click();
  await navTick();
  assert.ok(doc.querySelector('.account-daily-view'));
  assert.ok(doc.querySelector('a[data-nav="account"]').classList.contains('active'));
  // 回首页
  doc.querySelector('a[data-nav="home"]').click();
  await navTick();
  assert.ok(doc.querySelector('.home-view'));
  assert.ok(doc.querySelector('a[data-nav="home"]').classList.contains('active'));
});

test('未知 hash 回退首页', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  win.location.hash = '#/no-such-page';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  assert.ok(doc.querySelector('.home-view'));
});

/* ============ 首页（H1-H4） ============ */

test('H1 首页显示今天日期与星期', async () => {
  const { doc, app } = buildApp();
  await app.start();
  assert.match(doc.querySelector('.detail-date-label').textContent, /2026年9月9日/);
  assert.strictEqual(doc.querySelector('.detail-date-week').textContent, '星期三');
});

test('C2/H2 首页快捷打卡：勾选立即保存并更新完成数，打卡页同步', async () => {
  const { win, doc, app, store, adapter } = buildApp(seedPlanOld());
  await app.start();
  let count = doc.querySelector('.detail-section-title .count').textContent;
  assert.strictEqual(count.trim(), '已完成 1 / 共 1');
  // 取消勾选
  const box = doc.querySelector('input[data-action="toggle-today"]');
  assert.ok(box.checked);
  clickAction(win, box);
  await navTick();
  count = doc.querySelector('.detail-section-title .count').textContent;
  assert.strictEqual(count.trim(), '已完成 0 / 共 1');
  assert.strictEqual(store.todayStatus('plan_old'), false);
  // 即时保存：同底层存储新建 store（模拟刷新）状态保留
  const s2 = new Store(adapter, { todayFn: () => TODAY });
  await s2.init();
  assert.strictEqual(s2.todayStatus('plan_old'), false);
  // 打卡页同步
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  const listBox = doc.querySelector('.plan-list input[data-action="toggle-today"]');
  assert.strictEqual(listBox.checked, false);
  // 在打卡页勾选 → 回首页同步
  clickAction(win, listBox);
  await navTick();
  doc.querySelector('a[data-nav="home"]').click();
  await navTick();
  assert.strictEqual(doc.querySelector('input[data-action="toggle-today"]').checked, true);
  assert.match(doc.querySelector('.detail-section-title .count').textContent, /已完成 1 \/ 共 1/);
});

test('H3 首页记账只读：显示今日收支但不含金额输入框', async () => {
  const d = Storage.createDefaultData();
  d.expenseItems = [{ id: 'e1', name: '早餐', createdAt: '2026-09-01', stoppedAt: null }];
  d.expenseRecords = [{ itemId: 'e1', date: TODAY, amount: 12 }];
  d.incomeRecords = [{ id: 'i1', name: '工资', date: TODAY, amount: 8000 }];
  const { doc, app } = buildApp(d);
  await app.start();
  const homeHtml = doc.querySelector('.home-view').innerHTML;
  assert.match(homeHtml, /¥12\.00/);
  assert.match(homeHtml, />工资</);
  assert.doesNotMatch(homeHtml, /amount-input/);
  assert.doesNotMatch(homeHtml, /id="inc-name"/);
});

test('H4 首页导航「记账」跳转到日记账且日期为今天', async () => {
  const { doc, app } = buildApp();
  await app.start();
  doc.querySelector('a[data-nav="account"]').click();
  await navTick();
  assert.ok(doc.querySelector('.account-daily-view'));
  assert.strictEqual(doc.querySelector('.date-input').value, TODAY);
});

test('G4 首页空状态引导', async () => {
  const { doc, app } = buildApp();
  await app.start();
  assert.match(doc.querySelector('.home-view').textContent, /还没有打卡计划/);
  assert.match(doc.querySelector('.home-view').textContent, /今天还没有记账/);
});

/* ============ 删除确认（G2） ============ */

test('G2 删除计划：取消不删除，确认才删除', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="delete-plan"]'));
  await navTick();
  const overlay = doc.querySelector('.modal-overlay');
  assert.ok(overlay, '删除应弹出确认框');
  // 取消
  overlay.querySelector('.modal-foot button').click(); // 第一个按钮为「取消」
  await navTick();
  assert.ok(store.getPlan('plan_old'), '取消后计划保留');
  // 再删并确认
  clickAction(win, doc.querySelector('button[data-action="delete-plan"]'));
  await navTick();
  const btns = doc.querySelectorAll('.modal-foot button');
  btns[btns.length - 1].click(); // 最后一个为「删除」
  await navTick();
  assert.strictEqual(store.getPlan('plan_old'), null, '确认后计划删除');
  assert.strictEqual(store.getPlanRecords('plan_old').length, 0, '记录一并删除');
});

/* ============ 备份导出（B1） ============ */

test('B1 导出备份：下载文件名与内容为全部数据', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  let capturedBlob = null;
  win.URL.createObjectURL = function (b) { capturedBlob = b; return 'blob:mock'; };
  win.URL.revokeObjectURL = function () {};
  let clicked = null;
  win.HTMLAnchorElement.prototype.click = function () { clicked = this; };
  clickAction(win, doc.querySelector('button[data-action="export-backup"]'));
  await navTick();
  assert.ok(clicked, '应触发下载');
  assert.match(clicked.download, /^生活助手备份_\d{8}_\d{6}\.json$/);
  assert.strictEqual(clicked.href, 'blob:mock');
  const text = await capturedBlob.text();
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.plans[0].name, '早起');
  assert.strictEqual(parsed.checkRecords[0].completed, true);
  assert.strictEqual(parsed.meta.version, '1.0');
});

/* ============ 备份导入（B2/B3/B4） ============ */

function makeBackupFile(win, data, name) {
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  return new win.File([json], name || 'backup.json', { type: 'application/json' });
}

function setFiles(input, file) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
}

test('B3/B2 导入恢复：有数据时弹出覆盖确认，确认后覆盖并刷新', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  const backup = {
    plans: [{ id: 'p_new', name: '导入计划', createdAt: TODAY }],
    checkRecords: [{ planId: 'p_new', date: TODAY, completed: true }],
    expenseItems: [{ id: 'e9', name: '午餐', createdAt: TODAY, stoppedAt: null }],
    expenseRecords: [{ itemId: 'e9', date: TODAY, amount: 20 }],
    incomeRecords: [{ id: 'i9', name: '工资', date: TODAY, amount: 5000 }],
    meta: { version: '1.0', lastModified: '2026-09-09T00:00:00.000Z' }
  };
  const input = doc.getElementById('import-file');
  setFiles(input, makeBackupFile(win, backup));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await navTick();
  await navTick();
  const overlay = doc.querySelector('.modal-overlay');
  assert.ok(overlay, '有数据时导入应弹出覆盖确认');
  assert.match(overlay.textContent, /覆盖当前所有数据/);
  overlay.querySelectorAll('.modal-foot button')[1].click(); // 确认导入
  await navTick();
  await navTick();
  assert.strictEqual(store.getPlan('plan_old'), null, '旧数据被覆盖');
  assert.strictEqual(store.getPlan('p_new').name, '导入计划');
  assert.strictEqual(store.todayStatus('p_new'), true);
  assert.strictEqual(store.dailySummary(TODAY).totalExpense, 20);
  // 恢复后自动刷新
  await tickMs(700);
  assert.strictEqual(win.__reloaded, true);
});

test('B3 导入覆盖确认：取消则不修改数据', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  const backup = { plans: [], checkRecords: [], expenseItems: [], expenseRecords: [], incomeRecords: [], meta: { version: '1.0' } };
  const input = doc.getElementById('import-file');
  setFiles(input, makeBackupFile(win, backup));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await navTick();
  await navTick();
  const overlay = doc.querySelector('.modal-overlay');
  assert.ok(overlay);
  overlay.querySelectorAll('.modal-foot button')[0].click(); // 取消
  await navTick();
  assert.ok(store.getPlan('plan_old'), '取消后数据保留');
  assert.strictEqual(win.__reloaded, undefined, '不应刷新');
});

test('B4 导入格式校验：非 JSON 文件提示错误且不修改数据', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  const input = doc.getElementById('import-file');
  setFiles(input, makeBackupFile(win, '这不是 JSON{{{'));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await navTick();
  await navTick();
  assert.strictEqual(doc.querySelector('.modal-overlay'), null, '非法文件不应弹确认框');
  const toast = doc.querySelector('.toast');
  assert.ok(toast, '应提示错误');
  assert.match(toast.textContent, /导入失败/);
  assert.ok(store.getPlan('plan_old'), '数据未被修改');
});

test('B4 导入格式校验：缺少必要字段拒绝导入', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  const bad = { plans: [], checkRecords: [], meta: { version: '1.0' } }; // 缺 expenseItems 等
  const input = doc.getElementById('import-file');
  setFiles(input, makeBackupFile(win, bad));
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  await navTick();
  await navTick();
  assert.strictEqual(doc.querySelector('.modal-overlay'), null);
  assert.match(doc.querySelector('.toast').textContent, /缺少必要字段/);
  assert.ok(store.getPlan('plan_old'));
});



/* ============ 阶段三：导航栏更多菜单 ============ */

test('N1 导航栏包含更多按钮 ⋮', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  const moreBtn = doc.querySelector('button[data-action="nav-more"]');
  assert.ok(moreBtn, '导航栏应包含更多按钮');
  assert.match(moreBtn.textContent, /⋮/, '更多按钮应显示 ⋮');
});

test('N2 点击更多按钮显示下拉菜单', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  const menu = doc.querySelector('[data-role="nav-more-menu"]');
  assert.ok(menu, '应存在更多菜单容器');
  assert.ok(menu.hasAttribute('hidden'), '初始应隐藏');
  // 点击更多按钮
  clickAction(win, doc.querySelector('button[data-action="nav-more"]'));
  await tick();
  assert.ok(!menu.hasAttribute('hidden'), '点击后应显示菜单');
});

test('N3 下拉菜单包含导出备份和导入恢复选项', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  clickAction(win, doc.querySelector('button[data-action="nav-more"]'));
  await tick();
  const menu = doc.querySelector('[data-role="nav-more-menu"]');
  assert.ok(menu.querySelector('button[data-action="export-backup"]'), '菜单应包含导出备份');
  assert.ok(menu.querySelector('button[data-action="import-backup"]'), '菜单应包含导入恢复');
  assert.match(menu.textContent, /导出备份/);
  assert.match(menu.textContent, /导入恢复/);
});

test('N4 再次点击更多按钮隐藏菜单', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  const moreBtn = doc.querySelector('button[data-action="nav-more"]');
  const menu = doc.querySelector('[data-role="nav-more-menu"]');
  // 第一次点击：显示
  clickAction(win, moreBtn);
  await tick();
  assert.ok(!menu.hasAttribute('hidden'), '第一次点击后应显示');
  // 第二次点击：隐藏
  clickAction(win, moreBtn);
  await tick();
  assert.ok(menu.hasAttribute('hidden'), '第二次点击后应隐藏');
});
