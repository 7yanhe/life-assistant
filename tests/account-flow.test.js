const { test } = require('node:test');
const assert = require('node:assert');
const Storage = require('../js/storage.js');
const { buildApp, tick, tickMs, navTick, clickAction, TODAY } = require('./_apphelper.js');

/** 会计种子数据：早餐(09-01创建)、交通(09-05创建)；收入 工资(09-05)、兼职(09-12) */
function seedAccounting() {
  const d = Storage.createDefaultData();
  d.expenseItems = [
    { id: 'e1', name: '早餐', createdAt: '2026-09-01', stoppedAt: null },
    { id: 'e2', name: '交通', createdAt: '2026-09-05', stoppedAt: null }
  ];
  d.expenseRecords = [
    { itemId: 'e1', date: '2026-09-07', amount: 12 },
    { itemId: 'e1', date: '2026-09-09', amount: 8 },
    { itemId: 'e2', date: '2026-09-10', amount: 13 }
  ];
  d.incomeRecords = [
    { id: 'i1', name: '工资', date: '2026-09-05', amount: 8000 },
    { id: 'i2', name: '兼职', date: '2026-09-12', amount: 500 }
  ];
  return d;
}

function gotoDaily(doc, win) {
  doc.querySelector('a[data-nav="account"]').click();
  return navTick();
}

function setDate(doc, win, date) {
  const input = doc.querySelector('.date-input');
  input.value = date;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  return tick();
}

function setAmount(doc, win, itemId, value) {
  const input = doc.querySelector(`input[data-item-id="${itemId}"]`);
  input.value = value;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
  return tick();
}

function rowNames(doc) {
  return Array.from(doc.querySelectorAll('.expense-row .name')).map(n => n.textContent);
}

/* ============ E1 新增支出项目 ============ */

test('E1 新增支出项目：创建日及之后日期都出现', async () => {
  const { win, doc, app, store } = buildApp();
  await app.start();
  await gotoDaily(doc, win);
  clickAction(win, doc.querySelector('button[data-action="add-expense"]'));
  await tick();
  doc.querySelector('.prompt-wrap input').value = '午餐';
  doc.querySelectorAll('.modal-foot button')[1].click();
  await tick();
  assert.ok(rowNames(doc).includes('午餐'), '当天出现「午餐」行');
  const item = store.listExpenseItems().find(i => i.name === '午餐');
  assert.strictEqual(item.createdAt, TODAY);
  // 下一天仍出现
  clickAction(win, doc.querySelector('button[data-action="date-next"]'));
  await tick();
  assert.ok(rowNames(doc).includes('午餐'), '次日仍出现「午餐」行');
});

/* ============ E2 创建日前不出现 ============ */

test('E2 创建日前不出现', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  // 交通创建于 9-05，切到 9-04 不应出现
  await setDate(doc, win, '2026-09-04');
  assert.ok(!rowNames(doc).includes('交通'), '创建日前不应出现「交通」');
  // 早餐创建于 9-01，9-04 应出现
  assert.ok(rowNames(doc).includes('早餐'), '创建日及之后应出现「早餐」');
  // 9-05 起交通出现
  await setDate(doc, win, '2026-09-05');
  assert.ok(rowNames(doc).includes('交通'));
});

/* ============ E3 每天独立填金额 ============ */

test('E3 每天金额独立保存互不影响', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  // 9-07 早餐改为 15
  await setDate(doc, win, '2026-09-07');
  await setAmount(doc, win, 'e1', '15');
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-07').amount, 15);
  // 9-09 早餐仍为 8
  await setDate(doc, win, '2026-09-09');
  const input = doc.querySelector('input[data-item-id="e1"]');
  assert.strictEqual(input.value, '8');
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-09').amount, 8);
});

/* ============ E4 留空不计 ============ */

test('E4 清空金额后不计入统计', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-07');
  await setAmount(doc, win, 'e1', '');
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-07'), null, '清空后记录删除');
  const summary = doc.querySelector('.day-summary');
  assert.match(summary.textContent, /支出 ¥0\.00/);
});

/* ============ E5 停止记录 ============ */

