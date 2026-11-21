/* Add-to-Jhola animation, shared by the home page and the Dabba page.
   Jhola.add(button, qty)        shop buttons: tick on the button + snack flies to the Jhola + bag catches it
   Jhola.fly({ from, to, src | brass, label })  returns a Promise that resolves when the bag has caught the snack */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);          // easeInOutCubic
  const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const bez = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  const hi = () => document.documentElement.lang === 'hi';
  const GOLD = ['#B99A58', '#C9AE74', '#E8D08C', '#8C3A4B'];

  function ring(el) { const r = document.createElement('span'); r.className = 'jh-ring'; el.appendChild(r); setTimeout(() => r.remove(), 850); }
  function sparkles(el) {
    const c = center(el), n = 9;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span'), ang = (i / n) * Math.PI * 2 + Math.random() * .5, d = 30 + Math.random() * 26;
      s.className = 'jh-spark'; s.style.left = c.x + 'px'; s.style.top = c.y + 'px'; s.style.background = GOLD[i % GOLD.length];
      s.style.setProperty('--dx', Math.cos(ang) * d + 'px'); s.style.setProperty('--dy', Math.sin(ang) * d + 'px'); s.style.width = s.style.height = 7 + Math.random() * 6 + 'px';
      document.body.appendChild(s); setTimeout(() => s.remove(), 800);
    }
  }
  function floatLabel(el, text) {
    const c = center(el), l = document.createElement('span');
    l.className = 'jh-label'; l.textContent = text; l.style.left = c.x + 'px'; l.style.top = c.y + 16 + 'px';
    document.body.appendChild(l); setTimeout(() => l.remove(), 1100);
  }
  function catchBag(el, label) {
    if (!el) return;
    if (!reduced) { el.classList.remove('jh-catch'); void el.offsetWidth; el.classList.add('jh-catch'); setTimeout(() => el.classList.remove('jh-catch'), 800); ring(el); sparkles(el); }
    if (label) floatLabel(el, label);
  }

  function fly(o) {
    return new Promise(resolve => {
      const from = o.from, to = o.to;
      if (!from || !to) return resolve();
      if (reduced) { catchBag(to, o.label); return resolve(); }
      const a = center(from), b = center(to), dist = Math.hypot(b.x - a.x, b.y - a.y);
      const lift = Math.min(210, 80 + dist * .34), side = (b.x > a.x ? -1 : 1) * Math.min(70, dist * .09);
      const c = { x: (a.x + b.x) / 2 + side, y: Math.min(a.y, b.y) - lift };
      const N = 44, dur = Math.max(800, Math.min(1150, 620 + dist * .55));
      const frames = (size, endScale, spin, opacity) => Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N, p = bez(a, c, b, ease(t));
        const pop = t < .14 ? Math.sin(t / .14 * Math.PI) * .14 : 0;                       // small "lift off" swell at the start
        const sc = 1 - (1 - endScale) * ease(Math.max(0, (t - .12) / .88)) + pop;
        return { offset: t, transform: `translate(${p.x - size / 2}px, ${p.y - size / 2}px) scale(${sc}) rotate(${spin * ease(t) + Math.sin(t * Math.PI * 2) * 7}deg)`, opacity: (t > .92 ? (1 - t) / .08 : 1) * opacity };
      });
      const mk = (cls, size) => { const d = document.createElement('div'); d.className = cls; d.style.width = d.style.height = size + 'px'; if (o.src) d.style.backgroundImage = `url("${o.src}")`; return d; };

      const token = mk('jh-token' + (o.brass ? ' brass' : ''), 56);
      if (o.brass) token.textContent = 'S';
      document.body.appendChild(token);
      const main = token.animate(frames(56, .3, 20, 1), { duration: dur, easing: 'linear', fill: 'forwards' });

      for (let i = 1; i <= 5; i++) setTimeout(() => {                                          // comet trail: faint copies that follow
        const g = mk('jh-ghost', 44 - i * 4); document.body.appendChild(g);
        g.animate(frames(44 - i * 4, .25, 10, .34 - i * .05), { duration: dur - i * 40, easing: 'linear', fill: 'forwards' }).onfinish = () => g.remove();
      }, i * 42);

      main.onfinish = () => { token.remove(); catchBag(to, o.label); resolve(); };
    });
  }

  function buttonDone(btn) {
    if (!btn) return;
    btn.classList.remove('jh-press'); void btn.offsetWidth; btn.classList.add('jh-press');
    if (!btn.dataset.jhBusy) {
      btn.dataset.jhBusy = '1'; btn._jhHTML = btn.innerHTML; btn.style.minWidth = btn.offsetWidth + 'px';
      btn.innerHTML = `<span class="jh-ico"><svg class="jh-tick" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 8.8"/></svg>${hi() ? 'जुड़ गया' : 'Added'}</span>`;
      btn.classList.add('jh-done');
    }
    clearTimeout(btn._jhT);
    btn._jhT = setTimeout(() => { btn.classList.remove('jh-done'); btn.innerHTML = btn._jhHTML; btn.style.minWidth = ''; delete btn.dataset.jhBusy; }, 1700);
  }

  function add(btn, n) {
    buttonDone(btn);
    const card = btn.closest('.reveal'), img = card && card.querySelector('img');
    return fly({ from: btn, to: document.getElementById('cart-btn'), src: img ? (img.currentSrc || img.src) : '', label: '+' + (n || 1) })
      .then(() => { if (window.FX && FX.play) FX.play('chime'); });
  }

  window.Jhola = { add, fly, catchBag, buttonDone };
})();
