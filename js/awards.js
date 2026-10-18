/* Titles (称号) and staged celebrations: confetti, a short message, and the ending staff roll.
   Rule checks are DOM-independent; celebrate() is the only part that touches the page. */
(() => {
  'use strict';
  const C = OTSU4;
  // tier 1: a section, 2: a subject, 3: every subject / mock pass, 4: the ending.
  const TITLES = [
    { id: 'first-clear', tier: 1, name: 'はじめの一歩', hint: 'どれかの節の問題を、1回の演習で全問正解する', message: '節の問題を全問正解！この調子で進もう。' },
    { id: 'clear-5', tier: 1, name: '節の達人', hint: '5つの節で全問正解する', message: '5つの節で全問正解。着実に力がついています。' },
    { id: 'read-hourei', tier: 2, name: '法令の読破者', hint: '法令のテキストを全節読む', message: '法令のテキストを読み切りました！' },
    { id: 'read-butsuka', tier: 2, name: '物化の読破者', hint: '物化のテキストを全節読む', message: '物化のテキストを読み切りました！' },
    { id: 'read-seishou', tier: 2, name: '性消の読破者', hint: '性消のテキストを全節読む', message: '性消のテキストを読み切りました！' },
    { id: 'clear-all', tier: 2, name: '全節パーフェクト', hint: '問題のあるすべての節で全問正解する', message: 'すべての節で全問正解。もう怖いものなし！' },
    { id: 'read-all', tier: 3, name: '全科目制覇', hint: '3科目すべてのテキストを全節読む', message: '3科目のテキストをすべて読み切りました！' },
    { id: 'mock-pass', tier: 3, name: '模試合格', hint: '模擬試験で各科目60%以上をとる', message: '模擬試験に合格！本番も、この力で。' },
    { id: 'mock-perfect', tier: 3, name: '満点合格', hint: '模擬試験で全問正解する', message: '模擬試験で満点！見事です。' },
    { id: 'ending', tier: 4, name: '乙4マスター', hint: '「全科目制覇」と「模試合格」の両方を達成する', message: '全科目を制覇し、模擬試験に合格しました。' }
  ];
  const byId = new Map(TITLES.map(t => [t.id, t]));
  const examGrade = a => { const list = a.keys.map(k => C.questions.get(k)).filter(Boolean); return { list, ...C.grade(list, a.answers) }; };
  const validExam = (a, g) => g.list.length === a.keys.length && !g.incomplete && g.passed;
  // Sections whose every question was answered correctly in this one session.
  function sectionClears(active) {
    const keys = new Set(active.keys), seen = new Set(), out = [];
    for (const k of active.keys) {
      const q = C.questions.get(k), skey = q && `${q.subject}:${q.section}`;
      if (!q || seen.has(skey)) continue;
      seen.add(skey);
      const own = C.subjects.get(q.subject).questions.filter(x => x.section === q.section);
      if (C.sections.has(skey) && own.every(x => keys.has(x.key) && active.answers[x.key] === x.answer)) out.push(skey);
    }
    return out;
  }
  function recordClears(state, active) {
    const clears = state.clears || (state.clears = {});
    for (const k of sectionClears(active)) clears[k] = true;
  }
  // Title ids the state currently satisfies.
  function satisfied(state) {
    const out = new Set(), clears = state.clears || {};
    const withQuestions = [...C.sections.values()].filter(s => C.subjects.get(s.subject).questions.some(q => q.section === s.id));
    const cleared = withQuestions.filter(s => clears[s.key]).length;
    if (cleared >= 1) out.add('first-clear');
    if (cleared >= 5) out.add('clear-5');
    if (withQuestions.length && cleared === withQuestions.length) out.add('clear-all');
    const read = C.SUBJECTS.filter(s => {
      const sections = C.subjects.get(s.id).chapters.flatMap(c => c.sections);
      return sections.length && sections.every(x => state.read[x.key]);
    });
    for (const s of read) out.add(`read-${s.id}`);
    if (read.length === C.SUBJECTS.length) out.add('read-all');
    for (const a of state.exams) {
      const g = examGrade(a);
      if (!validExam(a, g)) continue;
      out.add('mock-pass');
      if (g.correct === g.total) out.add('mock-perfect');
    }
    if (out.has('read-all') && out.has('mock-pass')) out.add('ending');
    return out;
  }
  // Stamp newly satisfied titles with today's date; returns the new ones, lowest tier first.
  function evaluate(state, date = C.localDate()) {
    const awards = state.awards || (state.awards = {}), now = satisfied(state);
    const fresh = TITLES.filter(t => now.has(t.id) && !awards[t.id]);
    for (const t of fresh) awards[t.id] = date;
    return fresh;
  }
  // Numbers for the ending screen.
  function summary(state) {
    const all = C.stats(state, [...C.questions.values()]), days = [...state.days].sort();
    let best = null;
    for (const a of state.exams) {
      const g = examGrade(a);
      if (g.total && (!best || g.correct / g.total > best.correct / best.total)) best = { correct: g.correct, total: g.total };
    }
    return { days: days.length, first: days[0] || '', unique: all.unique, answers: all.total, exams: state.exams.length, best,
      titles: TITLES.filter(t => (state.awards || {})[t.id]) };
  }

  /* ---- page effects ---- */
  const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function confetti(count, duration, parent = document.body) {
    if (reduced() || typeof document === 'undefined' || !document.body) return;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.className = 'confetti'; canvas.setAttribute('aria-hidden', 'true');
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.scale(dpr, dpr); parent.prepend(canvas);
    const css = getComputedStyle(document.documentElement);
    const colors = ['--primary', '--good', '--bad', '--heat-3'].map(v => css.getPropertyValue(v).trim()).filter(Boolean).concat('#f2c14e', '#5aa9e6');
    const parts = Array.from({ length: count }, () => ({ x: Math.random() * w, y: -20 - Math.random() * h * .5,
      vx: (Math.random() - .5) * 2.4, vy: 2 + Math.random() * 3, r: Math.random() * 6.3, vr: (Math.random() - .5) * .3,
      s: 6 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)], p: Math.random() * 6.3 }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h); ctx.globalAlpha = Math.max(0, Math.min(1, (duration - t) / (duration * .25)));
      for (const p of parts) {
        p.vy = Math.min(p.vy + .05, 5); p.x += p.vx + Math.sin(p.p + t / 300) * .6; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (t < duration) requestAnimationFrame(frame); else canvas.remove();
    })(start);
  }
  function toast(title) {
    const node = document.createElement('div');
    node.className = 'toast'; node.setAttribute('role', 'status');
    node.innerHTML = `<span class="toast-star" aria-hidden="true">★</span><span><strong>称号「${StudyUI.escape(title.name)}」を獲得</strong><br>${StudyUI.escape(title.message)}</span>`;
    document.body.append(node);
    setTimeout(() => node.classList.add('leaving'), 4200); setTimeout(() => node.remove(), 4800);
  }
  function dialog(fresh, top) {
    document.querySelector('.celebrate')?.remove();
    const e = StudyUI.escape, back = document.activeElement, node = document.createElement('div');
    node.className = `celebrate tier-${top.tier}`; node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true'); node.setAttribute('aria-labelledby', 'celebrate-title');
    node.innerHTML = `<div class="celebrate-box"><p class="celebrate-stars" aria-hidden="true">${'★'.repeat(top.tier)}</p>
      <p class="eyebrow">${top.tier === 4 ? 'ALL CLEAR' : '称号を獲得しました'}</p><h2 id="celebrate-title">${e(top.message)}</h2>
      <ul class="title-badges">${fresh.map(t => `<li><span aria-hidden="true">★</span> ${e(t.name)}</li>`).join('')}</ul>
      <div class="stack">${top.tier === 4 ? '<a class="button primary" href="#/ending" data-close>エンディングを見る</a>' : ''}
      <a class="button" href="#/titles" data-close>称号の一覧</a><button type="button" data-close>閉じる</button></div></div>`;
    const close = () => { node.remove(); document.removeEventListener('keydown', key); if (back?.isConnected) back.focus({ preventScroll: true }); };
    const key = event => { if (event.key === 'Escape') close(); };
    node.addEventListener('click', event => { if (event.target === node || event.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', key); document.body.append(node);
    node.querySelector('[data-close]').focus();
    return node;
  }
  // Bigger moments get more: tier 1 a toast and a short burst, tier 2+ a dialog, tier 4 a long shower.
  function celebrate(fresh) {
    if (!fresh.length || typeof document === 'undefined' || !document.body) return;
    const top = fresh.reduce((a, b) => b.tier >= a.tier ? b : a);
    // Inside a dialog the confetti falls behind the box so the message stays readable.
    const parent = top.tier === 1 && fresh.length === 1 ? (toast(top), document.body) : dialog(fresh, top);
    confetti([0, 70, 130, 180, 260][top.tier], [0, 1800, 2800, 3800, 5500][top.tier], parent);
  }
  globalThis.OTSU4Awards = { TITLES, byId, sectionClears, recordClears, satisfied, evaluate, summary, celebrate, reduced };
})();
