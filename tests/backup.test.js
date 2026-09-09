const { test } = require('node:test');
const assert = require('node:assert');
const Backup = require('../js/backup.js');
const Store = require('../js/store.js');
const Storage = require('../js/storage.js');

function sampleData() {
  const d = Storage.createDefaultData();
  d.plans = [{ id: 'p1', name: '早起', createdAt: '2026-09-01' }];
  d.checkRecords = [{ planId: 'p1', date: '2026-09-09', completed: true }];
  d.expenseItems = [{ id: 'e1', name: '早餐', createdAt: '2026-09-05', stoppedAt: null }];
  d.expenseRecords = [{ itemId: 'e1', date: '2026-09-05', amount: 12 }];
  d.incomeRecords = [{ id: 'i1', name: '工资', date: '2026-09-05', amount: 8000 }];
  return d;
}

test('B1 导出备份：JSON 包含全部数据集合与 meta', () => {
  const data = sampleData();
  const text = Backup.serialize(data);
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.plans[0].name, '早起');
  assert.strictEqual(parsed.checkRecords[0].completed, true);
  assert.strictEqual(parsed.expenseItems[0].name, '早餐');
  assert.strictEqual(parsed.expenseRecords[0].amount, 12);
  assert.strictEqual(parsed.incomeRecords[0].amount, 8000);
  assert.strictEqual(parsed.meta.version, '1.0');
});

test('备份文件名：生活助手备份_YYYYMMDD_HHmmss.json', () => {
  const now = new Date(2026, 8, 9, 14, 30, 0); // 2026-09-09 14:30:00
  assert.strictEqual(Backup.defaultFileName(now), '生活助手备份_20260909_143000.json');
  const now2 = new Date(2026, 0, 1, 9, 5, 7);
  assert.strictEqual(Backup.defaultFileName(now2), '生活助手备份_20260101_090507.json');
});

test('B2 导入恢复：导出 → 解析 → 恢复，数据完整', async () => {
  const data = sampleData();
  const text = Backup.serialize(data);
  const parsed = Backup.parseBackup(text);
  assert.strictEqual(parsed.ok, true);
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => '2026-09-09' });
  await s.init();
  await s.importData(parsed.data);
  assert.strictEqual(s.listPlans()[0].name, '早起');
  assert.strictEqual(s.todayStatus('p1'), true);
  assert.strictEqual(s.dailySummary('2026-09-05').totalExpense, 12);
  assert.strictEqual(s.dailySummary('2026-09-05').totalIncome, 8000);
  // 持久化到底层存储
  const s2 = new Store(ad, { todayFn: () => '2026-09-09' });
  await s2.init();
  assert.strictEqual(s2.listPlans().length, 1);
});

test('B4 格式校验：非 JSON / 结构错误一律拒绝且不修改现有数据', async () => {
  // 非 JSON
  const r1 = Backup.parseBackup('这不是 JSON{{{');
  assert.strictEqual(r1.ok, false);
  assert.ok(r1.reason.length > 0);
  // JSON 数组
  const r2 = Backup.parseBackup('[1,2,3]');
  assert.strictEqual(r2.ok, false);
  // 空对象：缺必要字段
  const r3 = Backup.parseBackup('{}');
  assert.strictEqual(r3.ok, false);
  // 缺一个集合字段
  const r4 = Backup.parseBackup(JSON.stringify({ plans: [], expenseItems: [], expenseRecords: [], incomeRecords: [], meta: { version: '1.0' } }));
  assert.strictEqual(r4.ok, false);
  assert.match(r4.reason, /checkRecords/);
  // 缺 meta
  const r5 = Backup.parseBackup(JSON.stringify({ plans: [], checkRecords: [], expenseItems: [], expenseRecords: [], incomeRecords: [] }));
  assert.strictEqual(r5.ok, false);
  assert.match(r5.reason, /meta/);
  // null
  const r6 = Backup.parseBackup('null');
  assert.strictEqual(r6.ok, false);

  // 拒绝导入时不修改现有数据
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => '2026-09-09' });
  await s.init();
  s.createPlan('现有计划');
  const before = JSON.stringify(s.exportData());
  if (r1.ok) await s.importData(r1.data);
  assert.strictEqual(JSON.stringify(s.exportData()), before, '失败导入不得修改数据');
});

test('导入会规范化：金额字段修正为数字', () => {
  const text = JSON.stringify({
    plans: [], checkRecords: [], expenseItems: [], expenseRecords: [], incomeRecords: [],
    meta: { version: '1.0', lastModified: '2026-09-09T00:00:00.000Z' }
  });
  const r = Backup.parseBackup(text);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.data.plans, []);
  assert.strictEqual(r.data.meta.version, '1.0');
});
