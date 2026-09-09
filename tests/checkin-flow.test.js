const { test } = require('node:test');
const assert = require('node:assert');
const { buildApp, tick, navTick, clickAction, seedPlanOld, seedPlanMid, TODAY } = require('./_apphelper.js');

/* ============ C1 新建计划 ============ */

test('C1 新建计划：列表出现且首页同步显示', async () => {
  const { win, doc, app, store } = buildApp();
  await app.start();
  // 进入打卡页
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="create-plan"]'));
  await tick();
  const input = doc.querySelector('.prompt-wrap input');
  assert.ok(input, '应弹出名称输入框');
  input.value = '早起';
  doc.querySelectorAll('.modal-foot button')[1].click(); // 确定
  await tick();
  assert.ok(doc.querySelector('.plan-row'), '列表应出现计划行');
  assert.match(doc.querySelector('.plan-name').textContent, /早起/);
  assert.ok(store.getPlan(store.listPlans()[0].id), 'store 已保存');
  // 首页同步
  doc.querySelector('a[data-nav="home"]').click();
  await navTick();
  assert.match(doc.querySelector('.home-view').textContent, /早起/);
});

test('C1 新建计划：名称为空不创建', async () => {
  const { win, doc, app, store } = buildApp();
  await app.start();
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="create-plan"]'));
  await tick();
  doc.querySelector('.prompt-wrap input').value = '   ';
  doc.querySelectorAll('.modal-foot button')[1].click();
  await tick();
  assert.strictEqual(store.listPlans().length, 0, '空名称不应创建');
  assert.ok(doc.querySelector('.toast'), '应提示错误');
});

test('编辑计划名称', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="rename-plan"]'));
  await tick();
  const input = doc.querySelector('.prompt-wrap input');
  input.value = '早睡早起';
  doc.querySelectorAll('.modal-foot button')[1].click();
  await tick();
  assert.strictEqual(store.getPlan('plan_old').name, '早睡早起');
  assert.match(doc.querySelector('.plan-name').textContent, /早睡早起/);
});

/* ============ C2 列表页切换今日状态 ============ */

test('C2 列表页勾选今日：状态保存并同步首页', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  const box = doc.querySelector('.plan-list input[data-action="toggle-today"]');
  assert.strictEqual(box.checked, true, '初始应为已勾选（种子数据）');
  clickAction(win, box);
  await tick();
  assert.strictEqual(store.todayStatus('plan_old'), false);
  // 首页同步
  doc.querySelector('a[data-nav="home"]').click();
  await navTick();
  assert.strictEqual(doc.querySelector('input[data-action="toggle-today"]').checked, false);
  assert.match(doc.querySelector('.card-title .count').textContent, /已完成 0 \/ 共 1/);
});

/* ============ C3 补打卡 ============ */

test('C3 详情页补打卡：点击过去日期标记完成', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  // 进入详情
  win.location.hash = '#/checkin/plan_old';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  assert.ok(doc.querySelector('.checkin-detail-view'));
  // 9-06 未完成 → 点击补卡
  const cell = doc.querySelector('td[data-date="2026-09-06"]');
  assert.ok(cell, '9-06 应存在');
  assert.match(cell.className, /miss/);
  clickAction(win, cell);
  await tick();
  assert.strictEqual(store.getCheckRecord('plan_old', '2026-09-06').completed, true);
  // 月历更新为 ✓
  const cell2 = doc.querySelector('td[data-date="2026-09-06"]');
  assert.match(cell2.className, /done/);
  assert.match(cell2.textContent, /✓/);
  // 再点击取消补卡
  clickAction(win, cell2);
  await tick();
  assert.strictEqual(store.getCheckRecord('plan_old', '2026-09-06').completed, false);
});

test('C3 详情页默认展示月份：今天所在月', async () => {
  const { win, doc, app } = buildApp(seedPlanOld());
  await app.start();
  win.location.hash = '#/checkin/plan_old';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  assert.strictEqual(doc.querySelector('.month-label').textContent, '2026年9月');
});

/* ============ C4 未来日期不可打卡 ============ */

test('C4 未来日期：无点击动作，点击无效果', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  win.location.hash = '#/checkin/plan_old';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  const futureCells = doc.querySelectorAll('td.future');
  assert.ok(futureCells.length >= 1, '应有未来日期格');
  for (const cell of futureCells) {
    assert.strictEqual(cell.getAttribute('data-action'), null, '未来日期不应可点击');
  }
  // 数据不变
  assert.strictEqual(store.getCheckRecord('plan_old', '2026-09-10'), null);
});

/* ============ C5 创建日前不可操作 ============ */

test('C5 创建日前：灰色格无点击动作，点击无效果', async () => {
  const { win, doc, app, store } = buildApp(seedPlanMid());
  await app.start();
  win.location.hash = '#/checkin/plan_mid';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  const beforeCells = doc.querySelectorAll('td.beforeCreated');
  assert.ok(beforeCells.length >= 4, '9月1-4日应为创建日前格');
  for (const cell of beforeCells) {
    assert.strictEqual(cell.getAttribute('data-action'), null);
  }
  assert.strictEqual(store.getCheckRecord('plan_mid', '2026-09-02'), null);
});

/* ============ C6 删除计划（界面层） ============ */

test('C6 删除计划：确认后计划与记录消失，首页同步', async () => {
  const { win, doc, app, store } = buildApp(seedPlanOld());
  await app.start();
  doc.querySelector('a[data-nav="checkin"]').click();
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="delete-plan"]'));
  await tick();
  const btns = doc.querySelectorAll('.modal-foot button');
  btns[btns.length - 1].click(); // 删除
  await tick();
  assert.strictEqual(store.getPlan('plan_old'), null);
  assert.strictEqual(store.getPlanRecords('plan_old').length, 0);
  assert.match(doc.querySelector('.checkin-list-view').textContent, /还没有打卡计划/);
  // 首页同步
  doc.querySelector('a[data-nav="home"]').click();
  await navTick();
  assert.match(doc.querySelector('.home-view').textContent, /还没有打卡计划/);
});

/* ============ 月历月份切换 ============ */

test('月历月份切换：上个月/下个月', async () => {
  const { win, doc, app } = buildApp(seedPlanOld());
  await app.start();
  win.location.hash = '#/checkin/plan_old';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  clickAction(win, doc.querySelector('button[data-action="month-prev"]'));
  await tick();
  assert.strictEqual(doc.querySelector('.month-label').textContent, '2026年8月');
  clickAction(win, doc.querySelector('button[data-action="month-next"]'));
  await tick();
  assert.strictEqual(doc.querySelector('.month-label').textContent, '2026年9月');
});

test('详情页：计划不存在显示空状态', async () => {
  const { win, doc, app } = buildApp();
  await app.start();
  win.location.hash = '#/checkin/no-such-id';
  win.dispatchEvent(new win.Event('hashchange'));
  await navTick();
  assert.match(doc.querySelector('.checkin-detail-view').textContent, /计划不存在/);
});
