/* Singhania's — surprise layer. Loaded after the main script in index.html
   (uses its globals: $, store, tr, T, lang, toast, REVIEWS). */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const PAL = ['#8C3A4B', '#B99A58', '#C9AE74', '#641E2B', '#3C3029', '#EADCC6'];

  Object.assign(T, {
    crunch:   ['Kurr-kurr! 😋', 'कुर्र-कुर्र! 😋'],
    secret:   ['Maa says: Khana khaya ki nahi? 😄', 'माँ पूछ रही हैं: खाना खाया कि नहीं? 😄'],
    gMorning: ['☀ Subah ki chai ke saath kuch kurkura ho jaaye?', '☀ सुबह की चाय के साथ कुछ कुरकुरा हो जाए?'],
    gNoon:    ['🌤 Dopahar ki halki bhookh? Maa ki mathri haazir hai.', '🌤 दोपहर की हल्की भूख? माँ की मठरी हाज़िर है।'],
    gEvening: ['🫖 Shaam ki chai ka time ho gaya sa!', '🫖 शाम की चाय का टाइम हो गया सा!'],
    gNight:   ['🌙 Raat ki chupke-chupke bhookh? Ek mathri banti hai.', '🌙 रात की चुपके-चुपके भूख? एक मठरी तो बनती है।'],
    unlockedFx: ['🎉 Free delivery unlocked!', '🎉 मुफ़्त डिलीवरी मिल गई!'],
    allerg:   ['Allergen info', 'एलर्जी की जानकारी'],
    allergNote: ['Have an allergy? Please message us on WhatsApp before ordering.', 'एलर्जी है? ऑर्डर से पहले कृपया WhatsApp पर हमें बताइए।'],
    orderNo:  ['Order', 'ऑर्डर'],
    copied:   ['UPI ID copied', 'UPI ID कॉपी हो गई']
  });

  /* ================= Particle engine (single canvas) ================= */
  const cv = $('fx'), cx = cv.getContext('2d');
  let W, H, raf = 0, last = 0;
  const parts = [];
  function resize() {
    const d = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const add = o => {
    if (reduced || parts.length > 700) return;
    parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: .12, drag: .99, life: 60, max: 0, size: 4, color: '#fff', type: 'dot', rot: 0, vr: 0, sway: 0 }, o, { max: o.life || 60 }));
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  };

  function draw(p, a) {
    cx.globalAlpha = a;
    if (p.type === 'spark') {
      cx.fillStyle = p.color; cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, 6.3); cx.fill();
    } else if (p.type === 'petal') {
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, .55);
      cx.fillStyle = p.color; cx.beginPath(); cx.arc(0, 0, p.size, 0, 6.3); cx.fill(); cx.restore();
    } else if (p.type === 'crumb') {
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.color; cx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .7); cx.restore();
    } else if (p.type === 'emoji') {
      cx.font = p.size + 'px serif'; cx.fillText(p.emoji, p.x, p.y);
    }
  }
  function loop(t) {
    const dt = Math.min(2, (t - last) / 16.67 || 1); last = t;
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 40) { if (p.life <= 0 && p.end) p.end(p); parts.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
      p.x += p.vx * dt + Math.sin(p.life * .1) * p.sway; p.y += p.vy * dt; p.rot += p.vr * dt;
      draw(p, Math.min(1, p.life / p.max * 2.2));
    }
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }

  const FX = {
    reduced,
    petals(x, y, n = 22) {
      for (let i = 0; i < n; i++) add({ x, y, vx: rnd(-3, 3), vy: rnd(-6, -1), g: .14, drag: .985, life: rnd(60, 100), size: rnd(4, 8), color: pick(['#C9AE74', '#D9B878', '#8C3A4B']), type: 'petal', vr: rnd(-.2, .2), sway: .6 });
    },
    rain(n = 60) {
      for (let i = 0; i < n; i++) setTimeout(() => add({ x: rnd(0, W), y: -10, vx: rnd(-.5, .5), vy: rnd(1, 2.5), g: .01, drag: 1, life: 240, size: rnd(4, 8), color: pick(['#C9AE74', '#D9B878', '#8C3A4B']), type: 'petal', vr: rnd(-.1, .1), sway: 1.2 }), i * 25);
    },
    crumbs(x, y) {
      for (let i = 0; i < 16; i++) add({ x, y, vx: rnd(-3.5, 3.5), vy: rnd(-6, -1), g: .32, life: 55, size: rnd(3, 6), color: pick(['#D9913A', '#E8B05C', '#B8741E']), type: 'crumb', vr: rnd(-.3, .3) });
    },
    sparks(x, y, n = 30) {
      for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(1, 4); add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .08, drag: .96, life: rnd(25, 45), size: rnd(1.2, 2.4), color: pick(['#FFD27A', '#C9AE74', '#D9B878']), type: 'spark' }); }
    },
    trail(x, y) {
      for (let i = 0; i < 2; i++) add({ x, y, vx: rnd(-1, 1), vy: rnd(-1, 1), g: .05, drag: .96, life: 28, size: rnd(1.2, 2.2), color: pick(['#FFD27A', '#D9B878']), type: 'spark' });
    },
    fireworks(count = 8) {
      if (reduced) return;
      for (let i = 0; i < count; i++) setTimeout(() => {
        const tx = rnd(.15, .85) * W, col = pick(['#FFB43A', '#FF7A45', '#7FB2FF', '#C9AE74', '#FF5C8A']);
        add({ x: tx, y: H, vx: rnd(-.4, .4), vy: -rnd(9, 12), g: .18, drag: 1, life: 50, size: 2.2, color: '#FFD27A', type: 'spark',
          end: p => {
            play('boom');
            for (let k = 0; k < 70; k++) { const a = k / 70 * 6.28 + rnd(-.1, .1), s = rnd(1.5, 6.5); add({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .05, drag: .965, life: rnd(55, 95), size: rnd(1.5, 3), color: k % 4 ? col : '#FFD27A', type: 'spark' }); }
          } });
      }, i * 380);
      setTimeout(() => FX.rain(50), 800);
    },
    ambient(list) {
      if (reduced) return;
      setInterval(() => { if (!document.hidden && parts.length < 40) add({ x: rnd(0, W), y: -20, vx: 0, vy: rnd(.6, 1.4), g: 0, drag: 1, life: 900, size: rnd(16, 26), type: 'emoji', emoji: pick(list), sway: .8 }); }, 1100);
    },
    bubble(x, y, text) {
      const b = document.createElement('div'); b.className = 'bubble'; b.textContent = text; b.style.left = x + 'px'; b.style.top = y + 'px';
      document.body.appendChild(b); setTimeout(() => b.remove(), 1100);
    }
  };

  /* ================= Sound (synthesised, off by default) ================= */
  let ac = null, soundOn = store.get('sound', false), droneNodes = null;
  function actx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function noise(dur, freq, q, gain) {
    const a = actx(); if (!a) return;
    const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  function tone(freq, dur, gain, delay = 0) {
    const a = actx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
    o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .05);
  }
  const SFX = {
    crunch() { noise(.12, 2800, .8, .5); setTimeout(() => noise(.09, 1800, 1, .4), 70); },
    pop() { tone(520, .12, .12); tone(780, .1, .08, .05); },
    chime() { [784, 988, 1318].forEach((f, i) => tone(f, .5, .1, i * .09)); },
    boom() { noise(.5, 120, .6, .7); noise(.35, 3000, .7, .15); }
  };
  function play(n) { if (soundOn && SFX[n]) SFX[n](); }
  // soft tanpura-style drone
  function startDrone() {
    const a = actx(); if (!a || droneNodes) return;
    const master = a.createGain(); master.gain.value = 0; master.connect(a.destination);
    master.gain.linearRampToValueAtTime(.05, a.currentTime + 2);
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = .25; lg.gain.value = .015; lfo.connect(lg); lg.connect(master.gain); lfo.start();
    const oscs = [98, 130.8, 131.3, 196].map(f => { const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(master); o.start(); return o; });
    droneNodes = { master, oscs, lfo };
  }
  function stopDrone() {
    if (!droneNodes || !ac) return;
    const { master, oscs, lfo } = droneNodes; droneNodes = null;
    master.gain.cancelScheduledValues(ac.currentTime); master.gain.linearRampToValueAtTime(0, ac.currentTime + .6);
    setTimeout(() => { oscs.forEach(o => o.stop()); lfo.stop(); }, 700);
  }
  const sndBtns = [...document.querySelectorAll('.snd-toggle')];
  const sndIcon = () => sndBtns.forEach(b => { b.querySelector('.snd-ico').textContent = soundOn ? '🔊' : '🔇'; b.setAttribute('aria-pressed', soundOn); });
  sndBtns.forEach(b => b.onclick = () => { soundOn = !soundOn; store.set('sound', soundOn); sndIcon(); if (soundOn) { actx(); SFX.pop(); startDrone(); } else stopDrone(); });
  sndIcon();
  addEventListener('pointerdown', () => { if (soundOn && !droneNodes) startDrone(); }, { once: true });

  /* ================= Diya intro (once per visit) ================= */
  const intro = $('intro');
  if (intro) {
    let seen = false; try { seen = sessionStorage.getItem('singhanias_intro'); } catch (e) {}
    if (reduced || seen) intro.remove();
    else {
      document.body.style.overflow = 'hidden';
      let ended = false;
      const end = () => {
        if (ended) return; ended = true;
        try { sessionStorage.setItem('singhanias_intro', '1'); } catch (e) {}
        intro.classList.add('out'); document.body.style.overflow = '';
        setTimeout(() => { intro.remove(); FX.rain(24); }, 700);
      };
      requestAnimationFrame(() => setTimeout(() => intro.classList.add('lit'), 150));
      intro.addEventListener('click', end); $('intro-skip').addEventListener('click', end);
      setTimeout(end, 3800);
      intro.addEventListener('pointermove', e => FX.trail(e.clientX, e.clientY));
    }
  }

  /* ================= Phuljhadi sparkler trail on the hero ================= */
  const hero = $('hero');
  if (hero) hero.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' || e.buttons) FX.trail(e.clientX, e.clientY); });

  /* ================= Sealed envelope -> handwritten letter ================= */
  const env = $('env'), story = $('story');
  function openEnv() {
    if (env.classList.contains('open')) return;
    env.classList.add('open'); story.classList.add('written'); play('pop');
    const r = env.querySelector('.seal').getBoundingClientRect(); FX.sparks(r.left + r.width / 2, r.top + r.height / 2, 40);
    setTimeout(() => env.classList.add('hidden'), 1500);
  }
  env.addEventListener('click', openEnv);
  env.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnv(); } });
  if (reduced) { env.classList.add('open', 'hidden'); story.classList.add('written'); }

  // Optional: Maa's voice note + handwritten signature (files appear only if you add them)
  if (HAS_VOICE) { $('maa-audio').src = 'audio/maa.mp3'; $('voice').classList.remove('hidden'); }
  if (HAS_SIGNATURE) { const sg = $('sig'); sg.onload = () => { sg.classList.remove('hidden'); sg.previousElementSibling.classList.add('hidden'); }; sg.src = 'images/signature.png'; }
  $('voice').onclick = () => { const a = $('maa-audio'); a.paused ? a.play() : a.pause(); };

  /* ================= Crunch on tap, fly to jhola ================= */
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-crunch]');
    if (c && !e.target.closest('button,a')) {
      FX.crunches = (FX.crunches || 0) + 1;
      FX.crumbs(e.clientX, e.clientY); FX.bubble(e.clientX, e.clientY - 10, tr('crunch')); play('crunch');
      if (navigator.vibrate) navigator.vibrate(25);
    }
    const t = e.target.closest('.vbtn[data-c="type"]');
    if (t) {
      const card = t.closest('.reveal'), v = t.dataset.v;
      card.dataset.glow = /Ghee/.test(v) ? 'ghee' : /Air/.test(v) ? 'air' : 'oil';
      const r = t.getBoundingClientRect(); FX.sparks(r.left + r.width / 2, r.top + r.height / 2, 14); play('pop');
    }
  });

  FX.play = play;
  FX.onAdd = btn => { play('chime'); };   // fallback only: the real animation lives in jhola.js
  FX.onOrder = () => { FX.fireworks(); };
  let prevTotal = null;
  FX.onCart = total => {
    if (prevTotal !== null && prevTotal < FREE_DELIVERY_ABOVE && total >= FREE_DELIVERY_ABOVE) { FX.rain(70); play('chime'); toast(tr('unlockedFx')); }
    prevTotal = total;
  };

  /* ================= Time-of-day greeting & festival mode ================= */
  FX.onLang = () => {
    const h = new Date().getHours(), el = $('greet');
    const k = h >= 5 && h < 11 ? 'gMorning' : h >= 11 && h < 16 ? 'gNoon' : h >= 16 && h < 21 ? 'gEvening' : 'gNight';
    if (el) el.textContent = tr(k);
    document.documentElement.dataset.time = h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 16 ? 'noon' : h >= 16 && h < 21 ? 'evening' : 'night';
    showFestival();
  };

  /* EDIT / verify dates each year — festival dates move. Format YYYY-MM-DD (inclusive). */
  const FESTIVALS = [
    { from: '2026-08-25', to: '2026-08-29', emo: ['🌸', '🧿', '✨'], en: '🧿 Happy Raksha Bandhan! Bhai-behen ke pyaar ke saath meetha-namkeen', hi: '🧿 रक्षाबंधन की शुभकामनाएँ! भाई-बहन के प्यार के साथ मीठा-नमकीन' },
    { from: '2026-11-04', to: '2026-11-10', emo: ['🪔', '✨', '🎆'], en: '🪔 Happy Diwali! Roshni ke saath maa ke haath ke snacks', hi: '🪔 दीपावली की शुभकामनाएँ! रोशनी के साथ माँ के हाथ के स्नैक्स' },
    { from: '2027-01-11', to: '2027-01-16', emo: ['🪁', '🪁', '✨'], en: '🪁 Happy Makar Sankranti! Patang aur kurkure snacks', hi: '🪁 मकर संक्रांति की शुभकामनाएँ! पतंग और कुरकुरे स्नैक्स' },
    { from: '2027-03-20', to: '2027-03-23', emo: ['🎨', '✨', '🌈'], en: '🎨 Happy Holi! Rang, gulal aur gujiya-mathri', hi: '🎨 होली की शुभकामनाएँ! रंग, गुलाल और गुजिया-मठरी' },
    { from: '2027-08-14', to: '2027-08-18', emo: ['🌸', '🧿', '✨'], en: '🧿 Happy Raksha Bandhan! Bhai-behen ke pyaar ke saath meetha-namkeen', hi: '🧿 रक्षाबंधन की शुभकामनाएँ! भाई-बहन के प्यार के साथ मीठा-नमकीन' },
    { from: '2027-10-25', to: '2027-11-02', emo: ['🪔', '✨', '🎆'], en: '🪔 Happy Diwali! Roshni ke saath maa ke haath ke snacks', hi: '🪔 दीपावली की शुभकामनाएँ! रोशनी के साथ माँ के हाथ के स्नैक्स' }
  ];
  let festStarted = false;
  function showFestival() {
    const n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
    const today = n.toISOString().slice(0, 10), f = FESTIVALS.find(x => today >= x.from && today <= x.to), el = $('fest');
    if (!f) { el.style.display = 'none'; return; }
    el.style.display = 'block'; el.textContent = lang === 'hi' ? f.hi : f.en;
    if (!festStarted) { festStarted = true; FX.ambient(f.emo); }
  }

  /* ================= Easter egg: tap the logo 5 times ================= */
  let taps = 0, tapT;
  document.querySelector('header a[href="#top"]').addEventListener('click', e => {
    taps++; clearTimeout(tapT); tapT = setTimeout(() => taps = 0, 2500);
    if (taps >= 5) { taps = 0; FX.bubble(e.clientX, e.clientY + 30, tr('secret')); FX.fireworks(4); play('chime'); }
  });

  /* ================= Scroll-driven bits: making steps, dabba, chai steam ================= */
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) en.target.classList.add('in'); }), { threshold: .35 });
  document.querySelectorAll('.step, #dabba-art').forEach(el => io.observe(el));
  if (reduced) document.querySelectorAll('.step, #dabba-art').forEach(el => el.classList.add('in'));
  const making = $('making');
  addEventListener('scroll', () => {
    const r = making.getBoundingClientRect(), p = Math.max(0, Math.min(1, (innerHeight * .75 - r.top) / (r.height * .8)));
    making.style.setProperty('--p', p.toFixed(3));
  }, { passive: true });
  $('dabba-art').addEventListener('click', e => { const d = $('dabba-art'); d.classList.toggle('in'); if (d.classList.contains('in')) { const r = d.getBoundingClientRect(); FX.petals(r.left + r.width / 2, r.top + 30, 12); play('pop'); } });
  const art = $('shop-art');
  art.addEventListener('pointermove', e => { const r = art.getBoundingClientRect(); art.style.setProperty('--sx', ((e.clientX - r.left) / r.width - .5) * 30 + 'px'); });

  /* ================= Chakli illustration (spirals drawn in code) ================= */
  document.querySelectorAll('path.spiral').forEach(p => {
    const cxp = +p.dataset.cx, cyp = +p.dataset.cy, k = +p.dataset.k, turns = +p.dataset.t || 3.2;
    let d = '';
    for (let t = 0.2; t < turns * 6.283; t += .12) { const r = 3 + t * k; d += (d ? 'L' : 'M') + (cxp + r * Math.cos(t)).toFixed(1) + ' ' + (cyp + r * Math.sin(t)).toFixed(1); }
    p.setAttribute('d', d);
  });

  /* ================= Customer chitthiyan (hidden until REVIEWS has entries) ================= */
  if (Array.isArray(REVIEWS) && REVIEWS.length) {
    $('reviews').classList.remove('hidden');
    $('reviews-grid').innerHTML = REVIEWS.map(r => `
      <div class="note hand rounded-sm p-5 text-brand-dark">
        <p class="text-lg leading-snug">“${r.text}”</p>
        <p class="mt-3 text-sm text-brand-terracotta font-bold">— ${r.name}${r.city ? ', ' + r.city : ''}</p>
      </div>`).join('');
  }

  window.FX = FX;
  FX.onLang(); FX.onCart(cartTotal() / 100);
})();
