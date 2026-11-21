// API + inventory tests. Runs the real Worker against a real (local) D1 database via Miniflare.
// Run:  npm test
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { start, regular, customer, order, stockOf } from './helpers.mjs';

let env;
before(async () => { env = await start(); });
after(async () => { await env.stop(); });
beforeEach(async () => { await env.reset(); });

const quote = cart => env.call('/api/quote', { method: 'POST', body: cart });
const place = (cart, extra) => env.call('/api/orders', { method: 'POST', body: order(cart, extra) });
const dabba = (format, items) => ({ dabbas: [{ format, items }] });
const trio = (suffix, q = [1, 1, 1]) => [{ sku: `SWALI-${suffix}`, qty: q[0] }, { sku: `CHAKLI-${suffix}`, qty: q[1] }, { sku: `CHIWDA-${suffix}`, qty: q[2] }];
const codes = r => r.data.errors.map(e => e.code);

/* ---------- pricing demo calculations (integer paise) ---------- */
test('1. Regular Dabba = ₹407 and 700g', async () => {
  const r = await quote(dabba('regular', trio('R')));
  assert.equal(r.status, 200); assert.equal(r.data.ok, true);
  assert.equal(r.data.total_paise, 40700); assert.equal(r.data.dabbas[0].weight_g, 700); assert.equal(r.data.dabbas[0].packs, 3);
});
test('2. Trial Dabba = ₹257', async () => {
  const r = await quote(dabba('trial', trio('T')));
  assert.equal(r.data.total_paise, 25700); assert.equal(r.data.dabbas[0].weight_g, 400);
});
test('3. Family Dabba = ₹727', async () => {
  const r = await quote(dabba('family', trio('F')));
  assert.equal(r.data.total_paise, 72700); assert.equal(r.data.dabbas[0].weight_g, 1400);
});

/* ---------- selection rules ---------- */
test('4. Minimum three packs is enforced', async () => {
  const r = await quote(dabba('regular', [{ sku: 'SWALI-R', qty: 1 }, { sku: 'CHAKLI-R', qty: 1 }]));
  assert.equal(r.data.ok, false); assert.ok(codes(r).includes('min_packs'));
  assert.match(r.data.errors[0].message, /Choose at least 3 packs/);
});
test('5. Maximum six packs is enforced', async () => {
  const r = await quote(dabba('regular', trio('R', [3, 2, 2])));
  assert.ok(codes(r).includes('max_packs')); assert.match(r.data.errors[0].message, /Your Dabba is full\. You can select up to 6 packs\./);
  const ok = await quote(dabba('regular', trio('R', [2, 2, 2])));
  assert.equal(ok.data.ok, true);
});
test('6. Several packs of the same product are allowed', async () => {
  const r = await quote(dabba('regular', [{ sku: 'SWALI-R', qty: 3 }]));
  assert.equal(r.data.ok, true); assert.equal(r.data.total_paise, 3 * 13900); assert.equal(r.data.dabbas[0].weight_g, 750);
});
test('7. Formats cannot be mixed inside one Dabba, and each format prices correctly', async () => {
  const mixed = await quote(dabba('regular', [{ sku: 'SWALI-R', qty: 2 }, { sku: 'CHAKLI-T', qty: 1 }]));
  assert.ok(codes(mixed).includes('mixed_format'));
  assert.equal((await quote(dabba('trial', [{ sku: 'SWALI-T', qty: 3 }]))).data.total_paise, 3 * 8900);
  assert.equal((await quote(dabba('family', [{ sku: 'CHIWDA-F', qty: 3 }]))).data.total_paise, 3 * 22900);
});
test('forged prices sent by the browser are ignored', async () => {
  const cart = dabba('regular', trio('R').map(i => ({ ...i, price_paise: 1, unit_price_paise: 1, price: 0.01 })));
  cart.total_paise = 100;
  const r = await place(cart, { expected_total_paise: 100 });
  assert.equal(r.status, 409); assert.equal(r.data.error, 'price_changed'); assert.equal(r.data.total_paise, 40700);
});

