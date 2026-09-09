const { JSDOM, VirtualConsole } = require('jsdom');

const vc = new VirtualConsole();
vc.on('error', (...args) => console.log('[console.error]', args.map(String).join(' ')));
vc.on('jsdomError', (e) => console.log('[jsdomError]', e.message, e.detail ? String(e.detail) : ''));

(async () => {
  const dom = await JSDOM.fromURL('http://localhost:8137/', {
    resources: 'usable',
    runScripts: 'dangerously',
    virtualConsole: vc,
    pretendToBeVisual: false
  });
  const win = dom.window;
  const doc = win.document;
  setTimeout(() => {
    console.log('LifeApp keys:', win.LifeApp ? Object.keys(win.LifeApp).join(', ') : 'NO LifeApp');
    console.log('#app html length:', doc.getElementById('app').innerHTML.length);
    console.log('#app head:', doc.getElementById('app').innerHTML.slice(0, 80));
  }, 800);
})();
