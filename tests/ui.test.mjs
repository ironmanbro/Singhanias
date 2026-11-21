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
  const seed = { 'SWALI-T': 6500, 'SWALI-R': 10800, 'SWALI-F': 19800, 'CHAKLI-T': 4300, 'CHAKLI-R': 8600, 'CHAKLI-F': 16200, 'CHIWDA-T': 6500, 'CHIWDA-R': 10800, 'CHIWDA-F': 19800 };
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

await test('Dabba page: Regular Dabba shows 3 packs, 700g, ₹302 and enables Add', async page => {
  await dabbaPage(page);
  assert.equal(await page.locator('[data-product]').count(), 3);
  assert.equal(await page.textContent('#sum-msg'), 'Choose at least 3 packs to create your Dabba.');
  assert.ok(await page.locator('#add-btn').isDisabled());
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  assert.equal((await page.textContent('#sum-total')).trim(), '₹302');
  assert.equal((await page.textContent('#sum-weight')).trim(), '700g');
  assert.match(await page.textContent('#sum-count'), /3 of 6 packs/);
  assert.ok(await page.locator('#add-btn').isEnabled());
});
await test('Dabba page: Trial = ₹173 and Family = ₹558', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('[data-format="trial"]'); assert.equal((await page.textContent('#sum-total')).trim(), '₹173');
  await page.click('[data-format="family"]'); assert.equal((await page.textContent('#sum-total')).trim(), '₹558');
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
  const cart = await cartOf(page); assert.equal(cart.length, 1); assert.equal(cart[0].type, 'dabba'); assert.equal(cart[0].paise, 30200);
  assert.deepEqual(cart[0].items.map(i => [i.sku, i.qty, i.weight_g, i.unit_price_paise]), [['SWALI-R', 1, 250, 10800], ['CHAKLI-R', 1, 200, 8600], ['CHIWDA-R', 1, 250, 10800]]);
  await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  assert.match(await page.textContent('#cart-items-container'), /Your Dabba · Regular/); assert.match(await page.textContent('#cart-items-container'), /3 packs · 700g/);
  assert.equal((await page.textContent('#cart-total-price')).trim(), '₹302');
  await page.reload(); await page.waitForTimeout(800);
  assert.equal((await page.textContent('#cart-badge')).trim(), '3'); assert.equal((await cartOf(page)).length, 1);
});
await test('Several Dabbas in one cart; edit one; remove one', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-again');
  await page.click('[data-format="trial"]'); await addOne(page, 'swali', 3);
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)');
  let cart = await cartOf(page); assert.equal(cart.length, 2); assert.deepEqual(cart.map(d => d.paise), [30200, 19500]);
  // edit the first Dabba
  await page.goto(BASE + '/build-your-dabba/?edit=' + cart[0].id); await page.waitForSelector('[data-product]');
  assert.equal((await page.textContent('#sum-total')).trim(), '₹302'); assert.equal(await page.locator('#edit-banner').isVisible(), true);
  await addOne(page, 'swali'); assert.equal((await page.textContent('#sum-total')).trim(), '₹410');
  assert.equal((await page.textContent('#add-btn')).trim(), 'Update My Dabba');
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)');
  cart = await cartOf(page); assert.equal(cart.length, 2); assert.equal(cart[0].paise, 41000); assert.equal(cart[0].packs, 4);
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
  assert.match(url, /Dabba 1 – Regular \(3 packs, 700g\) – ₹302/); assert.match(url, /\*Total Amount:\* ₹302/);
  assert.match(await page.textContent('#pay-sub'), /SG-\d{4}-[A-Z0-9]{4} · ₹302/);
  assert.equal((await cartOf(page)).length, 0);
  const cat = (await api('/api/catalogue')).data; assert.equal(cat.products[0].variants.find(v => v.sku === 'SWALI-R').available, 24);
});
await test('Price changed after adding to cart: checkout refreshes prices and creates no order', async page => {
  await dabbaPage(page);
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.click('#added-go'); await page.waitForSelector('#cart-drawer:not(.translate-x-full)');
  await api('/api/admin/variants/SWALI-R', 'PUT', { price_paise: 12800 }, true);
  await page.fill('#cust-name', 'Asha Singhania'); await page.fill('#cust-phone', '9876500000'); await page.fill('#cust-address', '12 MG Road, Malad East'); await page.fill('#cust-pin', '400097');
  const before = (await api('/api/admin/state', 'GET', null, true)).data.orders.length;
  await page.click('#order-btn'); await page.waitForSelector('#cart-error:not(.hidden)');
  assert.match(await page.textContent('#cart-error'), /prices changed/i);
  assert.equal((await page.textContent('#cart-total-price')).trim(), '₹322');
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
  assert.equal((await page.textContent('#sbar-total')).trim(), '₹302');
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


/* ---------- content, allergy list and mascot ---------- */
await test('No Saffola brand and no ingredient lists anywhere; allergy information is shown', async page => {
  for (const url of ['/', '/build-your-dabba/']) {
    await page.goto(BASE + url); await page.waitForTimeout(900);
    const text = await page.evaluate(() => document.body.innerText + ' ' + [...document.querySelectorAll('[data-hi]')].map(e => e.dataset.en || '').join(' '));
    assert.ok(!/saffola|सफ़ोला/i.test(text), url + ' still mentions Saffola');
    assert.ok(!/maida|rava|ajwain|curd\b|jeera|curry patta|kneaded firm/i.test(text.replace(/Contains:[^.\n]*/g, '')), url + ' still shows recipe words');
  }
  await page.goto(BASE + '/'); await page.waitForTimeout(800);
  assert.match(await page.textContent('#allergy-grid'), /Wheat \(gluten\)/); assert.match(await page.textContent('#allergy-grid'), /Peanuts/); assert.match(await page.textContent('#allergy-note'), /serious allergy/);
  await page.click('[data-info="chakli"]'); const modal = await page.textContent('#info-body');
  assert.match(modal, /Allergen info|Allergy/i); assert.match(modal, /Sesame/); assert.ok(!/Ingredients/.test(modal));
  assert.equal(await page.locator('[data-v="Fresh Oil"]').count(), 1);
  await dabbaPage(page); assert.match(await page.locator('[data-product="chivda"]').textContent(), /Contains: Peanuts, Chickpea/);
  const cat = (await api('/api/catalogue')).data; assert.ok(!JSON.stringify(cat).includes('Saffola'));
});
await test('Mascot Mathu: appears, speaks on tap, can be hidden and brought back', async page => {
  await page.goto(BASE + '/'); await page.waitForSelector('#mathu');
  await page.click('#mathu .mathu-btn'); await page.waitForSelector('#mathu .mathu-bubble.show');
  assert.ok((await page.textContent('#mathu .m-msg')).length > 10);
  await page.click('#mathu .hide'); assert.equal(await page.locator('#mathu').count(), 0);
  await page.reload(); await page.waitForTimeout(800); assert.equal(await page.locator('#mathu').count(), 0);
  await page.evaluate(() => document.getElementById('mathu-back').scrollIntoView()); await page.click('#mathu-back'); await page.waitForSelector('#mathu');
  await dabbaPage(page); await page.waitForSelector('#mathu');
  await addOne(page, 'swali', 3); await addOne(page, 'chakli', 3); await page.waitForSelector('#mathu .mathu-bubble.show');
  assert.match(await page.textContent('#mathu .m-msg'), /full/i);
});
await test('Mascot on a phone: visible, does not cause sideways scroll or cover the Dabba bar', async page => {
  await dabbaPage(page); await page.waitForSelector('#mathu');
  const m = await page.locator('#mathu').boundingBox(), bar = await page.locator('#sbar').boundingBox();
  assert.ok(m.y + m.height <= bar.y + 2, 'mascot sits above the bottom bar'); assert.ok(m.x >= 0 && m.x + m.width <= 390);
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1]);
}, { viewport: { width: 390, height: 844 }, mobile: true });


