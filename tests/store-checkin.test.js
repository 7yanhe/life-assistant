const { test } = require('node:test');
const assert = require('node:assert');
const Store = require('../js/store.js');
const Storage = require('../js/storage.js');

const TODAY = '2026-09-09';

async function makeStore(seed) {
  const ad = Storage.memoryAdapter(seed || null);
  const store = new Store(ad, { todayFn: () => TODAY });
  await store.init();
  return store;
}

/** 预置一个创建于 9 月 1 日的计划（使 9-06/9-08 等过去日期可补打卡） */
function seedOldPlan() {
  return {
    plans: [{ id: 'plan_old', name: '早起', createdAt: '2026-09-01' }],
    checkRecords: [],
    expenseItems: [], expenseRecords: [], incomeRecords: [],
    meta: { version: '1.0', lastModified: '2026-09-01T00:00:00.000Z' }
  };
}

test('C1 新建计划：列表出现且 createdAt 为创建日', async () => {
  const s = await makeStore();
  const r = s.createPlan('早起');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.plan.name, '早起');
  assert.strictEqual(r.plan.createdAt, TODAY);
  assert.strictEqual(s.listPlans().length, 1);
});

test('新建计划：名称校验（空/超长/去空格）', async () => {
  const s = await makeStore();
  assert.strictEqual(s.createPlan('   ').ok, false);
  assert.strictEqual(s.createPlan('').ok, false);
  assert.strictEqual(s.createPlan(null).ok, false);
  const long = 'a'.repeat(31);
  assert.strictEqual(s.createPlan(long).ok, false);
  const ok = s.createPlan('  阅读  ');
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.plan.name, '阅读');
});

test('编辑计划名称', async () => {
  const s = await makeStore();
  const { plan } = s.createPlan('早起');
  assert.strictEqual(s.renamePlan(plan.id, '早睡早起').ok, true);
  assert.strictEqual(s.getPlan(plan.id).name, '早睡早起');
  assert.strictEqual(s.renamePlan(plan.id, '  ').ok, false);
  assert.strictEqual(s.renamePlan('no-such', 'x').ok, false);
});

test('C2 今日打卡：勾选/取消即时保存，刷新后仍保留', async () => {
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => TODAY });
  await s.init();
  const { plan } = s.createPlan('早起');
  // 勾选
  const r = s.setCheck(plan.id, TODAY, true);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.todayStatus(plan.id), true);
  // 用同一底层存储新建 store（模拟刷新），数据保留
  const s2 = new Store(ad, { todayFn: () => TODAY });
  await s2.init();
  assert.strictEqual(s2.todayStatus(plan.id), true);
  // 取消
  assert.strictEqual(s2.toggleCheck(plan.id, TODAY).changed, true);
  assert.strictEqual(s2.todayStatus(plan.id), false);
  // 重复切换同状态不重复写
  assert.strictEqual(s2.setCheck(plan.id, TODAY, false).changed, false);
});

test('C3 补打卡：修改过去任意一天（创建日及之后）', async () => {
  const s = await makeStore(seedOldPlan());
  const plan = s.getPlan('plan_old');
  const threeDaysAgo = '2026-09-06';
  assert.strictEqual(s.setCheck(plan.id, threeDaysAgo, true).ok, true);
  const rec = s.getCheckRecord(plan.id, threeDaysAgo);
  assert.strictEqual(rec.completed, true);
  // 再次补打卡取消
  assert.strictEqual(s.setCheck(plan.id, threeDaysAgo, false).ok, true);
  assert.strictEqual(s.getCheckRecord(plan.id, threeDaysAgo).completed, false);
});

test('C4 不可打未来卡：明天/未来日期拒绝且不产生记录', async () => {
  const s = await makeStore();
  const { plan } = s.createPlan('早起');
  const tomorrow = '2026-09-10';
  const r = s.setCheck(plan.id, tomorrow, true);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'future');
  assert.strictEqual(s.getCheckRecord(plan.id, tomorrow), null);
  assert.strictEqual(s.getPlanRecords(plan.id).length, 0);
});

