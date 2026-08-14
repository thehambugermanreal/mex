import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 10000);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function safePath(requestUrl) {
  const requestPath = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const candidate = path.normalize(path.join(dist, requestPath));
  return candidate.startsWith(dist) ? candidate : null;
}

const app = http.createServer((request, response) => {
  const requested = safePath(request.url || '/');
  const filePath = requested && fs.existsSync(requested) && fs.statSync(requested).isFile()
    ? requested
    : path.join(dist, 'index.html');

  if (!fs.existsSync(filePath)) {
    response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('The frontend has not been built yet.');
    return;
  }

  response.writeHead(200, {
    'cache-control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    'content-type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(response);
});

app.on('upgrade', (request, socket, head) => {
  wisp.routeRequest(request, socket, head);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`mex listening on ${port}`);
});
