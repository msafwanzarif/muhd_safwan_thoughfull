import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.output/public');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    const file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    let target = file === root ? resolve(root, 'index.html') : file;
    let content;
    try {
      content = await readFile(target);
    } catch {
      if (extname(target)) {
        res.writeHead(404);
        res.end();
        return;
      }
      target = resolve(root, 'index.html');
      content = await readFile(target);
    }
    res.setHeader(
      'Content-Type',
      types[extname(target)] ?? 'application/octet-stream',
    );
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end();
  }
}).listen(Number(process.env.PORT ?? 3011), process.env.HOST ?? '127.0.0.1');
