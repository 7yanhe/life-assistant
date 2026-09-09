/**
 * views/checkin-detail.js —— 打卡计划详情（月历/补打卡）视图（UMD，纯渲染函数）
 * 输入 state：{
 *   plan: { id, name, createdAt },
 *   month: "YYYY-MM" 当前展示月份（参考日取当月 1 号）,
 *   today: "YYYY-MM-DD",
 *   records: { "YYYY-MM-DD": true }  已完成日期映射
 * }
 * 返回 HTML 字符串。浏览器挂载 LifeApp.Views.CheckinDetail；Node 测试 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../dateutil.js'), require('../ui.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Views = root.LifeApp.Views || {};
    root.LifeApp.Views.CheckinDetail = factory(root.LifeApp.DateUtil, root.LifeApp.UI);
  }
})(typeof self !== 'undefined' ? self : this, function (D, UI) {
  'use strict';

  var WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

  /**
   * 计算某格状态：
   * 'beforeCreated' 创建日前（灰，不可点）
   * 'future'        未来日期（灰，不可点）
   * 'done'          已完成（✓）
   * 'miss'          未完成（✗，可点击补卡）
   */
  function cellState(date, plan, today, records) {
    if (D.isBefore(date, plan.createdAt)) return 'beforeCreated';
    if (D.isAfter(date, today)) return 'future';
    return records[date] ? 'done' : 'miss';
  }

  function render(state) {
    var plan = state.plan;
    if (!plan) return '<section class="checkin-detail-view"><div class="empty">计划不存在</div></section>';
    var today = state.today || D.today();
    var month = state.month || today.slice(0, 7); // "YYYY-MM"
    var records = state.records || {};
    var refDate = month + '-01';
    var weeks = D.buildMonthCalendar(refDate);
    var monthLabel = D.formatMonthCN(refDate);

    var rows = weeks.map(function (week) {
      var cells = week.map(function (cell) {
        var d = cell.date;
        var cls = ['cell'];
        if (!cell.inMonth) {
          cls.push('out');
          return '<td class="' + cls.join(' ') + '"></td>';
        }
        var st = cellState(d, plan, today, records);
        cls.push(st);
        if (d === today) cls.push('today');
        var text = '';
        if (st === 'done') text = '✓';
        else if (st === 'miss') text = '✗';
        var title = D.formatCN(d);
        if (st === 'beforeCreated') title += '（创建日前，不可操作）';
        else if (st === 'future') title += '（未来日期，不可打卡）';
        else if (st === 'done') title += ' 已打卡，点击取消';
        else title += ' 未打卡，点击补打卡';
        // 仅已完成/未完成格可点击（补打卡/取消）；创建日前与未来日期不可操作
        var clickable = st === 'done' || st === 'miss';
        var actionAttr = clickable
          ? ' data-action="toggle-day" data-id="' + UI.escapeHtml(plan.id) + '" data-date="' + d + '"'
          : '';
        return '<td class="' + cls.join(' ') + '"' + actionAttr + ' title="' + UI.escapeHtml(title) + '">' + text + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    return '' +
      '<section class="checkin-detail-view" data-view="checkin-detail">' +
      '  <header class="view-header">' +
      '    <a class="back-link" href="#/checkin">← 返回列表</a>' +
      '    <h2>' + UI.escapeHtml(plan.name) + '</h2>' +
      '    <span class="view-sub">创建于 ' + D.formatCN(plan.createdAt) + ' · 点击日期可补打卡</span>' +
      '  </header>' +
      '  <div class="month-nav">' +
      '    <button type="button" class="btn btn-small" data-action="month-prev">‹ 上个月</button>' +
      '    <span class="month-label">' + monthLabel + '</span>' +
      '    <button type="button" class="btn btn-small" data-action="month-next">下个月 ›</button>' +
      '  </div>' +
      '  <table class="calendar">' +
      '    <thead><tr>' + WEEK_HEADS.map(function (w) { return '<th>' + w + '</th>'; }).join('') + '</tr></thead>' +
      '    <tbody>' + rows + '</tbody>' +
      '  </table>' +
      '  <p class="calendar-hint">' +
      '    <span class="legend"><i class="dot done"></i>已完成</span>' +
      '    <span class="legend"><i class="dot miss"></i>未完成（可补卡）</span>' +
      '    <span class="legend"><i class="dot disabled"></i>不可操作</span>' +
      '  </p>' +
      '</section>';
  }

  return { render: render, cellState: cellState };
});
