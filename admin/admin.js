/* Minimal admin. Every call carries the Bearer token; the Worker checks it server-side. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupees = p => (p / 100).toFixed(2);
  let token = ''; try { token = sessionStorage.getItem('singhanias_admin') || ''; } catch (e) {}
  let msgTimer;

  function say(text, bad) {
    const m = $('msg'); m.textContent = text; m.className = 'rounded-lg px-4 py-3 text-sm font-semibold ' + (bad ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-900');
    clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.add('hidden'), 4000);
  }
  async function call(path, method = 'GET', body) {
    const res = await fetch(path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch (e) {}
    if (res.status === 401) { signOut(); throw new Error('Wrong or expired token'); }
    if (!res.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }
  const act = async (fn, ok) => { try { await fn(); say(ok); await load(); } catch (e) { say(e.message, true); } };

  function signOut() { token = ''; try { sessionStorage.removeItem('singhanias_admin'); } catch (e) {} $('app').classList.add('hidden'); $('login').classList.remove('hidden'); $('logout').classList.add('hidden'); }

  function render(d) {
    $('s-enabled').checked = d.settings.dabba_enabled; $('s-min').value = d.settings.min_packs; $('s-max').value = d.settings.max_packs;
    $('s-low').value = d.settings.low_stock_threshold; $('s-hours').value = d.settings.reservation_hours;
    $('s-tiers').value = (d.settings.dabba_tiers || []).map(t => `${t.min_packs}:${t.percent}`).join(', ');
    $('formats').innerHTML = d.formats.map(f => `<label class="flex items-center gap-2 font-semibold"><input type="checkbox" data-format="${esc(f.id)}" ${f.enabled ? 'checked' : ''} class="w-5 h-5"> ${esc(f.label)} format</label>`).join('');
    $('products').innerHTML = d.products.map(p => `
      <div>
        <label class="flex items-center gap-2 font-bold mb-2"><input type="checkbox" data-product="${esc(p.id)}" ${p.enabled ? 'checked' : ''} class="w-5 h-5"> ${esc(p.name)}</label>
        <div class="overflow-x-auto"><table class="w-full text-sm min-w-[640px]"><thead><tr class="text-left text-xs text-brand-muted"><th class="py-1">SKU</th><th>Pack</th><th>Price ₹</th><th>Weight g</th><th>On hand</th><th>Reserved</th><th>Available</th><th>On sale</th></tr></thead><tbody>
        ${p.variants.map(v => `<tr class="border-t border-brand-gold/30" data-sku="${esc(v.sku)}">
          <td class="py-1.5 font-mono text-xs">${esc(v.sku)}</td><td>${esc(v.label)}</td>
          <td><input data-f="price" type="number" step="0.01" min="0" value="${rupees(v.price_paise)}" class="w-24 px-2 py-1 rounded border border-brand-dark/30"></td>
          <td><input data-f="weight" type="number" min="1" value="${v.weight_g}" class="w-20 px-2 py-1 rounded border border-brand-dark/30"></td>
          <td><input data-f="qty" type="number" min="0" value="${v.qty}" class="w-20 px-2 py-1 rounded border border-brand-dark/30"></td>
          <td>${v.reserved}</td><td class="font-semibold ${v.qty - v.reserved <= d.settings.low_stock_threshold ? 'text-red-700' : ''}">${v.qty - v.reserved}</td>
          <td><input data-f="enabled" type="checkbox" ${v.enabled ? 'checked' : ''} class="w-5 h-5"></td>
          <td><button type="button" data-save="${esc(v.sku)}" class="px-3 min-h-[36px] rounded-full bg-brand-terracotta text-white text-xs font-bold">Save</button></td></tr>`).join('')}
        </tbody></table></div>
      </div>`).join('');
    $('orders').innerHTML = d.orders.length ? d.orders.map(o => `
      <div class="border border-brand-gold/40 rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-2">
        <div><b>${esc(o.id)}</b> · ₹${rupees(o.total_paise)} · <span class="font-semibold ${o.status === 'paid' ? 'text-green-800' : o.status === 'pending' ? 'text-brand-terracotta' : 'text-brand-muted'}">${esc(o.status)}</span>
          <div class="text-xs text-brand-muted">${esc(o.customer.name)} · ${esc(o.customer.phone)} · ${new Date(o.created_at).toLocaleString('en-IN')}${o.ref ? ' · ' + esc(o.ref) : ''}</div></div>
        ${o.status === 'pending' ? `<div class="flex gap-2"><button data-paid="${esc(o.id)}" class="px-4 min-h-[44px] rounded-full bg-green-700 text-white font-bold text-xs">Mark paid</button><button data-cancel="${esc(o.id)}" class="px-4 min-h-[44px] rounded-full border border-brand-dark/40 font-bold text-xs">Cancel</button></div>` : ''}
      </div>`).join('') : '<p class="text-sm text-brand-muted">No orders yet.</p>';
    $('movements').innerHTML = d.movements.length ? d.movements.map(m => `<div>${esc(m.created_at.slice(0, 16).replace('T', ' '))} · ${esc(m.sku)} · ${esc(m.reason)} · on hand ${m.delta >= 0 ? '+' : ''}${m.delta}, reserved ${m.reserved_delta >= 0 ? '+' : ''}${m.reserved_delta}${m.order_id ? ' · ' + esc(m.order_id) : ''}</div>`).join('') : 'No movements yet.';
  }

  async function load() { render(await call('/api/admin/state')); }

  $('login-btn').onclick = async () => {
    token = $('token').value.trim(); $('login-err').textContent = '';
    try { await load(); try { sessionStorage.setItem('singhanias_admin', token); } catch (e) {} $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('logout').classList.remove('hidden'); }
    catch (e) { $('login-err').textContent = e.message === 'admin_not_configured' ? 'Admin is not configured on the server yet.' : 'That token did not work.'; }
  };
  $('token').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });
  $('logout').onclick = signOut; $('refresh').onclick = () => act(load, 'Refreshed');

  const parseTiers = txt => txt.split(',').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d+)\s*:\s*(\d+)$/); if (!m) throw new Error('Tiers look like 3:10, 6:15'); return { min_packs: +m[1], percent: +m[2] }; });
  $('s-save').onclick = () => act(() => call('/api/admin/settings', 'PUT', { dabba_enabled: $('s-enabled').checked, min_packs: +$('s-min').value, max_packs: +$('s-max').value, low_stock_threshold: +$('s-low').value, reservation_hours: +$('s-hours').value, dabba_tiers: parseTiers($('s-tiers').value) }), 'Settings saved');

  document.addEventListener('change', e => {
    const f = e.target.closest('[data-format]'); if (f) return act(() => call('/api/admin/formats/' + f.dataset.format, 'PUT', { enabled: f.checked }), 'Format updated');
    const p = e.target.closest('[data-product]'); if (p) return act(() => call('/api/admin/products/' + p.dataset.product, 'PUT', { enabled: p.checked }), 'Product updated');
  });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-save]');
    if (s) {
      const row = s.closest('tr'), g = f => row.querySelector(`[data-f="${f}"]`);
      return act(async () => {
        await call('/api/admin/variants/' + s.dataset.save, 'PUT', { price_paise: Math.round(parseFloat(g('price').value) * 100), weight_g: parseInt(g('weight').value, 10), enabled: g('enabled').checked });
        await call('/api/admin/stock/' + s.dataset.save, 'POST', { qty: parseInt(g('qty').value, 10) });
      }, 'Saved ' + s.dataset.save);
    }
    const paid = e.target.closest('[data-paid]'); if (paid) return act(() => call(`/api/admin/orders/${paid.dataset.paid}/paid`, 'POST'), 'Marked paid');
    const can = e.target.closest('[data-cancel]'); if (can && confirm('Cancel this order and release its stock?')) return act(() => call(`/api/admin/orders/${can.dataset.cancel}/cancel`, 'POST'), 'Order cancelled');
  });

  if (token) { load().then(() => { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('logout').classList.remove('hidden'); }).catch(() => signOut()); }
})();
