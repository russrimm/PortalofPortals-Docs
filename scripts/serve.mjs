import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer from 0 through 65535. Use --port 0 for a free port.');
await stat(path.join(root, 'index.html')).catch(error => {
  if (error.code === 'ENOENT') throw new Error('No built site found. Run npm run build first.');
  throw error;
});
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.avif': 'image/avif',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8'
};
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Read-only documentation server.');
    return;
  }
  let requested;
  try { requested = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end('Invalid URL'); return; }
  if (requested.includes('\\') || requested.includes('\0') || requested.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(400); response.end('Invalid path'); return;
  }
  const target = path.resolve(root, `.${requested === '/' ? '/index.html' : requested}`);
  if (!target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403); response.end('Access denied'); return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'text/plain; charset=utf-8', 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      const body = await readFile(path.join(root, '404.html'));
      response.writeHead(404, { 'Content-Type': types['.html'] });
      response.end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    console.error(`Read failed for ${requested}: ${error.message}`);
    response.writeHead(500); response.end('Could not read the built page.');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Run npm run preview -- --port 0 for an available port.`
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Portal 360 docs: http://127.0.0.1:${server.address().port}`);
  console.log('Static snapshot only. Press Ctrl+C to stop.');
});