test('E5 停止记录：明天起不再出现，历史保留', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  // 今天 9-09 停止「早餐」
  clickAction(win, doc.querySelector('button[data-action="stop-expense"][data-id="e1"]'));
  await tick();
  const btns = doc.querySelectorAll('.modal-foot button');
  btns[btns.length - 1].click(); // 停止
  await tick();
  // 今天仍出现
  assert.ok(rowNames(doc).includes('早餐'));
  // 明天不出现
  clickAction(win, doc.querySelector('button[data-action="date-next"]'));
  await tick();
  assert.ok(!rowNames(doc).includes('早餐'), '明天起不应出现「早餐」');
  assert.ok(rowNames(doc).includes('交通'));
  // 历史日期仍出现
  await setDate(doc, win, '2026-09-07');
  assert.ok(rowNames(doc).includes('早餐'), '历史日期仍应出现');
});

/* ============ E6 删除项目 ============ */

test('E6 删除项目：所有日期记录消失', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  clickAction(win, doc.querySelector('button[data-action="delete-expense"][data-id="e1"]'));
  await tick();
  const btns = doc.querySelectorAll('.modal-foot button');
  btns[btns.length - 1].click(); // 删除
  await tick();
  assert.strictEqual(store.getExpenseItem('e1'), null);
  assert.strictEqual(store.getExpenseRecordsForDate('2026-09-07').length, 0);
  assert.ok(!rowNames(doc).includes('早餐'));
  // 历史日期也消失
  await setDate(doc, win, '2026-09-07');
  assert.ok(!rowNames(doc).includes('早餐'));
});

/* ============ I1/I2/I3 收入 ============ */

test('I1/I2 记一笔收入：仅出现在当天，次日不出现', async () => {
  const { win, doc, app, store } = buildApp();
  await app.start();
  await gotoDaily(doc, win);
  doc.querySelector('#inc-name').value = '工资';
  doc.querySelector('#inc-amount').value = '8000';
  doc.querySelector('button[data-action="add-income"]').click();
  await tick();
  const incomeRows = Array.from(doc.querySelectorAll('.income-row .name')).map(n => n.textContent);
  assert.ok(incomeRows.includes('工资'), '当天显示收入');
  assert.strictEqual(store.getIncomesForDate(TODAY).length, 1);
  // 次日不出现
  clickAction(win, doc.querySelector('button[data-action="date-next"]'));
  await tick();
  const rows2 = Array.from(doc.querySelectorAll('.income-row .name')).map(n => n.textContent);
  assert.ok(!rows2.includes('工资'), '次日收入区域应为空');
});

test('I3 再次收入：两笔独立存在', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-05');
  assert.ok(Array.from(doc.querySelectorAll('.income-row .name')).some(n => n.textContent === '工资'));
  await setDate(doc, win, '2026-09-12');
  assert.ok(Array.from(doc.querySelectorAll('.income-row .name')).some(n => n.textContent === '兼职'));
  // 两笔都存在于 store
  assert.strictEqual(store.getIncomesForDate('2026-09-05').length, 1);
  assert.strictEqual(store.getIncomesForDate('2026-09-12').length, 1);
});

test('收入编辑与删除（界面层）', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-05');
  // 编辑
  clickAction(win, doc.querySelector('button[data-action="edit-income"]'));
  await tick();
  const inputs = doc.querySelectorAll('.prompt-wrap input');
  inputs[1].value = '9000';
  doc.querySelectorAll('.modal-foot button')[1].click();
  await tick();
  assert.strictEqual(store.getIncome('i1').amount, 9000);
  // 删除
  clickAction(win, doc.querySelector('button[data-action="delete-income"]'));
  await tick();
  doc.querySelectorAll('.modal-foot button')[1].click();
  await tick();
  assert.strictEqual(store.getIncome('i1'), null);
});

/* ============ G3 输入校验 ============ */

test('G3 金额输入校验：负数/字母拒绝并提示', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-07');
  const before = store.getExpenseRecord('e1', '2026-09-07').amount; // 12
  await setAmount(doc, win, 'e1', '-5');
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-07').amount, before, '非法输入不应保存');
  assert.ok(doc.querySelector('.toast'), '应提示错误');
  assert.match(doc.querySelector('.toast').textContent, /金额格式不正确/);
  // 输入框回显原值
  assert.strictEqual(doc.querySelector('input[data-item-id="e1"]').value, String(before));
});

