// Pure business logic: pricing, validation, WhatsApp message, ids. No I/O, so it is easy to test.
// All money is INTEGER PAISE. Prices always come from the catalogue (database), never from the browser.

export const MAX_LINE_QTY = 20;
export const MAX_DABBAS = 10;
export const MAX_LINES = 30;

export const formatMoney = paise => {
  const rupees = paise / 100;
  return '₹' + (Number.isInteger(rupees) ? rupees.toLocaleString('en-IN') : rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};
export const formatWeight = g => (g >= 1000 && g % 100 === 0 ? `${g / 1000}kg` : `${g}g`);

/** What the same weight would cost bought separately at the shop: the price of the smallest shop pack that holds at least that much,
 *  pro-rata by weight (so a 150g Dabba pack is compared with 150/250 of the 250g shop pack). null when the shop has no comparable pack. */
export function referenceUnit(cat, v) {
  let best = null;
  for (const s of cat.variants.values()) {
    if (s.kind !== 'single' || s.product_id !== v.product_id || !s.enabled || s.weight_g < v.weight_g) continue;
    if (!best || s.weight_g < best.weight_g || (s.weight_g === best.weight_g && s.price_paise < best.price_paise)) best = s;
  }
  return best ? Math.round(best.price_paise * v.weight_g / best.weight_g) : null;
}

const isQty = n => Number.isInteger(n) && n >= 1 && n <= MAX_LINE_QTY;

/**
 * cat = { settings, formats: Map(id->row), products: Map(id->row), variants: Map(sku->row), available: Map(sku->number) }
 * input = { dabbas: [{ format, items: [{ sku, qty }] }], lines: [{ sku, qty }] }
 */
export function priceCart(cat, input) {
  const errors = [];
  const err = (code, message, extra = {}) => errors.push({ code, message, ...extra });
  const dabbasIn = Array.isArray(input?.dabbas) ? input.dabbas : [];
  const linesIn = Array.isArray(input?.lines) ? input.lines : [];

  if (!dabbasIn.length && !linesIn.length) err('empty', 'Your cart is empty.');
  if (dabbasIn.length > MAX_DABBAS) err('too_many', `You can order up to ${MAX_DABBAS} Dabbas at once.`);
  if (linesIn.length > MAX_LINES) err('too_many', 'Too many items in the cart.');
  if (errors.length) return { ok: false, errors, dabbas: [], lines: [], total_paise: 0, need: {} };

  const { min_packs: min, max_packs: max, dabba_enabled: dabbaOn } = cat.settings;
  const need = {};
  const take = (sku, qty) => { need[sku] = (need[sku] || 0) + qty; };
  const usable = v => v && v.enabled && cat.products.get(v.product_id)?.enabled;
  const priceItem = v => ({ sku: v.sku, product_id: v.product_id, product_name: cat.products.get(v.product_id).name, label: v.label, weight_g: v.weight_g, unit_price_paise: v.price_paise });

  const dabbas = [];
  dabbasIn.forEach((d, i) => {
    const no = i + 1;
    if (!dabbaOn) return err('dabba_disabled', 'Build Your Own Dabba is not available right now.', { dabba: no });
    const fmt = cat.formats.get(d?.format);
    if (!fmt) return err('bad_format', 'Unknown Dabba format.', { dabba: no });
    if (!fmt.enabled) return err('format_disabled', `The ${fmt.label} format is not available right now.`, { dabba: no });
    const merged = new Map();
    for (const it of Array.isArray(d.items) ? d.items : []) {
      if (!it || typeof it.sku !== 'string' || !isQty(it.qty)) { err('bad_qty', 'Invalid quantity.', { dabba: no }); continue; }
      merged.set(it.sku, (merged.get(it.sku) || 0) + it.qty);
    }
    const items = [];
    let packs = 0, weight = 0, subtotal = 0, saving = 0;
    for (const [sku, qty] of merged) {
      const v = cat.variants.get(sku);
      if (!v) { err('unknown_sku', 'An item in your Dabba no longer exists.', { sku, dabba: no }); continue; }
      if (v.kind !== 'dabba') { err('wrong_kind', 'This item cannot be added to a Dabba.', { sku, dabba: no }); continue; }
      if (v.format !== fmt.id) { err('mixed_format', 'All packs in a Dabba must use the same format.', { sku, dabba: no }); continue; }
      if (!usable(v)) { err('unavailable', `${cat.products.get(v.product_id)?.name || sku} is not available right now.`, { sku, dabba: no }); continue; }
      const line = qty * v.price_paise, ref = referenceUnit(cat, v), refUnit = ref != null && ref > v.price_paise ? ref : v.price_paise;
      items.push({ ...priceItem(v), qty, line_paise: line, reference_unit_paise: refUnit, saving_paise: qty * (refUnit - v.price_paise) });
      packs += qty; weight += qty * v.weight_g; subtotal += line; saving += qty * (refUnit - v.price_paise); take(sku, qty);
    }
    if (packs < min) err('min_packs', `Choose at least ${min} packs to create your Dabba.`, { dabba: no });
    if (packs > max) err('max_packs', `Your Dabba is full. You can select up to ${max} packs.`, { dabba: no });
    dabbas.push({ no, format: fmt.id, format_label: fmt.label, packs, weight_g: weight, subtotal_paise: subtotal, saving_paise: saving, reference_paise: subtotal + saving, items });
  });

  const lines = [];
  const mergedLines = new Map();
  for (const l of linesIn) {
    if (!l || typeof l.sku !== 'string' || !isQty(l.qty)) { err('bad_qty', 'Invalid quantity.'); continue; }
    mergedLines.set(l.sku, (mergedLines.get(l.sku) || 0) + l.qty);
  }
  for (const [sku, qty] of mergedLines) {
    const v = cat.variants.get(sku);
    if (!v) { err('unknown_sku', 'An item in your cart no longer exists.', { sku }); continue; }
    if (v.kind !== 'single') { err('wrong_kind', 'This item can only be ordered inside a Dabba.', { sku }); continue; }
    if (!usable(v)) { err('unavailable', `${cat.products.get(v.product_id)?.name || sku} is not available right now.`, { sku }); continue; }
    lines.push({ ...priceItem(v), qty, line_paise: qty * v.price_paise });
    take(sku, qty);
  }

  for (const [sku, qty] of Object.entries(need)) {
    const avail = cat.available.get(sku) ?? 0;
    if (qty > avail) err('insufficient_stock', avail > 0 ? `Only ${avail} left of ${cat.products.get(cat.variants.get(sku).product_id).name} (${cat.variants.get(sku).label}).` : `${cat.products.get(cat.variants.get(sku).product_id).name} (${cat.variants.get(sku).label}) is sold out.`, { sku, available: avail, requested: qty });
  }

  const total = dabbas.reduce((s, d) => s + d.subtotal_paise, 0) + lines.reduce((s, l) => s + l.line_paise, 0);
  const saving = dabbas.reduce((a, d) => a + d.saving_paise, 0);
  return { ok: errors.length === 0, errors, dabbas, lines, total_paise: total, saving_paise: saving, need };
}

/** Returns { ok, errors: {field: msg}, clean } */
export function validateCustomer(c) {
  const errors = {};
  const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
  const name = str(c?.name, 80);
  const phone = str(c?.phone, 20).replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, '');
  const address = str(c?.address, 300);
  const pin = str(c?.pin, 6);
  const date = str(c?.date, 10);
  const gift = str(c?.gift, 200);
  if (name.length < 2) errors.name = 'Please enter your name';
  if (!/^[6-9]\d{9}$/.test(phone)) errors.phone = 'Enter a valid 10-digit mobile number';
  if (address.length < 8) errors.address = 'Please enter your full address';
  if (!/^\d{6}$/.test(pin)) errors.pin = 'Enter a valid 6-digit pincode';
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Invalid date';
  return { ok: Object.keys(errors).length === 0, errors, clean: { name, phone, address, pin, date, gift } };
}

