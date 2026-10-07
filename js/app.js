(() => {
  'use strict';
  const U = StudyUI, C = OTSU4, V = StudyViews;
  const storageKey = U.dev ? 'otsu4-study:dev:v1' : 'otsu4-study:v1';
  let loaded = false, timer;
  U.save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(U.state)); U.storageProblem = ''; }
    catch { U.storageProblem = '端末への保存ができません。記録はこの画面を閉じると失われる可能性があります。JSONを書き出してください。'; }
    U.status();
  };
  function loadState() {
    try {
      const text = localStorage.getItem(storageKey);
      if (text) U.state = C.validateState(JSON.parse(text));
    } catch { U.storageProblem = '保存データを読み込めませんでした。初期状態で表示しています。読み込み直しや書き出しを行う前に、保管済みのJSONを確認してください。'; }
    U.applySettings();
  }
  U.filteredQuestions = () => [...C.questions.values()].filter(q => {
    const f = U.filters, section = C.sections.get(`${q.subject}:${q.section}`);
    return (!f.subject || q.subject === f.subject) && (!f.chapter || `${q.subject}:${section?.chapter}` === f.chapter) && (!f.level || q.level === Number(f.level));
  });
  function resetDeck() {
    U.deck = C.shuffle([...C.cards.values()].filter(c => (!U.cardFilter || c.subject === U.cardFilter) && (U.cardScope === 'all' || !U.state.cards[c.key])).map(c => c.key));
    U.cardIndex = 0; U.flipped = false;
  }
  function start(list, mode) {
    if (!list.length) { U.notify('データなし：出題できる問題がありません。'); return; }
    if (U.state.active && !U.state.active.finished && !confirm('進行中の演習・試験を終了せずに、新しい演習を始めますか？進行中の回答は置き換わります。')) return;
    const now = Date.now();
    U.state.active = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, mode, keys: list.map(q => q.key),
      answers: {}, index: 0, started: now, deadline: mode === 'mock' ? now + 7200000 : 0, finished: false };
    U.state.lastRoute = '#/session'; U.message = ''; U.save(); U.go('session');
  }
  function finish(automatic = false) {
    const a = U.state.active;
    if (!a || a.finished) return;
    if (a.mode === 'mock' && !automatic) {
      const remaining = a.keys.length - Object.keys(a.answers).length;
      if (!confirm(`${remaining ? `未回答が${remaining}問あります。` : ''}試験を終了して採点しますか？`)) return;
    }
    if (a.mode === 'mock') {
      for (const k of a.keys) {
        const q = C.questions.get(k);
        if (q) C.recordAnswer(U.state, k, a.answers[k] === q.answer);
      }
    }
    a.finished = true;
    if (a.mode === 'mock') U.state.exams.push(JSON.parse(JSON.stringify(a)));
    C.touch(U.state); U.save();
    if (automatic) U.notify('制限時間になったため、模擬試験を終了して採点しました。');
    U.go('session');
  }
  function checkTimer() {
    const a = U.state.active;
    if (!a || a.finished || a.mode !== 'mock') return;
    const remaining = Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000));
    if (!remaining) { finish(true); return; }
    const node = document.getElementById('timer');
    if (node) node.textContent = `残り ${String(Math.floor(remaining / 3600)).padStart(2, '0')}:${String(Math.floor(remaining / 60) % 60).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }
  U.render = (focus = false) => {
    if (!loaded) return;
    const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/').map(x => {
      try { return decodeURIComponent(x); } catch { return ''; }
    });
    const route = parts[0] || 'home';
    let html;
    if (route === 'text') {
      html = V.text(parts);
      U.state.lastRoute = location.hash || '#/text'; U.save();
    } else if (route === 'exam') {
      const a = U.state.exams[Number(parts[1])]; html = a ? V.result(a) : U.empty('試験履歴はありません。');
    } else html = V[route] ? V[route]() : U.empty('ページが見つかりません。');
    document.getElementById('main').innerHTML = html;
    document.title = `${({ home: 'ホーム', text: 'テキスト', practice: '問題演習', mock: '模擬試験', review: '苦手の復習', session: '解答', cards: '暗記カード', records: '学習の記録', settings: '設定', about: 'このアプリについて', guide: '試験ガイド', exam: '試験結果' })[route] || 'ホーム'} | 乙4 合格ドリル`;
    const tab = ['mock', 'review', 'session', 'exam'].includes(route) ? 'practice' : route;
    for (const item of document.querySelectorAll('[data-tab]')) {
      if (item.dataset.tab === tab) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    }
    U.status(); checkTimer();
    if (focus) { document.getElementById('main').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  };
  const actions = {
    'section-practice'(node) { start(C.shuffle([...C.questions.values()].filter(q => `${q.subject}:${q.section}` === node.dataset.key)), 'practice'); },
    'start-review'() { start(C.shuffle(C.weakKeys(U.state).filter(k => C.questions.has(k)).map(k => C.questions.get(k))), 'review'); },
    'start-mock'() { start(C.mockSet(), 'mock'); },
    answer(node) {
      const a = U.state.active;
      if (!a || a.finished) return;
      if (a.mode === 'mock' && Date.now() >= a.deadline) { finish(true); return; }
      const key = a.keys[a.index], q = C.questions.get(key), value = Number(node.dataset.choice);
      if (!q || !Number.isInteger(value) || value < 0 || value > 4) return;
      if (a.mode !== 'mock' && Object.prototype.hasOwnProperty.call(a.answers, key)) return;
      a.answers[key] = value;
      if (a.mode !== 'mock') C.recordAnswer(U.state, key, value === q.answer);
      U.save(); U.render();
      if (a.mode !== 'mock') document.querySelector('.explanation')?.scrollIntoView({ block: 'start' });
    },
    previous() { const a = U.state.active; if (a && !a.finished && a.index > 0) { a.index--; U.save(); U.render(true); } },
    next() { const a = U.state.active; if (!a || a.finished) return; if (a.mode !== 'mock' && !Object.prototype.hasOwnProperty.call(a.answers, a.keys[a.index])) return; if (a.index < a.keys.length - 1) { a.index++; U.save(); U.render(true); } },
    jump(node) { const a = U.state.active, index = Number(node.dataset.index); if (a && !a.finished && a.mode === 'mock' && Number.isInteger(index) && index >= 0 && index < a.keys.length) { a.index = index; U.save(); U.render(true); } },
    finish() { finish(); },
    flip() { U.flipped = !U.flipped; U.render(); },
    'card-known'() { rateCard(true); },
    'card-again'() { rateCard(false); },
    'card-restart'() { resetDeck(); U.render(); },
    export() {
      const data = { app: 'otsu4-study', version: 1, mode: U.dev ? 'dev' : 'normal', exportedAt: new Date().toISOString(), state: U.state };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `otsu4-${U.dev ? 'dev-' : ''}${C.localDate()}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); U.notify('学習データのダウンロードを開始しました。');
    },
    forgetKey() {
      if (!confirm('この端末に記憶したパスワードを消しますか？次に開くときに再入力が必要です。')) return;
      OTSU4Lock.forget(); U.notify('パスワードの記憶を消しました。');
    },
    reset() {
      if (!confirm('このモードの学習記録・試験履歴・設定をすべてリセットしますか？この操作は元に戻せません。')) return;
      U.state = C.freshState(); U.save(); U.applySettings(); resetDeck(); U.notify('学習データをリセットしました。'); U.render();
    },
    async install() {
      if (!U.installPrompt) return;
      await U.installPrompt.prompt(); await U.installPrompt.userChoice; U.installPrompt = null; U.render();
    }
  };
  function rateCard(known) {
    const key = U.deck[U.cardIndex];
    if (!key || !U.flipped) return;
    U.state.cards[key] = known; C.touch(U.state); U.cardIndex++; U.flipped = false; U.save(); U.render();
  }
  document.addEventListener('click', event => {
    const node = event.target.closest('button[data-action]');
    if (node && !node.disabled && actions[node.dataset.action]) actions[node.dataset.action](node);
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'practice-form') {
      event.preventDefault(); const list = C.shuffle(U.filteredQuestions());
      start(list.slice(0, U.filters.count === 'all' ? list.length : Number(U.filters.count)), 'practice');
    } else if (event.target.id === 'settings-form') event.preventDefault();
  });
  document.addEventListener('change', async event => {
    const node = event.target;
    if (node.dataset.read) { U.state.read[node.dataset.read] = node.checked; if (node.checked) C.touch(U.state); U.save(); }
    else if (node.dataset.review) { C.setReview(U.state, node.dataset.review, node.checked); U.save(); }
    else if (node.closest('#practice-form')) {
      U.filters[node.name] = node.value;
      if (node.name === 'subject') U.filters.chapter = '';
      U.render(); document.querySelector(`#practice-form [name="${node.name}"]`)?.focus();
    } else if (node.closest('#settings-form')) {
      if (node.name === 'examDate' && node.value && !C.validDate(node.value)) { U.notify('有効な試験日を指定してください。'); return; }
      U.state.settings[node.name] = node.value; U.applySettings(); U.save();
    } else if (node.id === 'card-subject' || node.id === 'card-scope') {
      if (node.id === 'card-subject') U.cardFilter = node.value; else U.cardScope = node.value;
      resetDeck(); U.render(); document.getElementById(node.id)?.focus();
    } else if (node.id === 'import-file') {
      const file = node.files[0];
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error('読み込めるJSONは5MBまでです。');
        const data = JSON.parse(await file.text());
        if (data.app !== 'otsu4-study' || data.version !== 1) throw new Error('このアプリの書き出しJSONを選んでください。');
        if (data.mode !== (U.dev ? 'dev' : 'normal')) throw new Error('開発モードと通常モードの記録は相互に読み込めません。');
        const candidate = C.validateState(data.state);
        if (!confirm('現在の学習記録と設定を、選んだJSONの内容で置き換えますか？')) { node.value = ''; return; }
        U.state = candidate; U.save(); U.applySettings(); resetDeck(); U.notify('学習データを読み込みました。'); U.render();
      } catch (error) { node.value = ''; U.notify(`読み込みに失敗しました：${error.message}`); }
    }
  });
  window.addEventListener('hashchange', () => U.render(true));
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); U.installPrompt = event; if (loaded) U.render(); });
  window.addEventListener('appinstalled', () => { U.installPrompt = null; U.notify('ホーム画面に追加しました。'); });
  window.addEventListener('online', () => U.notify('オンラインです。教材を更新するにはページを再読み込みしてください。'));
  window.addEventListener('offline', () => U.notify('オフラインです。保存済みの教材を利用できます。'));
  // Wait for first-page control so missing optional data receives a quiet 200 stub.
  async function worker() {
    if (!('serviceWorker' in navigator)) return false;
    try {
      await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))]);
      if (!navigator.serviceWorker.controller) await new Promise(resolve => {
        const done = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', done); resolve(); };
        const timeout = setTimeout(done, 2000); navigator.serviceWorker.addEventListener('controllerchange', done);
      });
      return !!navigator.serviceWorker.controller;
    } catch { U.dataProblem = 'オフライン機能を準備できませんでした。オンラインで利用できます。'; return false; }
  }
  function script(path) {
    return new Promise(resolve => {
      const node = document.createElement('script'); node.src = path; node.async = false;
      node.onload = () => resolve(true); node.onerror = () => { node.remove(); resolve(false); }; document.head.append(node);
    });
  }
  async function boot() {
    loadState();
    const controlled = await worker();
    // Python's directory listing avoids 404 browser errors even when SW is disabled.
    let listing = null;
    if (!controlled && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
      try { const response = await fetch('data/'); if (response.ok) listing = await response.text(); } catch { /* offline */ }
    }
    const locked = !U.dev && (listing === null || listing.includes('bundle.enc.json')) && await OTSU4Lock.unlock();
    if (!locked) for (const path of ['data/hourei.js', 'data/butsuka.js', 'data/seishou.js']) {
      if (listing !== null && !listing.includes(`href="${path.split('/')[1]}"`)) continue;
      await script(path);
    }
    if (U.dev) await script('data/dev-sample.js');
    resetDeck(); loaded = true; U.render(); timer = setInterval(checkTimer, 1000);
  }
  boot().catch(() => {
    U.dataProblem = '教材を読み込めませんでした。データなしで表示しています。'; loaded = true; U.render();
  });
})();
