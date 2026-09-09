// 共享测试助手：构建 App + jsdom 环境
const { JSDOM } = require('jsdom');
const Store = require('../js/store.js');
const Storage = require('../js/storage.js');
const App = require('../js/app.js');

const TODAY = '2026-09-09';

const HTML = `<!DOCTYPE html><html><head></head><body>
<nav class="topnav">
  <div class="brand">生活助手</div>
  <div class="nav-links">
    <a href="#/" data-nav="home">首页</a>
    <a href="#/checkin" data-nav="checkin">打卡</a>
    <a href="#/account/daily" data-nav="account">记账</a>
  </div>
  <div class="nav-actions">
    <button type="button" class="btn btn-small" data-action="export-backup">导出备份</button>
    <button type="button" class="btn btn-small" data-action="import-backup">导入恢复</button>
    <input type="file" id="import-file" accept=".json,application/json" hidden>
  </div>
</nav>
<main id="app" class="app-container"></main>
</body></html>`;

function buildApp(seed) {
  const dom = new JSDOM(HTML, { url: 'http://localhost/' });
  const win = dom.window;
  const doc = win.document;
  const adapter = Storage.memoryAdapter(seed || null);
  const store = new Store(adapter, { todayFn: () => TODAY });
  const app = new App({ window: win, root: doc.getElementById('app'), store });
  app._reload = function () { win.__reloaded = true; };
  return { dom, win, doc, app, store, adapter };
}

const tick = () => new Promise(r => setTimeout(r, 0));
const tickMs = ms => new Promise(r => setTimeout(r, ms));
// jsdom 的 hash 导航在异步任务队列中处理，点击锚点后需等待其完成
const navTick = () => tickMs(40);

function clickAction(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

function seedPlanOld() {
  const d = Storage.createDefaultData();
  d.plans = [{ id: 'plan_old', name: '早起', createdAt: '2026-09-01' }];
  d.checkRecords = [{ planId: 'plan_old', date: TODAY, completed: true }];
  return d;
}

function seedPlanMid() {
  // 计划创建于 9-05（月中），用于验证创建日前格子
  const d = Storage.createDefaultData();
  d.plans = [{ id: 'plan_mid', name: '阅读', createdAt: '2026-09-05' }];
  return d;
}

module.exports = { TODAY, HTML, buildApp, tick, tickMs, navTick, clickAction, seedPlanOld, seedPlanMid };
