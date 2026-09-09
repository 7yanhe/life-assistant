/**
 * backup.js —— 备份与恢复模块（UMD）
 * 导出 JSON 备份、默认文件名、导入校验。
 * 浏览器中挂载为 LifeApp.Backup；Node 测试中通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./storage.js'));
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.Backup = factory(root.LifeApp.Storage);
  }
})(typeof self !== 'undefined' ? self : this, function (Storage) {
  'use strict';

  var COLLECTIONS = ['plans', 'checkRecords', 'expenseItems', 'expenseRecords', 'incomeRecords'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * 默认备份文件名：生活助手备份_YYYYMMDD_HHmmss.json
   * @param now Date 对象（可注入以便测试），默认当前时间
   */
  function defaultFileName(now) {
    var d = now instanceof Date ? now : new Date();
    var stamp =
      d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '_' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    return '生活助手备份_' + stamp + '.json';
  }

  /** 序列化为 JSON 字符串（含全部数据集合与 meta） */
  function serialize(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * 解析并校验备份文本。
   * 成功 → { ok:true, data: 规范化后的完整数据 }
   * 失败 → { ok:false, reason: 错误原因 }（绝不返回部分数据）
   */
  function parseBackup(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: '文件不是有效的 JSON' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: '备份文件结构无效' };
    }
    for (var i = 0; i < COLLECTIONS.length; i++) {
      var key = COLLECTIONS[i];
      if (!Array.isArray(parsed[key])) {
        return { ok: false, reason: '缺少必要字段：' + key };
      }
    }
    if (!parsed.meta || typeof parsed.meta !== 'object' || Array.isArray(parsed.meta)) {
      return { ok: false, reason: '缺少必要字段：meta' };
    }
    return { ok: true, data: Storage.normalizeData(parsed) };
  }

  return {
    COLLECTIONS: COLLECTIONS,
    defaultFileName: defaultFileName,
    serialize: serialize,
    parseBackup: parseBackup
  };
});
