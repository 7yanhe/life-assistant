/**
 * ui.js —— 通用 UI 组件（UMD，依赖 DOM）
 * HTML 转义、金额格式化、模态框（确认/多字段输入）、轻提示 toast。
 * 浏览器中挂载为 LifeApp.UI；Node 测试中通过 require + jsdom 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeApp = root.LifeApp || {};
    root.LifeApp.UI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // document 可注入：浏览器默认取全局，Node 测试/应用启动时通过 _setDoc 指定
  var currentDoc = typeof document !== 'undefined' ? document : null;

  function _setDoc(d) { currentDoc = d; }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** ¥45.00 */
  function formatMoney(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return '¥' + v.toFixed(2);
  }

  /** +¥8000.00 / -¥45.00（带符号，符号在 ¥ 前） */
  function formatMoneySigned(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return (v < 0 ? '-' : '+') + '¥' + Math.abs(v).toFixed(2);
  }

  /** 百分比显示：49.33% */
  function formatPercent(n) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toFixed(2) + '%';
  }

  /**
   * 模态框：返回 Promise<actionValue | null>（null = 关闭/ESC）
   * @param opts { title, body: HTMLElement|null, actions: [{text, value, primary?}] }
   */
  function showModal(opts) {
    if (!currentDoc) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var overlay = currentDoc.createElement('div');
      overlay.className = 'modal-overlay';
      var box = currentDoc.createElement('div');
      box.className = 'modal-box';
      var title = currentDoc.createElement('div');
      title.className = 'modal-title';
      title.textContent = opts.title || '';
      box.appendChild(title);
      if (opts.body) {
        var body = currentDoc.createElement('div');
        body.className = 'modal-body';
        body.appendChild(opts.body);
        box.appendChild(body);
      }
      var foot = currentDoc.createElement('div');
      foot.className = 'modal-foot';
      var actions = opts.actions && opts.actions.length ? opts.actions : [{ text: '确定', value: true, primary: true }];
      actions.forEach(function (a) {
        var btn = currentDoc.createElement('button');
        btn.type = 'button';
        btn.textContent = a.text;
        btn.className = a.primary ? 'btn btn-primary' : 'btn';
        btn.addEventListener('click', function () { cleanup(); resolve(a.value); });
        foot.appendChild(btn);
      });
      box.appendChild(foot);
      overlay.appendChild(box);
      currentDoc.body.appendChild(overlay);
      var done = false;
      function cleanup() {
        if (done) return;
        done = true;
        overlay.remove();
        currentDoc.removeEventListener('keydown', onKey, true);
      }
      function onKey(e) {
        if (e.key === 'Escape') { cleanup(); resolve(null); }
      }
      currentDoc.addEventListener('keydown', onKey, true);
    });
  }

  /** 确认框：返回 Promise<boolean> */
  function confirm(message, okText) {
    if (!currentDoc) return Promise.resolve(false);
    var p = currentDoc.createElement('p');
    p.textContent = message;
    return showModal({
      title: '确认操作',
      body: p,
      actions: [
        { text: '取消', value: false },
        { text: okText || '确定', value: true, primary: true }
      ]
    }).then(function (v) { return v === true; });
  }

  /** 单字段输入框：返回 Promise<string|null>（null = 取消） */
  function promptText(message, initial, placeholder) {
    if (!currentDoc) return Promise.resolve(null);
    var input = currentDoc.createElement('input');
    input.type = 'text';
    input.className = 'text-input';
    input.value = initial || '';
    input.placeholder = placeholder || '';
    var wrap = currentDoc.createElement('div');
    wrap.className = 'prompt-wrap';
    var label = currentDoc.createElement('div');
    label.textContent = message;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return showModal({
      title: '输入',
      body: wrap,
      actions: [
        { text: '取消', value: null },
        { text: '确定', value: input, primary: true }
      ]
    }).then(function (v) {
      if (v === null || v === undefined) return null;
      return v.value;
    });
  }

  /**
   * 多字段输入框：返回 Promise<{values: string[]} | null>
   * @param fields [{label, value?, placeholder?, type?}]
   */
  function promptFields(title, fields) {
    if (!currentDoc) return Promise.resolve(null);
    var wrap = currentDoc.createElement('div');
    wrap.className = 'prompt-wrap';
    var inputs = [];
    fields.forEach(function (f) {
      var label = currentDoc.createElement('div');
      label.className = 'field-label';
      label.textContent = f.label;
      var input = currentDoc.createElement('input');
      input.type = f.type || 'text';
      input.className = 'text-input';
      input.value = f.value || '';
      input.placeholder = f.placeholder || '';
      wrap.appendChild(label);
      wrap.appendChild(input);
      inputs.push(input);
    });
    return showModal({
      title: title || '输入',
      body: wrap,
      actions: [
        { text: '取消', value: null },
        { text: '确定', value: inputs, primary: true }
      ]
    }).then(function (v) {
      if (!v) return null;
      return { values: v.map(function (i) { return i.value; }) };
    });
  }

  /** 轻提示 */
  function toast(message, type) {
    if (!currentDoc) return;
    var t = currentDoc.createElement('div');
    t.className = 'toast' + (type ? ' toast-' + type : '');
    t.textContent = message;
    currentDoc.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  return {
    escapeHtml: escapeHtml,
    formatMoney: formatMoney,
    formatMoneySigned: formatMoneySigned,
    formatPercent: formatPercent,
    showModal: showModal,
    confirm: confirm,
    promptText: promptText,
    promptFields: promptFields,
    toast: toast,
    _setDoc: _setDoc
  };
});

