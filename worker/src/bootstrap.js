// First-start setup: creates the tables (idempotent) and loads the starting catalogue when the database is empty.
import catalogue from './catalogue.js';

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS formats (id TEXT PRIMARY KEY, label TEXT NOT NULL, label_hi TEXT, sort INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_hi TEXT, short_desc TEXT, short_desc_hi TEXT, image TEXT, sort INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS variants (sku TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), kind TEXT NOT NULL CHECK (kind IN ('dabba','single')), format TEXT REFERENCES formats(id), type TEXT, size TEXT, label TEXT NOT NULL, weight_g INTEGER NOT NULL CHECK (weight_g > 0), price_paise INTEGER NOT NULL CHECK (price_paise >= 0), enabled INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS stock (sku TEXT PRIMARY KEY REFERENCES variants(sku), qty INTEGER NOT NULL DEFAULT 0, reserved INTEGER NOT NULL DEFAULT 0, CHECK (qty >= 0 AND reserved >= 0 AND reserved <= qty))`,
  `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('pending','paid','cancelled','expired')), customer_json TEXT NOT NULL, total_paise INTEGER NOT NULL, ref TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, paid_at TEXT, closed_at TEXT, whatsapp_text TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS order_dabbas (order_id TEXT NOT NULL REFERENCES orders(id), dabba_no INTEGER NOT NULL, format TEXT NOT NULL, packs INTEGER NOT NULL, weight_g INTEGER NOT NULL, subtotal_paise INTEGER NOT NULL, PRIMARY KEY (order_id, dabba_no))`,
  `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id), dabba_no INTEGER, sku TEXT NOT NULL, product_name TEXT NOT NULL, label TEXT NOT NULL, qty INTEGER NOT NULL CHECK (qty > 0), weight_g INTEGER NOT NULL, unit_price_paise INTEGER NOT NULL, line_paise INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL, delta INTEGER NOT NULL DEFAULT 0, reserved_delta INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL, order_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_movement_once ON stock_movements (order_id, sku, reason) WHERE order_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, expires_at)`
];

const q = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replace(/'/g, "''")}'`;

/** INSERT OR IGNORE statements: never overwrite existing prices, settings or stock. */
export function seedStatements(cat = catalogue, { stock = true } = {}) {
  const out = [];
  for (const [k, v] of Object.entries(cat.settings)) out.push(`INSERT OR IGNORE INTO settings (key, value) VALUES (${q(k)}, ${q(JSON.stringify(v))})`);
  for (const f of cat.formats) out.push(`INSERT OR IGNORE INTO formats (id, label, label_hi, sort, enabled) VALUES (${q(f.id)}, ${q(f.label)}, ${q(f.label_hi)}, ${q(f.sort)}, ${q(f.enabled)})`);
  for (const p of cat.products) {
    out.push(`INSERT OR IGNORE INTO products (id, name, name_hi, short_desc, short_desc_hi, image, sort, enabled) VALUES (${q(p.id)}, ${q(p.name)}, ${q(p.name_hi)}, ${q(p.short_desc)}, ${q(p.short_desc_hi)}, ${q(p.image)}, ${q(p.sort)}, ${q(p.enabled)})`);
    for (const v of p.variants) {
      out.push(`INSERT OR IGNORE INTO variants (sku, product_id, kind, format, type, size, label, weight_g, price_paise, enabled) VALUES (${q(v.sku)}, ${q(p.id)}, ${q(v.kind)}, ${q(v.format)}, ${q(v.type)}, ${q(v.size)}, ${q(v.label)}, ${q(v.weight_g)}, ${q(v.price_paise)}, ${q(v.enabled)})`);
      out.push(`INSERT OR IGNORE INTO stock (sku, qty, reserved) VALUES (${q(v.sku)}, ${stock ? q(cat.initial_stock[v.sku] ?? 0) : 0}, 0)`);
    }
  }
  return out;
}

/** One-off data fixes for databases created by earlier versions. Idempotent: safe to run on every start. */
export const MIGRATIONS = [
  `UPDATE variants SET type = 'Fresh Oil' WHERE type = 'Fresh Saffola Oil'`,
  `UPDATE variants SET label = REPLACE(label, 'Fresh Saffola Oil', 'Fresh Oil') WHERE label LIKE '%Saffola%'`,
  `UPDATE products SET short_desc = 'Crunchy, golden chakli, made fresh at home.', short_desc_hi = 'कुरकुरी, सुनहरी चकली, घर पर ताज़ा बनी।' WHERE id = 'chakli' AND short_desc LIKE '%jeera%'`,
  `UPDATE products SET short_desc = 'Light, crunchy and tangy roasted poha chiwda, made fresh at home.', short_desc_hi = 'हल्का, कुरकुरा और चटपटा भुना पोहा चिवड़ा, घर पर ताज़ा बना।' WHERE id = 'chivda' AND short_desc LIKE '%curry leaves%'`,
  `UPDATE variants SET price_paise = 6500 WHERE sku = 'SWALI-T' AND price_paise = 8900`,
  `UPDATE variants SET price_paise = 10800 WHERE sku = 'SWALI-R' AND price_paise = 13900`,
  `UPDATE variants SET price_paise = 19800 WHERE sku = 'SWALI-F' AND price_paise = 24900`,
  `UPDATE variants SET price_paise = 4300 WHERE sku = 'CHAKLI-T' AND price_paise = 8900`,
  `UPDATE variants SET price_paise = 8600 WHERE sku = 'CHAKLI-R' AND price_paise = 13900`,
  `UPDATE variants SET price_paise = 16200 WHERE sku = 'CHAKLI-F' AND price_paise = 24900`,
  `UPDATE variants SET price_paise = 6500 WHERE sku = 'CHIWDA-T' AND price_paise = 7900`,
  `UPDATE variants SET price_paise = 10800 WHERE sku = 'CHIWDA-R' AND price_paise = 12900`,
  `UPDATE variants SET price_paise = 19800 WHERE sku = 'CHIWDA-F' AND price_paise = 22900`
];

let ready = null;
/** Called once per Worker instance before the first API request. Safe to run concurrently (all statements are idempotent). */
export function ensureReady(env) {
  if (!ready) {
    ready = (async () => {
      await env.DB.batch([...SCHEMA, ...MIGRATIONS].map(s => env.DB.prepare(s)));
      const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
      if (!row || !row.n) await env.DB.batch(seedStatements().map(s => env.DB.prepare(s)));
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}
