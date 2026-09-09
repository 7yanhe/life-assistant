/**
 * views/account-stats.js —— 记账 · 统计视图（UMD，纯渲染函数）
 * 输入 state：{
 *   period: 'week'|'month'|'quarter'|'year',
 *   rangeLabel: "2026年9月7日 ~ 2026年9月13日",
 *   stats: {
 *     totalExpense, totalIncome, balance,
 *     expenseBreakdown: [{itemName, total, percent}],
 *     incomeBreakdown: [{name, total, percent}]
 *   }
 * }
 * 返回 HTML 字符串。浏览器挂载 LifeApp.Views.AccountStats；Node 测试 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../ui.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Views = root.LifeApp.Views || {};
    root.LifeApp.Views.AccountStats = factory(root.LifeApp.UI);
  }
})(typeof self !== 'undefined' ? self : this, function (UI) {
  'use strict';

  var PERIODS = [
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
    { key: 'quarter', label: '本季' },
    { key: 'year', label: '本年' }
  ];

  function renderBreakdown(list, emptyText, moneyFn) {
    if (!list.length) return '<div class="empty">' + emptyText + '</div>';
    var items = list.map(function (b) {
      var width = Math.max(0, Math.min(100, b.percent));
      return '<li class="breakdown-row">' +
        '<span class="b-name">' + UI.escapeHtml(b.name) + '</span>' +
        '<span class="b-bar"><i style="width:' + width + '%"></i></span>' +
        '<span class="b-amount">' + moneyFn(b.total) + '</span>' +
        '<span class="b-pct">' + UI.formatPercent(b.percent) + '</span>' +
        '</li>';
    }).join('');
    return '<ul class="breakdown">' + items + '</ul>';
  }

  function render(state) {
    var period = state.period || 'month';
    var stats = state.stats || {};
    var totalExpense = typeof stats.totalExpense === 'number' ? stats.totalExpense : 0;
    var totalIncome = typeof stats.totalIncome === 'number' ? stats.totalIncome : 0;
    var balance = typeof stats.balance === 'number' ? stats.balance : 0;
    var expenseBreakdown = stats.expenseBreakdown || [];
    var incomeBreakdown = stats.incomeBreakdown || [];
    var balanceCls = balance < 0 ? ' negative' : '';
    var tabs = PERIODS.map(function (p) {
      var cls = p.key === period ? 'btn period-btn active' : 'btn period-btn';
      return '<button type="button" class="' + cls + '" data-action="period-' + p.key + '">' + p.label + '</button>';
    }).join('');
    return '' +
      '<section class="account-stats-view" data-view="account-stats">' +
      '  <header class="view-header">' +
      '    <h2>统计</h2>' +
      '    <div class="account-tabs">' +
      '      <a class="account-tab" href="#/account/daily">日记账</a>' +
      '      <a class="account-tab active" href="#/account/stats">统计</a>' +
      '    </div>' +
      '    <div class="period-tabs">' + tabs + '</div>' +
      '  </header>' +
      '  <div class="period-range">' + UI.escapeHtml(state.rangeLabel || '') + '</div>' +
      '  <section class="card">' +
      '    <div class="card-title">汇总</div>' +
      '    <div class="money-summary">' +
      '      <span class="ms-item">总支出 <b class="expense">' + UI.formatMoney(totalExpense) + '</b></span>' +
      '      <span class="ms-item">总收入 <b class="income">' + UI.formatMoney(totalIncome) + '</b></span>' +
      '      <span class="ms-item">结余 <b class="balance' + balanceCls + '">' + UI.formatMoney(balance) + '</b></span>' +
      '    </div>' +
      '  </section>' +
      '  <section class="card">' +
      '    <div class="card-title">支出明细</div>' +
      renderBreakdown(expenseBreakdown, '本周期暂无支出记录', UI.formatMoney) +
      '  </section>' +
      '  <section class="card">' +
      '    <div class="card-title">收入明细</div>' +
      renderBreakdown(incomeBreakdown, '本周期暂无收入记录', UI.formatMoneySigned) +
      '  </section>' +
      '</section>';
  }

  return { render: render };
});
