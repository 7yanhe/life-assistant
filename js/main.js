/**
 * main.js —— 应用引导：选择本地存储适配器（IndexedDB 优先，降级 localStorage）并启动。
 */
(function () {
  'use strict';
  var adapter;
  try {
    adapter = LifeApp.Storage.pickBrowserAdapter();
  } catch (e) {
    adapter = LifeApp.Storage.localStorageAdapter();
  }
  var app = new LifeApp.App({ adapter: adapter });
  app.start().catch(function (e) {
    console.error('生活助手初始化失败:', e);
    if (LifeApp.UI && LifeApp.UI.toast) {
      LifeApp.UI.toast('初始化失败：' + (e && e.message ? e.message : e), 'error');
    }
  });
})();
