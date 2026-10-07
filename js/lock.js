'use strict';
// Encrypted teaching data: PBKDF2-SHA256 -> AES-256-GCM. Same format as scripts/build-site.mjs.
(() => {
  const KEY = 'otsu4-study-key';
  const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const storage = {
    get() { try { return localStorage.getItem(KEY); } catch { return null; } },
    set(value) { try { localStorage.setItem(KEY, value); } catch { /* private mode */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }
  };
  async function bundle() {
    try {
      const response = await fetch('data/bundle.enc.json', { cache: 'no-cache' });
      if (!response.ok) return null;
      const data = JSON.parse(await response.text());
      return data && data.v === 1 && data.ct ? data : null;
    } catch { return null; }
  }
  async function derive(password, data) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(data.salt), iterations: data.iter },
      base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  async function decrypt(key, data) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(data.iv) }, key, unb64(data.ct));
    return new TextDecoder().decode(plain);
  }
  function run(code) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      const node = document.createElement('script'); node.src = url;
      node.onload = () => { URL.revokeObjectURL(url); resolve(); };
      node.onerror = () => { URL.revokeObjectURL(url); reject(new Error('run')); };
      document.head.append(node);
    });
  }
  function ask(data) {
    const main = document.getElementById('main') || document.querySelector('main') || document.body;
    main.innerHTML = `<section class="card lock"><h2>パスワード</h2><p>配布されたパスワードを入力してください。この端末では次回から入力不要です。</p>
      <form id="lock-form"><label for="lock-pass">パスワード</label>
      <input id="lock-pass" type="password" autocomplete="current-password" required>
      <label class="lock-show"><input id="lock-toggle" type="checkbox"> パスワードを表示</label>
      <p id="lock-error" class="note" role="alert"></p>
      <button class="primary wide" type="submit">開く</button></form></section>`;
    const input = main.querySelector('#lock-pass'), error = main.querySelector('#lock-error');
    main.querySelector('#lock-toggle').addEventListener('change', e => { input.type = e.target.checked ? 'text' : 'password'; });
    input.focus();
    return new Promise(resolve => {
      main.querySelector('#lock-form').addEventListener('submit', async event => {
        event.preventDefault(); error.textContent = '確認しています…';
        try {
          const key = await derive(input.value, data), code = await decrypt(key, data);
          storage.set(b64(await crypto.subtle.exportKey('raw', key))); resolve(code);
        } catch { error.textContent = 'パスワードが違います。'; input.select(); }
      });
    });
  }
  // Returns true when encrypted data was found and loaded, false when running with plain data files.
  async function unlock() {
    const data = await bundle();
    if (!data) return false;
    let code = null; const saved = storage.get();
    if (saved) {
      try {
        const key = await crypto.subtle.importKey('raw', unb64(saved), 'AES-GCM', false, ['decrypt']);
        code = await decrypt(key, data);
      } catch { storage.clear(); }
    }
    if (code === null) code = await ask(data);
    await run(code);
    return true;
  }
  globalThis.OTSU4Lock = { unlock, forget: storage.clear, hasKey: () => !!storage.get() };
})();
