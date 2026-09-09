/**
 * dateutil.js —— 日期工具模块（UMD）
 * 提供：日期解析/校验、格式化、加减、周/月/季/年周期、月历网格、金额校验。
 * 浏览器中挂载为 LifeApp.DateUtil；Node 测试中通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.DateUtil = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // 测试钩子：可替换“今天”的取值来源
  var nowFn = function () { return new Date(); };

  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * 解析 "YYYY-MM-DD" 为本地当天 00:00 的 Date；非法返回 null。
   * 会严格校验实际日期（如 2026-02-30 视为非法）。
   */
  function parseDate(dateStr) {
    if (typeof dateStr !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  function isValidDate(dateStr) { return parseDate(dateStr) !== null; }

  function toDateStr(dt) {
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }

  /** 当前日期（可被 _setNow 替换，便于测试与固定“今日”） */
  function today() { return toDateStr(nowFn()); }

  function _setNow(fn) {
    if (typeof fn === 'function') nowFn = fn;
    else nowFn = function () { return new Date(); };
  }

  /** 日期加减 n 天，返回新日期串；非法输入返回 null */
  function addDays(dateStr, n) {
    var dt = parseDate(dateStr);
    if (!dt) return null;
    dt.setDate(dt.getDate() + n);
    return toDateStr(dt);
  }

  /** 中文长格式：2026年9月9日 */
  function formatCN(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return '';
    return dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
  }

  /** 中文月格式：2026年9月 */
  function formatMonthCN(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return '';
    return dt.getFullYear() + '年' + (dt.getMonth() + 1) + '月';
  }

  /** 中文星期：星期三 */
  function weekdayCN(dateStr) {
    var dt = parseDate(dateStr);
    return dt ? WEEKDAYS[dt.getDay()] : '';
  }

  /** 字符串日期比较（YYYY-MM-DD 字典序即时间序） */
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  function isAfter(a, b) { return compare(a, b) > 0; }
  function isBefore(a, b) { return compare(a, b) < 0; }
  function isSameOrBefore(a, b) { return compare(a, b) <= 0; }
  function isSameOrAfter(a, b) { return compare(a, b) >= 0; }

  /** 本周范围（周一到周日） */
  function getWeekRange(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return null;
    var dow = dt.getDay(); // 0=日
    var offsetToMonday = dow === 0 ? -6 : 1 - dow;
    var start = addDays(dateStr, offsetToMonday);
    return { start: start, end: addDays(start, 6) };
  }

  /** 本月范围 */
  function getMonthRange(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return null;
    var y = dt.getFullYear(), mo = dt.getMonth();
    return {
      start: toDateStr(new Date(y, mo, 1)),
      end: toDateStr(new Date(y, mo + 1, 0))
    };
  }

  /** 本季范围（1-3 / 4-6 / 7-9 / 10-12 月） */
  function getQuarterRange(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return null;
    var y = dt.getFullYear();
    var q = Math.floor(dt.getMonth() / 3);
    return {
      start: toDateStr(new Date(y, q * 3, 1)),
      end: toDateStr(new Date(y, q * 3 + 3, 0))
    };
  }

  /** 本年范围 */
  function getYearRange(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return null;
    return { start: dt.getFullYear() + '-01-01', end: dt.getFullYear() + '-12-31' };
  }

  /** 统一周期范围入口：week / month / quarter / year */
  function getPeriodRange(period, dateStr) {
    switch (period) {
      case 'week': return getWeekRange(dateStr);
      case 'month': return getMonthRange(dateStr);
      case 'quarter': return getQuarterRange(dateStr);
      case 'year': return getYearRange(dateStr);
      default: throw new Error('未知统计周期: ' + period);
    }
  }

  /** 周期中文标签：2026年9月7日 ~ 2026年9月13日 */
  function periodLabelCN(range) {
    if (!range) return '';
    return formatCN(range.start) + ' ~ ' + formatCN(range.end);
  }

  /**
   * 生成某月的月历网格（周一开头，最多 6 行）。
   * 每格：{ date: "YYYY-MM-DD", inMonth: boolean }
   */
  function buildMonthCalendar(dateStr) {
    var dt = parseDate(dateStr);
    if (!dt) return [];
    var y = dt.getFullYear(), mo = dt.getMonth();
    var first = new Date(y, mo, 1);
    var startDow = first.getDay();
    var lead = startDow === 0 ? 6 : startDow - 1; // 周一开头的前置天数
    var gridStart = new Date(y, mo, 1 - lead);
    var weeks = [];
    var cur = new Date(gridStart);
    var monthEnd = new Date(y, mo + 1, 0);
    while (weeks.length < 6) {
      var week = [];
      for (var i = 0; i < 7; i++) {
        week.push({ date: toDateStr(cur), inMonth: cur.getMonth() === mo });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
      // 已越过月末且下一行整行都在下月时提前结束
      if (cur.getTime() > monthEnd.getTime() && cur.getMonth() !== mo) break;
    }
    return weeks;
  }

  /**
   * 金额输入校验：允许非负数字，最多两位小数。
   * 返回数字；空/null/非法输入返回 null。
   */
  function parseAmount(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).trim();
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var n = Number(s);
    if (!isFinite(n)) return null;
    return n;
  }

  return {
    WEEKDAYS: WEEKDAYS,
    pad2: pad2,
    parseDate: parseDate,
    isValidDate: isValidDate,
    toDateStr: toDateStr,
    today: today,
    _setNow: _setNow,
    addDays: addDays,
    formatCN: formatCN,
    formatMonthCN: formatMonthCN,
    weekdayCN: weekdayCN,
    compare: compare,
    isAfter: isAfter,
    isBefore: isBefore,
    isSameOrBefore: isSameOrBefore,
    isSameOrAfter: isSameOrAfter,
    getWeekRange: getWeekRange,
    getMonthRange: getMonthRange,
    getQuarterRange: getQuarterRange,
    getYearRange: getYearRange,
    getPeriodRange: getPeriodRange,
    periodLabelCN: periodLabelCN,
    buildMonthCalendar: buildMonthCalendar,
    parseAmount: parseAmount
  };
});
