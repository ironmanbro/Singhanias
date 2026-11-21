/* Mathu the mascot. Shared by the home page and the Dabba page.
   Public API: window.Mathu.say(english, hindi)  ·  window.Mathu.show()  ·  window.Mathu.hide()  */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const LS = k => { try { return JSON.parse(localStorage.getItem('singhanias_' + k)); } catch (e) { return null; } };
  const lang = () => (LS('lang') === 'hi' ? 1 : 0);
  const T = {
    greet: ["Ram Ram sa! I'm Mathu, Maa's crunchiest helper. 🙏", 'राम राम सा! मैं मठू हूँ, माँ का कुरकुरा साथी। 🙏'],
    tips: [
      ['Tap any snack photo and hear it go crunch! 😋', 'किसी भी स्नैक की फ़ोटो पर टैप करो, कुरकुरी आवाज़ सुनो! 😋'],
      ['Build your own Dabba: pick 3 to 6 packs!', 'अपना डब्बा बनाओ: 3 से 6 पैक चुनो!'],
      ['Chai + mathri = the perfect pair, sa! ☕', 'चाय + मठरी = बढ़िया जोड़ी, सा! ☕'],
      ['Got an allergy? Please check the allergy list first.', 'एलर्जी है? पहले एलर्जी की सूची देख लो।'],
      ['Planning a gift or a big order? Message Maa on WhatsApp!', 'गिफ़्ट या बड़ा ऑर्डर? माँ को WhatsApp करो!'],
      ['Psst… try tapping the logo five times. 🤫', 'श्श… लोगो पर पाँच बार टैप करके देखो। 🤫']
    ],
    added: ['Wah! Great choice! 🎉', 'वाह! बढ़िया पसंद! 🎉'],
    full: ['Your Dabba is full! Press "Add My Dabba". 📦', 'आपका डब्बा भर गया! "मेरा डब्बा जोड़ें" दबाइए। 📦'],
    dabba: ['Time to pick your favourites! 😋', 'अब अपनी पसंद चुनने का समय! 😋'],
    allergy: ['Allergies matter. Do read the list below. 💛', 'एलर्जी ज़रूरी है। नीचे की सूची ज़रूर पढ़िए। 💛'],
    order: ['Dhanyavaad sa! Maa will reply on WhatsApp. 🙏', 'धन्यवाद सा! माँ WhatsApp पर जवाब देंगी। 🙏'],
    hide: ['Hide Mathu', 'मठू को छिपाएँ'], aria: ['Mathu, our mascot. Tap for a tip.', 'मठू, हमारा शुभंकर। टिप के लिए टैप करें।'], back: ['Bring Mathu back', 'मठू को वापस बुलाएँ'], close: ['Close', 'बंद करें']
  };
  const tx = k => T[k][lang()];

  const SVG = `
<svg viewBox="0 0 100 112" role="img" aria-hidden="true" focusable="false">
  <ellipse cx="50" cy="108" rx="26" ry="3.5" fill="#3C3029" opacity=".18"/>
  <g class="m-bob">
    <ellipse cx="38" cy="100" rx="9" ry="5" fill="#8C3A4B"/><ellipse cx="62" cy="100" rx="9" ry="5" fill="#8C3A4B"/>
    <g class="m-hand"><ellipse cx="91" cy="64" rx="8" ry="6.5" fill="#E8B05C" stroke="#B8741E" stroke-width="2.5"/></g>
    <ellipse cx="9" cy="68" rx="7" ry="6" fill="#E8B05C" stroke="#B8741E" stroke-width="2.5"/>
    <circle cx="50" cy="62" r="38" fill="#E8B05C" stroke="#B8741E" stroke-width="3"/>
    <g fill="#B8741E" opacity=".5"><circle cx="24" cy="58" r="1.8"/><circle cx="76" cy="58" r="1.8"/><circle cx="20" cy="72" r="1.8"/><circle cx="80" cy="72" r="1.8"/><circle cx="30" cy="86" r="1.8"/><circle cx="70" cy="86" r="1.8"/><circle cx="50" cy="92" r="1.8"/><circle cx="36" cy="48" r="1.5"/><circle cx="64" cy="48" r="1.5"/></g>
    <path d="M14 46c2-24 20-32 36-32s34 8 36 32c-11-9-23-12-36-12S25 37 14 46z" fill="#641E2B"/>
    <path d="M17 44c11-8 22-11 33-11s22 3 33 11" fill="none" stroke="#B99A58" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M30 25c9-6 31-6 40 0M26 33c13-6 35-6 48 0" fill="none" stroke="#8C3A4B" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="50" cy="27" r="5.5" fill="#B99A58" stroke="#8C6B1F" stroke-width="1.5"/><path d="M50 22c-2-8 3-13 8-14-2 4-1 9-3 13z" fill="#C9AE74"/>
    <g class="m-eyes"><ellipse cx="37" cy="60" rx="7" ry="8" fill="#fff"/><ellipse cx="63" cy="60" rx="7" ry="8" fill="#fff"/>
      <circle class="m-pupil" data-cx="37" data-cy="61" cx="37" cy="61" r="3.6" fill="#3C3029"/><circle class="m-pupil" data-cx="63" data-cy="61" cx="63" cy="61" r="3.6" fill="#3C3029"/>
      <circle cx="38.5" cy="59" r="1.1" fill="#fff"/><circle cx="64.5" cy="59" r="1.1" fill="#fff"/></g>
    <ellipse cx="27" cy="73" rx="5.5" ry="3.2" fill="#E58A8A" opacity=".65"/><ellipse cx="73" cy="73" rx="5.5" ry="3.2" fill="#E58A8A" opacity=".65"/>
    <path d="M50 71c-7-4-15-3-20 2 4-1 7 0 9 2M50 71c7-4 15-3 20 2-4-1-7 0-9 2" fill="none" stroke="#3C3029" stroke-width="3" stroke-linecap="round"/>
    <path d="M43 78c4 5 10 5 14 0" fill="none" stroke="#3C3029" stroke-width="3" stroke-linecap="round"/>
    <text class="m-zzz" x="78" y="30">z</text>
  </g>
</svg>`;

  let root, bubble, btn, hideTimer, tipIdx = Math.floor(Math.random() * 6), sleepTimer;
  const pupils = () => root.querySelectorAll('.m-pupil');

  function build() {
    if (document.getElementById('mathu')) return;
    root = document.createElement('div'); root.id = 'mathu'; root.className = 'mathu';
    root.innerHTML = `<div class="mathu-bubble" role="status" aria-live="polite"><span class="m-msg"></span><button type="button" class="m-x" aria-label="${tx('close')}">✕</button><button type="button" class="hide"></button></div><button type="button" class="mathu-btn" aria-label="${tx('aria')}">${SVG}</button>`;
    document.body.appendChild(root);
    bubble = root.querySelector('.mathu-bubble'); btn = root.querySelector('.mathu-btn');
    btn.onclick = () => { hop(); say(...T.tips[tipIdx++ % T.tips.length]); };
    root.querySelector('.m-x').onclick = () => bubble.classList.remove('show');
    root.querySelector('.hide').onclick = () => hideForever();
    wake();
  }
  function hop() { if (reduced) return; root.classList.remove('hop'); void root.offsetWidth; root.classList.add('hop'); setTimeout(() => root && root.classList.remove('hop'), 650); }
  function say(en, hi, ms = 5200) {
    if (!root) return; wake();
    bubble.querySelector('.m-msg').textContent = lang() ? hi : en;
    bubble.querySelector('.hide').textContent = tx('hide');
    btn.setAttribute('aria-label', tx('aria'));
    bubble.classList.add('show'); clearTimeout(hideTimer); hideTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }
  function hideForever() { try { localStorage.setItem('singhanias_mathu_off', '1'); } catch (e) {} root && root.remove(); root = null; footerLink(); }
  function show() { try { localStorage.removeItem('singhanias_mathu_off'); } catch (e) {} build(); hop(); say(...T.greet); footerLink(); }
  function footerLink() {
    const a = document.getElementById('mathu-back'); if (!a) return;
    const off = !document.getElementById('mathu'); a.classList.toggle('hidden', !off); a.textContent = tx('back');
  }

  /* sleepy after a while, wakes on any interaction */
  function wake() { if (!root) return; root.classList.remove('sleep'); clearTimeout(sleepTimer); sleepTimer = setTimeout(() => root && root.classList.add('sleep'), 60000); }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => addEventListener(ev, () => { if (root && root.classList.contains('sleep')) wake(); else if (root) { clearTimeout(sleepTimer); sleepTimer = setTimeout(() => root && root.classList.add('sleep'), 60000); } }, { passive: true }));

  /* eyes follow the mouse */
  if (fine && !reduced) {
    let raf = 0, mx = 0, my = 0;
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(() => {
      raf = 0; if (!root) return;
      const r = btn.getBoundingClientRect(), dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height * .55), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220) * 2.6;
      pupils().forEach(p => { p.style.transform = `translate(${dx / d * k}px, ${dy / d * k}px)`; });
    }); }, { passive: true });
  }

  /* reactions */
  function watch() {
    const once = new Set();
    const sayOnce = (key, k) => { if (once.has(key)) return; try { if (sessionStorage.getItem('mathu_' + key)) return; sessionStorage.setItem('mathu_' + key, '1'); } catch (e) {} once.add(key); say(...T[k]); hop(); };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); sayOnce(e.target.id, e.target.id === 'allergy' ? 'allergy' : 'dabba'); } }), { threshold: .35 });
    ['dabba', 'allergy'].forEach(id => { const el = document.getElementById(id); if (el && location.pathname === '/') io.observe(el); });
    const badge = document.getElementById('cart-badge');
    if (badge) { let last = badge.textContent; new MutationObserver(() => { const now = badge.textContent; if (+now > +last) { say(...T.added, 3000); hop(); } last = now; }).observe(badge, { childList: true, characterData: true, subtree: true }); }
    const pay = document.getElementById('pay-modal');
    if (pay) new MutationObserver(() => { if (!pay.classList.contains('hidden')) say(...T.order, 6000); }).observe(pay, { attributes: true, attributeFilter: ['class'] });
  }

  window.Mathu = { say: (en, hi, ms) => { if (root) { say(en, hi, ms); hop(); } }, show, hide: hideForever };

  function start() {
    if (LS('mathu_off')) { footerLink(); return; }
    build(); watch(); footerLink();
    const greet = () => { try { if (sessionStorage.getItem('mathu_greet')) return; sessionStorage.setItem('mathu_greet', '1'); } catch (e) {} if (!/build-your-dabba/.test(location.pathname)) { say(...T.greet, 5600); hop(); } else { say(...T.dabba, 4200); } };
    const wait = () => { if (document.getElementById('intro')) return setTimeout(wait, 400); setTimeout(greet, 1800); };
    wait();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
