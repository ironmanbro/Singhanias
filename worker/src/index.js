// Singhania's API (Cloudflare Worker + D1). Static pages are served by Workers Assets; only /api/* reaches this code.
import { priceCart, validateCustomer, genOrderId, buildWhatsAppText } from './core.js';

const DEFAULT_SETTINGS = { dabba_enabled: true, min_packs: 3, max_packs: 6, low_stock_threshold: 5, reservation_hours: 12 };
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const nowISO = () => new Date().toISOString();

class HttpError extends Error { constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; } }

/* ------------------------------------------------------------------ database helpers */
async function loadCatalogue(env) {
  const [s, f, p, v, st] = await env.DB.batch([
    env.DB.prepare('SELECT key, value FROM settings'),
    env.DB.prepare('SELECT * FROM formats ORDER BY sort'),
    env.DB.prepare('SELECT * FROM products ORDER BY sort'),
    env.DB.prepare('SELECT * FROM variants'),
    env.DB.prepare('SELECT sku, qty, reserved FROM stock')
  ]);
  const settings = { ...DEFAULT_SETTINGS };
  for (const r of s.results) { try { settings[r.key] = JSON.parse(r.value); } catch { /* ignore bad row */ } }
  const toMap = (rows, key) => new Map(rows.map(r => [r[key], { ...r, enabled: !!r.enabled }]));
  const stock = new Map(st.results.map(r => [r.sku, r]));
  const available = new Map([...stock].map(([sku, r]) => [sku, Math.max(0, r.qty - r.reserved)]));
  return { settings, formats: toMap(f.results, 'id'), products: toMap(p.results, 'id'), variants: toMap(v.results, 'sku'), stock, available };
}

function publicCatalogue(cat) {
  const thr = cat.settings.low_stock_threshold;
  return {
    settings: { dabba_enabled: cat.settings.dabba_enabled, min_packs: cat.settings.min_packs, max_packs: cat.settings.max_packs },
    formats: [...cat.formats.values()].filter(f => f.enabled).map(f => ({ id: f.id, label: f.label, label_hi: f.label_hi })),
    products: [...cat.products.values()].filter(p => p.enabled).map(p => ({
      id: p.id, name: p.name, name_hi: p.name_hi, short_desc: p.short_desc, short_desc_hi: p.short_desc_hi, image: p.image,
      variants: [...cat.variants.values()].filter(v => v.product_id === p.id && v.enabled).map(v => {
        const avail = cat.available.get(v.sku) ?? 0;
        return { sku: v.sku, kind: v.kind, format: v.format, type: v.type, size: v.size, label: v.label, weight_g: v.weight_g, price_paise: v.price_paise, available: Math.min(avail, 99), in_stock: avail > 0, low_stock: avail > 0 && avail <= thr };
      })
    }))
  };
}

/** Releases reservations of pending orders whose time ran out. */
async function expirePending(env) {
  const { results } = await env.DB.prepare(`SELECT id FROM orders WHERE status = 'pending' AND expires_at < ? LIMIT 25`).bind(nowISO()).all();
  for (const r of results) await transition(env, r.id, 'expired');
}

/**
 * Moves a PENDING order to paid / cancelled / expired, atomically and at most once.
 * - 'paid'      : turns the reservation into a sale (qty and reserved both go down).
 * - otherwise   : releases the reservation.
 * Every stock statement is guarded by the unique token written by the first statement,
 * so a repeated call (duplicate confirmation) changes nothing.
 */
