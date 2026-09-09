const { test } = require('node:test');
const assert = require('node:assert');
const Stats = require('../js/stats.js');
const Storage = require('../js/storage.js');

const REF = '2026-09-09'; // 周三

/**
 * 构造跨日期测试数据：
 * 支出：早餐(09-01 10, 09-07 12, 09-09 8, 09-30 7, 10-01 9)
 *      交通(09-05 5, 09-10 13, 09-20 20)
 * 收入：工资(09-05 8000, 09-20 8000)、兼职(09-12 500)、季度外(10-02 100)
 */
function buildData() {
  const data = Storage.createDefaultData();
  data.expenseItems = [
    { id: 'it_breakfast', name: '早餐', createdAt: '2026-09-01', stoppedAt: null },
    { id: 'it_traffic', name: '交通', createdAt: '2026-09-05', stoppedAt: null }
  ];
  data.expenseRecords = [
    { itemId: 'it_breakfast', date: '2026-09-01', amount: 10 },
    { itemId: 'it_breakfast', date: '2026-09-07', amount: 12 },
    { itemId: 'it_breakfast', date: '2026-09-09', amount: 8 },
    { itemId: 'it_breakfast', date: '2026-09-30', amount: 7 },
    { itemId: 'it_breakfast', date: '2026-10-01', amount: 9 },
    { itemId: 'it_traffic', date: '2026-09-05', amount: 5 },
    { itemId: 'it_traffic', date: '2026-09-10', amount: 13 },
    { itemId: 'it_traffic', date: '2026-09-20', amount: 20 }
  ];
  data.incomeRecords = [
    { id: 'in1', name: '工资', date: '2026-09-05', amount: 8000 },
    { id: 'in2', name: '工资', date: '2026-09-20', amount: 8000 },
    { id: 'in3', name: '兼职', date: '2026-09-12', amount: 500 },
    { id: 'in4', name: '工资', date: '2026-10-02', amount: 100 }
  ];
  return data;
}

test('S1 本月统计：周期起止、支出/收入/结余', () => {
  const r = Stats.compute(buildData(), 'month', REF);
  assert.deepStrictEqual(r.range, { start: '2026-09-01', end: '2026-09-30' });
  // 9月全部支出：10+12+8+7+5+13+20 = 75（10-01 的 9 不计）
  assert.strictEqual(r.totalExpense, 75);
  // 收入：8000+8000+500 = 16500（10-02 的 100 不计）
  assert.strictEqual(r.totalIncome, 16500);
  assert.strictEqual(r.balance, 16500 - 75);
});

test('S2 支出明细：各项目金额之和 = 总支出，占比合计 100%', () => {
  const r = Stats.compute(buildData(), 'month', REF);
  const sum = r.expenseBreakdown.reduce((a, b) => a + b.total, 0);
  assert.strictEqual(r.totalExpense, 75);
  assert.strictEqual(sum, 75);
  const bf = r.expenseBreakdown.find(x => x.name === '早餐');
  const tf = r.expenseBreakdown.find(x => x.name === '交通');
  assert.strictEqual(bf.total, 37); // 10+12+8+7
  assert.strictEqual(tf.total, 38); // 5+13+20
  assert.strictEqual(bf.percent, Stats.round2(37 / 75 * 100));
  assert.strictEqual(tf.percent, Stats.round2(38 / 75 * 100));
  const pctSum = r.expenseBreakdown.reduce((a, b) => a + b.percent, 0);
  assert.ok(Math.abs(pctSum - 100) < 0.01, '占比合计应约等于 100%');
});

test('收入明细：按名称汇总金额', () => {
  const r = Stats.compute(buildData(), 'month', REF);
  const gz = r.incomeBreakdown.find(x => x.name === '工资');
  const jz = r.incomeBreakdown.find(x => x.name === '兼职');
  assert.strictEqual(gz.total, 16000);
  assert.strictEqual(jz.total, 500);
});

