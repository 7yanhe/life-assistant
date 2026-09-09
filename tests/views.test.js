const { test } = require('node:test');
const assert = require('node:assert');
require('./_setup.js');

const HomeView = require('../js/views/home.js');
const CheckinList = require('../js/views/checkin-list.js');
const CheckinDetail = require('../js/views/checkin-detail.js');
const AccountDaily = require('../js/views/account-daily.js');
const AccountStats = require('../js/views/account-stats.js');

/* ============ 首页 ============ */

test('H1 首页日期显示：年月日 + 星期', () => {
  const html = HomeView.render({ today: '2026-09-09', plans: [], summary: {} });
  assert.match(html, /2026年9月9日/);
  assert.match(html, /星期三/);
});

test('H1 首页打卡概览：已完成 x / 共 y，勾选状态正确', () => {
  const html = HomeView.render({
    today: '2026-09-09',
    plans: [
      { id: 'p1', name: '早起', completedToday: true },
      { id: 'p2', name: '运动', completedToday: false },
      { id: 'p3', name: '阅读', completedToday: true }
    ],
    summary: {}
  });
  assert.match(html, /已完成 2 \/ 共 3/);
  assert.match(html, />早起</);
  assert.match(html, /data-action="toggle-today" data-id="p1" checked/);
  assert.doesNotMatch(html, /data-action="toggle-today" data-id="p2" checked/);
});

test('H3 首页记账只读：展示金额与明细，无输入框', () => {
  const html = HomeView.render({
    today: '2026-09-09',
    plans: [],
    summary: {
      totalExpense: 45,
      totalIncome: 0,
      balance: -45,
      expenseRows: [
        { itemName: '早餐', amount: 12 },
        { itemName: '午餐', amount: 20 },
        { itemName: '交通', amount: 13 }
      ],
      incomes: [{ name: '工资', amount: 8000 }]
    }
  });
  assert.match(html, /支出 <b class="expense">¥45\.00<\/b>/);
  assert.match(html, /收入 <b class="income">¥0\.00<\/b>/);
  assert.match(html, /结余 <b class="balance negative">¥-45\.00<\/b>/);
  assert.match(html, />早餐<\/span><span class="amount">¥12\.00<\/span>/);
  assert.match(html, />工资<\/span><span class="amount income">\+¥8000\.00<\/span>/);
  assert.doesNotMatch(html, /<input/);
});

test('H4 首页日历视图结构', () => {
  const html = HomeView.render({ today: '2026-09-09', plans: [], summary: {} });
  assert.match(html, /class="cal-month">9月/);
  assert.match(html, /class="cal-year">2026年/);
  assert.match(html, /data-action="home-month-prev"/);
  assert.match(html, /data-action="home-month-next"/);
  assert.match(html, /data-action="home-today"/);
  assert.match(html, /class="cal-grid"/);
  assert.match(html, /class="cal-weekhead">日</);
  assert.match(html, /class="cal-weekhead">六</);
  assert.match(html, /class="cal-cell today selected" data-action="home-date-select" data-date="2026-09-09"/);
  assert.match(html, /class="cal-num today-num">9</);
  assert.match(html, /class="cal-cell future" data-action="home-date-select" data-date="2026-09-10"/);
  assert.match(html, /class="home-detail"/);
  assert.match(html, /class="detail-date-label">今天 · 2026年9月9日/);
  assert.match(html, /class="detail-date-week">星期三/);
  assert.match(html, /📋 打卡/);
  assert.match(html, /💰 记账/);
  assert.match(html, /class="fab" data-action="home-quick-add"/);
});

test('H5 首页日历圆点标记：打卡完成/未完成/支出/收入', () => {
  const html = HomeView.render({
    today: '2026-09-09',
    plans: [],
    summary: {},
    calendar: {
      '2026-09-01': { checkin: { total: 3, done: 3 }, expense: 45, income: 0 },
      '2026-09-02': { checkin: { total: 3, done: 1 }, expense: 0, income: 8000 },
      '2026-09-03': { checkin: { total: 0, done: 0 }, expense: 20, income: 0 }
    }
  });
  assert.match(html, /data-date="2026-09-01"[\s\S]*?dot-checkin-done/);
  assert.match(html, /data-date="2026-09-01"[\s\S]*?dot-expense/);
  assert.match(html, /data-date="2026-09-02"[\s\S]*?dot-checkin-miss/);
  assert.match(html, /data-date="2026-09-02"[\s\S]*?dot-income/);
  assert.match(html, /data-date="2026-09-03"[\s\S]*?dot-expense/);
  assert.doesNotMatch(html, /data-date="2026-09-03"[\s\S]*?dot-checkin/);
});

