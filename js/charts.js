/* Progress charts for the home screen: plain SVG/HTML strings, no libraries.
   Colors come from CSS classes so light/dark themes both apply. */
(() => {
  'use strict';
  const U = StudyUI, C = OTSU4, e = U.escape;
  const pct = rate => rate == null ? '—' : `${Math.round(rate * 100)}%`;
  const LEVELS = ['未解答', '〜39%', '40〜59%', '60〜79%', '80%〜'];

  // Horizontal bars per subject on a 0–100% scale with the 60% pass line.
  function subjectRates(progress) {
    const W = 320, x0 = 46, x1 = 262, rowH = 38, top = 22, h = top + progress.length * rowH + 20;
    const x = rate => x0 + (x1 - x0) * rate, pass = x(.6);
    const rows = progress.map((p, i) => {
      const y = top + i * rowH + 12, label = `${p.short}：正答率 ${pct(p.rate)}（${p.correct} / ${p.total}回 正解）`;
      return `<g><title>${e(label)}</title>
        <text class="chart-label" x="0" y="${y + 11}">${e(p.short)}</text>
        <rect class="chart-track" x="${x0}" y="${y}" width="${x1 - x0}" height="14" rx="4"/>
        ${p.rate ? `<rect class="chart-bar" x="${x0}" y="${y}" width="${Math.max(4, x(p.rate) - x0).toFixed(1)}" height="14" rx="4"/>` : ''}
        <text class="chart-value" x="${W}" y="${y + 12}" text-anchor="end">${pct(p.rate)}</text></g>`;
    }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${e(progress.map(p => `${p.short} ${pct(p.rate)}`).join('、'))}（合格基準60%）">
      ${rows}
      <line class="chart-pass" x1="${pass}" x2="${pass}" y1="16" y2="${h - 16}"/>
      <text class="chart-axis" x="${pass}" y="11" text-anchor="middle">合格 60%</text>
      <text class="chart-axis" x="${x0}" y="${h - 2}">0%</text><text class="chart-axis" x="${x1}" y="${h - 2}" text-anchor="end">100%</text></svg>`;
  }

  // Questions answered per day; bars carry direct labels, so there is no y axis.
  function dailyBars(days, today) {
    const W = 320, H = 150, left = 4, base = 112, plotH = 90, slot = (W - left) / days.length, barW = 14;
    const max = Math.max(1, ...days.map(d => d.total));
    let month = '';
    const bars = days.map((d, i) => {
      const cx = left + slot * (i + .5), hgt = d.total ? Math.max(4, d.total / max * plotH) : 0;
      const [, m, day] = d.date.split('-').map(Number), isToday = d.date === today;
      const monthLabel = m !== Number(month) ? `<text class="chart-axis" x="${(left + slot * i).toFixed(1)}" y="${H - 2}">${m}月</text>` : '';
      month = String(m);
      const tip = `${m}/${day}${isToday ? '（今日）' : ''}：${d.total ? `${d.total}問（正解 ${d.correct}問）` : d.studied ? '解答なし・学習あり' : '学習なし'}`;
      return `<g><title>${e(tip)}</title><rect class="chart-hit" x="${(left + slot * i).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${base}"/>
        ${hgt ? `<path class="chart-bar" d="M${(cx - barW / 2).toFixed(1)} ${base}v${-(hgt - 4).toFixed(1)}a4 4 0 0 1 4 -4h${barW - 8}a4 4 0 0 1 4 4v${(hgt - 4).toFixed(1)}z"/>
          <text class="chart-value small" x="${cx.toFixed(1)}" y="${(base - hgt - 4).toFixed(1)}" text-anchor="middle">${d.total}</text>`
          : d.studied ? `<circle class="chart-dot" cx="${cx.toFixed(1)}" cy="${base - 5}" r="3"/>` : ''}
        <text class="chart-axis${isToday ? ' today' : ''}" x="${cx.toFixed(1)}" y="${base + 16}" text-anchor="middle">${day}</text>${monthLabel}</g>`;
    }).join('');
    const sum = days.reduce((n, d) => n + d.total, 0);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="直近${days.length}日の解答数：合計${sum}問">${bars}
      <line class="chart-base" x1="0" x2="${W}" y1="${base}" y2="${base}"/></svg>`;
  }

  // One square per section, wrapping on narrow screens; the table below carries the numbers.
  function heatStrip(sections) {
    return `<span class="heat-strip" aria-hidden="true">${sections.map(s => `<i class="heat-${s.level}"></i>`).join('')}</span>`;
  }

  function sectionTable(p) {
    let chapter = '';
    const rows = p.sections.map(s => {
      const head = s.chapter !== chapter ? `<tr class="heat-chapter"><th colspan="3" scope="colgroup">${e(chapter = s.chapter)}</th></tr>` : '';
      return `${head}<tr><th scope="row"><a href="#/text/${encodeURIComponent(s.key)}">${e(s.title)}</a></th>
        <td class="heat-read">${s.read ? '✓<span class="sr"> 既読</span>' : '<span class="muted">—</span><span class="sr"> 未読</span>'}</td>
        <td class="heat-${s.level}" title="${s.questions ? `${s.questions}問中 ${s.unique}問に解答・${s.correct} / ${s.total}回 正解` : '問題なし'}">${s.questions ? `${pct(s.rate)}<small>${s.total ? `${s.correct}/${s.total}` : `${s.questions}問`}</small>` : '<small>問題なし</small>'}</td></tr>`;
    }).join('');
    return `<table class="heat-table"><thead><tr><th scope="col">節</th><th scope="col">既読</th><th scope="col">正答率</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function progress() {
    const state = U.state, today = C.localDate(), prog = C.progress(state), days = C.recentDays(state, today, 14);
    const sum = days.reduce((a, d) => ({ total: a.total + d.total, correct: a.correct + d.correct, active: a.active + (d.total || d.studied ? 1 : 0) }), { total: 0, correct: 0, active: 0 });
    const legend = LEVELS.map((name, i) => `<span><i class="heat-${i}"></i>${name}</span>`).join('');
    return `<h2>学習の進捗</h2>
      <section class="card"><h3 class="chart-title">科目ごとの正答率</h3>
        ${prog.some(p => p.total) ? '' : '<p class="muted">問題を解くと、ここに正答率が表示されます。</p>'}${subjectRates(prog)}
        <p class="muted">破線は合格基準（各科目60%）。棒は延べ解答の正答率です。</p></section>
      <section class="card"><h3 class="chart-title">直近14日の学習問題数</h3>
        <p>合計 <strong>${sum.total}問</strong>（正解 ${sum.correct}問）・<span class="nowrap">学習した日 ${sum.active}日</span></p>${dailyBars(days, today)}
        <p class="muted"><span class="dot-key" aria-hidden="true"></span>は、問題の解答はないが学習した日です（テキスト・暗記カード、またはこの記録を始める前の解答）。</p>
        <details class="chart-table"><summary>表で見る</summary><table class="data-table"><thead><tr><th scope="col">日付</th><th scope="col">問題数</th><th scope="col">正解</th></tr></thead><tbody>
          ${days.slice().reverse().map(d => `<tr><th scope="row">${e(d.date.slice(5).replace('-', '/'))}${d.date === today ? '（今日）' : ''}</th><td>${d.total ? `${d.total}問` : d.studied ? '0問（学習あり）' : '—'}</td><td>${d.total ? `${d.correct}問` : '—'}</td></tr>`).join('')}
        </tbody></table></details></section>
      <section class="card"><h3 class="chart-title">節ごとの既読・正答率</h3><p class="heat-legend">${legend}</p>
        ${prog.map(p => `<details class="heat"><summary><span class="row"><strong>${e(p.short)}</strong><span class="muted">既読 ${p.readCount} / ${p.sections.length}節</span></span>${p.sections.length ? heatStrip(p.sections) : '<span class="muted">データなし</span>'}</summary>
          ${p.sections.length ? sectionTable(p) : '<p class="empty">データなし</p>'}</details>`).join('')}</section>`;
  }

  globalThis.StudyCharts = { progress, subjectRates, dailyBars, heatStrip, sectionTable };
})();
