(() => {
  'use strict';
  const U = StudyUI, C = OTSU4;
  const { escape: e, link, button, percent, field, empty } = U;
  const heading = (title, eyebrow = '') => `${eyebrow ? `<p class="eyebrow">${e(eyebrow)}</p>` : ''}<h1>${e(title)}</h1>`;
  const summary = (stat, available) => `<div class="row"><span>正答率 <strong>${percent(stat.correct, stat.total)}</strong></span><span class="muted">${stat.total}回 解答</span></div><div class="bar"><span style="width:${available ? stat.unique / available * 100 : 0}%"></span></div><p class="muted">${stat.unique} / ${available}問に取り組みました</p>`;
  function home() {
    const state = U.state, date = state.settings.examDate;
    const remaining = date ? Math.round((new Date(`${date}T12:00:00`) - new Date(`${C.localDate()}T12:00:00`)) / 86400000) : null;
    const weak = C.weakKeys(state).filter(k => C.questions.has(k)).length;
    const active = state.active && !state.active.finished;
    return `<section class="card hero"><p class="eyebrow">毎日の一歩を、合格につなげる。</p><h1>今日も、少しずつ。</h1>
      ${date ? `<p>${e(date)} の試験まで</p><p>${remaining > 0 ? `<strong class="big-number">${remaining}</strong> 日` : remaining === 0 ? '今日は試験日です' : '設定した試験日は過ぎています'}</p>` : '<p>試験日を決めて、学習のペースをつくろう。</p>'}
      ${link('settings', date ? '試験日を変更' : '試験日を設定')}</section>
      <div class="grid">${link(active ? 'session' : state.lastRoute.slice(2), '続きから', 'button primary')}${button('start-review', `今日の復習 ${weak}問`)}</div>
      <h2>科目ごとの進み具合</h2>${C.SUBJECTS.map(s => {
        const sub = C.subjects.get(s.id), sections = sub.chapters.flatMap(c => c.sections);
        return `<section class="card"><div class="row"><h2>${e(s.short)}</h2><span class="badge">${sub.questions.length ? `${sub.questions.length}問` : 'データなし'}</span></div><p>${e(sub.name)}</p>
          ${summary(C.stats(state, sub.questions), sub.questions.length)}<p class="muted">テキスト既読 ${sections.filter(x => state.read[x.key]).length} / ${sections.length}節</p>
          ${link(`text/${s.id}`, 'テキストを読む', 'button wide')}</section>`;
      }).join('')}
      <div class="grid">${link('mock', '模擬試験')}${link('review', '苦手の復習')}</div>
      <div class="card"><p>連続学習 <strong>${C.streak(state)}日</strong>。自分のペースで続けましょう。</p><div class="links">${link('guide', '試験ガイド', '')}${link('about', 'このアプリについて', '')}</div>
      ${U.installPrompt ? button('install', 'ホーム画面に追加', '', 'wide') : ''}</div>`;
  }
  function text(parts) {
    if (!parts[1]) return `${heading('テキスト', '読む → 確認する → 解いてみる')}${C.SUBJECTS.map(s => `<div class="card"><h2>${e(s.short)}</h2><p>${e(C.subjects.get(s.id).name)}</p>${link(`text/${s.id}`, '章を選ぶ', 'button wide')}</div>`).join('')}`;
    let section = C.sections.get(parts[1]) || [...C.sections.values()].find(s => s.id === parts[1]);
    if (section) {
      const chapter = C.subjects.get(section.subject).chapters.find(c => c.id === section.chapter);
      return `${link(`text/${section.subject}/${section.chapter}`, '‹ 章の目次へ', 'back')}${heading(section.title, `${C.subjects.get(section.subject).short} / ${chapter?.title || ''}`)}
        <article class="card reading">${section.body}</article><section class="card"><h2>重要ポイント</h2><ul>${section.points.map(p => `<li>${e(p)}</li>`).join('')}</ul>
        <label class="check"><input type="checkbox" data-read="${e(section.key)}" ${U.state.read[section.key] ? 'checked' : ''}>この節を読みました</label>
        ${button('section-practice', 'この節の問題を解く', `data-key="${e(section.key)}"`, 'primary wide')}</section>`;
    }
    const sub = C.subjects.get(parts[1]);
    if (!sub) return empty('指定されたテキストはデータなし');
    const chapters = parts[2] ? sub.chapters.filter(c => c.id === parts[2]) : sub.chapters;
    return `${link(parts[2] ? `text/${sub.id}` : 'text', '‹ 目次へ', 'back')}${heading(sub.short, sub.name)}${chapters.length ? chapters.map(c => `<section class="card"><h2>${e(c.title)}</h2>${c.sections.map(s => `<a class="section-link" href="#/text/${encodeURIComponent(s.key)}"><span>${e(s.title)}</span><span class="badge">${U.state.read[s.key] ? '✓ 既読' : '未読'}</span></a>`).join('') || '<p>データなし</p>'}</section>`).join('') : empty('データなし：この科目のテキストはまだありません。')}`;
  }
  function practice() {
    const f = U.filters;
    const chapters = [...C.subjects.values()].filter(s => !f.subject || s.id === f.subject).flatMap(s => s.chapters.map(c => ({ ...c, key: `${s.id}:${c.id}`, short: s.short })));
    const count = U.filteredQuestions().length;
    return `${heading('問題演習', '1問ずつ、解説を読みながら')}
      <form id="practice-form" class="card">
        ${field('科目', `<select name="subject">${U.subjectOptions(f.subject)}</select>`)}
        ${field('章', `<select name="chapter"><option value="">すべての章</option>${chapters.map(c => `<option value="${e(c.key)}" ${f.chapter === c.key ? 'selected' : ''}>${e(c.short)}：${e(c.title)}</option>`).join('')}</select>`)}
        ${field('難易度', `<select name="level">${[['', 'すべて'], ['1', '基本'], ['2', '標準'], ['3', '応用']].map(([v, n]) => `<option value="${v}" ${f.level === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        ${field('出題数', `<select name="count">${[['10', '10問'], ['20', '20問'], ['all', '全部']].map(([v, n]) => `<option value="${v}" ${f.count === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
        <p class="muted">対象 ${count}問。指定数に足りない場合は、ある問題だけ出題します。</p><button class="primary wide" type="submit" ${count ? '' : 'disabled'}>演習を始める</button>
        ${count ? '' : '<p class="empty">データなし：条件に合う問題がありません。</p>'}</form>
        <div class="grid">${link('review', '苦手の復習')}${link('mock', '模擬試験')}</div>`;
  }
  function review() {
    const keys = C.weakKeys(U.state).filter(k => C.questions.has(k));
    return `${heading('苦手の復習', 'できるようになるまで、少しずつ')}<section class="card"><p>間違えた問題と「あとで見直す」にチェックした問題が対象です。2回続けて正解すると、苦手リストから外れます。</p>
      <p><strong>${keys.length}問</strong> が復習を待っています。</p>${keys.length ? button('start-review', '復習を始める', '', 'primary wide') : '<p class="empty">復習する問題はありません。演習で力を試しましょう。</p>'}</section>
      ${keys.map(k => { const q = C.questions.get(k); return `<div class="card"><span class="badge">${e(C.subjects.get(q.subject).short)}</span><p>${e(q.q)}</p><p class="muted">連続正解 ${Math.min(U.state.answers[k].streak, 2)} / 2回</p>${U.sectionLink(q)}</div>`; }).join('')}${link('practice', '演習へ', 'button wide')}`;
  }
  function mock() {
    const total = C.mockSet().length;
    return `${heading('模擬試験', '時間を決めて、力を試す')}<section class="card"><h2>制限時間 2時間</h2><p>法令15問・物化10問・性消10問（計35問）を、それぞれ無作為に選びます。採点と解説は終了後にまとめて表示します。</p><p>合格基準：<strong>各科目で60%以上</strong>の正答。科目に問題がない場合は合否を判定できません。</p>
      ${C.SUBJECTS.map(s => { const n = Math.min(C.subjects.get(s.id).questions.length, s.target); return `<p>${e(s.short)}：${n} / ${s.target}問 ${n < s.target ? '<span class="bad">（問題数不足：ある分だけで実施）</span>' : ''}</p>`; }).join('')}
      <p>今回の出題：${total}問 ${U.dev ? '（開発用サンプルを含みます）' : ''}</p>
      ${button('start-mock', '模擬試験を始める', total ? '' : 'disabled', 'primary wide')}</section>
      ${U.state.active?.mode === 'mock' && !U.state.active.finished ? link('session', '中断した試験を再開', 'button wide') : ''}${link('guide', '試験ガイド', 'back')}`;
  }
  function session() {
    const a = U.state.active;
    if (!a) return empty('演習を始めると、ここに表示されます。');
    const list = a.keys.map(k => C.questions.get(k));
    if (list.some(q => !q)) return empty('出題データが見つかりません。演習画面で新しい演習を始めてください。');
    if (a.finished) return result(a);
    const q = list[a.index], answered = Object.prototype.hasOwnProperty.call(a.answers, q.key), selected = a.answers[q.key];
    const mock = a.mode === 'mock';
    return `${heading(mock ? '模擬試験' : a.mode === 'review' ? '苦手の復習' : '問題演習')}
      <div class="row wrap"><span class="badge">${e(C.subjects.get(q.subject).short)} / ${['基本', '標準', '応用'][q.level - 1]}</span><strong>${a.index + 1} / ${list.length}問</strong>${mock ? '<span class="timer" id="timer" role="timer"></span>' : ''}</div>
      <div class="bar"><span style="width:${(a.index + 1) / list.length * 100}%"></span></div>
      <section class="card"><h2>${e(q.q)}</h2><div class="choices">${q.choices.map((choice, i) => {
        const cls = mock ? (selected === i ? 'selected' : '') : answered ? i === q.answer ? 'correct' : i === selected ? 'wrong' : '' : '';
        return `<button type="button" class="choice ${cls}" data-action="answer" data-choice="${i}" ${!mock && answered ? 'disabled' : ''} ${mock ? `aria-pressed="${selected === i}"` : ''}><span class="number">${i + 1}</span><span>${e(choice)}${!mock && answered && i === q.answer ? ' ○ 正解' : !mock && answered && i === selected ? ' ✕' : ''}</span></button>`;
      }).join('')}</div>${mock ? '<p class="muted">回答は終了まで変更できます。未回答のまま次へ進むこともできます。</p>' : ''}</section>
      ${!mock && answered ? U.explanation(q, selected) : ''}
      <div class="grid">${button('previous', '前の問題', a.index ? '' : 'disabled')}${button(a.index === list.length - 1 ? 'finish' : 'next', a.index === list.length - 1 ? '終了・採点' : '次の問題', !mock && !answered ? 'disabled' : '', 'primary')}</div>
      ${mock ? `<details class="card"><summary>回答状況（${Object.keys(a.answers).length} / ${list.length}問）</summary><div class="question-jump">${list.map((x, i) => button('jump', `${i + 1}${Object.prototype.hasOwnProperty.call(a.answers, x.key) ? ' ✓' : ''}`, `data-index="${i}" aria-label="第${i + 1}問${Object.prototype.hasOwnProperty.call(a.answers, x.key) ? ' 回答済み' : ' 未回答'}"`)).join('')}</div></details>${button('finish', 'ここで試験を終了・採点', '', 'wide')}` : ''}
      <p class="muted">進行状況は自動保存します。ホームの「続きから」で再開できます。模擬試験の残り時間は中断中も進みます。</p>`;
  }
  function result(a) {
    const list = a.keys.map(k => C.questions.get(k)).filter(Boolean), grade = C.grade(list, a.answers), mock = a.mode === 'mock';
    return `${heading(mock ? '模擬試験の結果' : '演習の結果')}
      <section class="card"><p class="eyebrow">${mock ? new Date(a.started).toLocaleString('ja-JP') : 'おつかれさまでした'}</p>
        <h2 class="${grade.passed || !mock ? 'good' : 'bad'}">${mock ? grade.incomplete || list.length !== a.keys.length ? '合否判定できません（科目・問題データ不足）' : grade.passed ? '○ 合格' : '✕ 不合格' : '演習を完了しました'}</h2>
        <p><strong class="big-number">${grade.correct}</strong> / ${grade.total}問 正解（${percent(grade.correct, grade.total)}）</p>
        ${mock ? grade.scores.map(s => `<p>${e(C.subjects.get(s.subject).short)}：${s.correct} / ${s.total}問　<strong class="${s.rate >= .6 && s.total ? 'good' : 'bad'}">${percent(s.correct, s.total)} ${s.total ? s.rate >= .6 ? '○' : '✕' : '判定不可'}</strong></p>`).join('') : ''}
        ${mock && C.SUBJECTS.some(s => grade.scores.find(x => x.subject === s.id).total < s.target) ? '<p class="note">問題数が不足した短縮試験の結果です。本番相当の結果ではありません。</p>' : ''}
      </section><div class="grid">${link('review', '苦手を復習する')}${link('records', '学習の記録')}</div><h2>全問の解説</h2>
      ${list.map((q, i) => `<details class="card"><summary><span class="${a.answers[q.key] === q.answer ? 'good' : 'bad'}">${a.answers[q.key] === q.answer ? '○' : '✕'}</span> ${i + 1}．${e(q.q)}</summary><p>あなたの回答：${a.answers[q.key] == null ? '未回答' : `${a.answers[q.key] + 1}．${e(q.choices[a.answers[q.key]])}`}</p>${U.explanation(q, a.answers[q.key])}</details>`).join('')}${link('practice', '演習へ戻る', 'button wide')}`;
  }
  function cards() {
    const all = [...C.cards.values()].filter(c => !U.cardFilter || c.subject === U.cardFilter);
    const current = U.deck[U.cardIndex] && C.cards.get(U.deck[U.cardIndex]);
    return `${heading('暗記カード', 'めくって、思い出す')}
      <section class="card">${field('科目', `<select id="card-subject">${U.subjectOptions(U.cardFilter)}</select>`)}${field('表示するカード', `<select id="card-scope"><option value="pending" ${U.cardScope === 'pending' ? 'selected' : ''}>まだ覚えていない</option><option value="all" ${U.cardScope === 'all' ? 'selected' : ''}>すべて</option></select>`)}
      <p class="muted">覚えた ${all.filter(c => U.state.cards[c.key]).length} / ${all.length}枚</p></section>
      ${current ? `<p class="row"><span class="badge">${e(C.subjects.get(current.subject).short)}</span><span>${U.cardIndex + 1} / ${U.deck.length}枚</span></p>
        <button type="button" class="flashcard" data-action="flip" aria-label="カードをめくる"><span class="badge">${U.flipped ? '裏面' : '表面'}</span><span>${e(U.flipped ? current.back : current.front)}</span><span class="muted">タップで${U.flipped ? '表' : '裏'}を表示</span></button>
        <div class="grid">${button('card-again', 'まだ', U.flipped ? '' : 'disabled')}${button('card-known', '覚えた', U.flipped ? '' : 'disabled', 'primary')}</div>` : `<section class="card"><p class="empty">${all.length ? 'このカードセットは完了しました。' : 'データなし：カードはまだありません。'}</p>${all.length ? button('card-restart', 'もう一度確認する', '', 'wide') : ''}</section>`}`;
  }
  function records() {
    const total = C.stats(U.state, [...C.questions.values()]);
    return `${heading('学習の記録', '積み重ねを、見える形に')}<div class="grid"><div class="metric"><strong>${total.total}</strong>解答回数</div><div class="metric"><strong>${C.streak(U.state)}</strong>連続学習日数</div></div><p class="muted">解いた問題：${total.unique}問（同じ問題への再解答を除く）</p>
      ${C.SUBJECTS.map(s => { const sub = C.subjects.get(s.id); return `<section class="card"><h2>${e(s.short)}</h2>${summary(C.stats(U.state, sub.questions), sub.questions.length)}${sub.chapters.map(ch => { const own = sub.questions.filter(q => ch.sections.some(sec => sec.id === q.section)), stats = C.stats(U.state, own); return `<div class="reason"><strong>${e(ch.title)}</strong><p>正答率 ${percent(stats.correct, stats.total)} / ${stats.total}回 解答 / ${stats.unique}問</p></div>`; }).join('')}</section>`; }).join('')}
      <h2>模擬試験の履歴</h2>${U.state.exams.length ? U.state.exams.map((a, index) => { const list = a.keys.map(k => C.questions.get(k)).filter(Boolean), grade = C.grade(list, a.answers); return `<div class="card"><p>${e(new Date(a.started).toLocaleString('ja-JP'))}</p><p>${grade.incomplete || list.length !== a.keys.length ? '判定不可' : grade.passed ? '○ 合格' : '✕ 不合格'} / ${grade.correct} / ${grade.total}問 正解</p>${link(`exam/${index}`, '結果と解説を見る', 'button wide')}</div>`; }).reverse().join('') : '<p class="empty">模擬試験の履歴はありません。</p>'}`;
  }
  function settings() {
    const s = U.state.settings;
    return `${heading('設定')}<form id="settings-form" class="card">
      ${field('文字サイズ', `<select name="font">${[['normal', '標準'], ['large', '大'], ['xlarge', '特大']].map(([v, n]) => `<option value="${v}" ${v === s.font ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${field('ダークモード', `<select name="theme">${[['system', '端末に従う'], ['light', 'ライト'], ['dark', 'ダーク']].map(([v, n]) => `<option value="${v}" ${v === s.theme ? 'selected' : ''}>${n}</option>`).join('')}</select>`)}
      ${field('試験日（任意）', `<input type="date" name="examDate" value="${e(s.examDate)}">`)}<p class="muted">設定は変更すると自動で保存されます。</p></form>
      <section class="card"><h2>学習データのバックアップ</h2><p>記録・設定・進行中の演習をJSONに保存できます。読み込みは現在のデータを置き換えます。</p><div class="stack">${button('export', '学習データを書き出す', '', 'primary')}
        ${field('学習データを読み込む（JSON・5MBまで）', '<input class="file-input" type="file" id="import-file" accept="application/json,.json">')}</div></section>
      ${globalThis.OTSU4Lock && OTSU4Lock.hasKey() ? `<section class="card"><h2>パスワード</h2><p>この端末ではパスワードを記憶しています。</p>${button('forgetKey', 'この端末のパスワード記憶を消す', '', 'wide')}</section>` : ''}<section class="card"><h2>リセット</h2><p>${U.dev ? '開発モード' : '通常モード'}の学習記録と設定を削除します。必要なら先に書き出してください。</p>${button('reset', '学習データをリセット', '', 'danger wide')}</section>
      <div class="links">${link('guide', '試験ガイド', '')}${link('about', 'このアプリについて', '')}</div>`;
  }
  function guide() {
    return `${heading('試験ガイド')}<p class="note">最新情報は必ず公式で確認してください。免除の有無や地域により案内が異なります。</p>
      <section class="card"><h2>乙種第4類の試験（免除なし）</h2><ul><li>法令：15問</li><li>基礎的な物理学・化学：10問</li><li>性質・火災予防・消火：10問</li><li>合計35問・5択・試験時間2時間</li><li>各科目で60%以上の正答で合格</li></ul><p>このアプリの模擬試験も本番と同じ35問構成です。</p></section>
      <section class="card"><h2>受験までの流れ</h2><ol><li>受験地域の公式日程・受験案内を確認する</li><li>案内に従って申請し、受験手数料を納付する</li><li>受験票や持参物、会場・時刻を確認する</li><li>受験後に合格発表と免状交付の手続きを確認する</li></ol><div class="stack"><a class="button" href="https://www.shoubo-shiken.or.jp/kikenbutsu/" target="_blank" rel="noopener">消防試験研究センター：受験案内</a><a class="button" href="https://www.shoubo-shiken.or.jp/kikenbutsu/annai/subject.html" target="_blank" rel="noopener">公式の試験科目・問題数</a><a class="button" href="https://www.shoubo-shiken.or.jp/faq/index_kiken.html" target="_blank" rel="noopener">公式のFAQ（時間・合格基準等）</a><a class="button" href="https://www.shoubo-shiken.or.jp/kikenbutsu/exercise.html" target="_blank" rel="noopener">公式の公開問題</a></div></section>`;
  }
  function about() {
    return `${heading('このアプリについて')}<section class="card"><h2>乙4 合格ドリル</h2><p>アプリ版数：${C.version}</p><p>内容の正確性には努めていますが、正確性や合格を保証するものではありません。法改正に注意し、最新の法令・公式案内を確認してください。</p><p>問題とテキストはオリジナル教材を登録する形式です。開発用サンプルは試験知識を表すものではありません。</p></section>
      <section class="card"><h2>データの扱い</h2><p>学習記録はこの端末・このブラウザのlocalStorageだけに保存します。学習記録をサーバーへ送る機能はありません。ブラウザのデータ削除や端末変更で失われるため、設定から書き出して保管してください。</p><p>通常モードと開発モードの記録は別々です。オフライン利用には一度オンラインでアプリを開いてください。配信元への通常のページ・教材取得は発生します。</p><h2>ホーム画面に追加</h2><p>Android等ではブラウザメニューの「インストール」や「ホーム画面に追加」を選びます。iPhoneではSafariの共有メニューから追加できます。</p></section>
      <section class="card"><h2>出典</h2><p>試験ガイドは消防試験研究センターの公式案内を参照しています。確認日：2026-10-07。教材本文の根拠は各問題の表示・各科目データ担当の出典記録を参照してください。</p><div class="stack"><a class="button" href="SOURCES.md">出典と仕様上の注意</a><a class="button" href="https://laws.e-gov.go.jp/law/323AC1000000186" target="_blank" rel="noopener">e-Gov：消防法</a><a class="button" href="https://www.fdma.go.jp/" target="_blank" rel="noopener">総務省消防庁</a>${link('guide', '試験ガイド')}</div></section>`;
  }
  globalThis.StudyViews = { home, text, practice, review, mock, session, result, cards, records, settings, guide, about };
})();
