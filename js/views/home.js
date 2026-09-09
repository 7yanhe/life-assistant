/**
 * views/home.js —— 首页总览视图（UMD，纯渲染函数）
 * 输入 state：
 * {
 *   today: "YYYY-MM-DD",
 *   plans: [{ id, name, completedToday }],
 *   summary: { totalExpense, totalIncome, balance, expenseRows: [{itemName, amount}], incomes: [{name, amount}] }
 * }
 * 返回 HTML 字符串。浏览器挂载 LifeApp.Views.Home；Node 测试 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../dateutil.js'), require('../ui.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Views = root.LifeApp.Views || {};
    root.LifeApp.Views.Home = factory(root.LifeApp.DateUtil, root.LifeApp.UI);
  }
})(typeof self !== 'undefined' ? self : this, function (D, UI) {
  'use strict';

  function renderCheckinList(plans) {
    if (!plans.length) {
      return '<div class="empty">还没有打卡计划，去 <a href="#/checkin">打卡页</a> 新建一个吧</div>';
    }
    var items = plans.map(function (p) {
      var checked = p.completedToday ? ' checked' : '';
      var doneCls = p.completedToday ? ' done' : '';
      return '<li class="checkin-quick-item' + doneCls + '">' +
        '<label class="check-box">' +
        '<input type="checkbox" data-action="toggle-today" data-id="' + UI.escapeHtml(p.id) + '"' + checked + '>' +
        '<span class="checkmark"></span>' +
        '</label>' +
        '<span class="name">' + UI.escapeHtml(p.name) + '</span>' +
        '</li>';
    }).join('');
    return '<ul class="checkin-quick">' + items + '</ul>';
  }

  function renderAccountList(summary) {
    var rows = [];
    summary.expenseRows.forEach(function (r) {
      rows.push('<li class="account-quick-item">' +
        '<span class="name">' + UI.escapeHtml(r.itemName) + '</span>' +
        '<span class="amount">' + (r.amount === null ? '未填' : UI.formatMoney(r.amount)) + '</span>' +
        '</li>');
    });
    summary.incomes.forEach(function (r) {
      rows.push('<li class="account-quick-item income-row">' +
        '<span class="name">' + UI.escapeHtml(r.name) + '</span>' +
        '<span class="amount income">' + UI.formatMoneySigned(r.amount) + '</span>' +
        '</li>');
    });
    if (!rows.length) {
      return '<div class="empty">今天还没有记账，去 <a href="#/account/daily">记账页</a> 记一笔吧</div>';
    }
    return '<ul class="account-quick">' + rows.join('') + '</ul>';
  }

  function render(state) {
    var today = state.today || D.today();
    var plans = state.plans || [];
    var sum = state.summary || {};
    var expenseRows = sum.expenseRows || [];
    var incomes = sum.incomes || [];
    var totalExpense = typeof sum.totalExpense === 'number' ? sum.totalExpense : 0;
    var totalIncome = typeof sum.totalIncome === 'number' ? sum.totalIncome : 0;
    var balance = typeof sum.balance === 'number' ? sum.balance : 0;
    var doneCount = plans.filter(function (p) { return p.completedToday; }).length;
    var balanceCls = balance < 0 ? ' negative' : '';
    return '' +
      '<section class="home-view" data-view="home">' +
      '  <header class="date-header">' +
      '    <div class="date-big">' + D.formatCN(today) + '</div>' +
      '    <div class="date-week">' + D.weekdayCN(today) + '</div>' +
      '  </header>' +
      '  <section class="card">' +
      '    <div class="card-title">📋 今日打卡 <span class="count">已完成 ' + doneCount + ' / 共 ' + plans.length + '</span></div>' +
      renderCheckinList(plans) +
      '    <div class="card-link"><a href="#/checkin">查看全部打卡 →</a></div>' +
      '  </section>' +
      '  <section class="card">' +
      '    <div class="card-title">💰 今日记账</div>' +
      '    <div class="money-summary">' +
      '      <span class="ms-item">支出 <b class="expense">' + UI.formatMoney(totalExpense) + '</b></span>' +
      '      <span class="ms-item">收入 <b class="income">' + UI.formatMoney(totalIncome) + '</b></span>' +
      '      <span class="ms-item">结余 <b class="balance' + balanceCls + '">' + UI.formatMoney(balance) + '</b></span>' +
      '    </div>' +
      renderAccountList({ expenseRows: expenseRows, incomes: incomes }) +
      '    <div class="card-link"><a href="#/account/daily">去记账 →</a></div>' +
      '  </section>' +
      '</section>';
  }

  return { render: render };
});
