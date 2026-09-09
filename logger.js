// 日志接收服务器（验收用）：把 query/body 原样打到 stdout，便于后台任务读取
const http = require('http');
const port = Number(process.argv[2] || 8138);
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const line = (req.method + ' ' + req.url + (body ? ' BODY:' + body : '')).slice(0, 30000);
    console.log('[RECV] ' + line);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ok');
  });
}).listen(port, () => {
  console.log('log server on ' + port);
});