/* ---------- Add to Jhola animation ---------- */
await test('Add to Jhola: tick on the button, snack flies to the bag, bag catches it, button returns', async page => {
  await page.goto(BASE + '/'); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('[data-add="chakli"]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(900);
  await page.click('[data-add="chakli"]');
  await page.waitForSelector('.jh-token', { timeout: 1500 });
  assert.match(await page.textContent('[data-add="chakli"]'), /Added/); assert.ok(await page.locator('[data-add="chakli"].jh-done').count());
  await page.waitForSelector('#cart-btn.jh-catch', { timeout: 2500 });
  assert.equal(await page.locator('.jh-token').count(), 0, 'flying snack is removed after landing');
  assert.match(await page.textContent('.jh-label'), /\+1/);
  await page.waitForFunction(() => /Add to Jhola/.test(document.querySelector('[data-add="chakli"]').textContent), null, { timeout: 4000 });
  assert.equal(await page.locator('[data-add="chakli"].jh-done').count(), 0);
  assert.equal((await page.textContent('#cart-badge')).trim(), '1');
});
await test('Add to Jhola: tapping twice quickly adds twice and still ends cleanly', async page => {
  await page.goto(BASE + '/'); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('[data-add="chivda"]').scrollIntoView({ block: 'center' })); await page.waitForTimeout(900);
  await page.click('[data-add="chivda"]'); await page.waitForTimeout(150); await page.click('[data-add="chivda"]');
  await page.waitForFunction(() => /Add to Jhola/.test(document.querySelector('[data-add="chivda"]').textContent), null, { timeout: 5000 });
  assert.equal((await page.textContent('#cart-badge')).trim(), '2'); assert.equal(await page.locator('.jh-token, .jh-ghost').count(), 0);
});
await test('Dabba page: the brass dabba hops into the Jhola, then the confirmation appears', async page => {
  await dabbaPage(page); for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.waitForSelector('.jh-token.brass', { timeout: 1500 });
  assert.ok(await page.locator('#added.hidden').count(), 'confirmation waits for the landing');
  await page.waitForSelector('#added:not(.hidden)', { timeout: 4000 });
  assert.equal((await page.textContent('#cart-badge')).trim(), '3');
});
await test('Reduce motion: add to Jhola still works instantly with no flying snack', async (page, ctx) => {
  const rm = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await rm.addInitScript(() => { try { sessionStorage.setItem('singhanias_intro', '1'); } catch (e) {} });
  const p = await rm.newPage(); await p.goto(BASE + '/'); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('[data-add="swali"]').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
  await p.click('[data-add="swali"]'); await p.waitForTimeout(300);
  assert.equal(await p.locator('.jh-token').count(), 0); assert.equal((await p.textContent('#cart-badge')).trim(), '1');
  await dabbaPage(p); for (const id of ['swali', 'chakli', 'chivda']) await addOne(p, id);
  await p.click('#add-btn'); await p.waitForSelector('#added:not(.hidden)', { timeout: 3000 });
  await rm.close();
});