export function genOrderId(now = new Date(), rand = Math.random) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const mmdd = String(ist.getUTCMonth() + 1).padStart(2, '0') + String(ist.getUTCDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 4; i++) r += alphabet[Math.floor(rand() * alphabet.length)];
  return `SG-${mmdd}-${r}`;
}

/** WhatsApp text, built on the server from the priced order. */
export function buildWhatsAppText({ orderId, customer, priced, ref }) {
  const lines = [];
  priced.dabbas.forEach(d => {
    lines.push(`• Dabba ${d.no} – ${d.format_label} (${d.packs} packs, ${formatWeight(d.weight_g)}) – ${formatMoney(d.subtotal_paise)}${d.saving_paise > 0 ? ` (saves ${formatMoney(d.saving_paise)})` : ''}`);
    d.items.forEach(it => lines.push(`   ◦ ${it.qty}x ${it.product_name} ${formatWeight(it.weight_g)} – ${formatMoney(it.line_paise)}`));
  });
  priced.lines.forEach(l => lines.push(`• ${l.qty}x ${l.product_name} – ${l.label} – ${formatMoney(l.line_paise)}`));
  let extra = '';
  if (customer.date) extra += `\n• Preferred Delivery Date: ${new Date(customer.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  if (customer.gift) extra += `\n• Gift Message: ${customer.gift}`;
  return `*New Order from Singhania's Website!* 🪔
*Order No:* ${orderId}

*Customer Details:*
• Name: ${customer.name}
• Phone: ${customer.phone}
• Address: ${customer.address}, ${customer.pin}${extra}

*Order Summary:*
${lines.join('\n')}

*Total Amount:* ${formatMoney(priced.total_paise)}
_Delivery charges and taxes, if any, will be confirmed on WhatsApp._

Please confirm availability and payment details.
_Ref: ${orderId}${ref ? ' · ' + ref : ''}_`;
}
