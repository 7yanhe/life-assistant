/**
 * store.js —— 业务逻辑层（UMD）
 * 打卡部分：计划 CRUD、每日打卡/补卡、规则约束、坚持天数统计。
 * 记账部分：见下方「记账」区块（阶段4 加入）。
 * 浏览器中挂载为 LifeApp.Store；Node 测试中通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./dateutil.js'), require('./storage.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Store = factory(root.LifeApp.DateUtil, root.LifeApp.Storage);
  }
})(typeof self !== 'undefined' ? self : this, function (D, Storage) {
  'use strict';

  var NAME_MAX_LEN = 30;

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function validateName(name) {
    if (typeof name !== 'string') return { ok: false, reason: '名称不能为空' };
    var s = name.trim();
    if (s === '') return { ok: false, reason: '名称不能为空' };
    if (s.length > NAME_MAX_LEN) return { ok: false, reason: '名称不能超过' + NAME_MAX_LEN + '个字' };
    return { ok: true, value: s };
  }

  /**
   * Store 构造器
   * @param adapter { load():Promise<object|null>, save(obj):Promise<void> }
   * @param opts { todayFn?: () => "YYYY-MM-DD" }  固定“今日”便于测试
   */
  function Store(adapter, opts) {
    opts = opts || {};
    this.adapter = adapter;
    this.todayFn = typeof opts.todayFn === 'function' ? opts.todayFn : D.today;
    this.data = null;
    this.ready = false;
  }

  /** 初始化：从适配器加载并规范化数据 */
  Store.prototype.init = function () {
    var self = this;
    return this.adapter.load().then(function (raw) {
      self.data = Storage.normalizeData(raw);
      self.ready = true;
      return self;
    });
  };

  /** 每次变更后立即持久化（PRD D3：即时保存） */
  Store.prototype.persist = function () {
    this.data.meta.lastModified = new Date().toISOString();
    return this.adapter.save(this.data);
  };

  /** 导入整份数据（备份恢复用）：覆盖当前数据并持久化 */
  Store.prototype.importData = function (data) {
    this.data = Storage.normalizeData(data);
    return this.persist();
  };

  /** 导出当前数据深拷贝（备份用） */
  Store.prototype.exportData = function () {
    return JSON.parse(JSON.stringify(this.data));
  };

  /* ============ 打卡 · 计划 ============ */

  Store.prototype.listPlans = function () {
    return this.data.plans.slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  };

  Store.prototype.getPlan = function (id) {
    return this.data.plans.find(function (p) { return p.id === id; }) || null;
  };

  /** 新建计划：从创建日起可打卡 */
  Store.prototype.createPlan = function (name) {
    var v = validateName(name);
    if (!v.ok) return v;
    var plan = { id: genId('plan'), name: v.value, createdAt: this.todayFn() };
    this.data.plans.push(plan);
    this.persist();
    return { ok: true, plan: plan };
  };

  /** 编辑计划名称 */
  Store.prototype.renamePlan = function (id, name) {
    var plan = this.getPlan(id);
    if (!plan) return { ok: false, reason: '计划不存在' };
    var v = validateName(name);
    if (!v.ok) return v;
    plan.name = v.value;
    this.persist();
    return { ok: true, plan: plan };
  };

  /** 删除计划：同时删除该计划所有打卡记录 */
  Store.prototype.deletePlan = function (id) {
    var plan = this.getPlan(id);
    if (!plan) return { ok: false, reason: '计划不存在' };
    this.data.plans = this.data.plans.filter(function (p) { return p.id !== id; });
    this.data.checkRecords = this.data.checkRecords.filter(function (r) { return r.planId !== id; });
    this.persist();
    return { ok: true };
  };

  /* ============ 打卡 · 记录 ============ */

  Store.prototype.getCheckRecord = function (planId, date) {
    return this.data.checkRecords.find(function (r) { return r.planId === planId && r.date === date; }) || null;
  };

  Store.prototype.getPlanRecords = function (planId) {
    return this.data.checkRecords.filter(function (r) { return r.planId === planId; });
  };

  /**
   * 设置某计划某天完成状态（打卡/取消/补打卡）
   * 规则：不可对未来日期打卡；创建日之前的日期不可操作。
   */
  Store.prototype.setCheck = function (planId, date, completed) {
    var plan = this.getPlan(planId);
    if (!plan) return { ok: false, reason: '计划不存在' };
    if (!D.isValidDate(date)) return { ok: false, reason: '日期无效' };
    var today = this.todayFn();
    if (D.isAfter(date, today)) return { ok: false, reason: 'future' };
    if (D.isBefore(date, plan.createdAt)) return { ok: false, reason: 'beforeCreated' };
    var idx = this.data.checkRecords.findIndex(function (r) {
      return r.planId === planId && r.date === date;
    });
    var want = !!completed;
    if (idx >= 0) {
      var rec = this.data.checkRecords[idx];
      if (rec.completed === want) return { ok: true, changed: false };
      rec.completed = want;
    } else {
      this.data.checkRecords.push({ planId: planId, date: date, completed: want });
    }
    this.persist();
    return { ok: true, changed: true };
  };

  /** 切换某天完成状态（快捷打卡/补打卡） */
  Store.prototype.toggleCheck = function (planId, date) {
    var rec = this.getCheckRecord(planId, date);
    return this.setCheck(planId, date, rec ? !rec.completed : true);
  };

  /** 今日完成状态 */
  Store.prototype.todayStatus = function (planId) {
    var rec = this.getCheckRecord(planId, this.todayFn());
    return rec ? !!rec.completed : false;
  };

  /** 累计完成天数 */
  Store.prototype.totalCompleted = function (planId) {
    return this.getPlanRecords(planId).filter(function (r) { return r.completed; }).length;
  };

  /**
   * 连续坚持天数：从今天（若今天未打卡则从昨天）往前数连续完成的天数。
   */
  Store.prototype.currentStreak = function (planId) {
    var plan = this.getPlan(planId);
    if (!plan) return 0;
    var completedMap = {};
    this.getPlanRecords(planId).forEach(function (r) {
      if (r.completed) completedMap[r.date] = true;
    });
    var cursor = this.todayFn();
    if (!completedMap[cursor]) cursor = D.addDays(cursor, -1);
    var streak = 0;
    while (completedMap[cursor] && D.isSameOrAfter(cursor, plan.createdAt)) {
      streak += 1;
      cursor = D.addDays(cursor, -1);
    }
    return streak;
  };

  /** 计划列表 + 今日状态 + 坚持天数（供列表页/首页使用） */
  Store.prototype.listPlansWithStatus = function () {
    var self = this;
    return this.listPlans().map(function (p) {
      return {
        plan: p,
        completedToday: self.todayStatus(p.id),
        totalCompleted: self.totalCompleted(p.id),
        streak: self.currentStreak(p.id)
      };
    });
  };

  /* ============ 记账 · 支出项目 ============ */

  /** 全部支出项目（按创建时间升序） */
  Store.prototype.listExpenseItems = function () {
    return this.data.expenseItems.slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  };

  Store.prototype.getExpenseItem = function (id) {
    return this.data.expenseItems.find(function (it) { return it.id === id; }) || null;
  };

  /**
   * 某日应出现的支出项目：创建日及之后出现；已停止的项目在停止日及之后不再出现。
   * 即 createdAt <= date，且（未停止 或 date <= stoppedAt）。
   */
  Store.prototype.getExpenseItemsForDate = function (date) {
    return this.listExpenseItems().filter(function (it) {
      if (D.isBefore(date, it.createdAt)) return false;
      if (it.stoppedAt && D.isAfter(date, it.stoppedAt)) return false;
      return true;
    });
  };

  /** 新增支出项目：从当前所选日期起，之后每天都出现 */
  Store.prototype.createExpenseItem = function (name, date) {
    var v = validateName(name);
    if (!v.ok) return v;
    if (!D.isValidDate(date)) return { ok: false, reason: '日期无效' };
    var item = { id: genId('exp'), name: v.value, createdAt: date, stoppedAt: null };
    this.data.expenseItems.push(item);
    this.persist();
    return { ok: true, item: item };
  };

  /** 编辑支出项目名称 */
  Store.prototype.renameExpenseItem = function (id, name) {
    var item = this.getExpenseItem(id);
    if (!item) return { ok: false, reason: '支出项目不存在' };
    var v = validateName(name);
    if (!v.ok) return v;
    item.name = v.value;
    this.persist();
    return { ok: true, item: item };
  };

  /**
   * 停止支出项目：从停止日次日起不再出现（停止日当天仍出现）。
   */
  Store.prototype.stopExpenseItem = function (id, stopDate) {
    var item = this.getExpenseItem(id);
    if (!item) return { ok: false, reason: '支出项目不存在' };
    if (!D.isValidDate(stopDate)) return { ok: false, reason: '日期无效' };
    if (D.isBefore(stopDate, item.createdAt)) return { ok: false, reason: '停止日期早于创建日' };
    if (item.stoppedAt && D.isBefore(stopDate, item.stoppedAt)) {
      return { ok: false, reason: '该项目已停止' };
    }
    item.stoppedAt = stopDate;
    this.persist();
    return { ok: true, item: item };
  };

  /** 删除支出项目：移除项目及所有历史金额记录 */
  Store.prototype.deleteExpenseItem = function (id) {
    var item = this.getExpenseItem(id);
    if (!item) return { ok: false, reason: '支出项目不存在' };
    this.data.expenseItems = this.data.expenseItems.filter(function (it) { return it.id !== id; });
    this.data.expenseRecords = this.data.expenseRecords.filter(function (r) { return r.itemId !== id; });
    this.persist();
    return { ok: true };
  };

  /* ============ 记账 · 支出金额记录 ============ */

  Store.prototype.getExpenseRecord = function (itemId, date) {
    return this.data.expenseRecords.find(function (r) { return r.itemId === itemId && r.date === date; }) || null;
  };

  /** 某日全部支出记录（按项目创建时间排序） */
  Store.prototype.getExpenseRecordsForDate = function (date) {
    var self = this;
    return this.data.expenseRecords.filter(function (r) { return r.date === date; }).sort(function (a, b) {
      var ia = self.getExpenseItem(a.itemId);
      var ib = self.getExpenseItem(b.itemId);
      var ca = ia ? ia.createdAt : '';
      var cb = ib ? ib.createdAt : '';
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
  };

  /**
   * 填写/修改/清空某支出项目在某天的金额。
   * amount 为 null 或空串 → 清空（删除该日记录）；数字须为非负、最多两位小数。
   */
  Store.prototype.setExpenseAmount = function (itemId, date, amount) {
    var item = this.getExpenseItem(itemId);
    if (!item) return { ok: false, reason: '支出项目不存在' };
    if (!D.isValidDate(date)) return { ok: false, reason: '日期无效' };
    // 仅允许填写项目生效日期内的金额
    if (D.isBefore(date, item.createdAt)) return { ok: false, reason: '项目创建日前不可填写' };
    if (item.stoppedAt && D.isAfter(date, item.stoppedAt)) return { ok: false, reason: '项目已停止' };

    var num = D.parseAmount(amount);
    if (num === null && amount !== null && amount !== undefined && String(amount).trim() !== '') {
      return { ok: false, reason: 'invalidAmount' };
    }
    var idx = this.data.expenseRecords.findIndex(function (r) { return r.itemId === itemId && r.date === date; });
    if (num === null) {
      if (idx >= 0) {
        this.data.expenseRecords.splice(idx, 1);
        this.persist();
      }
      return { ok: true, cleared: true };
    }
    if (idx >= 0) {
      this.data.expenseRecords[idx].amount = num;
    } else {
      this.data.expenseRecords.push({ itemId: itemId, date: date, amount: num });
    }
    this.persist();
    return { ok: true, amount: num };
  };

  /* ============ 记账 · 收入记录 ============ */

  /** 某日收入记录 */
  Store.prototype.getIncomesForDate = function (date) {
    return this.data.incomeRecords.filter(function (r) { return r.date === date; });
  };

  /** 全部收入（按日期倒序） */
  Store.prototype.listIncomes = function () {
    return this.data.incomeRecords.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
  };

  Store.prototype.getIncome = function (id) {
    return this.data.incomeRecords.find(function (r) { return r.id === id; }) || null;
  };

  /** 记一笔收入：仅出现在录入当天 */
  Store.prototype.addIncome = function (name, amount, date) {
    var v = validateName(name);
    if (!v.ok) return v;
    if (!D.isValidDate(date)) return { ok: false, reason: '日期无效' };
    var num = D.parseAmount(amount);
    if (num === null) return { ok: false, reason: 'invalidAmount' };
    var rec = { id: genId('inc'), name: v.value, date: date, amount: num };
    this.data.incomeRecords.push(rec);
    this.persist();
    return { ok: true, record: rec };
  };

  /** 编辑收入：可改名称/金额/日期 */
  Store.prototype.updateIncome = function (id, patch) {
    var rec = this.getIncome(id);
    if (!rec) return { ok: false, reason: '收入记录不存在' };
    patch = patch || {};
    if (patch.name !== undefined) {
      var v = validateName(patch.name);
      if (!v.ok) return v;
      rec.name = v.value;
    }
    if (patch.date !== undefined) {
      if (!D.isValidDate(patch.date)) return { ok: false, reason: '日期无效' };
      rec.date = patch.date;
    }
    if (patch.amount !== undefined) {
      var num = D.parseAmount(patch.amount);
      if (num === null) return { ok: false, reason: 'invalidAmount' };
      rec.amount = num;
    }
    this.persist();
    return { ok: true, record: rec };
  };

  /** 删除某天的某笔收入 */
  Store.prototype.deleteIncome = function (id) {
    var rec = this.getIncome(id);
    if (!rec) return { ok: false, reason: '收入记录不存在' };
    this.data.incomeRecords = this.data.incomeRecords.filter(function (r) { return r.id !== id; });
    this.persist();
    return { ok: true };
  };

  /* ============ 记账 · 当日小结 ============ */

  /**
   * 某日汇总：该日应出现的支出项目及金额（空为未填）、该日收入、合计与结余。
   * 结余 = 总收入 − 总支出；留空不计入支出。
   */
  Store.prototype.dailySummary = function (date) {
    var self = this;
    var items = this.getExpenseItemsForDate(date);
    var rows = items.map(function (it) {
      var rec = self.getExpenseRecord(it.id, date);
      return { item: it, amount: rec ? rec.amount : null };
    });
    var incomes = this.getIncomesForDate(date);
    var totalExpense = rows.reduce(function (sum, r) {
      return sum + (typeof r.amount === 'number' ? r.amount : 0);
    }, 0);
    var totalIncome = incomes.reduce(function (sum, r) { return sum + r.amount; }, 0);
    return {
      date: date,
      expenseRows: rows,
      incomes: incomes,
      totalExpense: totalExpense,
      totalIncome: totalIncome,
      balance: totalIncome - totalExpense
    };
  };

  return Store;
});
