/* Singhania's: motion layer (home page). Loaded after fx.js. Respects "reduce motion". */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const root = document.documentElement;
  const safe = fn => { try { fn(); } catch (e) { console.warn('anim:', e); } };

  /* ---- start the entrance animations once the diya intro has finished ---- */
  const go = () => root.classList.add('anim-go');
  if (!$('intro')) go();
  else { const mo = new MutationObserver(() => { if (!$('intro')) { mo.disconnect(); go(); } }); mo.observe(document.body, { childList: true }); setTimeout(go, 6000); }

  /* ---- hero: staggered entrance, word-by-word headline, floating petals and sparkles ---- */
  safe(() => {
    const hero = $('hero'); if (!hero) return;
    const left = hero.querySelector('.lg\\:col-span-7'), right = hero.querySelector('.lg\\:col-span-5');
    if (left) [...left.children].forEach((el, i) => { if (el.tagName === 'H1') return; el.classList.add('rise'); el.style.setProperty('--d', i); });
    if (right) right.classList.add('hero-art');
    hero.querySelector('a[href="#dabba"]')?.classList.add('cta-ring');

    const h1 = hero.querySelector('h1');
    const split = el => {
      el._busy = true; let i = 0;
      const walk = n => [...n.childNodes].forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' '));
            else { const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--wi', i++); s.textContent = p; frag.appendChild(s); }
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && !c.classList.contains('w')) walk(c);
      });
      walk(el); el._busy = false;
    };
    if (h1 && !reduced) {
      split(h1);
      new MutationObserver(() => { if (!h1._busy && !h1.querySelector('.w')) split(h1); }).observe(h1, { childList: true });   // language switch / experiments rewrite the headline
    }

    if (reduced) return;
    const box = document.createElement('div');
    box.className = 'absolute inset-0 overflow-hidden pointer-events-none'; box.setAttribute('aria-hidden', 'true');
    const cols = ['#B99A58', '#8C3A4B', '#D9B878', '#641E2B'];
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('span'); p.className = 'petal-float';
      p.style.cssText = `left:${rnd(2, 96)}%;background:${cols[i % 4]};--dx:${rnd(-80, 80)}px;animation-duration:${rnd(10, 18)}s;animation-delay:${-rnd(0, 16)}s`;
      box.appendChild(p);
    }
    for (let i = 0; i < 12; i++) {
      const t = document.createElement('span'); t.className = 'twinkle';
      t.style.cssText = `left:${rnd(2, 98)}%;top:${rnd(4, 90)}%;animation-delay:${-rnd(0, 3)}s;animation-duration:${rnd(2.4, 4.6)}s`;
      box.appendChild(t);
    }
    hero.insertBefore(box, hero.querySelector('.relative.z-10'));
  });

  /* ---- reveal variants + stagger, and section underlines ---- */
  safe(() => {
    document.querySelectorAll('.reveal').forEach(el => {
      const sibs = [...el.parentElement.children].filter(x => x.classList.contains('reveal')), i = sibs.indexOf(el);
      const grid = getComputedStyle(el.parentElement).display === 'grid' && sibs.length > 1;
      el.classList.add(grid ? ['rv-left', 'rv-zoom', 'rv-right'][i % 3] : 'rv-zoom');
      if (sibs.length > 1) el.style.transitionDelay = (i * 90) + 'ms';
    });
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      if (el.classList.contains('uline')) el.classList.add('in');
      else setTimeout(() => { el.style.transitionDelay = ''; }, 1600);   // keep hover effects instant afterwards
    }), { threshold: .15 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
    document.querySelectorAll('main section h2').forEach(h => {
      if (getComputedStyle(h).textAlign !== 'center') return;
      const u = document.createElement('div'); u.className = 'uline'; u.setAttribute('aria-hidden', 'true'); h.after(u); io.observe(u);
    });
    document.querySelectorAll('#promise .reveal > div:first-child').forEach(el => el.classList.add('pi'));
  });

  /* ---- count-up numbers ---- */
  safe(() => {
    const els = document.querySelectorAll('[data-count]'); if (!els.length) return;
    const run = el => {
      const to = +el.dataset.count, suf = el.dataset.suffix || '';
      if (reduced) { el.textContent = to + suf; return; }
      const t0 = performance.now(), dur = 1500;
      const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { threshold: .6 });
    if (reduced) { els.forEach(run); return; }   // reduce motion: show the final numbers straight away
    els.forEach(el => { el.textContent = '0' + (el.dataset.suffix || ''); io.observe(el); });
  });

  /* ---- button ripple ---- */
  safe(() => {
    document.querySelectorAll('#hero a.rounded-full, [data-add], #order-btn, #gift-wa, .vbtn, #pay-wa, #reorder-btn').forEach(el => el.classList.add('rip'));
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest('.rip'); if (!b || reduced || b.disabled) return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span');
      s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
      b.appendChild(s); setTimeout(() => s.remove(), 700);
    });
  });

  /* ---- pointer effects (mouse only): image tilt + magnetic hero buttons ---- */
  if (fine && !reduced) safe(() => {
    document.querySelectorAll('#dabba .arch, #hero .arch').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--ty', ((e.clientX - r.left) / r.width - .5) * 8 + 'deg'); el.style.setProperty('--tx', (-((e.clientY - r.top) / r.height - .5)) * 8 + 'deg'); });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg'); });
    });
    document.querySelectorAll('#hero a.rounded-full').forEach(el => {
      el.classList.add('magnetic');
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${((e.clientX - r.left) / r.width - .5) * 10}px, ${((e.clientY - r.top) / r.height - .5) * 8}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  });

  /* ---- cart: items slide in when the drawer opens; totals bump when they change ---- */
  safe(() => {
    const drawer = $('cart-drawer'), list = $('cart-items-container');
    if (drawer && list && !reduced) new MutationObserver(() => {
      if (!drawer.classList.contains('translate-x-full')) { list.classList.add('stagger'); setTimeout(() => list.classList.remove('stagger'), 1000); }
    }).observe(drawer, { attributes: true, attributeFilter: ['class'] });
    ['cart-total-price', 'cart-badge', 'mbar-info'].forEach(id => {
      const el = $(id); if (!el || reduced) return; let last = el.textContent;
      new MutationObserver(() => { if (el.textContent === last) return; last = el.textContent; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  });

  /* ---- dusk footer: stars ---- */
  safe(() => {
    const dusk = document.querySelector('.dusk'); if (!dusk || reduced) return;
    for (let i = 0; i < 30; i++) {
      const s = document.createElement('span'); s.className = 'star';
      s.style.cssText = `left:${rnd(1, 99)}%;top:${rnd(2, 50)}%;animation-delay:${-rnd(0, 4)}s;animation-duration:${rnd(2.5, 5)}s;opacity:0`;
      dusk.appendChild(s);
    }
  });

  /* ---- scroll: progress bar, hero parallax, back-to-top ---- */
  safe(() => {
    const bar = document.createElement('div'); bar.id = 'scroll-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
    const top = document.createElement('button');
    top.type = 'button'; top.setAttribute('aria-label', 'Back to top'); top.textContent = '↑';
    top.className = 'fixed right-4 bottom-36 md:bottom-24 z-40 w-12 h-12 rounded-full bg-brand-terracotta text-white text-xl font-bold shadow-xl';
    top.style.cssText = 'opacity:0;transform:translateY(20px) scale(.8);pointer-events:none;transition:opacity .3s,transform .4s cubic-bezier(.3,1.6,.5,1)';
    top.onclick = () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    document.body.appendChild(top);
    const heroImg = document.querySelector('#hero .arch img'); let ticking = false, shown = false;
    const update = () => {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      if (heroImg && !reduced && y < 1400) heroImg.style.translate = `0 ${Math.min(60, y * .09)}px`;
      const show = y > 900;
      if (show !== shown) { shown = show; top.style.opacity = show ? 1 : 0; top.style.transform = show ? 'none' : 'translateY(20px) scale(.8)'; top.style.pointerEvents = show ? 'auto' : 'none'; }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  });
})();
