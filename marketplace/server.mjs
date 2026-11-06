import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const digest = value => createHash('sha256').update(value).digest();

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function money(units) {
  const fraction = (units % 1_000_000n).toString().padStart(6, '0');
  return units / 1_000_000n + '.' + fraction.replace(/0{1,4}$/, '') + ' USDT';
}

function page(response, status, title, body) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  response.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title><main><h1>' + title + '</h1>' + body + '</main></html>');
}

export function createMarketplace({ database, password, products }) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('MARKETPLACE_PASSWORD must contain at least 16 characters');
  }
  const credentials = digest('Basic ' + Buffer.from('merchant:' + password).toString('base64'));
  const catalog = new Map();
  for (const product of products) {
    if (typeof product.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(product.id) ||
        catalog.has(product.id) || typeof product.name !== 'string' || !product.name.trim() ||
        typeof product.price !== 'string' || !/^\d{1,12}(\.\d{1,6})?$/.test(product.price)) {
      throw new Error('Invalid marketplace catalog entry');
    }
    const [whole, fraction = ''] = product.price.split('.');
    const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
    if (units === 0n) throw new Error('Catalog prices must be positive');
    catalog.set(product.id, { ...product, units });
  }
  const db = new DatabaseSync(database);
  db.exec('CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, total TEXT NOT NULL, lines TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO orders (id, created_at, total, lines) VALUES (?, ?, ?, ?)');
  const history = db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC');
  const findOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
  const server = createServer(async (request, response) => {
    try {
      const path = request.url.split('?', 1)[0];
      if (path.startsWith('/admin/') && !timingSafeEqual(digest(request.headers.authorization ?? ''), credentials)) {
        response.setHeader('WWW-Authenticate', 'Basic realm="Marketplace", charset="UTF-8"');
        return page(response, 401, 'Merchant login required', '');
      }
      if (request.method === 'GET' && path === '/') {
        const fields = [...catalog.values()].map(product =>
          '<p><label>' + escape(product.name) + ' · ' + money(product.units) +
          ' <input name="' + product.id + '" inputmode="numeric" pattern="[0-9]{1,2}" maxlength="2" value="0" required></label></p>'
        ).join('');
        return page(response, 200, 'Marketplace', '<form action="/orders" method="post">' +
          fields + '<button>Create order</button></form><p><a href="/admin/orders">Merchant order history</a></p>');
      }
      if (request.method === 'POST' && path === '/orders') {
        if (request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
          return page(response, 415, 'Unsupported form', '<a href="/">Back to catalog</a>');
        }
        const body = await readBody(request);
        if (!body) {
          response.setHeader('Connection', 'close');
          return page(response, 413, 'Cart too large', '<a href="/">Back to catalog</a>');
        }
        const form = new URLSearchParams(body.toString('utf8'));
        const lines = [];
        let total = 0n;
        for (const product of catalog.values()) {
          const quantities = form.getAll(product.id);
          if (quantities.length === 0) continue;
          const [quantity] = quantities;
          if (quantities.length !== 1 || !/^\d{1,2}$/.test(quantity)) {
            return page(response, 400, 'Invalid quantity', '<a href="/">Back to catalog</a>');
          }
          if (Number(quantity) === 0) continue;
          lines.push({ id: product.id, name: product.name, quantity: Number(quantity), unitPrice: product.units.toString() });
          total += product.units * BigInt(quantity);
        }
        if (lines.length === 0) return page(response, 400, 'Cart is empty', '<a href="/">Back to catalog</a>');
        const id = randomUUID();
        insert.run(id, new Date().toISOString(), total.toString(), JSON.stringify(lines));
        console.info('[marketplace] order created', id);
        response.writeHead(303, { Location: '/orders/' + id, 'Cache-Control': 'no-store' });
        return response.end();
      }
      const orderPath = /^\/orders\/([a-f0-9-]{36})$/.exec(path);
      if (request.method === 'GET' && orderPath) {
        const [, id] = orderPath;
        const order = findOrder.get(id);
        if (order) return page(response, 200, 'Order recorded', '<p>' + id + ' · ' +
          money(BigInt(order.total)) + ' · Awaiting payment</p><a href="/">Back to catalog</a>');
      }
      if (request.method === 'GET' && path === '/admin/orders') {
        const orders = history.all().map(order => '<li><p>' + escape(order.created_at) + ' · ' +
          escape(order.id) + ' · ' + money(BigInt(order.total)) + ' · Awaiting payment</p><ul>' +
          JSON.parse(order.lines).map(line => '<li>' + line.quantity + ' × ' + escape(line.name) +
            ' · ' + money(BigInt(line.unitPrice)) + '</li>').join('') + '</ul></li>').join('');
        return page(response, 200, 'Order history', orders ? '<ol>' + orders + '</ol>' : '<p>No orders yet.</p>');
      }
      return page(response, 404, 'Page not found', '<a href="/">Back to catalog</a>');
    } catch (error) {
      console.error('[marketplace] request failed', error);
      if (!response.headersSent) page(response, 500, 'Marketplace error', '');
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (import.meta.main) {
  const products = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
  const database = new URL('./orders.sqlite', import.meta.url);
  createMarketplace({ database, password: process.env.MARKETPLACE_PASSWORD, products })
    .listen(5174, '127.0.0.1', () => console.info('[marketplace] http://127.0.0.1:5174'));
}
