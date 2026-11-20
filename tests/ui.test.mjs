// Browser tests (Playwright) against a running dev server:  npm run dev   (in another terminal)  then  npm run test:ui
// Covers the customer journey, cart persistence, editing, checkout, error states, mobile layouts and the admin page.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:8787';
const TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
const results = [];
const browser = await chromium.launch();

const api = async (path, method = 'GET', body, auth) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + TOKEN } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => null) };
};
async function resetState() {   // cancel pending orders, restore stock, prices and settings used by the tests
  const st = (await api('/api/admin/state', 'GET', null, true)).data;
  for (const o of st.orders.filter(o => o.status === 'pending')) await api(`/api/admin/orders/${o.id}/cancel`, 'POST', null, true);
  await api('/api/admin/settings', 'PUT', { dabba_enabled: true, min_packs: 3, max_packs: 6 }, true);
  const seed = { 'SWALI-R': 13900, 'CHAKLI-R': 13900, 'CHIWDA-R': 12900 };
  for (const p of st.products) {
    await api(`/api/admin/products/${p.id}`, 'PUT', { enabled: true }, true);
    for (const v of p.variants) {
      if (seed[v.sku]) await api(`/api/admin/variants/${v.sku}`, 'PUT', { price_paise: seed[v.sku] }, true);
      if (v.qty < 25 && v.reserved === 0) await api(`/api/admin/stock/${v.sku}`, 'POST', { qty: 25 }, true);
    }
  }
}
async function test(name, fn, { viewport = { width: 1280, height: 900 }, mobile = false } = {}) {
  await resetState();
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('singhanias_intro', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  try { await fn(page, ctx); assert.deepEqual(problems, [], 'browser console / page errors'); results.push([true, name]); console.log('ok   ', name); }
  catch (e) { results.push([false, name]); console.log('FAIL ', name, '\n      ', String(e.message).split('\n')[0]); }
  await ctx.close();
}
const addOne = async (page, id, n = 1) => { for (let i = 0; i < n; i++) await page.click(`[data-inc="${id}"]`); };
const dabbaPage = async page => { await page.goto(BASE + '/build-your-dabba/'); await page.waitForSelector('[data-product]'); };
const cartOf = page => page.evaluate(() => JSON.parse(localStorage.getItem('singhanias_cart') || '[]'));
const noHScroll = async (page, url) => { await page.goto(BASE + url); await page.waitForTimeout(900); const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1], `${url} scrolls horizontally (${w[0]} > ${w[1]})`); };

