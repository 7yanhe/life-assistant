const { test } = require('node:test');
const assert = require('node:assert');
const S = require('../js/storage.js');
const { indexedDB: fakeIndexedDB } = require('fake-indexeddb');

test('createDefaultData：PRD 7.2 数据结构', () => {
  const d = S.createDefaultData();
  assert.deepStrictEqual(Object.keys(d).sort(), [
    'checkRecords', 'expenseItems', 'expenseRecords', 'incomeRecords', 'meta', 'plans'
  ]);
  assert.ok(Array.isArray(d.plans));
  assert.ok(Array.isArray(d.checkRecords));
  assert.ok(Array.isArray(d.expenseItems));
  assert.ok(Array.isArray(d.expenseRecords));
  assert.ok(Array.isArray(d.incomeRecords));
  assert.strictEqual(d.meta.version, '1.0');
  assert.ok(typeof d.meta.lastModified === 'string' && d.meta.lastModified.length > 0);
});

test('normalizeData：缺失集合补默认，脏数据修正', () => {
  const n = S.normalizeData(null);
  assert.deepStrictEqual(n, S.createDefaultData());
  const n2 = S.normalizeData({});
  assert.deepStrictEqual(n2.plans, []);
  assert.strictEqual(n2.meta.version, '1.0');
  // 金额修正
  const n3 = S.normalizeData({
    expenseRecords: [{ itemId: 'i1', date: '2026-09-09', amount: '12' }],
    incomeRecords: [{ id: 'r1', name: '工资', date: '2026-09-05', amount: '8000' }]
  });
  assert.strictEqual(n3.expenseRecords[0].amount, null); // 非数字 → null
  assert.strictEqual(n3.incomeRecords[0].amount, 0);     // 非数字 → 0
  assert.strictEqual(n3.incomeRecords[0].name, '工资');
});

test('memoryAdapter：保存/读取往返 + 深拷贝隔离', async () => {
  const ad = S.memoryAdapter();
  assert.strictEqual(await ad.load(), null); // 初始为空
  const data = { plans: [{ id: 'p1', name: '早起' }], checkRecords: [], expenseItems: [], expenseRecords: [], incomeRecords: [], meta: { version: '1.0' } };
  await ad.save(data);
  // 修改原对象不应影响已存数据
  data.plans[0].name = '被改';
  const loaded = await ad.load();
  assert.strictEqual(loaded.plans[0].name, '早起');
  // 修改读取结果不应影响存储
  loaded.plans.push({ id: 'p2' });
  const loaded2 = await ad.load();
  assert.strictEqual(loaded2.plans.length, 1);
});

test('localStorageAdapter：使用注入的 storage 往返', async () => {
  const fake = new Map();
  const storage = {
    getItem: (k) => (fake.has(k) ? fake.get(k) : null),
    setItem: (k, v) => fake.set(k, String(v)),
    removeItem: (k) => fake.delete(k)
  };
  const ad = S.localStorageAdapter({ storage, key: 'testKey' });
  assert.strictEqual(await ad.load(), null);
  const data = S.createDefaultData();
  data.plans.push({ id: 'p1', name: '阅读' });
  await ad.save(data);
  const loaded = await ad.load();
  assert.strictEqual(loaded.plans[0].name, '阅读');
  // 写入的是 JSON 字符串
  assert.ok(typeof fake.get('testKey') === 'string');
  assert.strictEqual(JSON.parse(fake.get('testKey')).plans[0].id, 'p1');
});

test('indexedDBAdapter：使用 fake-indexeddb 往返 + 跨实例持久', async () => {
  const opts = { indexedDB: fakeIndexedDB, dbName: 'test-life-app' };
  const ad1 = S.indexedDBAdapter(opts);
  assert.strictEqual(await ad1.load(), null);
  const data = S.createDefaultData();
  data.plans.push({ id: 'p1', name: '运动' });
  data.expenseItems.push({ id: 'e1', name: '早餐', createdAt: '2026-09-05' });
  await ad1.save(data);
  // 新实例（同一底层库）仍能读到
  const ad2 = S.indexedDBAdapter(opts);
  const loaded = await ad2.load();
  assert.strictEqual(loaded.plans[0].name, '运动');
  assert.strictEqual(loaded.expenseItems[0].name, '早餐');
  // 再次保存覆盖
  data.plans[0].name = '运动2';
  await ad2.save(data);
  const loaded2 = await ad1.load();
  assert.strictEqual(loaded2.plans[0].name, '运动2');
});

test('pickBrowserAdapter：无 window 时不可直接调用（需自行选适配器）', () => {
  // 该函数仅在浏览器环境调用；Node 环境验证逻辑存在即可
  assert.strictEqual(typeof S.pickBrowserAdapter, 'function');
});
