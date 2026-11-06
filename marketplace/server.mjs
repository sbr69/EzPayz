import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createCheckout } from './checkout.mjs';
import { verifyPaymentWebhook, verifySettlement } from './settlement.mjs';

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

function orderStatus(order) {
  if (order.fulfilled_at) return 'Fulfilled';
  return order.tx_ref ? 'Paid' : 'Awaiting payment';
}

function money(units) {
  const fraction = (units % 1_000_000n).toString().padStart(6, '0');
  return units / 1_000_000n + '.' + fraction.replace(/0{1,4}$/, '') + ' USDT';
}

function page(response, status, title, body, formOrigin = '') {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'" + formOrigin + "; frame-ancestors 'none'; base-uri 'none'",
  });
  response.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title><main><h1>' + title + '</h1>' + body + '</main></html>');
}

export function createMarketplace({ database, password, products, gateway }) {
  if (typeof password !== 'string' || password.length < 16) {
    throw new Error('MARKETPLACE_PASSWORD must contain at least 16 characters');
  }
  const credentials = digest('Basic ' + Buffer.from('merchant:' + password).toString('base64'));
  const hostedCheckout = gateway ? new URL(gateway.checkoutOrigin) : null;
  if (hostedCheckout && !['http:', 'https:'].includes(hostedCheckout.protocol)) {
    throw new Error('EZPAYZ_CHECKOUT_ORIGIN must use HTTP or HTTPS');
  }
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
  const columns = new Set(db.prepare('PRAGMA table_info(orders)').all().map(column => column.name));
  for (const column of ['payment_id', 'checkout_url', 'tx_ref', 'fulfilled_at']) {
    if (!columns.has(column)) db.exec('ALTER TABLE orders ADD COLUMN ' + column + ' TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_id ON orders(payment_id)');
  const insert = db.prepare('INSERT INTO orders (id, created_at, total, lines) VALUES (?, ?, ?, ?)');
  const history = db.prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC');
  const findOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
  const findPayment = db.prepare('SELECT * FROM orders WHERE payment_id = ?');
  const saveCheckout = db.prepare('UPDATE orders SET payment_id = ?, checkout_url = ? WHERE id = ? AND payment_id IS NULL');
  const markPaid = db.prepare('UPDATE orders SET tx_ref = ? WHERE id = ? AND payment_id = ? AND tx_ref IS NULL');
  const markFulfilled = db.prepare('UPDATE orders SET fulfilled_at = ? WHERE id = ? AND tx_ref IS NOT NULL AND fulfilled_at IS NULL');
  // ponytail: checkout requests share a promise in one process. Use a database claim before running multiple instances.
  const pendingCheckouts = new Map();
  const fulfilToken = id => createHmac('sha256', password).update('fulfil:' + id).digest('hex');

  async function reconcile(order) {
    if (order.tx_ref) return true;
    const txRef = await verifySettlement(gateway, { id: order.id, total: order.total, paymentId: order.payment_id });
    if (!txRef) return false;
    markPaid.run(txRef, order.id, order.payment_id);
    return true;
  }

  const server = createServer(async (request, response) => {
    try {
      const path = request.url.split('?', 1)[0];
      if (path.startsWith('/admin/') && !timingSafeEqual(digest(request.headers.authorization ?? ''), credentials)) {
        response.setHeader('WWW-Authenticate', 'Basic realm="Marketplace", charset="UTF-8"');
        return page(response, 401, 'Merchant login required', '');
      }
      if (request.method === 'POST' && path === '/webhooks/ezpayz' && gateway?.webhookSecret) {
        const event = request.headers['x-whitechain-event'];
        if (event !== 'payment.succeeded') return response.writeHead(204).end();
        const body = await readBody(request);
        if (!body) return response.writeHead(413, { Connection: 'close' }).end();
        const paymentId = verifyPaymentWebhook({
          secret: gateway.webhookSecret, body, signature: request.headers['x-whitechain-signature'], event,
        });
        if (!paymentId) return response.writeHead(401).end();
        const order = findPayment.get(paymentId);
        return response.writeHead(!order || await reconcile(order) ? 204 : 503).end();
      }
      const orderPath = /^\/orders\/([a-f0-9-]{36})(?:\/(checkout|refresh))?$/.exec(path);
      if (gateway && orderPath && request.method === 'POST' && orderPath[2]) {
        const [, id, action] = orderPath;
        const order = findOrder.get(id);
        if (!order) return page(response, 404, 'Order not found', '');
        if (action === 'refresh' || order.tx_ref) {
          if (action === 'refresh' && order.payment_id) await reconcile(order);
          return response.writeHead(303, { Location: '/orders/' + id, 'Cache-Control': 'no-store' }).end();
        }
        let checkoutUrl = order.checkout_url;
        if (!checkoutUrl) {
          if (!pendingCheckouts.has(id)) {
            const checkout = createCheckout(gateway, { id, total: order.total }).then(result => {
              saveCheckout.run(result.paymentId, result.checkoutUrl, id);
              return findOrder.get(id).checkout_url;
            }).finally(() => pendingCheckouts.delete(id));
            pendingCheckouts.set(id, checkout);
          }
          try {
            checkoutUrl = await pendingCheckouts.get(id);
          } catch {
            console.error('[marketplace] EzPayz checkout unavailable', id);
            return page(response, 502, 'Checkout unavailable', '<a href="/orders/' + id + '">Back to order</a>');
          }
        }
        // Earlier marketplace versions stored checkout routes in URL fragments.
        const location = checkoutUrl.replace('/#/real-checkout/', '/real-checkout/');
        return response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }).end();
      }
      const fulfilPath = /^\/admin\/orders\/([a-f0-9-]{36})\/fulfil$/.exec(path);
      if (request.method === 'POST' && fulfilPath) {
        const [, id] = fulfilPath;
        const body = await readBody(request);
        if (!body) return response.writeHead(413, { Connection: 'close' }).end();
        const token = new URLSearchParams(body.toString('utf8')).get('token') ?? '';
        if (!timingSafeEqual(digest(token), digest(fulfilToken(id)))) return response.writeHead(403).end();
        const order = findOrder.get(id);
        if (!order) return page(response, 404, 'Order not found', '');
        if (!order.tx_ref) return page(response, 409, 'Order is awaiting payment', '');
        markFulfilled.run(new Date().toISOString(), id);
        return response.writeHead(303, { Location: '/admin/orders', 'Cache-Control': 'no-store' }).end();
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
      if (request.method === 'GET' && orderPath && !orderPath[2]) {
        const [, id] = orderPath;
        const order = findOrder.get(id);
        if (order) {
          const checkout = gateway && !order.tx_ref
            ? '<form method="post" action="/orders/' + id + '/checkout"><button>Pay with EzPayz</button></form>' +
              (order.payment_id ? '<form method="post" action="/orders/' + id + '/refresh"><button>Check payment status</button></form>' : '')
            : '';
          return page(response, 200, 'Order recorded', '<p>' + id + ' · ' + money(BigInt(order.total)) +
            ' · ' + orderStatus(order) + '</p>' + checkout + '<a href="/">Back to catalog</a>',
          checkout ? ' ' + hostedCheckout.origin : '');
        }
      }
      if (request.method === 'GET' && path === '/admin/orders') {
        const orders = history.all().map(order => '<li><p>' + escape(order.created_at) + ' · ' +
          escape(order.id) + ' · ' + money(BigInt(order.total)) + ' · ' + orderStatus(order) +
          ' · <a href="/orders/' + escape(order.id) + '">View order</a></p><ul>' +
          JSON.parse(order.lines).map(line => '<li>' + line.quantity + ' × ' + escape(line.name) +
            ' · ' + money(BigInt(line.unitPrice)) + '</li>').join('') + '</ul>' +
          (order.tx_ref && !order.fulfilled_at
            ? '<form method="post" action="/admin/orders/' + escape(order.id) + '/fulfil">' +
              '<input type="hidden" name="token" value="' + fulfilToken(order.id) + '"><button>Mark fulfilled</button></form>'
            : '') + '</li>').join('');
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
  const gateway = process.env.EZPAYZ_SECRET_KEY ? {
    apiUrl: process.env.EZPAYZ_API_URL ?? 'http://127.0.0.1:3000',
    checkoutOrigin: process.env.EZPAYZ_CHECKOUT_ORIGIN ?? 'http://127.0.0.1:5173',
    returnOrigin: 'http://127.0.0.1:5174',
    secretKey: process.env.EZPAYZ_SECRET_KEY,
    webhookSecret: process.env.EZPAYZ_WEBHOOK_SECRET,
  } : undefined;
  createMarketplace({ database, password: process.env.MARKETPLACE_PASSWORD, products, gateway })
    .listen(5174, '127.0.0.1', () => console.info('[marketplace] http://127.0.0.1:5174'));
}