await test('Dabba page: Regular Dabba shows 3 packs, 700g, ₹407 and enables Add', async page => {
  await dabbaPage(page);
  assert.equal(await page.locator('[data-product]').count(), 3);
  assert.equal(await page.textContent('#sum-msg'), 'Choose at least 3 packs to create your Dabba.');
  assert.ok(await page.locator('#add-btn').isDisabled());
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  assert.equal((await page.textContent('#sum-total')).trim(), '₹407');
  assert.equal((await page.textContent('#sum-weight')).trim(), '700g');
  assert.match(await page.textContent('#sum-count'), /3 of 6 packs/);
  assert.ok(await page.locator('#add-btn').isEnabled());
});
await test('Dabba page: Trial = ₹257 and Family = ₹727', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('[data-format="trial"]'); assert.equal((await page.textContent('#sum-total')).trim(), '₹257');
  await page.click('[data-format="family"]'); assert.equal((await page.textContent('#sum-total')).trim(), '₹727');
  assert.equal((await page.textContent('#sum-weight')).trim(), '1.4kg');
});
await test('Dabba page: maximum of 6 packs, "Dabba is full" message, + disabled, remove works', async page => {
  await dabbaPage(page);
  await addOne(page, 'swali', 3); await addOne(page, 'chakli', 3);
  assert.equal(await page.textContent('#sum-msg'), 'Your Dabba is full. You can select up to 6 packs.');
  assert.ok(await page.locator('[data-inc="chivda"]').isDisabled());
  assert.ok(await page.locator('[data-inc="swali"]').isDisabled());
  await page.click('[data-remove="chakli"]');
  assert.match(await page.textContent('#sum-count'), /3 of 6/); assert.ok(await page.locator('[data-inc="chivda"]').isEnabled());
});
await test('Stock: sold-out product cannot be selected; low stock is labelled', async page => {
  await api('/api/admin/stock/CHAKLI-R', 'POST', { qty: 0 }, true);
  await api('/api/admin/stock/CHIWDA-R', 'POST', { qty: 2 }, true);
  await dabbaPage(page);
  assert.match(await page.locator('[data-product="chakli"] [data-stock]').textContent(), /Sold out/);
  assert.ok(await page.locator('[data-inc="chakli"]').isDisabled());
  assert.match(await page.locator('[data-product="chivda"] [data-stock]').textContent(), /Only 2 left/);
  await addOne(page, 'chivda', 2); assert.equal((await page.textContent('[data-product="chivda"] [data-qty]')).trim(), '2'); assert.ok(await page.locator('[data-inc="chivda"]').isDisabled());
});
await test('Add to cart, badge, checkout drawer shows the Dabba, and it persists after refresh', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)');
  assert.equal((await page.textContent('#cart-badge')).trim(), '3');
  const cart = await cartOf(page); assert.equal(cart.length, 1); assert.equal(cart[0].type, 'dabba'); assert.equal(cart[0].paise, 40700);
  assert.deepEqual(cart[0].items.map(i => [i.sku, i.qty, i.weight_g, i.unit_price_paise]), [['SWALI-R', 1, 250, 13900], ['CHAKLI-R', 1, 200, 13900], ['CHIWDA-R', 1, 250, 12900]]);
  await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  assert.match(await page.textContent('#cart-items-container'), /Your Dabba · Regular/); assert.match(await page.textContent('#cart-items-container'), /3 packs · 700g/);
  assert.equal((await page.textContent('#cart-total-price')).trim(), '₹407');
  await page.reload(); await page.waitForTimeout(800);
  assert.equal((await page.textContent('#cart-badge')).trim(), '3'); assert.equal((await cartOf(page)).length, 1);
});
await test('Several Dabbas in one cart; edit one; remove one', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-again');
  await page.click('[data-format="trial"]'); await addOne(page, 'swali', 3);
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)');
  let cart = await cartOf(page); assert.equal(cart.length, 2); assert.deepEqual(cart.map(d => d.paise), [40700, 26700]);
  // edit the first Dabba
  await page.goto(BASE + '/build-your-dabba/?edit=' + cart[0].id); await page.waitForSelector('[data-product]');
  assert.equal((await page.textContent('#sum-total')).trim(), '₹407'); assert.equal(await page.locator('#edit-banner').isVisible(), true);
  await addOne(page, 'swali'); assert.equal((await page.textContent('#sum-total')).trim(), '₹546');
  assert.equal((await page.textContent('#add-btn')).trim(), 'Update My Dabba');
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)');
  cart = await cartOf(page); assert.equal(cart.length, 2); assert.equal(cart[0].paise, 54600); assert.equal(cart[0].packs, 4);
  // remove from the cart drawer
  await page.goto(BASE + '/?cart=1'); await page.waitForSelector('[data-dabba]');
  await page.locator('[data-dabba]').first().getByRole('button', { name: 'Remove' }).click();
  assert.equal((await cartOf(page)).length, 1);
});
await test('Full checkout: server creates the order, stock is reserved, cart clears', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  await page.evaluate(() => { window.__opened = null; window.open = u => { window.__opened = u; }; });
  await page.fill('#cust-name', 'Asha Singhania'); await page.fill('#cust-phone', '9876500000'); await page.fill('#cust-address', '12 MG Road, Malad East'); await page.fill('#cust-pin', '400097');
  await page.click('#order-btn'); await page.waitForSelector('#pay-modal:not(.hidden)');
  const url = decodeURIComponent(await page.evaluate(() => window.__opened));
  assert.match(url, /^https:\/\/wa\.me\/919320685055\?text=/); assert.match(url, /\*Order No:\* SG-\d{4}-[A-Z0-9]{4}/);
  assert.match(url, /Dabba 1 – Regular \(3 packs, 700g\) – ₹407/); assert.match(url, /\*Total Amount:\* ₹407/);
  assert.match(await page.textContent('#pay-sub'), /SG-\d{4}-[A-Z0-9]{4} · ₹407/);
  assert.equal((await cartOf(page)).length, 0);
  const cat = (await api('/api/catalogue')).data; assert.equal(cat.products[0].variants.find(v => v.sku === 'SWALI-R').available, 24);
});
await test('Price changed after adding to cart: checkout refreshes prices and creates no order', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  await api('/api/admin/variants/SWALI-R', 'PUT', { price_paise: 15900 }, true);
  await page.fill('#cust-name', 'Asha Singhania'); await page.fill('#cust-phone', '9876500000'); await page.fill('#cust-address', '12 MG Road, Malad East'); await page.fill('#cust-pin', '400097');
  const before = (await api('/api/admin/state', 'GET', null, true)).data.orders.length;
  await page.click('#order-btn'); await page.waitForSelector('#cart-error:not(.hidden)');
  assert.match(await page.textContent('#cart-error'), /prices changed/i);
  assert.equal((await page.textContent('#cart-total-price')).trim(), '₹427');
  assert.equal((await api('/api/admin/state', 'GET', null, true)).data.orders.length, before);
});
await test('Single shop items still work and are priced by the server', async page => {
  await page.goto(BASE + '/'); await page.waitForTimeout(900);
  await page.click('[data-p="swali"][data-v="Pure Desi Ghee"]'); await page.click('[data-p="swali"][data-v="500gms"]');
  assert.equal((await page.textContent('#swali-price')).trim(), '₹280');
  await page.click('[data-add="swali"]'); await page.waitForTimeout(500);
  const cart = await cartOf(page); assert.deepEqual([cart[0].type, cart[0].sku, cart[0].paise], ['single', 'SWALI-GHEE-500', 28000]);
  await page.evaluate(() => { window.open = u => { window.__opened = u; }; });
  await page.click('#cart-btn'); await page.waitForTimeout(400);
  await page.fill('#cust-name', 'Asha Singhania'); await page.fill('#cust-phone', '9876500000'); await page.fill('#cust-address', '12 MG Road, Malad East'); await page.fill('#cust-pin', '400097');
  await page.click('#order-btn'); await page.waitForSelector('#pay-modal:not(.hidden)');
  assert.match(decodeURIComponent(await page.evaluate(() => window.__opened)), /1x Signature Swali – Pure Desi Ghee · 500gms – ₹280/);
});
await test('Server validation errors are shown (cart with a product that just sold out)', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  await api('/api/admin/stock/CHAKLI-R', 'POST', { qty: 0 }, true);
  await page.fill('#cust-name', 'Asha Singhania'); await page.fill('#cust-phone', '9876500000'); await page.fill('#cust-address', '12 MG Road, Malad East'); await page.fill('#cust-pin', '400097');
  await page.click('#order-btn'); await page.waitForSelector('#cart-error:not(.hidden)');
  assert.match(await page.textContent('#cart-error'), /sold out/i); assert.equal((await cartOf(page)).length, 1);
});
await test('Error and disabled states', async (page, ctx) => {
  await page.route('**/api/catalogue', r => r.abort());
  await page.goto(BASE + '/build-your-dabba/'); await page.waitForSelector('#retry');
  assert.match(await page.textContent('#cards'), /could not load the menu/); await page.unroute('**/api/catalogue');
  await page.click('#retry'); await page.waitForSelector('[data-product]');
  await api('/api/admin/settings', 'PUT', { dabba_enabled: false }, true);
  await page.reload(); await page.waitForSelector('#cards a'); assert.match(await page.textContent('#cards'), /not available right now/);
  assert.ok(await page.locator('#add-btn').isDisabled());
});
await test('Hindi toggle works on the Dabba page', async page => {
  await dabbaPage(page); await page.click('#lang-btn');
  assert.match(await page.textContent('h1'), /आपका डब्बा/); assert.match(await page.textContent('#sum-msg'), /कम से कम 3 पैक/);
});