/* ---------- more Dabba page motion ---------- */
await test('Dabba page: live brass dabba fills with snacks, shows FULL, and empties again', async page => {
  await dabbaPage(page);
  assert.equal(await page.locator('#ld-snacks .ld-disc').count(), 0); assert.ok(!(await page.locator('#live-dabba.open').count()));
  await addOne(page, 'swali', 2); await addOne(page, 'chakli');
  assert.equal(await page.locator('#ld-snacks .ld-disc').count(), 3); assert.ok(await page.locator('#live-dabba.open').count());
  assert.ok(await page.locator('#ld-snacks .ld-disc.new').count() >= 1, 'new snacks drop in with an animation');
  await addOne(page, 'chivda', 3);
  assert.equal(await page.locator('#ld-snacks .ld-disc').count(), 6); assert.ok(await page.locator('#live-dabba.full').count());
  assert.ok(await page.locator('#meter.meter-full').count());
  await page.click('[data-remove="chivda"]'); assert.equal(await page.locator('#ld-snacks .ld-disc').count(), 3); assert.ok(!(await page.locator('#live-dabba.full').count()));
});
await test('Dabba page: picked cards highlight with a ×N badge, price flips in, add button unlocks', async page => {
  await dabbaPage(page);
  assert.ok(!(await page.locator('.card-in.is-picked').count()));
  await addOne(page, 'chakli', 2); assert.ok(await page.locator('[data-product="chakli"].is-picked').count());
  assert.equal((await page.textContent('[data-product="chakli"] [data-badge]')).trim(), '×2');
  assert.ok(await page.locator('.price-flip').count() >= 3);
  await addOne(page, 'swali');
  await page.waitForSelector('#add-btn.unlock', { timeout: 1000 });
});
await test('Dabba page: steps strip, empty-state slots, headline words and removal slide-out', async page => {
  await dabbaPage(page); await page.waitForTimeout(1500);
  assert.equal(await page.locator('.step-i').count(), 3); assert.ok(await page.locator('.steps.seen').count());
  assert.ok(await page.locator('h1 .w').count() >= 3, 'headline is split into animated words');
  assert.ok(!(await page.locator('#sum-empty.gone').count()), 'empty state visible when nothing is picked');
  await addOne(page, 'swali', 3); assert.ok(await page.locator('#sum-empty.gone').count());
  await page.click('[data-remove="swali"]');
  assert.match(await page.textContent('#sum-count'), /No packs yet/, 'state changes instantly');
  assert.ok(await page.locator('.li-ghost').count() >= 1, 'row slides away');
  await page.waitForTimeout(700); assert.equal(await page.locator('.li-ghost').count(), 0);
  assert.ok(await page.locator('#dp-progress').count());
});
await test('Dabba page: closing the lid animation does not block adding to the Jhola', async page => {
  await dabbaPage(page); for (const id of ['swali', 'chakli', 'chivda']) await addOne(page, id);
  await page.click('#add-btn'); await page.waitForSelector('#added:not(.hidden)', { timeout: 4000 });
  assert.equal((await cartOf(page)).length, 1);
});
await test('Reduce motion: Dabba page extras are calm but fully working', async (page, ctx) => {
  const rm = await ctx.browser().newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await rm.newPage(); await dabbaPage(p);
  assert.equal(await p.locator('.petal-float, .twinkle').count(), 0); assert.equal(await p.locator('h1 .w').count(), 0);
  assert.ok(await p.locator('.step-i').first().isVisible());
  for (const id of ['swali', 'chakli', 'chivda']) await addOne(p, id);
  assert.equal(await p.locator('#ld-snacks .ld-disc').count(), 3); assert.equal(await p.locator('#ld-snacks .ld-disc.new').count(), 0);
  await p.click('#add-btn'); await p.waitForSelector('#added:not(.hidden)', { timeout: 3000 });
  await rm.close();
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
  await api('/api/admin/variants/SWALI-T', 'PUT', { price_paise: 6500 }, true); await api('/api/admin/stock/SWALI-T', 'POST', { qty: 25 }, true);
  const o = (await api('/api/orders', 'POST', { customer: { name: 'Asha S', phone: '9876500000', address: '12 MG Road, Malad', pin: '400097' }, dabbas: [{ format: 'regular', items: [{ sku: 'SWALI-R', qty: 3 }] }] })).data;
  await page.click('#refresh'); await page.waitForSelector(`[data-paid="${o.order_id}"]`); await page.click(`[data-paid="${o.order_id}"]`); await page.waitForTimeout(700);
  const st = (await api('/api/admin/state', 'GET', null, true)).data; assert.equal(st.orders.find(x => x.id === o.order_id).status, 'paid');
  await api('/api/admin/stock/SWALI-R', 'POST', { qty: 25 }, true);
});

await browser.close();
const failed = results.filter(r => !r[0]).length;
console.log(`\n${results.length - failed}/${results.length} UI tests passed`);
process.exit(failed ? 1 : 0);