/* ============ 日期导航 ============ */

test('日期导航：前一天/后一天/回到今天/日期选择器', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  clickAction(win, doc.querySelector('button[data-action="date-prev"]'));
  await tick();
  assert.strictEqual(doc.querySelector('.date-input').value, '2026-09-08');
  clickAction(win, doc.querySelector('button[data-action="date-next"]'));
  await tick();
  assert.strictEqual(doc.querySelector('.date-input').value, '2026-09-09');
  clickAction(win, doc.querySelector('button[data-action="date-today"]'));
  await tick();
  assert.strictEqual(doc.querySelector('.date-input').value, TODAY);
  // 日期选择器
  await setDate(doc, win, '2026-08-15');
  assert.strictEqual(doc.querySelector('.date-input').value, '2026-08-15');
  assert.ok(rowNames(doc).length === 0, '8-15 无任何支出项目（早于创建日）');
});

/* ============ S1/S3 统计 ============ */

function gotoStats(doc, win) {
  win.location.hash = '#/account/stats';
  win.dispatchEvent(new win.Event('hashchange'));
  return navTick();
}

test('S1 统计：本月起止日期、支出/收入/结余', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoStats(doc, win);
  assert.match(doc.querySelector('.period-range').textContent, /2026年9月1日 ~ 2026年9月30日/);
  const html = doc.querySelector('.account-stats-view').innerHTML;
  assert.match(html, /总支出 <b class="expense">¥33\.00<\/b>/);
  assert.match(html, /总收入 <b class="income">¥8500\.00<\/b>/);
  assert.match(html, /结余 <b class="balance">¥8467\.00<\/b>/);
});

test('S2/S4 支出明细：分项合计 = 总支出，结余 = 收入 - 支出', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoStats(doc, win);
  // 限定「支出明细」卡片内的分项行
  const cards = Array.from(doc.querySelectorAll('.card'));
  const expenseCard = cards.find(c => c.querySelector('.card-title').textContent.includes('支出明细'));
  const rows = Array.from(expenseCard.querySelectorAll('.breakdown-row'));
  assert.strictEqual(rows.length, 2, '早餐+交通 两个分项');
  const total = rows.reduce((s, r) => s + Number(r.querySelector('.b-amount').textContent.replace(/¥/, '')), 0);
  assert.strictEqual(total, 33);
  const names = {};
  rows.forEach(r => { names[r.querySelector('.b-name').textContent] = r.querySelector('.b-amount').textContent; });
  assert.strictEqual(names['早餐'], '¥20.00');
  assert.strictEqual(names['交通'], '¥13.00');
  const pcts = rows.reduce((s, r) => s + parseFloat(r.querySelector('.b-pct').textContent), 0);
  assert.ok(Math.abs(pcts - 100) < 0.1, '占比合计约 100%');
});

test('S3 周期切换：本周/本月/本季/本年 各自正确', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoStats(doc, win);
  // 本月（默认）
  assert.ok(doc.querySelector('button[data-action="period-month"]').classList.contains('active'));
  // 本周：09-07 ~ 09-13；支出 12+8+13=33，收入 500
  clickAction(win, doc.querySelector('button[data-action="period-week"]'));
  await tick();
  assert.match(doc.querySelector('.period-range').textContent, /2026年9月7日 ~ 2026年9月13日/);
  const weekHtml = doc.querySelector('.account-stats-view').innerHTML;
  assert.match(weekHtml, /总支出 <b class="expense">¥33\.00<\/b>/);
  assert.match(weekHtml, /总收入 <b class="income">¥500\.00<\/b>/);
  assert.ok(doc.querySelector('button[data-action="period-week"]').classList.contains('active'));
  // 本季 / 本年（数据都在 9 月，与本月一致）
  clickAction(win, doc.querySelector('button[data-action="period-quarter"]'));
  await tick();
  assert.match(doc.querySelector('.period-range').textContent, /2026年7月1日 ~ 2026年9月30日/);
  clickAction(win, doc.querySelector('button[data-action="period-year"]'));
  await tick();
  assert.match(doc.querySelector('.period-range').textContent, /2026年1月1日 ~ 2026年12月31日/);
  assert.match(doc.querySelector('.account-stats-view').innerHTML, /总收入 <b class="income">¥8500\.00<\/b>/);
});

