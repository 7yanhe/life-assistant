/**
 * views/account-daily.js —— 记账 · 日记账视图（UMD，纯渲染函数）
 * 输入 state：{
 *   date: "YYYY-MM-DD",
 *   summary: {
 *     expenseRows: [{ item: {id,name}, amount: number|null }],
 *     incomes: [{ id, name, amount }],
 *     totalExpense, totalIncome, balance
 *   }
 * }
 * 返回 HTML 字符串。浏览器挂载 LifeApp.Views.AccountDaily；Node 测试 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../ui.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Views = root.LifeApp.Views || {};
    root.LifeApp.Views.AccountDaily = factory(root.LifeApp.UI);
  }
})(typeof self !== 'undefined' ? self : this, function (UI) {
  'use strict';

  function renderExpenseList(rows) {
    if (!rows.length) {
      return '<div class="empty">这一天还没有支出项目，点击「＋ 新增支出项目」创建（从今天起每天自动出现）</div>';
    }
    var items = rows.map(function (r) {
      var it = r.item;
      var value = typeof r.amount === 'number' ? r.amount : '';
      return '<li class="expense-row" data-item-id="' + UI.escapeHtml(it.id) + '">' +
        '<span class="name" title="' + UI.escapeHtml(it.name) + '">' + UI.escapeHtml(it.name) + '</span>' +
        '<input class="amount-input" type="text" inputmode="decimal" placeholder="未填写" ' +
        'value="' + value + '" ' +
        'data-action="expense-amount" data-item-id="' + UI.escapeHtml(it.id) + '" data-date="' + UI.escapeHtml(r.date) + '">' +
        '<div class="ops">' +
        '<button type="button" class="btn btn-small" data-action="rename-expense" data-id="' + UI.escapeHtml(it.id) + '">改名</button>' +
        '<button type="button" class="btn btn-small" data-action="stop-expense" data-id="' + UI.escapeHtml(it.id) + '">停止</button>' +
        '<button type="button" class="btn btn-small btn-danger" data-action="delete-expense" data-id="' + UI.escapeHtml(it.id) + '">删除</button>' +
        '</div>' +
        '</li>';
    }).join('');
    return '<ul class="expense-list">' + items + '</ul>';
  }

  function renderIncomeList(incomes) {
    if (!incomes.length) {
      return '<div class="empty">当天暂无收入记录</div>';
    }
    var items = incomes.map(function (r) {
      return '<li class="income-row" data-id="' + UI.escapeHtml(r.id) + '">' +
        '<span class="name">' + UI.escapeHtml(r.name) + '</span>' +
        '<span class="amount income">' + UI.formatMoneySigned(r.amount) + '</span>' +
        '<div class="ops">' +
        '<button type="button" class="btn btn-small" data-action="edit-income" data-id="' + UI.escapeHtml(r.id) + '">编辑</button>' +
        '<button type="button" class="btn btn-small btn-danger" data-action="delete-income" data-id="' + UI.escapeHtml(r.id) + '">删除</button>' +
        '</div>' +
        '</li>';
    }).join('');
    return '<ul class="income-list">' + items + '</ul>';
  }

  function render(state) {
    var date = state.date || '';
    var sum = state.summary || {};
    var expenseRows = sum.expenseRows || [];
    var incomes = sum.incomes || [];
    var totalExpense = typeof sum.totalExpense === 'number' ? sum.totalExpense : 0;
    var totalIncome = typeof sum.totalIncome === 'number' ? sum.totalIncome : 0;
    var balance = typeof sum.balance === 'number' ? sum.balance : 0;
    var rows = expenseRows.map(function (r) {
      return { item: r.item, amount: r.amount, date: date };
    });
    var balanceCls = balance < 0 ? ' negative' : '';
    return '' +
      '<section class="account-daily-view" data-view="account-daily">' +
      '  <header class="view-header">' +
      '    <h2>日记账</h2>' +
      '    <div class="account-tabs">' +
      '      <a class="account-tab active" href="#/account/daily">日记账</a>' +
      '      <a class="account-tab" href="#/account/stats">统计</a>' +
      '    </div>' +
      '    <div class="date-nav">' +
      '      <button type="button" class="btn btn-small" data-action="date-prev" title="前一天">‹ 前一天</button>' +
      '      <input type="date" class="date-input" data-action="date-set" value="' + UI.escapeHtml(date) + '">' +
      '      <button type="button" class="btn btn-small" data-action="date-next" title="后一天">后一天 ›</button>' +
      '      <button type="button" class="btn btn-small" data-action="date-today" title="回到今天">今天</button>' +
      '    </div>' +
      '  </header>' +
      '  <section class="card">' +
      '    <div class="card-title">支出 <span class="card-sub">金额独立填写，留空不计入统计</span>' +
      '      <button type="button" class="btn btn-small btn-primary" data-action="add-expense">＋ 新增支出项目</button></div>' +
      renderExpenseList(rows) +
      '  </section>' +
      '  <section class="card">' +
      '    <div class="card-title">收入 <span class="card-sub">仅出现在录入当天</span></div>' +
      renderIncomeList(incomes) +
      '    <form class="inline-form" data-form="income">' +
      '      <input id="inc-name" class="text-input" placeholder="收入名称，如：工资" autocomplete="off">' +
      '      <input id="inc-amount" class="text-input amount-input" type="text" inputmode="decimal" placeholder="金额" autocomplete="off">' +
      '      <button type="submit" class="btn btn-primary" data-action="add-income">记一笔</button>' +
      '    </form>' +
      '  </section>' +
      '  <section class="card day-summary">' +
      '    <div class="card-title">当日小结</div>' +
      '    <div class="money-summary">' +
      '      <span class="ms-item">支出 <b class="expense">' + UI.formatMoney(totalExpense) + '</b></span>' +
      '      <span class="ms-item">收入 <b class="income">' + UI.formatMoney(totalIncome) + '</b></span>' +
      '      <span class="ms-item">结余 <b class="balance' + balanceCls + '">' + UI.formatMoney(balance) + '</b></span>' +
      '    </div>' +
      '  </section>' +
      '</section>';
  }

  return { render: render };
});