async function transition(env, orderId, to) {
  const items = (await env.DB.prepare('SELECT sku, SUM(qty) AS qty FROM order_items WHERE order_id = ? GROUP BY sku').bind(orderId).all()).results;
  const token = nowISO() + '#' + crypto.randomUUID();
  const now = nowISO();
  const guard = 'EXISTS (SELECT 1 FROM orders WHERE id = ? AND closed_at = ?)';
  const stmts = [env.DB.prepare(`UPDATE orders SET status = ?, closed_at = ?, paid_at = ? WHERE id = ? AND status = 'pending'`).bind(to, token, to === 'paid' ? now : null, orderId)];
  for (const it of items) {
    const sale = to === 'paid';
    stmts.push(env.DB.prepare(`INSERT INTO stock_movements (sku, delta, reserved_delta, reason, order_id, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard}`)
      .bind(it.sku, sale ? -it.qty : 0, -it.qty, sale ? 'sale' : 'release', orderId, now, orderId, token));
    stmts.push(sale
      ? env.DB.prepare(`UPDATE stock SET qty = qty - ?, reserved = reserved - ? WHERE sku = ? AND ${guard}`).bind(it.qty, it.qty, it.sku, orderId, token)
      : env.DB.prepare(`UPDATE stock SET reserved = reserved - ? WHERE sku = ? AND ${guard}`).bind(it.qty, it.sku, orderId, token));
  }
  await env.DB.batch(stmts);
  const row = await env.DB.prepare('SELECT status, closed_at FROM orders WHERE id = ?').bind(orderId).first();
  if (!row) throw new HttpError(404, 'order_not_found');
  return { changed: row.closed_at === token, status: row.status };
}

async function createOrder(env, { priced, customer, ref, hours }) {
  const created = nowISO();
  const expires = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  for (let attempt = 0; attempt < 6; attempt++) {
    const orderId = genOrderId();
    const text = buildWhatsAppText({ orderId, customer, priced, ref });
    const st = [env.DB.prepare(`INSERT INTO orders (id, status, customer_json, total_paise, ref, created_at, expires_at, whatsapp_text) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)`)
      .bind(orderId, JSON.stringify(customer), priced.total_paise, ref || null, created, expires, text)];
    for (const [sku, qty] of Object.entries(priced.need)) {
      st.push(env.DB.prepare('UPDATE stock SET reserved = reserved + ? WHERE sku = ?').bind(qty, sku));   // CHECK (reserved <= qty) rejects overselling
      st.push(env.DB.prepare(`INSERT INTO stock_movements (sku, delta, reserved_delta, reason, order_id, created_at) VALUES (?, 0, ?, 'reserve', ?, ?)`).bind(sku, qty, orderId, created));
    }
    for (const d of priced.dabbas) {
      st.push(env.DB.prepare('INSERT INTO order_dabbas (order_id, dabba_no, format, packs, weight_g, subtotal_paise) VALUES (?, ?, ?, ?, ?, ?)').bind(orderId, d.no, d.format, d.packs, d.weight_g, d.subtotal_paise));
      for (const it of d.items) st.push(insertItem(env, orderId, d.no, it));
    }
    for (const l of priced.lines) st.push(insertItem(env, orderId, null, l));
    try {
      await env.DB.batch(st);
      return { orderId, text, expires };
    } catch (e) {
      const m = String(e && (e.message || e));
      if (/orders\.id/.test(m) && /UNIQUE/i.test(m)) continue;          // id clash: try another id
      if (/CHECK constraint failed/i.test(m)) throw new HttpError(409, 'insufficient_stock');
      throw e;
    }
  }
  throw new HttpError(500, 'order_id_unavailable');
}
const insertItem = (env, orderId, dabbaNo, it) => env.DB.prepare('INSERT INTO order_items (order_id, dabba_no, sku, product_name, label, qty, weight_g, unit_price_paise, line_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .bind(orderId, dabbaNo, it.sku, it.product_name, it.label, it.qty, it.weight_g, it.unit_price_paise, it.line_paise);

const quoteView = p => ({ ok: p.ok, errors: p.errors, total_paise: p.total_paise, dabbas: p.dabbas, lines: p.lines });

/* ------------------------------------------------------------------ http helpers */
async function readJson(req) {
  if (Number(req.headers.get('content-length') || 0) > 65536) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > 65536) throw new HttpError(413, 'too_large');
  try { const v = JSON.parse(text || '{}'); if (v === null || typeof v !== 'object') throw 0; return v; } catch { throw new HttpError(400, 'bad_json'); }
}