test('G4 首页空状态', () => {
  const html = HomeView.render({ today: '2026-09-09', plans: [], summary: { expenseRows: [], incomes: [] } });
  assert.match(html, /还没有打卡计划/);
  assert.match(html, /今天还没有记账/);
});

/* ============ 打卡列表 ============ */

test('打卡列表：名称、坚持天数、今日状态、操作按钮', () => {
  const html = CheckinList.render({
    items: [
      { plan: { id: 'p1', name: '早起', createdAt: '2026-09-01' }, completedToday: true, totalCompleted: 5, streak: 2 },
      { plan: { id: 'p2', name: '阅读', createdAt: '2026-09-02' }, completedToday: false, totalCompleted: 3, streak: 0 }
    ]
  });
  assert.match(html, />早起</);
  assert.match(html, /连续 2 天 · 累计 5 天/);
  assert.match(html, /data-action="toggle-today" data-id="p1" checked/);
  assert.doesNotMatch(html, /data-action="toggle-today" data-id="p2" checked/);
  assert.match(html, /data-action="rename-plan" data-id="p1"/);
  assert.match(html, /data-action="delete-plan" data-id="p2"/);
  assert.match(html, /href="#\/checkin\/p1"/);
  assert.match(html, /data-action="create-plan"/);
});

test('G4 打卡列表空状态', () => {
  const html = CheckinList.render({ items: [] });
  assert.match(html, /还没有打卡计划/);
});

/* ============ 打卡详情（月历） ============ */

const PLAN = { id: 'p1', name: '早起', createdAt: '2026-09-01' };
const RECORDS = { '2026-09-01': true, '2026-09-02': true, '2026-09-05': true, '2026-09-09': true };

function detailHtml(over) {
  return CheckinDetail.render(Object.assign({
    plan: PLAN, month: '2026-09', today: '2026-09-09', records: RECORDS
  }, over || {}));
}

test('C3 详情月历：已完成显示 ✓，未完成显示 ✗', () => {
  const html = detailHtml();
  assert.match(html, /<td class="cell done[^"]*" [^>]*>✓<\/td>/);
  assert.match(html, /<td class="cell miss[^"]*" [^>]*>✗<\/td>/);
  // 9-01 已完成
  assert.match(html, /data-date="2026-09-01"[^>]*>✓<\/td>/);
  // 9-03 未完成
  assert.match(html, /data-date="2026-09-03"[^>]*>✗<\/td>/);
});

test('C4 未来日期不可操作：future 类，无点击动作', () => {
  const html = detailHtml();
  const cells = html.match(/<td class="cell future[^"]*"/g) || [];
  assert.ok(cells.length >= 1, '未来日期格应有 future 类');
  assert.doesNotMatch(html, /data-date="2026-09-10"/, '未来日期不应带点击动作');
  assert.match(html, /未来日期，不可打卡/);
});

test('C5 创建日前不可操作：beforeCreated 类，无点击动作', () => {
  // 计划创建于 9-05：9-01 ~ 9-04 为创建日前（月内灰色格）
  const html = detailHtml({ plan: { id: 'p1', name: '早起', createdAt: '2026-09-05' } });
  const cells = html.match(/<td class="cell beforeCreated[^"]*"/g) || [];
  assert.ok(cells.length >= 4, '9月1-4日应为 beforeCreated 格');
  assert.doesNotMatch(html, /data-date="2026-09-02"/, '创建日前不应带点击动作');
  assert.match(html, /创建日前，不可操作/);
  // 月外格（8-31）为 cell out 空 td
  assert.match(html, /<td class="cell out"><\/td>/);
});

