/**
 * stats.js —— 记账统计模块（UMD，纯函数）
 * 按周期（本周/本月/本季/本年）计算：汇总、支出分项占比、收入分项。
 * 浏览器中挂载为 LifeApp.Stats；Node 测试中通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dateutil.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Stats = factory(root.LifeApp.DateUtil);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  function round2(n) {
    // 加 EPSILON 抵消浮点表示误差（如 1.005*100=100.4999…）
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /**
   * 计算某周期统计。
   * @param data  规范化后的数据对象（含 expenseItems/expenseRecords/incomeRecords）
   * @param period 'week' | 'month' | 'quarter' | 'year'
   * @param refDate 周期参考日期（默认今天）
   */
  function compute(data, period, refDate) {
    var ref = refDate || D.today();
    var range = D.getPeriodRange(period, ref);
    var items = data.expenseItems || [];
    var records = data.expenseRecords || [];
    var incomes = data.incomeRecords || [];
    var itemMap = {};
    items.forEach(function (it) { itemMap[it.id] = it; });

    var expenseByItem = {}; // itemId -> 金额合计
    var totalExpense = 0;
    records.forEach(function (r) {
      if (r.date < range.start || r.date > range.end) return;
      if (typeof r.amount !== 'number') return; // 留空不计
      totalExpense += r.amount;
      if (!expenseByItem[r.itemId]) expenseByItem[r.itemId] = 0;
      expenseByItem[r.itemId] += r.amount;
    });

    var incomeByName = {}; // name -> 金额合计
    var totalIncome = 0;
    incomes.forEach(function (r) {
      if (r.date < range.start || r.date > range.end) return;
      totalIncome += r.amount;
      if (!incomeByName[r.name]) incomeByName[r.name] = 0;
      incomeByName[r.name] += r.amount;
    });

    var expenseBreakdown = Object.keys(expenseByItem).map(function (itemId) {
      var total = round2(expenseByItem[itemId]);
      var item = itemMap[itemId] || { name: '（已删除项目）' };
      return {
        itemId: itemId,
        name: item.name,
        total: total,
        percent: totalExpense > 0 ? round2(total / totalExpense * 100) : 0
      };
    }).sort(function (a, b) { return b.total - a.total; });

    var incomeBreakdown = Object.keys(incomeByName).map(function (name) {
      var total = round2(incomeByName[name]);
      return {
        name: name,
        total: total,
        percent: totalIncome > 0 ? round2(total / totalIncome * 100) : 0
      };
    }).sort(function (a, b) { return b.total - a.total; });

    return {
      period: period,
      range: range,
      totalExpense: round2(totalExpense),
      totalIncome: round2(totalIncome),
      balance: round2(totalIncome - totalExpense),
      expenseBreakdown: expenseBreakdown,
      incomeBreakdown: incomeBreakdown
    };
  }

  return {
    round2: round2,
    compute: compute
  };
});