async function sha(s) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function requireAdmin(req, env) {
  if (!env.ADMIN_TOKEN) throw new HttpError(503, 'admin_not_configured');
  const h = req.headers.get('authorization') || '';
  const given = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [a, b] = await Promise.all([sha(given), sha(env.ADMIN_TOKEN)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) throw new HttpError(401, 'unauthorized');
}

const int = (v, min, max) => { if (!Number.isInteger(v) || v < min || v > max) throw new HttpError(400, 'invalid_number'); return v; };
const bool = v => { if (typeof v !== 'boolean') throw new HttpError(400, 'invalid_boolean'); return v ? 1 : 0; };

/* ------------------------------------------------------------------ routes */
async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  if (m === 'GET' && path === '/api/catalogue') {
    await expirePending(env);
    return json(publicCatalogue(await loadCatalogue(env)));
  }

  if (m === 'POST' && path === '/api/quote') {
    const body = await readJson(req);
    return json(quoteView(priceCart(await loadCatalogue(env), body)));
  }

  if (m === 'POST' && path === '/api/orders') {
    const body = await readJson(req);
    await expirePending(env);
    const cv = validateCustomer(body.customer);
    if (!cv.ok) throw new HttpError(422, 'invalid_customer', { fields: cv.errors });
    const cat = await loadCatalogue(env);
    const priced = priceCart(cat, body);
    if (!priced.ok) throw new HttpError(409, 'cart_invalid', { errors: priced.errors, quote: quoteView(priced) });
    if (body.expected_total_paise != null && body.expected_total_paise !== priced.total_paise) throw new HttpError(409, 'price_changed', { total_paise: priced.total_paise, quote: quoteView(priced) });
    const ref = /^v[AB]{2}$/.test(body.ref || '') ? body.ref : '';
    let made;
    try { made = await createOrder(env, { priced, customer: cv.clean, ref, hours: cat.settings.reservation_hours }); }
    catch (e) {
      if (e instanceof HttpError && e.code === 'insufficient_stock') {   // someone else got there first: report fresh availability
        const again = priceCart(await loadCatalogue(env), body);
        throw new HttpError(409, 'cart_invalid', { errors: again.errors.length ? again.errors : [{ code: 'insufficient_stock', message: 'Some items just sold out.' }], quote: quoteView(again) });
      }
      throw e;
    }
    const num = String(env.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    return json({ order_id: made.orderId, total_paise: priced.total_paise, expires_at: made.expires, whatsapp_text: made.text, whatsapp_url: `https://wa.me/${num}?text=${encodeURIComponent(made.text)}` }, 201);
  }

  if (path.startsWith('/api/admin')) return admin(req, env, path, m);
  throw new HttpError(404, 'not_found');
}

async function admin(req, env, path, m) {
  await requireAdmin(req, env);
  let r;

  if (m === 'GET' && path === '/api/admin/state') {
    await expirePending(env);
    const cat = await loadCatalogue(env);
    const orders = (await env.DB.prepare('SELECT id, status, total_paise, created_at, expires_at, paid_at, customer_json, ref FROM orders ORDER BY created_at DESC LIMIT 50').all()).results
      .map(o => ({ ...o, customer: JSON.parse(o.customer_json), customer_json: undefined }));
    const movements = (await env.DB.prepare('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 40').all()).results;
    return json({
      settings: cat.settings,
      formats: [...cat.formats.values()],
      products: [...cat.products.values()].map(p => ({ ...p, variants: [...cat.variants.values()].filter(v => v.product_id === p.id).map(v => ({ ...v, qty: cat.stock.get(v.sku)?.qty ?? 0, reserved: cat.stock.get(v.sku)?.reserved ?? 0 })) })),
      orders, movements
    });
  }

  if (m === 'PUT' && path === '/api/admin/settings') {
    const b = await readJson(req);
    const cur = (await loadCatalogue(env)).settings;
    const next = { ...cur };
    if ('dabba_enabled' in b) next.dabba_enabled = !!bool(b.dabba_enabled);
    if ('min_packs' in b) next.min_packs = int(b.min_packs, 1, 20);
    if ('max_packs' in b) next.max_packs = int(b.max_packs, 1, 20);
    if ('low_stock_threshold' in b) next.low_stock_threshold = int(b.low_stock_threshold, 0, 1000);
    if ('reservation_hours' in b) next.reservation_hours = int(b.reservation_hours, 1, 168);
    if (next.max_packs < next.min_packs) throw new HttpError(400, 'max_below_min');
    await env.DB.batch(Object.entries(next).map(([k, v]) => env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, JSON.stringify(v))));
    return json({ settings: next });
  }

  if ((r = path.match(/^\/api\/admin\/variants\/([A-Za-z0-9-]+)$/)) && m === 'PUT') {
    const b = await readJson(req); const sets = [], vals = [];
    if ('price_paise' in b) { sets.push('price_paise = ?'); vals.push(int(b.price_paise, 0, 10000000)); }
    if ('weight_g' in b) { sets.push('weight_g = ?'); vals.push(int(b.weight_g, 1, 100000)); }
    if ('enabled' in b) { sets.push('enabled = ?'); vals.push(bool(b.enabled)); }
    if (!sets.length) throw new HttpError(400, 'nothing_to_update');
    const res = await env.DB.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE sku = ?`).bind(...vals, r[1]).run();
    if (!res.meta.changes) throw new HttpError(404, 'sku_not_found');
    return json({ ok: true });
  }

  if ((r = path.match(/^\/api\/admin\/(products|formats)\/([A-Za-z0-9-]+)$/)) && m === 'PUT') {
    const b = await readJson(req);
    const res = await env.DB.prepare(`UPDATE ${r[1]} SET enabled = ? WHERE id = ?`).bind(bool(b.enabled), r[2]).run();
    if (!res.meta.changes) throw new HttpError(404, 'not_found');
    return json({ ok: true });
  }

  if ((r = path.match(/^\/api\/admin\/stock\/([A-Za-z0-9-]+)$/)) && m === 'POST') {
    const b = await readJson(req);
    const row = await env.DB.prepare('SELECT qty, reserved FROM stock WHERE sku = ?').bind(r[1]).first();
    if (!row) throw new HttpError(404, 'sku_not_found');
    const target = 'qty' in b ? int(b.qty, 0, 1000000) : row.qty + int(b.delta, -1000000, 1000000);
    if (target < row.reserved) throw new HttpError(409, 'below_reserved', { reserved: row.reserved });
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE stock SET qty = ? WHERE sku = ?').bind(target, r[1]),
        env.DB.prepare(`INSERT INTO stock_movements (sku, delta, reserved_delta, reason, order_id, created_at) VALUES (?, ?, 0, 'adjust', NULL, ?)`).bind(r[1], target - row.qty, nowISO())
      ]);
    } catch (e) { if (/CHECK constraint failed/i.test(String(e.message))) throw new HttpError(409, 'below_reserved'); throw e; }
    return json({ ok: true, qty: target });
  }

  if ((r = path.match(/^\/api\/admin\/orders\/(SG-[A-Z0-9-]+)\/(paid|cancel)$/)) && m === 'POST') {
    const res = await transition(env, r[1], r[2] === 'paid' ? 'paid' : 'cancelled');
    return json({ order_id: r[1], status: res.status, changed: res.changed });
  }

  if (m === 'POST' && path === '/api/admin/expire') { await expirePending(env); return json({ ok: true }); }
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(req, env) {
    try { return await route(req, env); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
      console.error('api error', e && (e.stack || e.message || e));
      return json({ error: 'server_error' }, 500);
    }
  }
};

export { loadCatalogue, transition, expirePending };
