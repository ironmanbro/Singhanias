/* Singhania's extras (home page): allergen checker and the chai-time quiz. Language follows the site toggle. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hiLang = () => { try { return JSON.parse(localStorage.getItem('singhanias_lang')) === 'hi'; } catch (e) { return false; } };
  const NAMES = { swali: 'Signature Swali', chakli: 'Signature Chakli', chivda: 'Signature Chiwda' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ================= allergen checker ================= */
  const avoid = new Set();
  const AC = {
    tap:  ['Tap an allergen above', 'ऊपर किसी एलर्जी पर टैप कीजिए'],
    suit: ['Suits you', 'आपके लिए ठीक है'],
    ghee: ['Suits you in Fresh Oil or Air-Fried (not the Pure Desi Ghee version)', 'फ़्रेश ऑयल या एयर-फ्राइड में ठीक है (शुद्ध देसी घी वाले में नहीं)'],
    has:  ['Contains', 'इसमें है'], gheeNote: ['(milk only in the ghee version)', '(दूध सिर्फ़ घी वाले में)']
  };
  function renderChecker() {
    const C = window.ALLERGEN_CHECK, box = $('ac-toggles'), out = $('ac-results'); if (!C || !box) return;
    const h = hiLang() ? 1 : 0, label = k => { const it = C.items.find(x => x[0] === k); return it ? it[1 + h] : k; };
    box.innerHTML = C.items.map(([k, en, hn]) => `<button type="button" data-ac="${k}" aria-pressed="${avoid.has(k)}" class="ac-chip min-h-[44px] px-4 rounded-full border border-brand-gold bg-white text-sm font-bold">${h ? hn : en}</button>`).join('');
    out.innerHTML = Object.keys(NAMES).map(p => {
      const hits = (C.has[p] || []).filter(a => avoid.has(a)), ghee = (C.gheeOnly && C.gheeOnly[p]) || [], hard = hits.filter(a => !ghee.includes(a));
      let cls = '', msg = AC.tap[h];
      if (avoid.size) {
        if (hard.length) { cls = 'no'; msg = `${AC.has[h]} ${hard.map(label).join(', ').toLowerCase()}` + (hits.length > hard.length ? ' ' + AC.gheeNote[h] : ''); }
        else if (hits.length) { cls = 'ok'; msg = AC.ghee[h]; }
        else { cls = 'ok'; msg = AC.suit[h]; }
      }
      return `<div class="ac-res ${cls}"><b class="font-serif text-lg">${NAMES[p].replace('Signature ', '')}</b><span>${esc(msg)}</span></div>`;
    }).join('');
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ac]'); if (!b) return;
    avoid.has(b.dataset.ac) ? avoid.delete(b.dataset.ac) : avoid.add(b.dataset.ac);
    renderChecker(); const nb = document.querySelector(`[data-ac="${b.dataset.ac}"]`); if (nb) nb.focus();
  });

  /* ================= chai-time quiz ================= */
  const QS = [
    { q: ['Your chai is…', 'आपकी चाय…'], o: [['Kadak, with extra adrak', 'कड़क, अदरक वाली', 'swali'], ['Milky and sweet', 'दूध वाली और मीठी', 'chakli'], ['Light, maybe green tea', 'हल्की, शायद ग्रीन टी', 'chivda']] },
    { q: ['Pick your crunch', 'अपना कुरकुरापन चुनिए'], o: [['Flaky and layered', 'परतदार और खस्ता', 'swali'], ['Loud and spiral', 'ज़ोरदार और गोल-गोल', 'chakli'], ['Light and tangy', 'हल्का और चटपटा', 'chivda']] },
    { q: ['Snack time is for…', 'नाश्ते का समय है…'], o: [['Slow evenings at home', 'घर की धीमी शामों के लिए', 'swali'], ['Sharing with the whole family', 'पूरे परिवार के साथ बाँटने के लिए', 'chakli'], ['Quick munching between work', 'काम के बीच जल्दी-जल्दी खाने के लिए', 'chivda']] }
  ];
  const LINES = {
    swali: ['Classic, warm and dependable. You are the one everyone comes home to.', 'क्लासिक, गर्मजोशी भरे और भरोसेमंद। आप वो हैं जिनके पास सब घर लौटते हैं।'],
    chakli: ['Bold, festive and a little dramatic. Every gathering needs you.', 'बेबाक, उत्सवी और थोड़े नाटकीय। हर महफ़िल को आपकी ज़रूरत है।'],
    chivda: ['Light, lively and always on the move. Tangy, with a surprise in every handful.', 'हल्के, चुलबुले और हमेशा चलते-फिरते। चटपटे, हर मुट्ठी में एक नया मज़ा।']
  };
  const QT = { you: ['You are', 'आप हैं'], add: ['Add to my Dabba', 'मेरे डब्बे में डालें'], again: ['Take it again', 'दोबारा खेलें'], of: ['Question {a} of {b}', 'सवाल {a} / {b}'] };
  let qi = 0, score = {}, winner = null;

  function renderQuiz() {
    const body = $('quiz-body'), dots = $('quiz-dots'); if (!body) return;
    const h = hiLang() ? 1 : 0;
    dots.innerHTML = QS.map((_, i) => `<i class="quiz-dot${i < Math.min(qi + 1, QS.length) ? ' on' : ''}"></i>`).join('');
    if (qi < QS.length) {
      const Q = QS[qi];
      body.innerHTML = `<div class="q-slide"><p class="text-xs font-bold uppercase tracking-widest text-brand-saffron">${QT.of[h].replace('{a}', qi + 1).replace('{b}', QS.length)}</p>
        <h3 class="font-serif text-2xl font-bold text-brand-terracotta mt-1 mb-4">${Q.q[h]}</h3>
        <div class="space-y-2.5">${Q.o.map(([en, hn, k]) => `<button type="button" data-q="${k}" class="quiz-opt block w-full text-left min-h-[48px] px-4 py-3 rounded-xl border border-brand-gold/50 bg-white font-semibold">${esc(h ? hn : en)}</button>`).join('')}</div></div>`;
    } else {
      const k = winner, nm = NAMES[k];
      body.innerHTML = `<div class="q-slide quiz-result grid grid-cols-[96px_1fr] sm:grid-cols-[130px_1fr] gap-5 items-center">
        <img src="/images/${k}-main.webp" alt="${nm}" width="130" height="130" class="quiz-img rounded-full aspect-square object-cover border-4 border-brand-gold">
        <div><p class="text-xs font-bold uppercase tracking-widest text-brand-saffron">${QT.you[h]}</p>
          <h3 class="font-serif text-2xl font-bold text-brand-terracotta my-1">${nm}</h3><p class="text-sm">${LINES[k][h]}</p>
          <div class="flex flex-wrap gap-2.5 mt-4"><a id="quiz-add" href="/build-your-dabba/?add=${k}" class="rip inline-flex items-center min-h-[48px] px-6 rounded-full bg-brand-terracotta text-white font-bold">${QT.add[h]}</a>
          <button type="button" id="quiz-again" class="min-h-[48px] px-5 rounded-full border border-brand-terracotta text-brand-terracotta font-bold">${QT.again[h]}</button></div></div></div>`;
    }
  }
  $('quiz-body') && $('quiz-body').addEventListener('click', e => {
    const o = e.target.closest('[data-q]');
    if (o) {
      score[o.dataset.q] = (score[o.dataset.q] || 0) + 1; qi++;
      if (qi >= QS.length) {
        const best = Math.max(...Object.values(score)); winner = Object.keys(NAMES).find(k => (score[k] || 0) === best);   // ties go to the first snack in the list
        renderQuiz();
        if (window.Mathu) Mathu.say(`You are a ${NAMES[winner]}! 🎉`, `आप ${NAMES[winner]} हैं! 🎉`, 5200);
      } else renderQuiz();
      return;
    }
    if (e.target.closest('#quiz-again')) { qi = 0; score = {}; winner = null; renderQuiz(); }
  });

  function render() { renderChecker(); renderQuiz(); }
  window.Extras = { render };
  render();
})();