test('C5 创建日前不可操作：灰色不可点', async () => {
  const s = await makeStore();
  const { plan } = s.createPlan('阅读');
  const yesterday = '2026-09-08';
  const r = s.setCheck(plan.id, yesterday, true);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'beforeCreated');
  assert.strictEqual(s.getCheckRecord(plan.id, yesterday), null);
});

test('C6 删除计划：计划及全部记录消失', async () => {
  const s = await makeStore(seedOldPlan());
  const plan = s.getPlan('plan_old');
  s.setCheck(plan.id, TODAY, true);
  s.setCheck(plan.id, '2026-09-08', true);
  assert.strictEqual(s.getPlanRecords(plan.id).length, 2);
  assert.strictEqual(s.deletePlan(plan.id).ok, true);
  assert.strictEqual(s.getPlan(plan.id), null);
  assert.strictEqual(s.listPlans().length, 0);
  assert.strictEqual(s.getPlanRecords(plan.id).length, 0);
  assert.strictEqual(s.deletePlan('no-such').ok, false);
});

test('坚持天数：累计完成天数与连续天数', async () => {
  const s = await makeStore(seedOldPlan());
  const plan = s.getPlan('plan_old');
  // 今天完成 + 昨天完成 + 前天未完成 → 累计2 连续2
  s.setCheck(plan.id, TODAY, true);
  s.setCheck(plan.id, '2026-09-08', true);
  assert.strictEqual(s.totalCompleted(plan.id), 2);
  assert.strictEqual(s.currentStreak(plan.id), 2);
  // 今天未完成、昨天完成 → 连续1
  s.setCheck(plan.id, TODAY, false);
  assert.strictEqual(s.currentStreak(plan.id), 1);
  // 昨天也取消 → 连续0
  s.setCheck(plan.id, '2026-09-08', false);
  assert.strictEqual(s.currentStreak(plan.id), 0);
  // 连续三天完成 → 连续3
  s.setCheck(plan.id, '2026-09-07', true);
  s.setCheck(plan.id, '2026-09-08', true);
  s.setCheck(plan.id, TODAY, true);
  assert.strictEqual(s.currentStreak(plan.id), 3);
});

test('listPlansWithStatus：包含今日状态与坚持天数', async () => {
  const s = await makeStore(seedOldPlan());
  const plan = s.getPlan('plan_old');
  s.setCheck(plan.id, TODAY, true);
  s.setCheck(plan.id, '2026-09-08', true);
  const list = s.listPlansWithStatus();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].completedToday, true);
  assert.strictEqual(list[0].totalCompleted, 2);
  assert.strictEqual(list[0].streak, 2);
});

test('数据持久化：plan 与 checkRecords 完整写入存储', async () => {
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => TODAY });
  await s.init();
  const { plan } = s.createPlan('早起');
  s.setCheck(plan.id, TODAY, true);
  const raw = ad._peek();
  assert.strictEqual(raw.plans[0].name, '早起');
  assert.strictEqual(raw.checkRecords[0].completed, true);
  assert.strictEqual(raw.meta.lastModified.length > 0, true);
});

test('导入数据（恢复）覆盖当前并持久化', async () => {
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => TODAY });
  await s.init();
  s.createPlan('旧计划');
  const backup = {
    plans: [{ id: 'p_new', name: '新计划', createdAt: TODAY }],
    checkRecords: [{ planId: 'p_new', date: TODAY, completed: true }],
    expenseItems: [], expenseRecords: [], incomeRecords: [],
    meta: { version: '1.0', lastModified: '2026-09-09T00:00:00.000Z' }
  };
  await s.importData(backup);
  assert.strictEqual(s.listPlans().length, 1);
  assert.strictEqual(s.listPlans()[0].name, '新计划');
  assert.strictEqual(s.todayStatus('p_new'), true);
  // 深拷贝：外部修改不影响 store
  backup.plans[0].name = '外部改了';
  assert.strictEqual(s.getPlan('p_new').name, '新计划');
});
