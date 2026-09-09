/**
 * storage.js —— 本地存储层（UMD）
 * 提供三种适配器：IndexedDB（浏览器首选）、localStorage（降级）、内存（测试）。
 * 浏览器中挂载为 LifeApp.Storage；Node 测试中通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Storage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DB_NAME = 'life-app-db';
  var DB_STORE = 'data';
  var DB_KEY = 'main';
  var LS_KEY = 'lifeAppData';

  /**
   * 按 PRD 7.2 生成空数据结构
   */
  function createDefaultData() {
    return {
      plans: [],
      checkRecords: [],
      expenseItems: [],
      expenseRecords: [],
      incomeRecords: [],
      meta: {
        version: '1.0',
        lastModified: new Date().toISOString()
      }
    };
  }

  /**
   * 数据规范化：保证集合字段存在且为数组、meta 存在；全部深拷贝，
   * 避免外部对象（如导入的备份数据）与内部数据共享引用。
   * 用于加载本地数据与导入备份时兜底。
   */
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeData(raw) {
    var base = createDefaultData();
    if (!raw || typeof raw !== 'object') return base;
    var out = {
      plans: Array.isArray(raw.plans) ? clone(raw.plans) : [],
      checkRecords: Array.isArray(raw.checkRecords) ? clone(raw.checkRecords) : [],
      expenseItems: Array.isArray(raw.expenseItems) ? clone(raw.expenseItems) : [],
      expenseRecords: Array.isArray(raw.expenseRecords) ? clone(raw.expenseRecords) : [],
      incomeRecords: Array.isArray(raw.incomeRecords) ? clone(raw.incomeRecords) : [],
      meta: raw.meta && typeof raw.meta === 'object' ? clone(raw.meta) : { version: '1.0' }
    };
    if (!out.meta.version) out.meta.version = '1.0';
    if (!out.meta.lastModified) out.meta.lastModified = base.meta.lastModified;
    // 金额字段强制为数字，避免脏数据
    out.expenseRecords = out.expenseRecords.map(function (r) {
      var c = { itemId: r.itemId, date: r.date };
      c.amount = typeof r.amount === 'number' ? r.amount : null;
      return c;
    });
    out.incomeRecords = out.incomeRecords.map(function (r) {
      return {
        id: r.id,
        name: String(r.name == null ? '' : r.name),
        date: r.date,
        amount: typeof r.amount === 'number' ? r.amount : 0
      };
    });
    return out;
  }

  /**
   * 内存适配器（测试用）：save/load 均为深拷贝，互不影响。
   */
  function memoryAdapter(initial) {
    var data = initial ? JSON.parse(JSON.stringify(initial)) : null;
    return {
      kind: 'memory',
      load: function () {
        return Promise.resolve(data ? JSON.parse(JSON.stringify(data)) : null);
      },
      save: function (d) {
        data = JSON.parse(JSON.stringify(d));
        return Promise.resolve();
      },
      _peek: function () { return data; }
    };
  }

  /**
   * localStorage 适配器（浏览器降级 / 可注入 storage 便于测试）
   */
  function localStorageAdapter(opts) {
    opts = opts || {};
    var store = opts.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    var key = opts.key || LS_KEY;
    if (!store) throw new Error('localStorage 不可用');
    return {
      kind: 'localStorage',
      load: function () {
        return Promise.resolve().then(function () {
          var raw = store.getItem(key);
          if (!raw) return null;
          return JSON.parse(raw);
        });
      },
      save: function (data) {
        return Promise.resolve().then(function () {
          store.setItem(key, JSON.stringify(data));
        });
      }
    };
  }

  /**
   * IndexedDB 适配器（浏览器首选；可注入 indexedDB 工厂便于测试）
   * 单库单表单键：存整个数据对象。
   */
  function indexedDBAdapter(opts) {
    opts = opts || {};
    var idb = opts.indexedDB ||
      (typeof window !== 'undefined' ? (window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB) : null);
    if (!idb) throw new Error('IndexedDB 不可用');
    var dbName = opts.dbName || DB_NAME;
    var dbPromise = null;

    function open() {
      if (!dbPromise) {
        dbPromise = new Promise(function (resolve, reject) {
          var req = idb.open(dbName, 1);
          req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(DB_STORE)) {
              db.createObjectStore(DB_STORE);
            }
          };
          req.onsuccess = function (e) { resolve(e.target.result); };
          req.onerror = function (e) {
            reject(e.target.error || new Error('IndexedDB 打开失败'));
            dbPromise = null;
          };
        });
      }
      return dbPromise;
    }

    return {
      kind: 'indexedDB',
      load: function () {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction(DB_STORE, 'readonly');
            var req = tx.objectStore(DB_STORE).get(DB_KEY);
            req.onsuccess = function () { resolve(req.result || null); };
            req.onerror = function (e) { reject(e.target.error || new Error('IndexedDB 读取失败')); };
          });
        });
      },
      save: function (data) {
        return open().then(function (db) {
          return new Promise(function (resolve, reject) {
            var tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(data, DB_KEY);
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function (e) { reject(e.target.error || new Error('IndexedDB 写入失败')); };
          });
        });
      }
    };
  }

  /**
   * 浏览器适配器选择：优先 IndexedDB，不可用时降级 localStorage。
   */
  function pickBrowserAdapter() {
    var idbAvailable = typeof window !== 'undefined' &&
      !!(window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB);
    if (idbAvailable) {
      try { return indexedDBAdapter(); } catch (e) { /* fall through */ }
    }
    return localStorageAdapter();
  }

  return {
    DB_NAME: DB_NAME,
    DB_STORE: DB_STORE,
    DB_KEY: DB_KEY,
    LS_KEY: LS_KEY,
    createDefaultData: createDefaultData,
    normalizeData: normalizeData,
    memoryAdapter: memoryAdapter,
    localStorageAdapter: localStorageAdapter,
    indexedDBAdapter: indexedDBAdapter,
    pickBrowserAdapter: pickBrowserAdapter
  };
});