test('C3 补打卡入口：未完成日期带 toggle-day 动作与日期', () => {
  const html = detailHtml();
  assert.match(html, /data-action="toggle-day" data-id="p1" data-date="2026-09-03"/);
  assert.match(html, /data-date="2026-09-09"[^>]*>✓<\/td>/); // 今天已完成
});

test('月历月份切换按钮与返回链接', () => {
  const html = detailHtml();
  assert.match(html, /data-action="month-prev"/);
  assert.match(html, /data-action="month-next"/);
  assert.match(html, />2026年9月<\/span>/);
  assert.match(html, /href="#\/checkin"/);
});

test('计划不存在时显示空状态', () => {
  assert.match(CheckinDetail.render({ plan: null }), /计划不存在/);
});

test('cellState：三种状态判定', () => {
  const st = CheckinDetail.cellState;
  assert.strictEqual(st('2026-08-31', PLAN, '2026-09-09', RECORDS), 'beforeCreated');
  assert.strictEqual(st('2026-09-10', PLAN, '2026-09-09', RECORDS), 'future');
  assert.strictEqual(st('2026-09-01', PLAN, '2026-09-09', RECORDS), 'done');
  assert.strictEqual(st('2026-09-03', PLAN, '2026-09-09', RECORDS), 'miss');
});

/* ============ 记账 · 日记账 ============ */

const DAILY_STATE = {
  date: '2026-09-09',
  summary: {
    expenseRows: [
      { item: { id: 'e1', name: '早餐' }, amount: 12 },
      { item: { id: 'e2', name: '交通' }, amount: null }
    ],
    incomes: [{ id: 'i1', name: '工资', amount: 8000 }],
    totalExpense: 12,
    totalIncome: 8000,
    balance: 7988
  }
};

test('日记账：日期导航与日期选择器', () => {
  const html = AccountDaily.render(DAILY_STATE);
  assert.match(html, /data-action="date-prev"/);
  assert.match(html, /data-action="date-next"/);
  assert.match(html, /data-action="date-today"/);
  assert.match(html, /<input type="date" class="date-input" data-action="date-set" value="2026-09-09">/);
});

test('E1/E3 日记账：支出项目行 + 金额输入框（已填/未填）', () => {
  const html = AccountDaily.render(DAILY_STATE);
  assert.match(html, />早餐</);
  assert.match(html, /data-action="expense-amount" data-item-id="e1" data-date="2026-09-09"/);
  assert.match(html, /value="12"/); // 已填金额回显
  assert.match(html, /placeholder="未填写"/); // 未填金额占位
  assert.match(html, /data-action="expense-name-edit" data-id="e1"/);
  assert.match(html, /data-action="expense-more" data-id="e1"/);
  assert.match(html, /class="name"[^>]*>早餐/);
});

test('I1/I2 日记账：收入行与录入表单', () => {
  const html = AccountDaily.render(DAILY_STATE);
  assert.match(html, />工资<\/span><span class="amount income">\+¥8000\.00<\/span>/);
  assert.match(html, /data-action="income-name-edit" data-id="i1"/);
  assert.match(html, /data-action="income-more" data-id="i1"/);
  assert.match(html, /id="inc-name"/);
  assert.match(html, /id="inc-amount"/);
  assert.match(html, /data-action="add-income"/);
});

test('日记账当日小结：支出/收入/结余', () => {
  const html = AccountDaily.render(DAILY_STATE);
  assert.match(html, /支出 <b class="expense">¥12\.00<\/b>/);
  assert.match(html, /收入 <b class="income">¥8000\.00<\/b>/);
  assert.match(html, /结余 <b class="balance">¥7988\.00<\/b>/);
});

/* ============ 阶段二：记账交互新设计 ============ */

test('E7 支出项目行：类别名称可点击编辑 + 更多按钮', () => {
  const html = AccountDaily.render(DAILY_STATE);
  // 类别名称可点击
  assert.match(html, /data-action="expense-name-edit" data-id="e1"/);
  assert.match(html, /class="name"[^>]*>早餐/);
  // 金额输入框在中间
  assert.match(html, /data-action="expense-amount" data-item-id="e1"/);
  // 更多按钮在右边
  assert.match(html, /data-action="expense-more" data-id="e1"/);
  assert.match(html, /class="btn btn-icon more-btn"/);
});