/* ---------- availability ---------- */
test('8. Disabled products and formats are unavailable', async () => {
  assert.equal((await env.admin('/api/admin/products/chakli', { method: 'PUT', body: { enabled: false } })).status, 200);
  const r = await quote(dabba('regular', trio('R')));
  assert.ok(codes(r).includes('unavailable'));
  const cat = await env.call('/api/catalogue');
  assert.ok(!cat.data.products.find(p => p.id === 'chakli'));
  await env.admin('/api/admin/formats/family', { method: 'PUT', body: { enabled: false } });
  assert.ok(codes(await quote(dabba('family', trio('F')))).includes('format_disabled'));
  await env.admin('/api/admin/settings', { method: 'PUT', body: { dabba_enabled: false } });
  assert.ok(codes(await quote(dabba('regular', trio('R')))).includes('dabba_disabled'));
});
test('9. Insufficient inventory is rejected, sold-out is flagged', async () => {
  await env.admin('/api/admin/stock/CHAKLI-R', { method: 'POST', body: { qty: 1 } });
  const r = await quote(dabba('regular', [{ sku: 'SWALI-R', qty: 1 }, { sku: 'CHAKLI-R', qty: 2 }, { sku: 'CHIWDA-R', qty: 1 }]));
  const e = r.data.errors.find(x => x.code === 'insufficient_stock'); assert.ok(e); assert.equal(e.available, 1);
  await env.admin('/api/admin/stock/CHAKLI-R', { method: 'POST', body: { qty: 0 } });
  const cat = await env.call('/api/catalogue');
  const v = cat.data.products.find(p => p.id === 'chakli').variants.find(x => x.sku === 'CHAKLI-R');
  assert.equal(v.in_stock, false); assert.equal(v.available, 0);
  const o = await place(dabba('regular', trio('R'))); assert.equal(o.status, 409);
});
test('adding to a cart never reserves stock; only an order does', async () => {
  await quote(dabba('regular', trio('R')));
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 0 });
});
test('low-stock flag follows the threshold', async () => {
  await env.admin('/api/admin/stock/SWALI-R', { method: 'POST', body: { qty: 4 } });
  const v = (await env.call('/api/catalogue')).data.products[0].variants.find(x => x.sku === 'SWALI-R');
  assert.equal(v.low_stock, true);
});

/* ---------- price change, several Dabbas, editing ---------- */
test('10. A price change between cart and checkout is caught', async () => {
  const cart = dabba('regular', trio('R'));
  assert.equal((await place(cart, { expected_total_paise: 40700 })).status, 201);
  await env.admin('/api/admin/variants/SWALI-R', { method: 'PUT', body: { price_paise: 15900 } });
  const r = await place(cart, { expected_total_paise: 40700 });
  assert.equal(r.status, 409); assert.equal(r.data.error, 'price_changed'); assert.equal(r.data.total_paise, 42700);
  const count = await env.db.prepare('SELECT COUNT(*) c FROM orders').first(); assert.equal(count.c, 1);   // second order was not created
  assert.equal((await place(cart, { expected_total_paise: 42700 })).status, 201);
});
test('11. Multiple separate Dabbas in one order keep their own snapshots', async () => {
  const cart = { dabbas: [{ format: 'regular', items: trio('R') }, { format: 'trial', items: trio('T') }] };
  const r = await place(cart);
  assert.equal(r.status, 201); assert.equal(r.data.total_paise, 40700 + 25700);
  assert.match(r.data.order_id, /^SG-\d{4}-[A-Z0-9]{4}$/);
  const ds = (await env.db.prepare('SELECT * FROM order_dabbas WHERE order_id = ? ORDER BY dabba_no').bind(r.data.order_id).all()).results;
  assert.deepEqual(ds.map(d => [d.format, d.packs, d.weight_g, d.subtotal_paise]), [['regular', 3, 700, 40700], ['trial', 3, 400, 25700]]);
  const items = (await env.db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(r.data.order_id).all()).results;
  assert.equal(items.length, 6); assert.ok(items.every(i => i.unit_price_paise > 0 && i.line_paise === i.unit_price_paise * i.qty));
  assert.match(r.data.whatsapp_text, /Dabba 1 – Regular \(3 packs, 700g\) – ₹407/); assert.match(r.data.whatsapp_text, /Dabba 2 – Trial/);
  assert.match(r.data.whatsapp_url, /^https:\/\/wa\.me\/919320685055\?text=/);
});
test('12. Editing a Dabba re-prices it from the server catalogue', async () => {
  const before = await quote(dabba('regular', trio('R')));
  const edited = await quote(dabba('regular', trio('R', [2, 1, 1])));
  assert.equal(edited.data.total_paise, before.data.total_paise + 13900);
  assert.equal(edited.data.dabbas[0].packs, 4);
});
test('single shop items and Dabbas can share one order', async () => {
  const r = await place({ ...dabba('regular', trio('R')), lines: [{ sku: 'SWALI-GHEE-500', qty: 1 }] });
  assert.equal(r.status, 201); assert.equal(r.data.total_paise, 40700 + 28000);
  assert.match(r.data.whatsapp_text, /1x Signature Swali – Pure Desi Ghee · 500gms – ₹280/);
});
test('a Dabba-only pack cannot be bought as a loose item, and vice versa', async () => {
  assert.ok(codes(await quote({ lines: [{ sku: 'SWALI-R', qty: 1 }] })).includes('wrong_kind'));
  assert.ok(codes(await quote(dabba('regular', [{ sku: 'SWALI-OIL-250', qty: 3 }]))).includes('wrong_kind'));
});
test('limits are configurable (min 2, max 4)', async () => {
  assert.equal((await env.admin('/api/admin/settings', { method: 'PUT', body: { min_packs: 2, max_packs: 4 } })).status, 200);
  assert.equal((await quote(dabba('regular', trio('R', [1, 1, 0]).filter(i => i.qty)))).data.ok, true);
  assert.ok(codes(await quote(dabba('regular', trio('R', [2, 2, 1])))).includes('max_packs'));
  assert.equal((await env.admin('/api/admin/settings', { method: 'PUT', body: { min_packs: 5, max_packs: 3 } })).status, 400);
});