/* ---------- mobile ---------- */
await test('Mobile 390×844: no horizontal scroll, sticky bar, sheet, big tap targets', async page => {
  for (const u of ['/build-your-dabba/', '/', '/admin/']) await noHScroll(page, u);
  await dabbaPage(page);
  assert.ok(await page.locator('#sbar').isVisible());
  const box = await page.locator('[data-inc="swali"]').boundingBox(); assert.ok(box.width >= 40 && box.height >= 40, `qty button ${box.width}x${box.height}`);
  for (const id of ['swali', 'chakli', 'chivda']) await page.tap(`[data-inc="${id}"]`);
  assert.equal((await page.textContent('#sbar-total')).trim(), '₹407');
  await page.tap('#sbar-open'); await page.waitForTimeout(400);
  assert.ok(await page.locator('#summary').isVisible()); assert.ok(await page.locator('#add-btn').isEnabled());
  assert.match(await page.textContent('#sum-items'), /Signature Chakli/);
  await page.tap('#sheet-close'); await page.waitForTimeout(400);
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1]);
}, { viewport: { width: 390, height: 844 }, mobile: true });
for (const [w, h] of [[360, 640], [414, 896], [768, 1024]]) {
  await test(`Viewport ${w}×${h}: no horizontal scroll on every page`, async page => { for (const u of ['/build-your-dabba/', '/', '/admin/']) await noHScroll(page, u); }, { viewport: { width: w, height: h }, mobile: w < 768 });
}
await test('Desktop: summary is a sticky second column', async page => {
  await dabbaPage(page);
  const [a, b] = await Promise.all([page.locator('#cards').boundingBox(), page.locator('#summary').boundingBox()]);
  assert.ok(b.x > a.x + a.width - 5, 'summary is to the right of the products');
  await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(200);
  assert.ok((await page.locator('#summary').boundingBox()).y < 200, 'summary stays in view while scrolling');
});