test('G4 统计空状态', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  await gotoStats(doc, win);
  assert.match(doc.querySelector('.account-stats-view').textContent, /本周期暂无支出记录/);
  assert.match(doc.querySelector('.account-stats-view').textContent, /本周期暂无收入记录/);
});

/* ============ 首页记账概览（H3 联动） ============ */

test('H3 首页记账概览与记账模块数据一致', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  // 今天(9-09)支出：早餐 8；收入无
  const homeHtml = doc.querySelector('.home-view').innerHTML;
  assert.match(homeHtml, /支出 <b class="expense">¥8\.00<\/b>/);
  assert.match(homeHtml, /收入 <b class="income">¥0\.00<\/b>/);
  // 去记账跳转且日期为今天
  const link = Array.from(doc.querySelectorAll('.card-link a')).find(a => a.textContent.includes('去记账'));
  link.click();
  await navTick();
  assert.ok(doc.querySelector('.account-daily-view'));
  assert.strictEqual(doc.querySelector('.date-input').value, TODAY);
});

/* ============ 回归：点击输入控件不应触发保存与重渲染 ============ */

test('回归：点击金额输入框不应重渲染（可正常聚焦编辑）', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-07');
  const input = doc.querySelector('input[data-item-id="e1"]');
  input.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  assert.strictEqual(doc.querySelector('input[data-item-id="e1"]'), input, '点击输入框不应重渲染替换节点');
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-07').amount, 12, '点击不应触发保存变更');
});

test('回归：点击日期选择器不应重渲染（原生选择器可正常打开）', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  const input = doc.querySelector('.date-input');
  input.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  assert.strictEqual(doc.querySelector('.date-input'), input, '点击日期不应重渲染替换节点');
  assert.strictEqual(doc.querySelector('.date-input').value, '2026-09-09');
});

test('回归：金额输入框点击后仍可正常输入并保存', async () => {
  const { win, doc, app, store } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  await setDate(doc, win, '2026-09-07');
  const input = doc.querySelector('input[data-item-id="e1"]');
  input.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick();
  // 聚焦后输入新金额并触发 change → 应正常保存
  const input2 = doc.querySelector('input[data-item-id="e1"]');
  input2.value = '15';
  input2.dispatchEvent(new win.Event('change', { bubbles: true }));
  await tick();
  assert.strictEqual(store.getExpenseRecord('e1', '2026-09-07').amount, 15, '输入后保存应生效');
});

/* ============ PRD 2.3：日记账 ⇢ Tab 切换 ⇢ 统计 ============ */

test('2.3 Tab 切换：日记账页提供「统计」Tab，点击切到统计页', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  const tabs = doc.querySelector('.account-tabs');
  assert.ok(tabs, '日记账页应提供 account-tabs');
  assert.ok(tabs.querySelector('a[href="#/account/daily"]').classList.contains('active'), '日记账 Tab 应高亮');
  const statsTab = tabs.querySelector('a[href="#/account/stats"]');
  assert.ok(statsTab, '日记账页应提供「统计」Tab');
  statsTab.click();
  await navTick();
  assert.ok(doc.querySelector('.account-stats-view'), '应切换到统计页');
  assert.ok(doc.querySelector('.account-tabs a[href="#/account/stats"]').classList.contains('active'), '统计 Tab 应高亮');
});

test('2.3 Tab 切换：统计页提供「日记账」Tab，点击切回且日期保留', async () => {
  const { win, doc, app } = buildApp(seedAccounting());
  await app.start();
  await gotoDaily(doc, win);
  // 先切到 9-07，再进统计，再切回 → 日期应保留为 9-07
  await setDate(doc, win, '2026-09-07');
  doc.querySelector('.account-tabs a[href="#/account/stats"]').click();
  await navTick();
  const dailyTab = doc.querySelector('.account-tabs a[href="#/account/daily"]');
  assert.ok(dailyTab, '统计页应提供「日记账」Tab');
  dailyTab.click();
  await navTick();
  assert.ok(doc.querySelector('.account-daily-view'), '应切回日记账页');
  assert.strictEqual(doc.querySelector('.date-input').value, '2026-09-07', '切换视图不应重置所选日期');
});
