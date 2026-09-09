/**
 * views/checkin-list.js —— 打卡计划列表视图（UMD，纯渲染函数）
 * 输入 state：{
 *   items: [{ plan: {id,name,createdAt}, completedToday, totalCompleted, streak }]
 * }
 * 返回 HTML 字符串。浏览器挂载 LifeApp.Views.CheckinList；Node 测试 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../ui.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Views = root.LifeApp.Views || {};
    root.LifeApp.Views.CheckinList = factory(root.LifeApp.UI);
  }
})(typeof self !== 'undefined' ? self : this, function (UI) {
  'use strict';

  function render(state) {
    var items = (state && state.items) || [];
    var rows = items.map(function (it) {
      var p = it.plan;
      var checked = it.completedToday ? ' checked' : '';
      var doneCls = it.completedToday ? ' done' : '';
      return '<li class="plan-row' + doneCls + '" data-id="' + UI.escapeHtml(p.id) + '">' +
        '<a class="plan-name" href="#/checkin/' + encodeURIComponent(p.id) + '">' + UI.escapeHtml(p.name) + '</a>' +
        '<span class="plan-streak">连续 ' + it.streak + ' 天 · 累计 ' + it.totalCompleted + ' 天</span>' +
        '<label class="check-box" title="切换今日完成状态">' +
        '<input type="checkbox" data-action="toggle-today" data-id="' + UI.escapeHtml(p.id) + '"' + checked + '>' +
        '<span class="checkmark"></span>' +
        '</label>' +
        '<div class="plan-ops">' +
        '<button type="button" class="btn btn-small" data-action="rename-plan" data-id="' + UI.escapeHtml(p.id) + '">编辑</button>' +
        '<button type="button" class="btn btn-small btn-danger" data-action="delete-plan" data-id="' + UI.escapeHtml(p.id) + '">删除</button>' +
        '</div>' +
        '</li>';
    }).join('');
    var list = items.length
      ? '<ul class="plan-list">' + rows + '</ul>'
      : '<div class="empty">还没有打卡计划，点击右上角「＋ 新建计划」开始吧</div>';
    return '' +
      '<section class="checkin-list-view" data-view="checkin-list">' +
      '  <header class="view-header">' +
      '    <h2>打卡计划</h2>' +
      '    <button type="button" class="btn btn-primary" data-action="create-plan">＋ 新建计划</button>' +
      '  </header>' +
      '  <p class="view-sub">每天记录一次完成状态，可补打卡过去任意一天</p>' +
      list +
      '</section>';
  }

  return { render: render };
});
