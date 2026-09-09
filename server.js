// 极简静态服务器：用于本地验收（应用本身不依赖网络，服务器只是浏览器打开方式之一）
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || '.';
const port = Number(process.argv[3] || 8137);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  fs.readFile(f, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + p);
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(f)] || 'application/octet-stream',
      // 本地开发/验收：禁用缓存，避免浏览器复用旧版 JS/CSS
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(port, () => {
  console.log('serving ' + root + ' at http://localhost:' + port);
});
