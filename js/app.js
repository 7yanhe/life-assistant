/**
 * app.js —— 应用外壳（UMD）：hash 路由、顶部导航、事件委托、备份导入导出。
 * 浏览器中挂载 LifeApp.App（start() 启动）；Node + jsdom 测试中 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./dateutil.js'), require('./storage.js'), require('./store.js'),
      require('./stats.js'), require('./backup.js'), require('./ui.js'),
      require('./views/home.js'), require('./views/checkin-list.js'),
      require('./views/checkin-detail.js'), require('./views/account-daily.js'),
      require('./views/account-stats.js')
    );
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.App = factory(
      root.LifeApp.DateUtil, root.LifeApp.Storage, root.LifeApp.Store,
      root.LifeApp.Stats, root.LifeApp.Backup, root.LifeApp.UI,
      root.LifeApp.Views.Home, root.LifeApp.Views.CheckinList,
      root.LifeApp.Views.CheckinDetail, root.LifeApp.Views.AccountDaily,
      root.LifeApp.Views.AccountStats
    );
  }
})(typeof self !== 'undefined' ? self : this, function (D, Storage, Store, Stats, Backup, UI, HomeView, CheckinListView, CheckinDetailView, AccountDailyView, AccountStatsView) {
  'use strict';

  function App(opts) {
    opts = opts || {};
    this.win = opts.window || (typeof window !== 'undefined' ? window : null);
    this.doc = this.win ? this.win.document : (typeof document !== 'undefined' ? document : null);
    this.root = opts.root || (this.doc ? this.doc.getElementById('app') : null);
    this.adapter = opts.adapter || null;
    this.store = opts.store || null;
    this.actions = opts.actions || {}; // 测试注入：{ 'action-name': fn } 覆盖默认
    this.state = {
      route: 'home',
      planId: null,
      detailMonth: null,
      detailPlanId: null,
      accountDate: null,
      statsPeriod: 'month',
      homeMonth: null,
      homeSelectedDate: null,
      editingExpenseId: null,
      editingIncomeId: null
    };
  }

  function monthAdd(monthStr, delta) {
    var m = /^(\d{4})-(\d{2})$/.exec(monthStr);
    if (!m) return monthStr;
    var d = new Date(+m[1], +m[2] - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function friendly(reason) {
    var map = {
      'future': '不能对未来日期打卡',
      'beforeCreated': '该日期早于计划创建日，不可操作',
      'invalidAmount': '金额格式不正确（非负数字，最多两位小数）',
      '名称不能为空': '名称不能为空',
      '计划不存在': '计划不存在',
      '支出项目不存在': '支出项目不存在',
      '收入记录不存在': '收入记录不存在',
      '项目创建日前不可填写': '该日期项目尚未创建，不可填写',
      '项目已停止': '该项目已停止记录',
      '日期无效': '日期无效'
    };
    return map[reason] || reason || '操作失败';
  }

  App.prototype.start = function () {
    var self = this;
    if (!this.root) throw new Error('缺少 #app 容器');
    if (!this.store) {
      if (!this.adapter) throw new Error('缺少存储适配器');
      this.store = new Store(this.adapter, { todayFn: D.today });
    }
    return (this.store.ready ? Promise.resolve() : this.store.init()).then(function () {
      UI._setDoc(self.doc); // 确保模态框/toast 使用应用所在 document
      self.state.accountDate = self.store.todayFn();
      self._bindEvents();
      self.render();
      if (self.win) {
        self.win.addEventListener('hashchange', function () { self.render(); });
      }
      return self;
    });
  };

  App.prototype._bindEvents = function () {
    var self = this;
    var doc = this.doc;
    if (!doc || !this.root) return;
    // 事件委托绑定在整个 document 上：导航栏的备份按钮也在 #app 之外
    doc.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (el) self._handle('click', el, e);
    });
    doc.addEventListener('change', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (el) self._handle('change', el, e);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('amount-input')) {
        e.target.blur(); // 触发 change → 保存
      }
    });
    doc.addEventListener('submit', function (e) {
      var form = e.target;
      if (form && form.getAttribute && form.getAttribute('data-form') === 'income') {
        e.preventDefault();
        var btn = form.querySelector('[data-action="add-income"]');
        if (btn) self._handle('click', btn, e);
      }
    });
    var fileInput = doc.getElementById('import-file');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        self._importFile(fileInput);
      });
    }
  };

  App.prototype._handle = function (eventType, el, nativeEvent) {
    var action = el.getAttribute('data-action');
    var self = this;
    // 金额输入框与日期选择器仅在 change 事件时保存；
    // 点击进入编辑（聚焦/打开原生选择器）不应触发保存与重渲染，否则会丢失焦点
    if (eventType === 'click' && (action === 'expense-amount' || action === 'date-set')) {
      return;
    }
    if (this.actions[action]) {
      this.actions[action].call(this, el, nativeEvent);
      return;
    }
    switch (action) {
      case 'toggle-today':
        self._toggleToday(el); break;
      case 'toggle-day':
        self._toggleDay(el); break;
      case 'create-plan':
        self._createPlan(); break;
      case 'rename-plan':
        self._renamePlan(el); break;
      case 'delete-plan':
        self._deletePlan(el); break;
      case 'month-prev':
        self.state.detailMonth = monthAdd(self.state.detailMonth || self.store.todayFn().slice(0, 7), -1);
        self.render(); break;
      case 'month-next':
        self.state.detailMonth = monthAdd(self.state.detailMonth || self.store.todayFn().slice(0, 7), 1);
        self.render(); break;
      case 'date-prev':
        self.state.accountDate = D.addDays(self.state.accountDate, -1);
        self.render(); break;
      case 'date-next':
        self.state.accountDate = D.addDays(self.state.accountDate, 1);
        self.render(); break;
      case 'date-today':
        self.state.accountDate = self.store.todayFn();
        self.render(); break;
      case 'date-set':
        self._dateSet(el); break;
      case 'expense-amount':
        self._expenseAmount(el); break;
      case 'add-expense':
        self._addExpense(); break;
      case 'rename-expense':
        self._renameExpense(el); break;
      case 'stop-expense':
        self._stopExpense(el); break;
      case 'delete-expense':
        self._deleteExpense(el); break;
      case 'expense-name-edit':
        self.state.editingExpenseId = el.getAttribute('data-id');
        self.render(); break;
      case 'expense-name-save':
        self._saveExpenseName(el); break;
      case 'expense-name-cancel':
        self.state.editingExpenseId = null;
        self.render(); break;
      case 'expense-more':
        self._expenseMore(el); break;
      case 'add-income':
        self._addIncome(); break;
      case 'edit-income':
        self._editIncome(el); break;
      case 'delete-income':
        self._deleteIncome(el); break;
      case 'income-name-edit':
        self.state.editingIncomeId = el.getAttribute('data-id');
        self.render(); break;
      case 'income-edit-save':
        self._saveIncomeEdit(el); break;
      case 'income-edit-cancel':
        self.state.editingIncomeId = null;
        self.render(); break;
      case 'income-more':
        self._incomeMore(el); break;
      case 'period-week':
      case 'period-month':
      case 'period-quarter':
      case 'period-year':
        self.state.statsPeriod = action.replace('period-', '');
        self.render(); break;
      case 'export-backup':
        self._exportBackup(); break;
      case 'import-backup':
        self._openImport(); break;
      case 'home-month-prev':
        self.state.homeMonth = monthAdd(self.state.homeMonth || self.store.todayFn().slice(0, 7), -1);
        self.render(); break;
      case 'home-month-next':
        self.state.homeMonth = monthAdd(self.state.homeMonth || self.store.todayFn().slice(0, 7), 1);
        self.render(); break;
      case 'home-today':
        self.state.homeMonth = self.store.todayFn().slice(0, 7);
        self.state.homeSelectedDate = self.store.todayFn();
        self.render(); break;
      case 'home-date-select':
        self.state.homeSelectedDate = el.getAttribute('data-date');
        self.render(); break;
      case 'home-quick-add':
        self._quickAdd(); break;
      case 'nav-more':
        self._toggleNavMore(); break;
      default:
        break;
    }
  };

  App.prototype._parseHash = function () {
    var h = this.win ? this.win.location.hash.replace(/^#/, '') : '';
    if (!h || h === '/' || h === '') return { route: 'home', params: {} };
    if (h.indexOf('/checkin/') === 0) return { route: 'checkin-detail', params: { id: decodeURIComponent(h.slice('/checkin/'.length)) } };
    if (h === '/checkin') return { route: 'checkin-list', params: {} };
    if (h === '/account/daily') return { route: 'account-daily', params: {} };
    if (h === '/account/stats') return { route: 'account-stats', params: {} };
    return { route: 'home', params: {} };
  };

  App.prototype._navKeyFor = function (route) {
    if (route === 'home') return 'home';
    if (route === 'checkin-list' || route === 'checkin-detail') return 'checkin';
    if (route === 'account-daily' || route === 'account-stats') return 'account';
    return 'home';
  };

  App.prototype._updateNav = function (route) {
    var self = this;
    var links = this.doc ? this.doc.querySelectorAll('.topnav .nav-links a') : [];
    var key = this._navKeyFor(route);
    Array.prototype.forEach.call(links, function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === key);
    });
  };

  App.prototype.render = function () {
    var parsed = this._parseHash();
    var route = parsed.route;
    this._updateNav(route);
    var html;
    switch (route) {
      case 'checkin-list':
        html = this._renderCheckinList(); break;
      case 'checkin-detail':
        html = this._renderCheckinDetail(parsed.params.id); break;
      case 'account-daily':
        html = this._renderAccountDaily(); break;
      case 'account-stats':
        html = this._renderAccountStats(); break;
      default:
        html = this._renderHome(); break;
    }
    this.root.innerHTML = html;
  };

  /* ---------- 视图数据装配 ---------- */

  App.prototype._renderHome = function () {
    var today = this.store.todayFn();
    var month = this.state.homeMonth || today.slice(0, 7);
    var selected = this.state.homeSelectedDate || today;
    var calendar = this.store.monthCalendarSummary(month);
    var items = this.store.listPlansWithStatus();
    var summary = this.store.dailySummary(selected);
    return HomeView.render({
      today: today,
      month: month,
      selectedDate: selected,
      calendar: calendar,
      plans: items.map(function (it) {
        return { id: it.plan.id, name: it.plan.name, completedToday: it.completedToday };
      }),
      summary: {
        totalExpense: summary.totalExpense,
        totalIncome: summary.totalIncome,
        balance: summary.balance,
        expenseRows: summary.expenseRows.map(function (r) { return { itemName: r.item.name, amount: r.amount }; }),
        incomes: summary.incomes.map(function (r) { return { name: r.name, amount: r.amount }; })
      }
    });
  };

  App.prototype._renderCheckinList = function () {
    var items = this.store.listPlansWithStatus().map(function (it) {
      return {
        plan: { id: it.plan.id, name: it.plan.name, createdAt: it.plan.createdAt },
        completedToday: it.completedToday,
        totalCompleted: it.totalCompleted,
        streak: it.streak
      };
    });
    return CheckinListView.render({ items: items });
  };

  App.prototype._renderCheckinDetail = function (id) {
    var plan = this.store.getPlan(id);
    if (!plan) {
      return '<section class="checkin-detail-view" data-view="checkin-detail">' +
        '<div class="empty">计划不存在或已被删除 · <a href="#/checkin">返回列表</a></div></section>';
    }
    var today = this.store.todayFn();
    if (this.state.detailPlanId !== id || !this.state.detailMonth) {
      this.state.detailPlanId = id;
      // 默认展示月份：创建日与今天中较晚者的月份
      var ref = D.isAfter(plan.createdAt, today) ? plan.createdAt : today;
      this.state.detailMonth = ref.slice(0, 7);
    }
    var records = {};
    this.store.getPlanRecords(id).forEach(function (r) { records[r.date] = !!r.completed; });
    return CheckinDetailView.render({
      plan: { id: plan.id, name: plan.name, createdAt: plan.createdAt },
      month: this.state.detailMonth,
      today: today,
      records: records
    });
  };

  App.prototype._renderAccountDaily = function () {
    var date = this.state.accountDate || this.store.todayFn();
    var summary = this.store.dailySummary(date);
    return AccountDailyView.render({
      date: date,
      editingExpenseId: this.state.editingExpenseId,
      editingIncomeId: this.state.editingIncomeId,
      summary: {
        expenseRows: summary.expenseRows.map(function (r) {
          return { item: { id: r.item.id, name: r.item.name }, amount: r.amount };
        }),
        incomes: summary.incomes.map(function (r) { return { id: r.id, name: r.name, amount: r.amount }; }),
        totalExpense: summary.totalExpense,
        totalIncome: summary.totalIncome,
        balance: summary.balance
      }
    });
  };

  App.prototype._renderAccountStats = function () {
    var period = this.state.statsPeriod;
    var today = this.store.todayFn();
    var stats = Stats.compute(this.store.data, period, today);
    return AccountStatsView.render({
      period: period,
      rangeLabel: D.periodLabelCN(stats.range),
      stats: stats
    });
  };

  /* ---------- 动作实现 ---------- */

  App.prototype._toggleToday = function (el) {
    var r = this.store.toggleCheck(el.getAttribute('data-id'), this.store.todayFn());
    if (!r.ok) UI.toast(friendly(r.reason), 'error');
    this.render();
  };

  App.prototype._toggleDay = function (el) {
    var id = el.getAttribute('data-id');
    var date = el.getAttribute('data-date');
    var r = this.store.toggleCheck(id, date);
    if (!r.ok) UI.toast(friendly(r.reason), 'error');
    this.render();
  };

  App.prototype._createPlan = function () {
    var self = this;
    UI.promptText('计划名称（如：早起、运动、阅读）：', '', '计划名称').then(function (name) {
      if (name === null) return;
      var r = self.store.createPlan(name);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
      UI.toast('已创建计划「' + r.plan.name + '」', 'success');
    });
  };

  App.prototype._renamePlan = function (el) {
    var self = this;
    var plan = this.store.getPlan(el.getAttribute('data-id'));
    if (!plan) return;
    UI.promptText('修改计划名称：', plan.name, '计划名称').then(function (name) {
      if (name === null) return;
      var r = self.store.renamePlan(plan.id, name);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
    });
  };

  App.prototype._deletePlan = function (el) {
    var self = this;
    var plan = this.store.getPlan(el.getAttribute('data-id'));
    if (!plan) return;
    UI.confirm('确定删除计划「' + plan.name + '」吗？\n将同时删除该计划的所有打卡记录。', '删除').then(function (ok) {
      if (!ok) return;
      var r = self.store.deletePlan(plan.id);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      // 若当前在详情页，跳回列表
      self.render();
      UI.toast('已删除计划', 'success');
    });
  };

  App.prototype._dateSet = function (el) {
    var value = el.value;
    if (!D.isValidDate(value)) { UI.toast('日期无效', 'error'); this.render(); return; }
    this.state.accountDate = value;
    this.render();
  };

  App.prototype._expenseAmount = function (el) {
    var itemId = el.getAttribute('data-item-id');
    var date = el.getAttribute('data-date');
    var r = this.store.setExpenseAmount(itemId, date, el.value);
    if (!r.ok) {
      UI.toast(friendly(r.reason), 'error');
      this.render(); // 恢复原值
      return;
    }
    this.render();
  };

  App.prototype._addExpense = function () {
    var self = this;
    UI.promptText('支出项目名称（创建后每天自动出现，金额每天单独填写）：', '', '如：早餐').then(function (name) {
      if (name === null) return;
      var r = self.store.createExpenseItem(name, self.state.accountDate || self.store.todayFn());
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
      UI.toast('已新增支出项目「' + r.item.name + '」', 'success');
    });
  };

  App.prototype._renameExpense = function (el) {
    var self = this;
    var item = this.store.getExpenseItem(el.getAttribute('data-id'));
    if (!item) return;
    UI.promptText('修改支出项目名称：', item.name, '项目名称').then(function (name) {
      if (name === null) return;
      var r = self.store.renameExpenseItem(item.id, name);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
    });
  };

  App.prototype._stopExpense = function (el) {
    var self = this;
    var item = this.store.getExpenseItem(el.getAttribute('data-id'));
    if (!item) return;
    UI.confirm('确定停止记录「' + item.name + '」吗？\n从明天起不再出现，历史记录保留。', '停止').then(function (ok) {
      if (!ok) return;
      var r = self.store.stopExpenseItem(item.id, self.state.accountDate || self.store.todayFn());
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
      UI.toast('已停止「' + item.name + '」', 'success');
    });
  };

  App.prototype._deleteExpense = function (el) {
    var self = this;
    var item = this.store.getExpenseItem(el.getAttribute('data-id'));
    if (!item) return;
    UI.confirm('确定删除「' + item.name + '」吗？\n将删除该项目所有日期的记录。', '删除').then(function (ok) {
      if (!ok) return;
      var r = self.store.deleteExpenseItem(item.id);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
      UI.toast('已删除「' + item.name + '」', 'success');
    });
  };

  App.prototype._saveExpenseName = function (el) {
    var id = el.getAttribute('data-id');
    var input = this.root.querySelector('input[data-action="expense-name-input"][data-id="' + id + '"]');
    var name = input ? input.value : '';
    var r = this.store.renameExpenseItem(id, name);
    if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
    this.state.editingExpenseId = null;
    this.render();
    UI.toast('已修改名称', 'success');
  };

  App.prototype._expenseMore = function (el) {
    var self = this;
    var id = el.getAttribute('data-id');
    var item = this.store.getExpenseItem(id);
    if (!item) return;
    UI.promptFields('「' + item.name + '」操作', [
      { label: '选择操作：1=重命名 2=停止记录 3=删除', value: '1', placeholder: '输入数字' }
    ]).then(function (res) {
      if (!res) return;
      var choice = res.values[0].trim();
      if (choice === '1') {
        self.state.editingExpenseId = id;
        self.render();
      } else if (choice === '2') {
        self._stopExpense(el);
      } else if (choice === '3') {
        self._deleteExpense(el);
      } else {
        UI.toast('请输入 1、2 或 3', 'error');
      }
    });
  };

  App.prototype._addIncome = function () {
    var self = this;
    var nameEl = this.root.querySelector('#inc-name');
    var amountEl = this.root.querySelector('#inc-amount');
    var name = nameEl ? nameEl.value : '';
    var amount = amountEl ? amountEl.value : '';
    var r = this.store.addIncome(name, amount, this.state.accountDate || this.store.todayFn());
    if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
    this.render();
    UI.toast('已记录收入', 'success');
  };

  App.prototype._editIncome = function (el) {
    var self = this;
    var rec = this.store.getIncome(el.getAttribute('data-id'));
    if (!rec) return;
    UI.promptFields('编辑收入', [
      { label: '名称', value: rec.name, placeholder: '如：工资' },
      { label: '金额', value: String(rec.amount), placeholder: '非负数字' }
    ]).then(function (res) {
      if (!res) return;
      var r = self.store.updateIncome(rec.id, { name: res.values[0], amount: res.values[1] });
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
    });
  };

  App.prototype._deleteIncome = function (el) {
    var self = this;
    var rec = this.store.getIncome(el.getAttribute('data-id'));
    if (!rec) return;
    UI.confirm('确定删除这笔收入「' + rec.name + ' ¥' + rec.amount + '」吗？', '删除').then(function (ok) {
      if (!ok) return;
      var r = self.store.deleteIncome(rec.id);
      if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
      self.render();
      UI.toast('已删除收入', 'success');
    });
  };

  App.prototype._saveIncomeEdit = function (el) {
    var id = el.getAttribute('data-id');
    var nameInput = this.root.querySelector('input[data-action="income-name-input"][data-id="' + id + '"]');
    var amountInput = this.root.querySelector('input[data-action="income-amount-input"][data-id="' + id + '"]');
    var name = nameInput ? nameInput.value : '';
    var amount = amountInput ? amountInput.value : '';
    var r = this.store.updateIncome(id, { name: name, amount: amount });
    if (!r.ok) { UI.toast(friendly(r.reason), 'error'); return; }
    this.state.editingIncomeId = null;
    this.render();
    UI.toast('已保存修改', 'success');
  };

  App.prototype._incomeMore = function (el) {
    var self = this;
    var id = el.getAttribute('data-id');
    var rec = this.store.getIncome(id);
    if (!rec) return;
    UI.promptFields('「' + rec.name + '」操作', [
      { label: '选择操作：1=编辑 2=删除', value: '1', placeholder: '输入数字' }
    ]).then(function (res) {
      if (!res) return;
      var choice = res.values[0].trim();
      if (choice === '1') {
        self.state.editingIncomeId = id;
        self.render();
      } else if (choice === '2') {
        self._deleteIncome(el);
      } else {
        UI.toast('请输入 1 或 2', 'error');
      }
    });
  };

  App.prototype._quickAdd = function () {
    var self = this;
    UI.promptFields('快速添加', [
      { label: '类型', value: '支出项目', placeholder: '支出项目/打卡计划/收入' }
    ]).then(function (res) {
      if (!res) return;
      var type = res.values[0].trim();
      if (type.indexOf('支出') >= 0) {
        self._addExpense();
      } else if (type.indexOf('打卡') >= 0) {
        self._createPlan();
      } else if (type.indexOf('收入') >= 0) {
        if (self.win) self.win.location.hash = '#/account/daily';
      } else {
        UI.toast('请输入：支出项目、打卡计划 或 收入', 'error');
      }
    });
  };


  App.prototype._toggleNavMore = function () {
    var menu = this.doc.querySelector('[data-role="nav-more-menu"]');
    if (!menu) return;
    if (menu.hasAttribute('hidden')) {
      menu.removeAttribute('hidden');
    } else {
      menu.setAttribute('hidden', '');
    }
  };

  App.prototype._closeNavMore = function () {
    var menu = this.doc.querySelector('[data-role="nav-more-menu"]');
    if (menu) menu.setAttribute('hidden', '');
  };

  App.prototype._exportBackup = function () {
    if (!this.win) return;
    var BlobCtor = this.win.Blob || (typeof Blob !== 'undefined' ? Blob : null);
    if (!BlobCtor) return;
    var text = Backup.serialize(this.store.exportData());
    var blob = new BlobCtor([text], { type: 'application/json' });
    var url = this.win.URL.createObjectURL(blob);
    var a = this.doc.createElement('a');
    a.href = url;
    a.download = Backup.defaultFileName();
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
    var win = this.win;
    setTimeout(function () { win.URL.revokeObjectURL(url); }, 1000);
    UI.toast('备份已导出', 'success');
  };

  App.prototype._openImport = function () {
    var input = this.doc.getElementById('import-file');
    if (input) input.click();
  };

  App.prototype._importFile = function (input) {
    var self = this;
    var file = input.files && input.files[0];
    input.value = ''; // 允许重复选择同一文件
    if (!file) return;
    var FileReaderCtor = this.win.FileReader || (typeof FileReader !== 'undefined' ? FileReader : null);
    if (!FileReaderCtor) return;
    var reader = new FileReaderCtor();
    reader.onload = function () {
      var parsed = Backup.parseBackup(String(reader.result));
      if (!parsed.ok) {
        UI.toast('导入失败：' + parsed.reason, 'error');
        return;
      }
      UI.confirm('导入将覆盖当前所有数据，是否继续？', '导入').then(function (ok) {
        if (!ok) return;
        self.store.importData(parsed.data).then(function () {
          UI.toast('导入成功，正在刷新…', 'success');
          setTimeout(function () { self._reload(); }, 600);
        });
      });
    };
    reader.onerror = function () {
      UI.toast('读取文件失败', 'error');
    };
    reader.readAsText(file);
  };

  /** 页面刷新（可注入，便于测试拦截） */
  App.prototype._reload = function () {
    if (this.win) this.win.location.reload();
  };

  return App;
});
