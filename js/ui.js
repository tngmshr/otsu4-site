(() => {
  'use strict';
  const C = OTSU4;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const percent = (correct, total) => total ? `${Math.round(correct / total * 100)}%` : '—';
  const link = (route, text, cls = 'button') => `<a class="${cls}" href="#/${route}">${escape(text)}</a>`;
  const button = (action, text, data = '', cls = '') => `<button type="button" class="${cls}" data-action="${action}" ${data}>${escape(text)}</button>`;
  const subjectOptions = (value = '', all = true) => `${all ? '<option value="">すべての科目</option>' : ''}${C.SUBJECTS.map(s => `<option value="${s.id}" ${s.id === value ? 'selected' : ''}>${s.short}：${escape(C.subjects.get(s.id).name)}</option>`).join('')}`;
  const field = (title, content) => `<label class="field"><span>${escape(title)}</span>${content}</label>`;
  const empty = text => `<div class="card"><p class="empty">${escape(text)}</p>${link('home', 'ホームへ')}</div>`;
  function sectionLink(q) {
    const section = C.sections.get(`${q.subject}:${q.section}`);
    return section ? link(`text/${encodeURIComponent(section.key)}`, `テキスト：${section.title}`) : '<p class="muted">関連テキストはデータなし</p>';
  }
  // Verdict for one answered question; text marks (○ / ✕) back up the color.
  function verdict(q, selected) {
    const correct = selected === q.answer, mine = selected == null ? '未回答' : `${selected + 1}`;
    return `<p class="verdict ${correct ? 'good' : 'bad'}"><strong>${correct ? '○ 正解' : selected == null ? '✕ 未回答' : '✕ 不正解'}</strong>
      <span>あなたの回答 ${escape(mine)} ／ 正解 ${q.answer + 1}</span></p>`;
  }
  // Every choice with its mark, then its reason (questions' why) folded underneath.
  // The chosen and correct choices start open; the others stay folded.
  function choiceReview(q, selected) {
    return `<ol class="choice-review">${q.choices.map((choice, i) => {
      const right = i === q.answer, mine = i === selected, cls = right ? 'correct' : mine ? 'wrong' : '';
      const tags = `${right ? '<span class="tag good">○ 正解</span>' : ''}${mine ? `<span class="tag ${right ? 'good' : 'bad'}">${right ? '' : '✕ '}あなたの回答</span>` : ''}`;
      return `<li class="choice-item ${cls}"><div class="choice-head"><span class="number" aria-hidden="true">${right ? '○' : mine ? '✕' : i + 1}</span>
        <span class="choice-text"><span class="sr">${i + 1}．</span>${escape(choice)}${tags ? `<span class="tags">${tags}</span>` : ''}</span></div>
        <details class="why" ${right || mine ? 'open' : ''}><summary>${i + 1} の理由</summary><p>${escape(q.why[i] || '選択肢の理由はデータなし')}</p></details></li>`;
    }).join('')}</ol>`;
  }
  // Overall explanation (explain) and its basis (ref) below the per-choice reasons.
  function explanation(q, selected, withReview = true, withChoices = false) {
    const correct = selected === q.answer;
    return `<div class="card explanation ${correct ? '' : 'incorrect'}">
      ${withChoices ? choiceReview(q, selected) : ''}
      <h2>総合解説</h2>
      <p>正解は <strong>${q.answer + 1}．${escape(q.choices[q.answer])}</strong></p>
      <p>${escape(q.explain || '全体の解説はデータなし')}</p>
      ${q.ref ? `<p class="ref"><strong>根拠</strong>　${escape(q.ref)}</p>` : ''}
      <div class="stack">${sectionLink(q)}</div>
      ${withReview ? `<label class="check"><input type="checkbox" data-review="${escape(q.key)}" ${U.state.answers[q.key]?.review ? 'checked' : ''}>あとで見直す</label>` : ''}
    </div>`;
  }
  const U = globalThis.StudyUI = {
    C, escape, percent, link, button, subjectOptions, field, empty, sectionLink, verdict, choiceReview, explanation,
    dev: new URLSearchParams(location.search).get('dev') === '1', state: C.freshState(),
    filters: { subject: '', chapter: '', level: '', count: '10' },
    resultFilter: 'all', cardFilter: '', cardScope: 'pending', deck: [], cardIndex: 0, flipped: false,
    message: '', storageProblem: '', dataProblem: '', installPrompt: null,
    go(route) { const hash = `#/${route}`; if (location.hash === hash) U.render(); else location.hash = hash; },
    notify(message) { U.message = message; U.status(); },
    status() {
      document.getElementById('status').textContent = [U.dev ? '開発モード：サンプルを含みます。記録は通常モードと別に保存します。' : '',
        U.storageProblem, U.dataProblem, U.message].filter(Boolean).join(' ');
    },
    applySettings() {
      document.documentElement.dataset.theme = U.state.settings.theme;
      document.documentElement.style.setProperty('--font-size', { normal: '16px', large: '18px', xlarge: '20px' }[U.state.settings.font]);
    }
  };
})();
