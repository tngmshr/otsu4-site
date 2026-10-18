/* Data registration and testable, DOM-independent study logic. */
(() => {
  'use strict';
  const SUBJECTS = [
    { id: 'hourei', name: '危険物に関する法令', short: '法令', target: 15 },
    { id: 'butsuka', name: '基礎的な物理学及び基礎的な化学', short: '物化', target: 10 },
    { id: 'seishou', name: '危険物の性質並びにその火災予防及び消火の方法', short: '性消', target: 10 }
  ];
  const subjects = new Map(SUBJECTS.map(s => [s.id, { ...s, chapters: [], questions: [], cards: [] }]));
  const questions = new Map(), sections = new Map(), cards = new Map();
  const safeId = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x);
  const key = (subject, id) => `${subject}:${id}`;
  function merge(list, item) {
    const index = list.findIndex(x => x.id === item.id);
    if (index < 0) list.push(item); else list[index] = item;
  }
  function register(data) {
    if (!data || !subjects.has(data.subject)) return false;
    const subject = subjects.get(data.subject);
    if (typeof data.name === 'string') subject.name = data.name;
    for (const chapter of data.chapters || []) {
      if (!safeId(chapter.id) || typeof chapter.title !== 'string') continue;
      let dest = subject.chapters.find(c => c.id === chapter.id);
      if (!dest) { dest = { id: chapter.id, title: chapter.title, sections: [] }; subject.chapters.push(dest); }
      dest.title = chapter.title;
      for (const section of chapter.sections || []) {
        if (!safeId(section.id) || typeof section.title !== 'string' || typeof section.body !== 'string') continue;
        const item = { ...section, subject: subject.id, chapter: chapter.id,
          key: key(subject.id, section.id), points: Array.isArray(section.points) ? section.points : [] };
        merge(dest.sections, item); sections.set(item.key, item);
      }
    }
    for (const q of data.questions || []) {
      if (!safeId(q.id) || !safeId(q.section) || typeof q.q !== 'string' || !Array.isArray(q.choices) ||
          q.choices.length !== 5 || !q.choices.every(x => typeof x === 'string') ||
          !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 4 || ![1, 2, 3].includes(q.level)) continue;
      const item = { ...q, subject: subject.id, key: key(subject.id, q.id), why: Array.isArray(q.why) ? q.why : [] };
      merge(subject.questions, item); questions.set(item.key, item);
    }
    for (const card of data.cards || []) {
      if (!safeId(card.id) || !safeId(card.section) || typeof card.front !== 'string' || typeof card.back !== 'string') continue;
      const item = { ...card, subject: subject.id, key: key(subject.id, card.id) };
      merge(subject.cards, item); cards.set(item.key, item);
    }
    return true;
  }
  function freshState() {
    return { version: 1, settings: { theme: 'system', font: 'normal', examDate: '' },
      read: {}, answers: {}, cards: {}, days: [], daily: {}, awards: {}, clears: {}, exams: [], active: null, lastRoute: '#/text' };
  }
  function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDate(date) === value;
  }
  function touch(state, date = localDate()) { if (!state.days.includes(date)) state.days.push(date); }
  // Per-day answer counts. Added after v1 shipped: older saves have no `daily`, so readers treat it as optional.
  function recordAnswer(state, qkey, correct, date = localDate()) {
    const entry = state.answers[qkey] || { total: 0, correct: 0, streak: 0, weak: false, review: false };
    entry.total++; entry.correct += correct ? 1 : 0;
    entry.streak = correct ? entry.streak + 1 : 0;
    if (!correct) entry.weak = true;
    if (entry.streak >= 2) { entry.weak = false; entry.review = false; }
    state.answers[qkey] = entry; touch(state, date);
    const daily = state.daily || (state.daily = {}), day = daily[date] || (daily[date] = { total: 0, correct: 0 });
    day.total++; day.correct += correct ? 1 : 0;
    return entry;
  }
  function setReview(state, qkey, value) {
    const entry = state.answers[qkey] || { total: 0, correct: 0, streak: 0, weak: false, review: false };
    entry.review = value;
    if (value) entry.streak = 0;
    state.answers[qkey] = entry;
  }
  function weakKeys(state) { return Object.keys(state.answers).filter(k => state.answers[k].weak || state.answers[k].review); }
  function stats(state, list) {
    return list.reduce((a, q) => {
      const e = state.answers[q.key];
      if (e) { a.total += e.total; a.correct += e.correct; if (e.total) a.unique++; }
      return a;
    }, { total: 0, correct: 0, unique: 0 });
  }
  // 0 = not answered yet, 1: <40%, 2: <60% (below the pass line), 3: <80%, 4: 80%+.
  function rateLevel(correct, total) {
    if (!total) return 0;
    const rate = correct / total;
    return rate < .4 ? 1 : rate < .6 ? 2 : rate < .8 ? 3 : 4;
  }
  function progress(state) {
    return SUBJECTS.map(s => {
      const sub = subjects.get(s.id), bySection = new Map();
      for (const q of sub.questions) { if (!bySection.has(q.section)) bySection.set(q.section, []); bySection.get(q.section).push(q); }
      const sections = sub.chapters.flatMap(c => c.sections.map(sec => {
        const own = bySection.get(sec.id) || [], stat = stats(state, own);
        return { key: sec.key, title: sec.title, chapter: c.title, read: !!state.read[sec.key], questions: own.length,
          ...stat, rate: stat.total ? stat.correct / stat.total : null, level: rateLevel(stat.correct, stat.total) };
      }));
      const stat = stats(state, sub.questions);
      return { subject: s.id, short: s.short, available: sub.questions.length, ...stat,
        rate: stat.total ? stat.correct / stat.total : null, readCount: sections.filter(x => x.read).length, sections };
    });
  }
  // Oldest first, ending today. `studied` marks days in `days` (reading/cards, or answers saved before `daily` existed).
  function recentDays(state, today = localDate(), count = 14) {
    const days = new Set(state.days), daily = state.daily || {}, date = new Date(`${today}T12:00:00`), result = [];
    for (let i = 0; i < count; i++) {
      const key = localDate(date), entry = daily[key];
      result.unshift({ date: key, total: entry ? entry.total : 0, correct: entry ? entry.correct : 0, studied: days.has(key) });
      date.setDate(date.getDate() - 1);
    }
    return result;
  }
  function shuffle(list, random = Math.random) {
    const result = [...list];
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function mockSet(random = Math.random) {
    return SUBJECTS.flatMap(s => shuffle(subjects.get(s.id).questions, random).slice(0, s.target));
  }
  function grade(list, answers) {
    const scores = SUBJECTS.map(s => {
      const own = list.filter(q => q.subject === s.id);
      const correct = own.filter(q => answers[q.key] === q.answer).length;
      return { subject: s.id, total: own.length, correct, rate: own.length ? correct / own.length : 0 };
    });
    return { scores, passed: scores.every(s => s.total > 0 && s.rate >= 0.6),
      total: list.length, correct: scores.reduce((n, s) => n + s.correct, 0), incomplete: scores.some(s => s.total === 0) };
  }
  function streak(state, today = localDate()) {
    const days = new Set(state.days); let date = new Date(`${today}T12:00:00`), count = 0;
    if (!days.has(localDate(date))) date.setDate(date.getDate() - 1);
    while (days.has(localDate(date))) { count++; date.setDate(date.getDate() - 1); }
    return count;
  }
  // Strict import validation: reject malformed data before any live-state mutation.
  function validateState(input) {
    const fail = () => { throw new Error('対応する学習データJSONではありません。'); };
    const obj = x => x && typeof x === 'object' && !Array.isArray(x);
    const mapKey = x => /^(hourei|butsuka|seishou):[a-zA-Z0-9_-]{1,100}$/.test(x);
    const number = x => Number.isSafeInteger(x) && x >= 0;
    if (!obj(input) || input.version !== 1 || !obj(input.settings) ||
        !['system', 'light', 'dark'].includes(input.settings.theme) || !['normal', 'large', 'xlarge'].includes(input.settings.font) ||
        (input.settings.examDate !== '' && !validDate(input.settings.examDate))) fail();
    const out = freshState(); out.settings = { theme: input.settings.theme, font: input.settings.font, examDate: input.settings.examDate };
    for (const type of ['read', 'answers', 'cards']) {
      if (!obj(input[type])) fail();
      for (const [k, v] of Object.entries(input[type])) {
        if (!mapKey(k)) fail();
        if (type === 'answers') {
          if (!obj(v) || !number(v.total) || !number(v.correct) || !number(v.streak) || v.correct > v.total ||
              v.streak > v.correct || typeof v.weak !== 'boolean' || typeof v.review !== 'boolean') fail();
          out.answers[k] = { total: v.total, correct: v.correct, streak: v.streak, weak: v.weak, review: v.review };
        } else { if (typeof v !== 'boolean') fail(); out[type][k] = v; }
      }
    }
    if (!Array.isArray(input.days) || !input.days.every(validDate) || !Array.isArray(input.exams)) fail();
    out.days = [...new Set(input.days)];
    if (input.daily !== undefined) {
      if (!obj(input.daily)) fail();
      for (const [k, v] of Object.entries(input.daily)) {
        if (!validDate(k) || !obj(v) || !number(v.total) || !number(v.correct) || v.correct > v.total) fail();
        out.daily[k] = { total: v.total, correct: v.correct };
      }
    }
    // Titles and section clears (js/awards.js) were added later too; both are optional.
    if (input.awards !== undefined) {
      if (!obj(input.awards)) fail();
      for (const [k, v] of Object.entries(input.awards)) { if (!/^[a-z0-9-]{1,40}$/.test(k) || !validDate(v)) fail(); out.awards[k] = v; }
    }
    if (input.clears !== undefined) {
      if (!obj(input.clears)) fail();
      for (const [k, v] of Object.entries(input.clears)) { if (!mapKey(k) || v !== true) fail(); out.clears[k] = true; }
    }
    function session(x, completed = false) {
      if (!obj(x) || !['practice', 'review', 'mock'].includes(x.mode) || !Array.isArray(x.keys) || !x.keys.length ||
          !x.keys.every(mapKey) || new Set(x.keys).size !== x.keys.length || !number(x.index) || x.index >= x.keys.length ||
          !obj(x.answers) || !Number.isFinite(x.started) || !Number.isFinite(x.deadline) || typeof x.finished !== 'boolean') fail();
      const copy = { mode: x.mode, keys: [...x.keys], index: x.index, answers: {}, started: x.started,
        deadline: x.deadline, finished: x.finished, id: typeof x.id === 'string' ? x.id.slice(0, 100) : '' };
      for (const [k, v] of Object.entries(x.answers)) {
        if (!x.keys.includes(k) || !(v === null || (Number.isInteger(v) && v >= 0 && v < 5))) fail();
        copy.answers[k] = v;
      }
      if (completed && (copy.mode !== 'mock' || !copy.finished)) fail();
      return copy;
    }
    out.exams = input.exams.map(x => session(x, true));
    if (input.active !== null) out.active = session(input.active);
    if (typeof input.lastRoute === 'string' && /^#\/(text|session)(\/[a-zA-Z0-9_:%-]+)*$/.test(input.lastRoute)) out.lastRoute = input.lastRoute;
    return out;
  }
  globalThis.OTSU4 = { version: '1.4.3', SUBJECTS, subjects, questions, sections, cards, register,
    freshState, localDate, validDate, touch, recordAnswer, setReview, weakKeys, stats, rateLevel, progress, recentDays, shuffle, mockSet, grade, streak, validateState };
})();