/* ---------- payment lifecycle (WhatsApp confirmation, marked paid in admin) ---------- */
test('creating an order reserves stock; qty is untouched until payment', async () => {
  const r = await place(dabba('regular', trio('R')));
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 1 });
  const cat = await env.call('/api/catalogue');
  assert.equal(cat.data.products[0].variants.find(v => v.sku === 'SWALI-R').available, 24);
  assert.equal(r.status, 201);
});
test('14. Failed payment (cancel) releases the reservation', async () => {
  const r = await place(dabba('regular', trio('R')));
  const c = await env.admin(`/api/admin/orders/${r.data.order_id}/cancel`, { method: 'POST' });
  assert.equal(c.data.status, 'cancelled');
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 0 });
  assert.equal((await env.admin(`/api/admin/orders/${r.data.order_id}/paid`, { method: 'POST' })).data.status, 'cancelled');   // cannot be paid afterwards
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 0 });
});
test('14b. Expired reservations are released automatically', async () => {
  const r = await place(dabba('regular', trio('R')));
  await env.db.prepare(`UPDATE orders SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`).bind(r.data.order_id).run();
  await env.call('/api/catalogue');
  assert.equal((await env.db.prepare('SELECT status FROM orders WHERE id = ?').bind(r.data.order_id).first()).status, 'expired');
  assert.deepEqual(await stockOf(env.db, 'CHAKLI-R'), { qty: 15, reserved: 0 });
});
test('15. Successful payment deducts stock and logs movements', async () => {
  const r = await place(dabba('regular', trio('R', [2, 1, 1])));
  const p = await env.admin(`/api/admin/orders/${r.data.order_id}/paid`, { method: 'POST' });
  assert.equal(p.data.status, 'paid'); assert.equal(p.data.changed, true);
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 23, reserved: 0 });
  assert.deepEqual(await stockOf(env.db, 'CHAKLI-R'), { qty: 14, reserved: 0 });
  const mv = (await env.db.prepare(`SELECT sku, delta, reason FROM stock_movements WHERE order_id = ? AND reason = 'sale' ORDER BY sku`).bind(r.data.order_id).all()).results;
  assert.deepEqual(mv.map(m => [m.sku, m.delta]), [['CHAKLI-R', -1], ['CHIWDA-R', -1], ['SWALI-R', -2]]);
  assert.ok((await env.db.prepare('SELECT paid_at FROM orders WHERE id = ?').bind(r.data.order_id).first()).paid_at);
});
test('16. A duplicate payment confirmation deducts stock only once', async () => {
  const r = await place(dabba('regular', trio('R')));
  const url = `/api/admin/orders/${r.data.order_id}/paid`;
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => env.admin(url, { method: 'POST' })));
  assert.equal(results.filter(x => x.data.changed).length, 1);
  assert.ok(results.every(x => x.data.status === 'paid'));
  await env.admin(url, { method: 'POST' });
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 24, reserved: 0 });
  const n = await env.db.prepare(`SELECT COUNT(*) c FROM stock_movements WHERE order_id = ? AND reason = 'sale'`).bind(r.data.order_id).first();
  assert.equal(n.c, 3);
});
test('17. Concurrent orders for the last units never oversell', async () => {
  await env.admin('/api/admin/stock/CHIWDA-R', { method: 'POST', body: { qty: 3 } });
  const results = await Promise.all(Array.from({ length: 10 }, () => place(dabba('regular', trio('R')))));
  assert.equal(results.filter(r => r.status === 201).length, 3);
  assert.equal(results.filter(r => r.status === 409).length, 7);
  assert.deepEqual(await stockOf(env.db, 'CHIWDA-R'), { qty: 3, reserved: 3 });
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 3 });   // failed orders left no partial reservation
  const orders = await env.db.prepare('SELECT COUNT(*) c FROM orders').first(); assert.equal(orders.c, 3);
});

