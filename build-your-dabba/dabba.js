/* Build Your Own Dabba. Prices, weights, stock and limits ALL come from /api/catalogue (the database).
   Nothing here is trusted by the server: it re-prices and re-validates every Dabba at quote and checkout time. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('singhanias_' + k)); return v ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('singhanias_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const money = paise => { const r = paise / 100; return '₹' + (Number.isInteger(r) ? r.toLocaleString('en-IN') : r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); };
  const weight = g => (g >= 1000 && g % 100 === 0 ? `${g / 1000}kg` : `${g}g`);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let lang = store.get('lang', 'en');
  const T = {
    min:        ['Choose at least {n} packs to create your Dabba.', 'अपना डब्बा बनाने के लिए कम से कम {n} पैक चुनिए।'],
    full:       ['Your Dabba is full. You can select up to {n} packs.', 'आपका डब्बा भर गया है। आप अधिकतम {n} पैक चुन सकते हैं।'],
    count:      ['{a} of {b} packs', '{b} में से {a} पैक'],
    empty:      ['No packs yet. Pick your favourites to begin.', 'अभी कोई पैक नहीं। शुरू करने के लिए अपनी पसंद चुनिए।'],
    inStock:    ['In stock', 'उपलब्ध'], low: ['Only {n} left', 'सिर्फ़ {n} बचे'], sold: ['Sold out', 'स्टॉक ख़त्म'],
    pack:       ['pack', 'पैक'], remove: ['Remove', 'हटाएँ'], inc: ['Add one', 'एक जोड़ें'], dec: ['Remove one', 'एक घटाएँ'],
    loadErr:    ['We could not load the menu. Please check your connection and try again.', 'मेन्यू लोड नहीं हो सका। कृपया कनेक्शन जाँचकर दोबारा कोशिश करें।'],
    retry:      ['Try again', 'दोबारा कोशिश करें'],
    off:        ['Build Your Own Dabba is not available right now.', 'अपना डब्बा बनाने की सुविधा अभी उपलब्ध नहीं है।'],
    browse:     ['Browse our single packs', 'हमारे अलग-अलग पैक देखें'],
    none:       ['Nothing is available in this size right now.', 'इस साइज़ में अभी कुछ उपलब्ध नहीं है।'],
    adding:     ['Adding…', 'जोड़ रहे हैं…'], update: ['Update My Dabba', 'मेरा डब्बा अपडेट करें'], add: ['Add My Dabba', 'मेरा डब्बा जोड़ें'],
    adjusted:   ['We adjusted your Dabba to what is in stock.', 'हमने आपका डब्बा उपलब्ध स्टॉक के हिसाब से बदल दिया।'],
    addedSub:   ['{p} packs · {w} · {t}', '{p} पैक · {w} · {t}'], updatedSub: ['Dabba updated: {p} packs · {w} · {t}', 'डब्बा अपडेट हुआ: {p} पैक · {w} · {t}'],
    from:       ['from', 'से'], pickSize: ['Pick a size', 'साइज़ चुनिए']
  };
  const tr = (k, v = {}) => T[k][lang === 'hi' ? 1 : 0].replace(/\{(\w+)\}/g, (_, x) => v[x]);

  const state = { cat: null, format: null, counts: {}, editId: null };
  let toastTimer;
  const toast = t => { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.opacity = 0, 2400); };

  /* ---------- catalogue helpers ---------- */
  const settings = () => state.cat.settings;
  const dabbaVariant = (productId, fmt) => state.cat.products.find(p => p.id === productId)?.variants.find(v => v.kind === 'dabba' && v.format === fmt);
  const products = () => state.cat.products.filter(p => p.variants.some(v => v.kind === 'dabba'));
  const packs = () => Object.values(state.counts).reduce((a, b) => a + b, 0);
  const lineFor = p => { const v = dabbaVariant(p.id, state.format); return v ? { v, qty: state.counts[p.id] || 0 } : null; };
  const subtotal = () => products().reduce((s, p) => { const l = lineFor(p); return s + (l ? l.qty * l.v.price_paise : 0); }, 0);
  const totalWeight = () => products().reduce((s, p) => { const l = lineFor(p); return s + (l ? l.qty * l.v.weight_g : 0); }, 0);
  const maxFor = p => { const l = lineFor(p); if (!l) return 0; const room = settings().max_packs - (packs() - l.qty); return Math.max(0, Math.min(l.v.available, room)); };

  /* ---------- rendering ---------- */
  function renderFormats() {
    $('formats').innerHTML = state.cat.formats.map(f => {
      const prices = products().map(p => dabbaVariant(p.id, f.id)).filter(Boolean).map(v => v.price_paise);
      const label = lang === 'hi' && f.label_hi ? f.label_hi : f.label;
      return `<button type="button" role="radio" aria-checked="${f.id === state.format}" data-format="${f.id}" class="seg min-h-[56px] rounded-lg border border-brand-gold bg-white text-brand-dark px-2 py-2 text-sm font-bold leading-tight">
        ${esc(label)}<span class="block text-[11px] font-medium opacity-80">${prices.length ? tr('from') + ' ' + money(Math.min(...prices)) : ''}</span></button>`;
    }).join('');
  }

  function renderCards() {
    const list = products().filter(p => dabbaVariant(p.id, state.format));
    if (!list.length) { $('cards').innerHTML = `<p class="rounded-lg bg-white border border-brand-gold/50 p-4 text-sm">${tr('none')}</p>`; return; }
    $('cards').innerHTML = list.map(p => {
      const v = dabbaVariant(p.id, state.format), name = esc(p.name), hi = esc(p.name_hi || ''), desc = esc(lang === 'hi' && p.short_desc_hi ? p.short_desc_hi : p.short_desc);
      return `<article class="bg-white rounded-xl border border-brand-gold/50 overflow-hidden sm:flex" data-product="${p.id}">
        <div class="sm:w-44 sm:shrink-0 aspect-[16/10] sm:aspect-auto bg-brand-card">
          <img src="${esc(p.image)}" alt="${name}" width="360" height="360" loading="lazy" decoding="async" class="w-full h-full object-cover" onerror="this.style.visibility='hidden'">
        </div>
        <div class="p-4 flex-1 min-w-0 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0"><h3 class="font-serif text-xl font-bold text-brand-dark">${name}</h3><p class="text-xs text-brand-saffron font-semibold">${hi}</p></div>
            <span data-stock class="text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap"></span>
          </div>
          <p class="text-sm text-brand-muted">${desc}</p>
          <div class="flex items-end justify-between gap-3 mt-auto pt-2">
            <div><p class="text-xs text-brand-muted">${weight(v.weight_g)} ${tr('pack')}</p><p class="font-serif text-xl font-bold text-brand-dark">${money(v.price_paise)}</p></div>
            <div class="flex items-center border border-brand-gold rounded-full overflow-hidden bg-white" role="group" aria-label="${name} quantity">
              <button type="button" data-dec="${p.id}" class="qty-btn w-11 h-11 text-xl font-bold" aria-label="${tr('dec')}: ${name}">−</button>
              <span data-qty class="w-8 text-center font-bold" aria-live="polite">0</span>
              <button type="button" data-inc="${p.id}" class="qty-btn w-11 h-11 text-xl font-bold" aria-label="${tr('inc')}: ${name}">+</button>
            </div>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function refresh() {
    const { min_packs: min, max_packs: max } = settings(), n = packs();
    // cards
    document.querySelectorAll('[data-product]').forEach(card => {
      const p = products().find(x => x.id === card.dataset.product), l = lineFor(p); if (!l) return;
      card.querySelector('[data-qty]').textContent = l.qty;
      card.querySelector('[data-dec]').disabled = l.qty <= 0;
      card.querySelector('[data-inc]').disabled = l.qty >= maxFor(p);
      const st = card.querySelector('[data-stock]');
      if (!l.v.in_stock) { st.textContent = tr('sold'); st.className = 'text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap bg-brand-dark text-white'; }
      else if (l.v.low_stock) { st.textContent = tr('low', { n: l.v.available }); st.className = 'text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap bg-brand-gold/30 text-brand-terracotta'; }
      else { st.textContent = tr('inStock'); st.className = 'text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap bg-brand-card text-brand-muted'; }
    });
    // summary
    const lines = products().map(p => ({ p, l: lineFor(p) })).filter(x => x.l && x.l.qty > 0);
    $('sum-count').textContent = n ? tr('count', { a: n, b: max }) : tr('empty');
    $('sum-items').innerHTML = lines.map(({ p, l }) => `<li class="py-2 flex items-center justify-between gap-2 text-sm">
        <span class="min-w-0"><span class="font-semibold">${l.qty}× ${esc(p.name)}</span><span class="block text-xs text-brand-muted">${weight(l.v.weight_g)} · ${money(l.v.price_paise)}</span></span>
        <span class="flex items-center gap-2"><span class="font-semibold">${money(l.qty * l.v.price_paise)}</span>
        <button type="button" data-remove="${p.id}" class="min-h-[44px] min-w-[44px] text-brand-muted hover:text-brand-terracotta" aria-label="${tr('remove')}: ${esc(p.name)}">✕</button></span></li>`).join('');
    $('sum-weight').textContent = weight(totalWeight());
    $('sum-total').textContent = money(subtotal());
    const msg = n < min ? tr('min', { n: min }) : n >= max ? tr('full', { n: max }) : '';
    $('sum-msg').textContent = msg;
    $('add-btn').disabled = n < min || n > max;
    $('add-btn').textContent = state.editId ? tr('update') : tr('add');
    // phone bar
    $('sbar-packs').textContent = tr('count', { a: n, b: max }) + (n ? ' · ' + weight(totalWeight()) : '');
    $('sbar-total').textContent = money(subtotal());
    if (!state.editId) store.set('draft', { format: state.format, counts: state.counts });
  }

  function renderAll() {
    renderFormats(); renderCards(); refresh();
    applyStaticLang();
  }

  /* ---------- selection logic ---------- */
  function setFormat(fmt) {
    if (fmt === state.format) return;
    state.format = fmt;
    let clamped = false;
    for (const p of products()) {                                   // keep quantities, but never above stock or the max
      const v = dabbaVariant(p.id, fmt), q = state.counts[p.id] || 0;
      const cap = v ? v.available : 0;
      if (q > cap) { state.counts[p.id] = cap; clamped = true; }
    }
    while (packs() > settings().max_packs) {                        // trim extras if needed
      const id = Object.keys(state.counts).reverse().find(k => state.counts[k] > 0); state.counts[id]--; clamped = true;
    }
    renderAll(); if (clamped) toast(tr('adjusted'));
  }
  function change(id, d) {
    const p = products().find(x => x.id === id); if (!p) return;
    const cur = state.counts[id] || 0;
    if (d > 0 && cur >= maxFor(p)) return;     // stock and the pack limit are both enforced here (and again by the server)
    if (d < 0 && cur <= 0) return;
    state.counts[id] = cur + d; refresh();
  }

  document.addEventListener('click', e => {
    const f = e.target.closest('[data-format]'); if (f) return setFormat(f.dataset.format);
    const inc = e.target.closest('[data-inc]'); if (inc) return change(inc.dataset.inc, 1);
    const dec = e.target.closest('[data-dec]'); if (dec) return change(dec.dataset.dec, -1);
    const rm = e.target.closest('[data-remove]'); if (rm) { state.counts[rm.dataset.remove] = 0; return refresh(); }
  });

  /* ---------- summary sheet (phones) ---------- */
  const mobile = () => matchMedia('(max-width: 1023px)').matches;
  function sheet(open) {
    $('summary').classList.toggle('open', open); $('sheet-overlay').classList.toggle('hidden', !open);
    $('sbar-open').setAttribute('aria-expanded', open); document.body.style.overflow = open && mobile() ? 'hidden' : '';
    if (open && mobile()) setTimeout(() => $('sheet-close').focus(), 50); else if (!open) $('sbar-open').focus?.();
  }
  $('sbar-open').onclick = () => sheet(true);
  $('sheet-close').onclick = $('sheet-overlay').onclick = () => sheet(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('added').classList.contains('hidden')) closeAdded(); else sheet(false); } });

  /* ---------- add to the shared cart (localStorage 'singhanias_cart') ---------- */
  const readCart = () => store.get('cart', []).filter(i => i && (i.type === 'single' || i.type === 'dabba'));
  function updateBadge() {
    const n = readCart().reduce((s, i) => s + (i.type === 'dabba' ? i.packs : i.qty), 0);
    $('cart-badge').textContent = n; $('cart-badge').classList.toggle('hidden', !n);
  }
  async function addToCart() {
    const btn = $('add-btn'); btn.disabled = true; btn.textContent = tr('adding');
    const items = products().map(p => ({ p, l: lineFor(p) })).filter(x => x.l && x.l.qty > 0).map(x => ({ sku: x.l.v.sku, qty: x.l.qty }));
    try {
      // The server validates and prices the Dabba before it goes into the cart.
      const res = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dabbas: [{ format: state.format, items }] }) });
      const q = await res.json();
      if (!res.ok || !q.ok) { await loadCatalogue(true); toast((q.errors && q.errors[0] && q.errors[0].message) || tr('loadErr')); return; }
      const sd = q.dabbas[0], fmt = state.cat.formats.find(f => f.id === state.format);
      const item = {
        type: 'dabba', id: state.editId || 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        format: sd.format, format_label: fmt ? fmt.label : sd.format_label, packs: sd.packs, weight_g: sd.weight_g, paise: sd.subtotal_paise,
        items: sd.items.map(i => ({ sku: i.sku, product: i.product_id, name: i.product_name, qty: i.qty, weight_g: i.weight_g, unit_price_paise: i.unit_price_paise }))
      };
      const cart = readCart(), at = cart.findIndex(i => i.type === 'dabba' && i.id === item.id);
      if (at >= 0) cart[at] = item; else cart.push(item);
      store.set('cart', cart); updateBadge();
      const editing = !!state.editId;
      $('added-sub').textContent = tr(editing ? 'updatedSub' : 'addedSub', { p: sd.packs, w: weight(sd.weight_g), t: money(sd.subtotal_paise) });
      sheet(false); openAdded();
      if (editing) { state.editId = null; $('edit-banner').classList.add('hidden'); history.replaceState(null, '', location.pathname); }
    } catch (e) { toast(tr('loadErr')); }
    finally { refresh(); }
  }
  $('add-btn').onclick = addToCart;
  function openAdded() { $('added').classList.remove('hidden'); $('added').classList.add('flex'); setTimeout(() => $('added-go').focus(), 50); }
  function closeAdded() { $('added').classList.add('hidden'); $('added').classList.remove('flex'); }
  $('added-again').onclick = () => { state.counts = {}; store.set('draft', null); closeAdded(); refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  /* ---------- load / states ---------- */
  function skeleton() { $('cards').innerHTML = [1, 2, 3].map(() => '<div class="skeleton h-40 rounded-xl"></div>').join(''); $('formats').innerHTML = [1, 2, 3].map(() => '<div class="skeleton h-14 rounded-lg"></div>').join(''); }
  async function loadCatalogue(keepSelection) {
    if (!keepSelection) skeleton();
    try {
      const res = await fetch('/api/catalogue'); if (!res.ok) throw 0;
      state.cat = await res.json();
    } catch (e) {
      $('formats').innerHTML = '';
      $('cards').innerHTML = `<div class="rounded-lg bg-white border border-brand-gold/50 p-5 text-sm space-y-3" role="alert"><p>${tr('loadErr')}</p><button id="retry" type="button" class="min-h-[44px] px-5 rounded-full bg-brand-terracotta text-white font-bold">${tr('retry')}</button></div>`;
      $('retry').onclick = () => loadCatalogue();
      return;
    }
    if (!state.cat.settings.dabba_enabled) {
      $('formats').innerHTML = '';
      $('cards').innerHTML = `<div class="rounded-lg bg-white border border-brand-gold/50 p-5 text-sm space-y-3"><p>${tr('off')}</p><a href="/#dabba" class="inline-block min-h-[44px] leading-[44px] px-5 rounded-full bg-brand-terracotta text-white font-bold">${tr('browse')}</a></div>`;
      $('add-btn').disabled = true; return;
    }
    const fmts = state.cat.formats.map(f => f.id);
    if (!keepSelection || !fmts.includes(state.format)) state.format = fmts.includes('regular') ? 'regular' : fmts[0];
    for (const p of products()) if (!(p.id in state.counts)) state.counts[p.id] = 0;
    for (const p of products()) { const v = dabbaVariant(p.id, state.format); if (v && state.counts[p.id] > v.available) state.counts[p.id] = v.available; }
    renderAll();
  }

  /* ---------- language ---------- */
  function applyStaticLang() {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
    document.querySelectorAll('[data-hi]').forEach(el => { if (el.dataset.en === undefined) el.dataset.en = el.innerHTML; el.innerHTML = lang === 'hi' ? el.dataset.hi : el.dataset.en; });
    $('lang-btn').textContent = lang === 'hi' ? 'English' : 'हिंदी';
    if (state.cat && $('add-btn')) $('add-btn').textContent = state.editId ? tr('update') : tr('add');
  }
  $('lang-btn').onclick = () => { lang = lang === 'hi' ? 'en' : 'hi'; store.set('lang', lang); if (state.cat && state.cat.settings.dabba_enabled) renderAll(); else applyStaticLang(); };

  /* ---------- init ---------- */
  (async () => {
    updateBadge(); applyStaticLang();
    await loadCatalogue();
    if (!state.cat || !state.cat.settings.dabba_enabled) return;
    const editId = new URLSearchParams(location.search).get('edit');
    const existing = editId && readCart().find(i => i.type === 'dabba' && i.id === editId);
    if (existing) {                                          // edit an existing Dabba from the cart
      state.editId = existing.id; state.format = existing.format; state.counts = {};
      for (const p of products()) state.counts[p.id] = 0;
      for (const it of existing.items) { const pid = state.cat.products.find(p => p.variants.some(v => v.sku === it.sku))?.id; if (pid) state.counts[pid] = it.qty; }
      $('edit-banner').classList.remove('hidden'); renderAll();
    } else {
      const d = store.get('draft', null);                    // restore an unfinished Dabba after a refresh
      if (d && state.cat.formats.some(f => f.id === d.format)) { state.format = d.format; for (const p of products()) state.counts[p.id] = Math.min(d.counts?.[p.id] || 0, dabbaVariant(p.id, d.format)?.available || 0); renderAll(); }
    }
  })();
})();
