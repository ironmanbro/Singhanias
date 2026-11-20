import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { seedStatements } from '../worker/seed.mjs';

export const ADMIN = 'test-admin-token';
const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8').split(/;\s*\n/).map(s => s.trim()).filter(Boolean);

export async function start() {
  const mf = new Miniflare({
    modules: true, scriptPath: new URL('../worker/src/index.js', import.meta.url).pathname, modulesRoot: new URL('../worker/src', import.meta.url).pathname, modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    compatibilityDate: '2025-01-01', d1Databases: { DB: 'test-db' },
    bindings: { ADMIN_TOKEN: ADMIN, WHATSAPP_NUMBER: '919320685055' }
  });
  const db = await mf.getD1Database('DB');
  for (const s of schema) await db.prepare(s).run();
  const reset = async ({ testStock = true } = {}) => {
    await db.batch(['stock_movements', 'order_items', 'order_dabbas', 'orders', 'stock', 'variants', 'products', 'formats', 'settings'].map(t => db.prepare(`DELETE FROM ${t}`)));
    await db.batch(seedStatements({ testStock }).map(s => db.prepare(s)));
  };
  const call = async (path, { method = 'GET', body, token } = {}) => {
    const res = await mf.dispatchFetch('http://localhost' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch { /* not json */ }
    return { status: res.status, data };
  };
  const admin = (path, opts = {}) => call(path, { ...opts, token: ADMIN });
  return { mf, db, reset, call, admin, stop: () => mf.dispose() };
}

export const regular = (extra = {}) => ({ format: 'regular', items: [{ sku: 'SWALI-R', qty: 1 }, { sku: 'CHAKLI-R', qty: 1 }, { sku: 'CHIWDA-R', qty: 1 }], ...extra });
export const customer = { name: 'Asha Singhania', phone: '9876500000', address: '12 MG Road, Malad East', pin: '400097' };
export const order = (cart, extra = {}) => ({ customer, ...cart, ...extra });
export const stockOf = async (db, sku) => db.prepare('SELECT qty, reserved FROM stock WHERE sku = ?').bind(sku).first();