/* ---------- admin ---------- */
await test('Admin: sign in, change a price and stock, mark an order paid', async page => {
  await page.goto(BASE + '/admin/'); await page.fill('#token', 'wrong'); await page.click('#login-btn'); await page.waitForTimeout(500);
  assert.match(await page.textContent('#login-err'), /did not work/);
  await page.fill('#token', TOKEN); await page.click('#login-btn'); await page.waitForSelector('#app:not(.hidden)');
  const row = page.locator('tr[data-sku="SWALI-T"]');
  await row.locator('[data-f="price"]').fill('95.50'); await row.locator('[data-f="qty"]').fill('11'); await row.locator('[data-save]').click(); await page.waitForTimeout(700);
  const v = (await api('/api/admin/state', 'GET', null, true)).data.products[0].variants.find(x => x.sku === 'SWALI-T');
  assert.equal(v.price_paise, 9550); assert.equal(v.qty, 11);
  await api('/api/admin/variants/SWALI-T', 'PUT', { price_paise: 8900 }, true); await api('/api/admin/stock/SWALI-T', 'POST', { qty: 25 }, true);
  const o = (await api('/api/orders', 'POST', { customer: { name: 'Asha S', phone: '9876500000', address: '12 MG Road, Malad', pin: '400097' }, dabbas: [{ format: 'regular', items: [{ sku: 'SWALI-R', qty: 3 }] }] })).data;
  await page.click('#refresh'); await page.waitForSelector(`[data-paid="${o.order_id}"]`); await page.click(`[data-paid="${o.order_id}"]`); await page.waitForTimeout(700);
  const st = (await api('/api/admin/state', 'GET', null, true)).data; assert.equal(st.orders.find(x => x.id === o.order_id).status, 'paid');
  await api('/api/admin/stock/SWALI-R', 'POST', { qty: 25 }, true);
});

await browser.close();
const failed = results.filter(r => !r[0]).length;
console.log(`\n${results.length - failed}/${results.length} UI tests passed`);
process.exit(failed ? 1 : 0);
