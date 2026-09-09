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

test('E1 新增支出项目：创建日及之后每天都出现', async () => {
  const s = await makeStore();
  const r = s.createExpenseItem('早餐', '2026-09-05');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.item.createdAt, '2026-09-05');
  assert.strictEqual(r.item.stoppedAt, null);
  // 创建日当天出现
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-05').length, 1);
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-05')[0].name, '早餐');
  // 之后日期都出现
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-06').length, 1);
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-30').length, 1);
  assert.strictEqual(s.getExpenseItemsForDate('2026-12-31').length, 1);
});

test('E2 创建日前不出现', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-04').length, 0);
  assert.strictEqual(s.getExpenseItemsForDate('2026-01-01').length, 0);
});

test('E3 每天独立填金额：互不影响', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  assert.strictEqual(s.setExpenseAmount('早餐不存在', '2026-09-05', 12).ok, false);
  // 通过 id 操作
  const item = s.listExpenseItems()[0];
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', 12).ok, true);
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-06', 15).ok, true);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-05').amount, 12);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-06').amount, 15);
  // 修改其中一天不影响另一天
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', 13).ok, true);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-05').amount, 13);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-06').amount, 15);
  // 可填 0
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-07', 0).ok, true);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-07').amount, 0);
});

test('E4 留空不计：清空金额后不参与统计', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  s.setExpenseAmount(item.id, '2026-09-05', 12);
  // 清空 9-06
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-06', '').ok, true);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-06'), null);
  const sum = s.dailySummary('2026-09-06');
  assert.strictEqual(sum.totalExpense, 0);
  // 9-05 仍有 12
  assert.strictEqual(s.dailySummary('2026-09-05').totalExpense, 12);
});

test('E5 停止支出项目：从停止日次日起不再出现', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  assert.strictEqual(s.stopExpenseItem(item.id, '2026-09-09').ok, true);
  // 停止日当天仍出现
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-09').length, 1);
  // 明天起不再出现
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-10').length, 0);
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-30').length, 0);
  // 历史日期仍出现（记录保留）
  assert.strictEqual(s.getExpenseItemsForDate('2026-09-06').length, 1);
  // 不能重复停止到更早日期
  assert.strictEqual(s.stopExpenseItem(item.id, '2026-09-08').ok, false);
  // 停止日期早于创建日 → 拒绝
  const s2 = await makeStore();
  s2.createExpenseItem('午餐', '2026-09-05');
  assert.strictEqual(s2.stopExpenseItem(s2.listExpenseItems()[0].id, '2026-09-04').ok, false);
});

test('E6 删除支出项目：所有日期记录全部消失', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  s.setExpenseAmount(item.id, '2026-09-05', 12);
  s.setExpenseAmount(item.id, '2026-09-06', 15);
  assert.strictEqual(s.getExpenseRecordsForDate('2026-09-05').length, 1);
  assert.strictEqual(s.deleteExpenseItem(item.id).ok, true);
  assert.strictEqual(s.getExpenseItem(item.id), null);
  assert.strictEqual(s.listExpenseItems().length, 0);
  assert.strictEqual(s.getExpenseRecordsForDate('2026-09-05').length, 0);
  assert.strictEqual(s.getExpenseRecordsForDate('2026-09-06').length, 0);
});

test('G3 金额输入校验：负数、字母、多位小数拒绝', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', '-5').ok, false);
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', 'abc').ok, false);
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', '12.345').ok, false);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-05'), null);
  // 非法输入不写入
  assert.strictEqual(s.setExpenseAmount(item.id, '2026-09-05', 12.5).ok, true);
  assert.strictEqual(s.getExpenseRecord(item.id, '2026-09-05').amount, 12.5);
});

test('支出项目：名称编辑与创建日校验', async () => {
  const s = await makeStore();
  assert.strictEqual(s.createExpenseItem('  ', '2026-09-05').ok, false);
  assert.strictEqual(s.createExpenseItem('早餐', 'bad-date').ok, false);
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  assert.strictEqual(s.renameExpenseItem(item.id, '早餐+豆浆').ok, true);
  assert.strictEqual(s.getExpenseItem(item.id).name, '早餐+豆浆');
});

test('I1 记一笔收入：仅出现在录入当天', async () => {
  const s = await makeStore();
  const r = s.addIncome('工资', 8000, '2026-09-05');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.record.name, '工资');
  assert.strictEqual(r.record.amount, 8000);
  assert.strictEqual(s.getIncomesForDate('2026-09-05').length, 1);
  assert.strictEqual(s.getIncomesForDate('2026-09-05')[0].name, '工资');
});

