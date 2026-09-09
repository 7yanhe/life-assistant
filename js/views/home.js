/**
 * views/home.js —— 首页日历视图（UMD，纯渲染函数）
 * 参考真我手机日历风格：月份标题 + 7列月历 + 蓝色今天高亮 + 圆点标记 + 底部今日详情
 * 输入 state：
 * {
 *   today: "YYYY-MM-DD",
 *   month: "YYYY-MM",
 *   selectedDate: "YYYY-MM-DD",
 *   calendar: { "YYYY-MM-DD": { checkin: {total, done}, expense, income } },
 *   plans: [{ id, name, completedToday }],
 *   summary: { totalExpense, totalIncome, balance, expenseRows: [{itemName, amount}], incomes: [{name, amount}] }
 * }
 * 返回 HTML 字符串。
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

  var WEEK_HEADERS = ['日', '一', '二', '三', '四', '五', '六'];

  function renderDots(dayInfo) {
    if (!dayInfo) return '';
    var dots = [];
    var ci = dayInfo.checkin || { total: 0, done: 0 };
    if (ci.total > 0) {
      var cls = ci.done >= ci.total ? 'dot-checkin-done' : 'dot-checkin-miss';
      dots.push('<span class="cal-dot ' + cls + '"></span>');
    }
    if (dayInfo.expense > 0) dots.push('<span class="cal-dot dot-expense"></span>');
    if (dayInfo.income > 0) dots.push('<span class="cal-dot dot-income"></span>');
    if (!dots.length) return '';
    return '<div class="cal-dots">' + dots.join('') + '</div>';
  }

  function renderCalendarGrid(state) {
    var month = state.month || state.today.slice(0, 7);
    var today = state.today;
    var selected = state.selectedDate || today;
    var calendar = state.calendar || {};
    var weeks = D.buildMonthCalendar(month + '-01');
    var html = '<div class="cal-grid">';
    WEEK_HEADERS.forEach(function (w) {
      html += '<div class="cal-weekhead">' + w + '</div>';
    });
    weeks.forEach(function (week) {
      week.forEach(function (cell) {
        var date = cell.date;
        var day = Number(date.slice(8, 10));
        var isToday = date === today;
        var isSelected = date === selected;
        var isFuture = D.isAfter(date, today);
        var dayInfo = calendar[date];
        var cls = 'cal-cell';
        if (!cell.inMonth) cls += ' out';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        if (isFuture) cls += ' future';
        var numCls = isToday ? 'cal-num today-num' : 'cal-num';
        html += '<div class="' + cls + '" data-action="home-date-select" data-date="' + date + '">' +
          '<span class="' + numCls + '">' + day + '</span>' +
          renderDots(dayInfo) +
          '</div>';
      });
    });
    html += '</div>';
    return html;
  }

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
    var month = state.month || today.slice(0, 7);
    var selected = state.selectedDate || today;
    var plans = state.plans || [];
    var sum = state.summary || {};
    var expenseRows = sum.expenseRows || [];
    var incomes = sum.incomes || [];
    var totalExpense = typeof sum.totalExpense === 'number' ? sum.totalExpense : 0;
    var totalIncome = typeof sum.totalIncome === 'number' ? sum.totalIncome : 0;
    var balance = typeof sum.balance === 'number' ? sum.balance : 0;
    var doneCount = plans.filter(function (p) { return p.completedToday; }).length;
    var balanceCls = balance < 0 ? ' negative' : '';
    var monthLabel = D.formatMonthCN(month + '-01');
    var yearStr = month.slice(0, 4) + '年';
    var selectedLabel = D.formatCN(selected);
    var selectedWeek = D.weekdayCN(selected);
    var isTodaySelected = selected === today;

    return '' +
      '<section class="home-view" data-view="home">' +
      '  <div class="cal-header">' +
      '    <div class="cal-title">' +
      '      <div class="cal-month">' + monthLabel.replace(yearStr, '') + '</div>' +
      '      <div class="cal-year">' + yearStr + '</div>' +
      '    </div>' +
      '    <div class="cal-nav">' +
      '      <button class="cal-nav-btn" data-action="home-month-prev" aria-label="上个月">‹</button>' +
      '      <button class="cal-today-btn" data-action="home-today">今天</button>' +
      '      <button class="cal-nav-btn" data-action="home-month-next" aria-label="下个月">›</button>' +
      '    </div>' +
      '  </div>' +
      renderCalendarGrid(state) +
      '  <div class="home-detail">' +
      '    <div class="detail-date">' +
      '      <span class="detail-date-label">' + (isTodaySelected ? '今天 · ' : '') + selectedLabel + '</span>' +
      '      <span class="detail-date-week">' + selectedWeek + '</span>' +
      '    </div>' +
      '    <div class="detail-section">' +
      '      <div class="detail-section-title">📋 打卡 <span class="count">已完成 ' + doneCount + ' / 共 ' + plans.length + '</span></div>' +
      renderCheckinList(plans) +
      '    </div>' +
      '    <div class="detail-section">' +
      '      <div class="detail-section-title">💰 记账</div>' +
      '      <div class="money-summary">' +
      '        <span class="ms-item">支出 <b class="expense">' + UI.formatMoney(totalExpense) + '</b></span>' +
      '        <span class="ms-item">收入 <b class="income">' + UI.formatMoney(totalIncome) + '</b></span>' +
      '        <span class="ms-item">结余 <b class="balance' + balanceCls + '">' + UI.formatMoney(balance) + '</b></span>' +
      '      </div>' +
      renderAccountList({ expenseRows: expenseRows, incomes: incomes }) +
      '    </div>' +
      '  </div>' +
      '  <button class="fab" data-action="home-quick-add" aria-label="快速添加">＋</button>' +
      '</section>';
  }

  return { render: render };
});
