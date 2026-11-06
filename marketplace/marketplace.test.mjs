import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';

test('checkout prices catalog items server-side and persists orders for the merchant', async () => {
  const { createMarketplace } = await import('./server.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'marketplace-'));
  const options = {
    database: join(directory, 'orders.sqlite'),
    password: 'test-password-long-enough',
    products: [
      { id: 'tea', name: 'Tea', price: '2.50' },
      { id: 'cup', name: 'Cup', price: '4.00' },
    ],
  };
  let server;
  async function start() {
    server = createMarketplace(options).listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (!server?.listening) return;
    const closed = once(server, 'close');
    server.close();
    await closed;
  }
  try {
    let url = await start();
    assert.match(await (await fetch(url)).text(), /Tea/);
    const order = await fetch(url + '/orders', {
      method: 'POST',
      body: new URLSearchParams({ tea: '2', cup: '1', total: '0.01' }),
      redirect: 'manual',
    });
    assert.equal(order.status, 303);
    const confirmation = await fetch(url + order.headers.get('location'));
    assert.equal(confirmation.status, 200);
    assert.match(await confirmation.text(), /9\.00 USDT/);
    const invalid = await fetch(url + '/orders', {
      method: 'POST',
      body: new URLSearchParams({ tea: '-1' }),
    });
    assert.equal(invalid.status, 400);
    await stop();
    url = await start();
    assert.equal((await fetch(url + '/admin/orders')).status, 401);
    const authorization = 'Basic ' + Buffer.from('merchant:' + options.password).toString('base64');
    const history = await fetch(url + '/admin/orders', { headers: { authorization } });
    assert.equal(history.status, 200);
    assert.match(await history.text(), /9\.00 USDT/);
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