/* ---------- validation, security, data safety ---------- */
test('customer details are validated on the server', async () => {
  const r = await env.call('/api/orders', { method: 'POST', body: { customer: { name: 'A', phone: '123', address: 'x', pin: '1' }, ...dabba('regular', trio('R')) } });
  assert.equal(r.status, 422); assert.deepEqual(Object.keys(r.data.fields).sort(), ['address', 'name', 'phone', 'pin']);
});
test('invalid carts and bad input are rejected cleanly', async () => {
  assert.ok(codes(await quote({})).includes('empty'));
  assert.ok(codes(await quote(dabba('regular', [{ sku: 'NOPE', qty: 3 }]))).includes('unknown_sku'));
  assert.ok(codes(await quote(dabba('regular', [{ sku: 'SWALI-R', qty: -1 }]))).includes('bad_qty'));
  assert.ok(codes(await quote(dabba('huge', trio('R')))).includes('bad_format'));
  assert.equal((await env.call('/api/quote', { method: 'POST', body: undefined })).status, 200);
  const bad = await env.mf.dispatchFetch('http://localhost/api/quote', { method: 'POST', body: '{nope' });
  assert.equal(bad.status, 400);
});
test('admin endpoints are protected', async () => {
  assert.equal((await env.call('/api/admin/state')).status, 401);
  assert.equal((await env.call('/api/admin/state', { token: 'wrong' })).status, 401);
  assert.equal((await env.call('/api/admin/settings', { method: 'PUT', body: { min_packs: 1 } })).status, 401);
  assert.equal((await env.call('/api/admin/stock/SWALI-R', { method: 'POST', body: { qty: 999 } })).status, 401);
  assert.equal((await env.admin('/api/admin/state')).status, 200);
  assert.deepEqual(await stockOf(env.db, 'SWALI-R'), { qty: 25, reserved: 0 });
});
test('stock cannot be set below what is reserved; every change is logged', async () => {
  await place(dabba('regular', trio('R', [2, 1, 1])));
  assert.equal((await env.admin('/api/admin/stock/SWALI-R', { method: 'POST', body: { qty: 1 } })).status, 409);
  assert.equal((await env.admin('/api/admin/stock/SWALI-R', { method: 'POST', body: { delta: 10 } })).data.qty, 35);
  const m = await env.db.prepare(`SELECT delta FROM stock_movements WHERE sku = 'SWALI-R' AND reason = 'adjust'`).first(); assert.equal(m.delta, 10);
});
test('seeding is non-destructive: re-running keeps production prices and stock', async () => {
  const { seedStatements } = await import('../worker/src/bootstrap.js');
  await env.admin('/api/admin/variants/SWALI-R', { method: 'PUT', body: { price_paise: 14500 } });
  await env.admin('/api/admin/stock/SWALI-R', { method: 'POST', body: { qty: 7 } });
  await env.db.batch(seedStatements(undefined, { stock: true }).map(s => env.db.prepare(s)));
  const v = await env.db.prepare('SELECT price_paise FROM variants WHERE sku = ?').bind('SWALI-R').first();
  assert.equal(v.price_paise, 14500); assert.equal((await stockOf(env.db, 'SWALI-R')).qty, 7);
});
test('unknown routes and wrong methods return JSON errors, never HTML', async () => {
  assert.equal((await env.call('/api/nope')).status, 404);
  assert.equal((await env.call('/api/orders')).status, 404);
});

test('migration: an older database with the Saffola name is renamed to "Fresh Oil"', async () => {
  const { MIGRATIONS } = await import('../worker/src/bootstrap.js');
  await env.db.prepare(`UPDATE variants SET type = 'Fresh Saffola Oil', label = 'Fresh Saffola Oil · 500gms' WHERE sku = 'SWALI-OIL-500'`).run();
  for (const m of MIGRATIONS) await env.db.prepare(m).run();
  const v = await env.db.prepare(`SELECT type, label FROM variants WHERE sku = 'SWALI-OIL-500'`).first();
  assert.deepEqual(v, { type: 'Fresh Oil', label: 'Fresh Oil · 500gms' });
  await env.db.prepare(`UPDATE products SET short_desc = 'Crunchy rice-flour chakli with sesame and jeera.' WHERE id = 'chakli'`).run();
  for (const m of MIGRATIONS) await env.db.prepare(m).run();
  assert.equal((await env.db.prepare(`SELECT short_desc FROM products WHERE id = 'chakli'`).first()).short_desc, 'Crunchy, golden chakli, made fresh at home.');
  const rows = (await env.db.prepare(`SELECT COUNT(*) c FROM variants WHERE label LIKE '%Saffola%' OR type LIKE '%Saffola%'`).first()).c; assert.equal(rows, 0);
});
