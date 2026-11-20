// Generates SQL that seeds the catalogue from data/catalogue.json.
// INSERT OR IGNORE: never overwrites production prices/settings/stock. Use --test-stock only for local/test databases.
import { readFileSync } from 'node:fs';
const cat = JSON.parse(readFileSync(new URL('../data/catalogue.json', import.meta.url), 'utf8'));
const q = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replace(/'/g, "''")}'`;
export function seedStatements({ testStock = false } = {}) {
  const out = [];
  for (const [k, v] of Object.entries(cat.settings)) out.push(`INSERT OR IGNORE INTO settings (key, value) VALUES (${q(k)}, ${q(JSON.stringify(v))})`);
  for (const f of cat.formats) out.push(`INSERT OR IGNORE INTO formats (id, label, label_hi, sort, enabled) VALUES (${q(f.id)}, ${q(f.label)}, ${q(f.label_hi)}, ${q(f.sort)}, ${q(f.enabled)})`);
  for (const p of cat.products) {
    out.push(`INSERT OR IGNORE INTO products (id, name, name_hi, short_desc, short_desc_hi, image, sort, enabled) VALUES (${q(p.id)}, ${q(p.name)}, ${q(p.name_hi)}, ${q(p.short_desc)}, ${q(p.short_desc_hi)}, ${q(p.image)}, ${q(p.sort)}, ${q(p.enabled)})`);
    for (const v of p.variants) {
      out.push(`INSERT OR IGNORE INTO variants (sku, product_id, kind, format, type, size, label, weight_g, price_paise, enabled) VALUES (${q(v.sku)}, ${q(p.id)}, ${q(v.kind)}, ${q(v.format)}, ${q(v.type)}, ${q(v.size)}, ${q(v.label)}, ${q(v.weight_g)}, ${q(v.price_paise)}, ${q(v.enabled)})`);
      out.push(`INSERT OR IGNORE INTO stock (sku, qty, reserved) VALUES (${q(v.sku)}, ${testStock ? q(cat.test_stock[v.sku] ?? 0) : 0}, 0)`);
    }
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('seed.mjs')) console.log(seedStatements({ testStock: process.argv.includes('--test-stock') }).join(';\n') + ';');
