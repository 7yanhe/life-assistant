const { test } = require('node:test');
const assert = require('node:assert');

test('测试框架冒烟测试：node:test 可运行', () => {
  assert.strictEqual(1 + 1, 2);
});
