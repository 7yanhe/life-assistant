const { test } = require('node:test');
const assert = require('node:assert');
require('./_setup.js');

const UI = require('../js/ui.js');

test('escapeHtml：转义特殊字符', () => {
  assert.strictEqual(UI.escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  assert.strictEqual(UI.escapeHtml(null), '');
  assert.strictEqual(UI.escapeHtml('普通文本'), '普通文本');
});

test('formatMoney / formatMoneySigned / formatPercent', () => {
  assert.strictEqual(UI.formatMoney(45), '¥45.00');
  assert.strictEqual(UI.formatMoney(8000), '¥8000.00');
  assert.strictEqual(UI.formatMoney(-45), '¥-45.00');
  assert.strictEqual(UI.formatMoney(null), '¥0.00');
  assert.strictEqual(UI.formatMoneySigned(8000), '+¥8000.00');
  assert.strictEqual(UI.formatMoneySigned(-45), '-¥45.00');
  assert.strictEqual(UI.formatMoneySigned(0), '+¥0.00');
  assert.strictEqual(UI.formatPercent(49.333), '49.33%');
});

test('confirm：确定返回 true，取消返回 false', async () => {
  // 触发后弹窗出现在 body，点击「确定」
  const p = UI.confirm('确定删除吗？', '删除');
  const overlay = document.querySelector('.modal-overlay');
  assert.ok(overlay, '弹窗应出现');
  const buttons = overlay.querySelectorAll('.modal-foot button');
  assert.strictEqual(buttons.length, 2);
  assert.strictEqual(buttons[0].textContent, '取消');
  assert.strictEqual(buttons[1].textContent, '删除');
  buttons[1].click();
  const result = await p;
  assert.strictEqual(result, true);
  assert.strictEqual(document.querySelector('.modal-overlay'), null, '弹窗应关闭');
});

test('confirm：取消返回 false', async () => {
  const p = UI.confirm('确定删除吗？');
  const overlay = document.querySelector('.modal-overlay');
  overlay.querySelectorAll('.modal-foot button')[0].click();
  assert.strictEqual(await p, false);
  assert.strictEqual(document.querySelector('.modal-overlay'), null);
});

test('promptText：输入内容返回字符串，取消返回 null', async () => {
  const p = UI.promptText('计划名称：', '', '名称');
  const input = document.querySelector('.prompt-wrap input');
  input.value = '早起';
  const buttons = document.querySelectorAll('.modal-foot button');
  buttons[1].click();
  assert.strictEqual(await p, '早起');

  const p2 = UI.promptText('计划名称：');
  document.querySelectorAll('.modal-foot button')[0].click();
  assert.strictEqual(await p2, null);
});

test('promptFields：多字段输入', async () => {
  const p = UI.promptFields('编辑收入', [
    { label: '名称', value: '工资' },
    { label: '金额', value: '8000' }
  ]);
  const inputs = document.querySelectorAll('.prompt-wrap input');
  assert.strictEqual(inputs.length, 2);
  inputs[1].value = '9000';
  document.querySelectorAll('.modal-foot button')[1].click();
  const res = await p;
  assert.deepStrictEqual(res.values, ['工资', '9000']);
});

test('toast：显示后自动消失', async () => {
  UI.toast('已保存', 'success');
  const t = document.querySelector('.toast');
  assert.ok(t);
  assert.strictEqual(t.textContent, '已保存');
  assert.ok(t.classList.contains('toast-success'));
  await new Promise(r => setTimeout(r, 2800));
  assert.strictEqual(document.querySelector('.toast'), null, 'toast 应自动消失');
});
