// 测试共享环境：先注入 jsdom 全局，再加载依赖 UI 的模块
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;

module.exports = { dom, window: dom.window, document: dom.window.document };
