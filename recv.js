// 日志接收服务器（验收用）：把收到的 body 追加写入接收文件
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = Number(process.argv[2] || 8139);
const outFile = path.join(__dirname, 'recv.json');
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (body) fs.writeFileSync(outFile, body, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end('ok');
  });
}).listen(port, () => {
  console.log('recv server on ' + port + ' -> ' + outFile);
});
