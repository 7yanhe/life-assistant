const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../js/dateutil.js');

test('parseDate / isValidDate：合法日期', () => {
  assert.strictEqual(D.isValidDate('2026-09-09'), true);
  const dt = D.parseDate('2026-09-09');
  assert.strictEqual(dt.getFullYear(), 2026);
  assert.strictEqual(dt.getMonth(), 8);
  assert.strictEqual(dt.getDate(), 9);
});

test('parseDate / isValidDate：非法日期返回 null/false', () => {
  assert.strictEqual(D.isValidDate('2026-02-30'), false);
  assert.strictEqual(D.isValidDate('2026-13-01'), false);
  assert.strictEqual(D.isValidDate('2026-00-10'), false);
  assert.strictEqual(D.isValidDate('abc'), false);
  assert.strictEqual(D.isValidDate('2026/09/09'), false);
  assert.strictEqual(D.isValidDate(''), false);
  assert.strictEqual(D.isValidDate(null), false);
  assert.strictEqual(D.isValidDate('2026-09-9'), false);
  assert.strictEqual(D.parseDate('2026-02-30'), null);
});

test('toDateStr / addDays：跨月、跨年、负天数', () => {
  assert.strictEqual(D.addDays('2026-09-09', 1), '2026-09-10');
  assert.strictEqual(D.addDays('2026-09-30', 1), '2026-10-01');
  assert.strictEqual(D.addDays('2026-01-01', -1), '2025-12-31');
  assert.strictEqual(D.addDays('2026-02-28', 1), '2026-03-01');
  assert.strictEqual(D.addDays('2026-09-09', 0), '2026-09-09');
  assert.strictEqual(D.addDays('bad', 1), null);
});

test('formatCN / weekdayCN / formatMonthCN：中文格式化', () => {
  assert.strictEqual(D.formatCN('2026-09-09'), '2026年9月9日');
  assert.strictEqual(D.formatCN('2026-01-05'), '2026年1月5日');
  assert.strictEqual(D.weekdayCN('2026-09-09'), '星期三');
  assert.strictEqual(D.weekdayCN('2026-09-13'), '星期日');
  assert.strictEqual(D.weekdayCN('2026-09-07'), '星期一');
  assert.strictEqual(D.formatMonthCN('2026-09-09'), '2026年9月');
  assert.strictEqual(D.formatCN('bad'), '');
});

test('today()：可用 _setNow 固定“今日”', () => {
  D._setNow(() => new Date(2026, 8, 9)); // 2026-09-09
  assert.strictEqual(D.today(), '2026-09-09');
  D._setNow(() => new Date(2026, 0, 1));
  assert.strictEqual(D.today(), '2026-01-01');
  D._setNow(null); // 恢复真实时间
  assert.strictEqual(D.isValidDate(D.today()), true);
});

test('getWeekRange：周一到周日', () => {
  // 2026-09-09 是周三 → 本周 09-07 ~ 09-13
  assert.deepStrictEqual(D.getWeekRange('2026-09-09'), { start: '2026-09-07', end: '2026-09-13' });
  // 周一当天
  assert.deepStrictEqual(D.getWeekRange('2026-09-07'), { start: '2026-09-07', end: '2026-09-13' });
  // 周日 → 同属前一周起点为周一
  assert.deepStrictEqual(D.getWeekRange('2026-09-13'), { start: '2026-09-07', end: '2026-09-13' });
  // 跨月：2026-09-30 是周三
  assert.deepStrictEqual(D.getWeekRange('2026-09-30'), { start: '2026-09-28', end: '2026-10-04' });
  // 跨年：2026-01-01 是周四
  assert.deepStrictEqual(D.getWeekRange('2026-01-01'), { start: '2025-12-29', end: '2026-01-04' });
});