test('E8 支出项目 inline edit 状态：名称输入框 + 保存/取消', () => {
  const state = JSON.parse(JSON.stringify(DAILY_STATE));
  state.editingExpenseId = 'e1';
  const html = AccountDaily.render(state);
  assert.match(html, /class="expense-row editing"/);
  assert.match(html, /data-action="expense-name-input" data-id="e1"/);
  assert.match(html, /value="早餐"/);
  assert.match(html, /data-action="expense-name-save" data-id="e1"/);
  assert.match(html, /data-action="expense-name-cancel" data-id="e1"/);
});

test('I4 收入行：名称可点击编辑 + 更多按钮', () => {
  const html = AccountDaily.render(DAILY_STATE);
  assert.match(html, /data-action="income-name-edit" data-id="i1"/);
  assert.match(html, /data-action="income-more" data-id="i1"/);
});

test('I5 收入 inline edit 状态：名称+金额输入框 + 保存/取消', () => {
  const state = JSON.parse(JSON.stringify(DAILY_STATE));
  state.editingIncomeId = 'i1';
  const html = AccountDaily.render(state);
  assert.match(html, /class="income-row editing"/);
  assert.match(html, /data-action="income-name-input" data-id="i1"/);
  assert.match(html, /data-action="income-amount-input" data-id="i1"/);
  assert.match(html, /data-action="income-edit-save" data-id="i1"/);
  assert.match(html, /data-action="income-edit-cancel" data-id="i1"/);
});

test('G4 日记账空状态：无支出项目、无收入', () => {
  const html = AccountDaily.render({ date: '2026-09-09', summary: { expenseRows: [], incomes: [], totalExpense: 0, totalIncome: 0, balance: 0 } });
  assert.match(html, /这一天还没有支出项目/);
  assert.match(html, /当天暂无收入记录/);
});

/* ============ 记账 · 统计 ============ */

test('S1 统计：周期起止、汇总金额', () => {
  const html = AccountStats.render({
    period: 'month',
    rangeLabel: '2026年9月1日 ~ 2026年9月30日',
    stats: { totalExpense: 75, totalIncome: 16500, balance: 16425, expenseBreakdown: [], incomeBreakdown: [] }
  });
  assert.match(html, /2026年9月1日 ~ 2026年9月30日/);
  assert.match(html, /总支出 <b class="expense">¥75\.00<\/b>/);
  assert.match(html, /总收入 <b class="income">¥16500\.00<\/b>/);
  assert.match(html, /结余 <b class="balance">¥16425\.00<\/b>/);
});

test('S3 统计：周期切换按钮与高亮', () => {
  const html = AccountStats.render({ period: 'quarter', rangeLabel: 'x', stats: {} });
  assert.match(html, /data-action="period-week"/);
  assert.match(html, /data-action="period-month"/);
  assert.match(html, /data-action="period-quarter"/);
  assert.match(html, /data-action="period-year"/);
  assert.match(html, /class="btn period-btn active" data-action="period-quarter"/);
  assert.doesNotMatch(html, /class="btn period-btn active" data-action="period-week"/);
});

test('S2 统计：支出明细含金额与占比条', () => {
  const html = AccountStats.render({
    period: 'month',
    rangeLabel: 'x',
    stats: {
      totalExpense: 75, totalIncome: 0, balance: -75,
      expenseBreakdown: [
        { name: '早餐', total: 37, percent: 49.33 },
        { name: '交通', total: 38, percent: 50.67 }
      ],
      incomeBreakdown: []
    }
  });
  assert.match(html, />早餐<\/span>/);
  assert.match(html, /style="width:49\.33%"/);
  assert.match(html, /¥37\.00/);
  assert.match(html, /49\.33%/);
  assert.match(html, /本周期暂无收入记录/);
});

test('G4 统计空状态', () => {
  const html = AccountStats.render({ period: 'month', rangeLabel: 'x', stats: { totalExpense: 0, totalIncome: 0, balance: 0, expenseBreakdown: [], incomeBreakdown: [] } });
  assert.match(html, /本周期暂无支出记录/);
  assert.match(html, /本周期暂无收入记录/);
});