test('I2 收入不重复出现：切换到其他日期收入区域为空', async () => {
  const s = await makeStore();
  s.addIncome('工资', 8000, '2026-09-05');
  assert.strictEqual(s.getIncomesForDate('2026-09-06').length, 0);
  assert.strictEqual(s.getIncomesForDate('2026-09-04').length, 0);
});

test('I3 再次收入：两笔独立存在，统计合并', async () => {
  const s = await makeStore();
  s.addIncome('工资', 8000, '2026-09-05');
  s.addIncome('工资', 8000, '2026-09-20');
  assert.strictEqual(s.getIncomesForDate('2026-09-05').length, 1);
  assert.strictEqual(s.getIncomesForDate('2026-09-20').length, 1);
  assert.strictEqual(s.listIncomes().length, 2);
  const d5 = s.dailySummary('2026-09-05');
  const d20 = s.dailySummary('2026-09-20');
  assert.strictEqual(d5.totalIncome, 8000);
  assert.strictEqual(d20.totalIncome, 8000);
});

test('收入：编辑与删除', async () => {
  const s = await makeStore();
  const { record } = s.addIncome('工资', 8000, '2026-09-05');
  assert.strictEqual(s.updateIncome(record.id, { amount: 9000 }).ok, true);
  assert.strictEqual(s.getIncome(record.id).amount, 9000);
  assert.strictEqual(s.updateIncome(record.id, { name: '奖金' }).ok, true);
  assert.strictEqual(s.getIncome(record.id).name, '奖金');
  assert.strictEqual(s.updateIncome(record.id, { amount: -1 }).ok, false);
  assert.strictEqual(s.updateIncome(record.id, { name: '  ' }).ok, false);
  assert.strictEqual(s.deleteIncome(record.id).ok, true);
  assert.strictEqual(s.getIncome(record.id), null);
  assert.strictEqual(s.deleteIncome(record.id).ok, false);
});

test('当日小结：支出合计、收入合计、结余', async () => {
  const s = await makeStore();
  s.createExpenseItem('早餐', '2026-09-05');
  s.createExpenseItem('交通', '2026-09-05');
  const items = s.listExpenseItems();
  s.setExpenseAmount(items[0].id, '2026-09-05', 12);
  s.setExpenseAmount(items[1].id, '2026-09-05', 13);
  // 一个项目留空
  s.createExpenseItem('零食', '2026-09-05');
  s.addIncome('工资', 8000, '2026-09-05');
  const sum = s.dailySummary('2026-09-05');
  assert.strictEqual(sum.expenseRows.length, 3); // 早餐/交通/零食 都出现
  assert.strictEqual(sum.totalExpense, 25);
  assert.strictEqual(sum.totalIncome, 8000);
  assert.strictEqual(sum.balance, 8000 - 25);
  // 零食 amount 为 null
  const snack = sum.expenseRows.find(r => r.item.name === '零食');
  assert.strictEqual(snack.amount, null);
});

test('dailySummary：无任何数据时为空值', async () => {
  const s = await makeStore();
  const sum = s.dailySummary('2026-09-09');
  assert.strictEqual(sum.expenseRows.length, 0);
  assert.strictEqual(sum.incomes.length, 0);
  assert.strictEqual(sum.totalExpense, 0);
  assert.strictEqual(sum.totalIncome, 0);
  assert.strictEqual(sum.balance, 0);
});

test('记账持久化：金额与收入即时写入存储', async () => {
  const ad = Storage.memoryAdapter();
  const s = new Store(ad, { todayFn: () => TODAY });
  await s.init();
  s.createExpenseItem('早餐', '2026-09-05');
  const item = s.listExpenseItems()[0];
  s.setExpenseAmount(item.id, '2026-09-05', 12);
  s.addIncome('工资', 8000, '2026-09-05');
  const raw = ad._peek();
  assert.strictEqual(raw.expenseRecords[0].amount, 12);
  assert.strictEqual(raw.incomeRecords[0].amount, 8000);
  // 模拟刷新：新实例读取
  const s2 = new Store(ad, { todayFn: () => TODAY });
  await s2.init();
  assert.strictEqual(s2.dailySummary('2026-09-05').totalExpense, 12);
  assert.strictEqual(s2.dailySummary('2026-09-05').totalIncome, 8000);
});