test('getMonthRange：本月起止', () => {
  assert.deepStrictEqual(D.getMonthRange('2026-09-09'), { start: '2026-09-01', end: '2026-09-30' });
  assert.deepStrictEqual(D.getMonthRange('2026-02-15'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepStrictEqual(D.getMonthRange('2024-02-15'), { start: '2024-02-01', end: '2024-02-29' }); // 闰年
  assert.deepStrictEqual(D.getMonthRange('2026-12-31'), { start: '2026-12-01', end: '2026-12-31' });
});

test('getQuarterRange：季度起止（1-3/4-6/7-9/10-12）', () => {
  assert.deepStrictEqual(D.getQuarterRange('2026-01-15'), { start: '2026-01-01', end: '2026-03-31' });
  assert.deepStrictEqual(D.getQuarterRange('2026-03-31'), { start: '2026-01-01', end: '2026-03-31' });
  assert.deepStrictEqual(D.getQuarterRange('2026-04-01'), { start: '2026-04-01', end: '2026-06-30' });
  assert.deepStrictEqual(D.getQuarterRange('2026-06-30'), { start: '2026-04-01', end: '2026-06-30' });
  assert.deepStrictEqual(D.getQuarterRange('2026-09-09'), { start: '2026-07-01', end: '2026-09-30' });
  assert.deepStrictEqual(D.getQuarterRange('2026-10-01'), { start: '2026-10-01', end: '2026-12-31' });
  assert.deepStrictEqual(D.getQuarterRange('2026-12-31'), { start: '2026-10-01', end: '2026-12-31' });
});

test('getYearRange：本年起止', () => {
  assert.deepStrictEqual(D.getYearRange('2026-09-09'), { start: '2026-01-01', end: '2026-12-31' });
});

test('getPeriodRange：统一入口与未知周期报错', () => {
  assert.deepStrictEqual(D.getPeriodRange('week', '2026-09-09'), D.getWeekRange('2026-09-09'));
  assert.deepStrictEqual(D.getPeriodRange('month', '2026-09-09'), D.getMonthRange('2026-09-09'));
  assert.deepStrictEqual(D.getPeriodRange('quarter', '2026-09-09'), D.getQuarterRange('2026-09-09'));
  assert.deepStrictEqual(D.getPeriodRange('year', '2026-09-09'), D.getYearRange('2026-09-09'));
  assert.throws(() => D.getPeriodRange('decade', '2026-09-09'), /未知统计周期/);
});

test('periodLabelCN：周期中文标签', () => {
  assert.strictEqual(D.periodLabelCN({ start: '2026-09-07', end: '2026-09-13' }), '2026年9月7日 ~ 2026年9月13日');
});

test('buildMonthCalendar：2026年9月网格', () => {
  const weeks = D.buildMonthCalendar('2026-09-09');
  assert.ok(weeks.length >= 4 && weeks.length <= 6, '月历应有 4~6 行');
  // 每行 7 格
  for (const week of weeks) assert.strictEqual(week.length, 7);
  // 周一开头
  assert.strictEqual(weeks[0][0].date, '2026-08-31');
  // 覆盖整个 9 月
  const dates = weeks.flat().map(c => c.date);
  assert.ok(dates.includes('2026-09-01') && dates.includes('2026-09-30'));
  // inMonth 标记
  const sep1 = weeks.flat().find(c => c.date === '2026-09-01');
  const aug31 = weeks.flat().find(c => c.date === '2026-08-31');
  assert.strictEqual(sep1.inMonth, true);
  assert.strictEqual(aug31.inMonth, false);
});

test('compare / isAfter / isBefore / isSameOrBefore / isSameOrAfter', () => {
  assert.strictEqual(D.compare('2026-09-09', '2026-09-10'), -1);
  assert.strictEqual(D.compare('2026-09-10', '2026-09-09'), 1);
  assert.strictEqual(D.compare('2026-09-09', '2026-09-09'), 0);
  assert.strictEqual(D.isAfter('2026-09-10', '2026-09-09'), true);
  assert.strictEqual(D.isBefore('2026-09-08', '2026-09-09'), true);
  assert.strictEqual(D.isSameOrBefore('2026-09-09', '2026-09-09'), true);
  assert.strictEqual(D.isSameOrAfter('2026-09-09', '2026-09-09'), true);
  assert.strictEqual(D.isAfter('2026-09-09', '2026-09-09'), false);
});

test('parseAmount：金额校验', () => {
  assert.strictEqual(D.parseAmount('12'), 12);
  assert.strictEqual(D.parseAmount('12.5'), 12.5);
  assert.strictEqual(D.parseAmount('12.50'), 12.5);
  assert.strictEqual(D.parseAmount(' 12 '), 12);
  assert.strictEqual(D.parseAmount('0'), 0);
  assert.strictEqual(D.parseAmount('0.01'), 0.01);
  assert.strictEqual(D.parseAmount(''), null);
  assert.strictEqual(D.parseAmount(null), null);
  assert.strictEqual(D.parseAmount(undefined), null);
  assert.strictEqual(D.parseAmount('-5'), null);
  assert.strictEqual(D.parseAmount('abc'), null);
  assert.strictEqual(D.parseAmount('12.345'), null);
  assert.strictEqual(D.parseAmount('1e3'), null);
  assert.strictEqual(D.parseAmount('12,5'), null);
});