test('S3 周期切换：本周/本月/本季/本年各自正确、互不干扰', () => {
  const data = buildData();
  // 本周：09-07 ~ 09-13（周三 09-09 所在周）
  const week = Stats.compute(data, 'week', REF);
  assert.deepStrictEqual(week.range, { start: '2026-09-07', end: '2026-09-13' });
  assert.strictEqual(week.totalExpense, 12 + 8 + 13); // 早餐12+8、交通13
  assert.strictEqual(week.totalIncome, 500); // 仅兼职
  assert.strictEqual(week.balance, 500 - 33);

  // 本季：07-01 ~ 09-30 → 与本月相同（数据都在 9 月）
  const quarter = Stats.compute(data, 'quarter', REF);
  assert.deepStrictEqual(quarter.range, { start: '2026-07-01', end: '2026-09-30' });
  assert.strictEqual(quarter.totalExpense, 75);
  assert.strictEqual(quarter.totalIncome, 16500);

  // 本年：2026-01-01 ~ 2026-12-31 → 包含 10 月数据
  const year = Stats.compute(data, 'year', REF);
  assert.deepStrictEqual(year.range, { start: '2026-01-01', end: '2026-12-31' });
  assert.strictEqual(year.totalExpense, 75 + 9); // 含 10-01 的 9
  assert.strictEqual(year.totalIncome, 16500 + 100); // 含 10-02 的 100

  // 各周期互不干扰：month 不含 10 月数据
  assert.strictEqual(Stats.compute(data, 'month', REF).totalExpense, 75);
  // 不同参考日期的周不同
  const weekNext = Stats.compute(data, 'week', '2026-09-14');
  assert.deepStrictEqual(weekNext.range, { start: '2026-09-14', end: '2026-09-20' });
  assert.strictEqual(weekNext.totalExpense, 20);
});

test('S4 结余计算：结余 = 总收入 − 总支出', () => {
  const data = buildData();
  for (const period of ['week', 'month', 'quarter', 'year']) {
    const r = Stats.compute(data, period, REF);
    assert.strictEqual(r.balance, r.totalIncome - r.totalExpense, period);
  }
});

test('空数据统计：全零、无分项', () => {
  const r = Stats.compute(Storage.createDefaultData(), 'month', REF);
  assert.strictEqual(r.totalExpense, 0);
  assert.strictEqual(r.totalIncome, 0);
  assert.strictEqual(r.balance, 0);
  assert.deepStrictEqual(r.expenseBreakdown, []);
  assert.deepStrictEqual(r.incomeBreakdown, []);
});

test('留空/0 金额处理：留空不计，0 计入 0', () => {
  const data = Storage.createDefaultData();
  data.expenseItems = [{ id: 'e1', name: '早餐', createdAt: '2026-09-01', stoppedAt: null }];
  data.expenseRecords = [
    { itemId: 'e1', date: '2026-09-02', amount: 10 },
    { itemId: 'e1', date: '2026-09-03', amount: 0 },
    { itemId: 'e1', date: '2026-09-04', amount: null }
  ];
  const r = Stats.compute(data, 'month', REF);
  assert.strictEqual(r.totalExpense, 10);
  assert.strictEqual(r.expenseBreakdown[0].total, 10);
});

test('已停止项目的历史记录仍计入统计', () => {
  const data = Storage.createDefaultData();
  data.expenseItems = [{ id: 'e1', name: '早餐', createdAt: '2026-09-01', stoppedAt: '2026-09-05' }];
  data.expenseRecords = [
    { itemId: 'e1', date: '2026-09-02', amount: 10 },
    { itemId: 'e1', date: '2026-09-06', amount: 20 } // 停止后不应有记录，但若存在仍按记录统计
  ];
  const r = Stats.compute(data, 'month', REF);
  assert.strictEqual(r.totalExpense, 30);
});

test('round2：四舍五入到两位小数', () => {
  assert.strictEqual(Stats.round2(37 / 75 * 100), Math.round(37 / 75 * 10000) / 100);
  assert.strictEqual(Stats.round2(1.005), 1.01);
  assert.strictEqual(Stats.round2(1.004), 1);
});

