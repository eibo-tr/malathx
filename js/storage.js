/* ═══════════════════════════════════════════════════
   storage.js — التخزين والمزامنة مع GitHub Gist
   البيانات تُحفظ محلياً + تُزامن مع Gist تلقائياً
═══════════════════════════════════════════════════ */

const Storage = {

  _syncTimer: null,

  /* ── جلب المفاتيح ── */
  getAnthropic: () => localStorage.getItem(Config.keys.anthropic) || '',
  getGithub:    () => localStorage.getItem(Config.keys.github) || '',
  getGistId:    () => localStorage.getItem(Config.keys.gistId) || '',

  /* ── حفظ محلي ── */
  saveLocal(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch(e) { console.error('Local save error:', e); return false; }
  },
  loadLocal(key, def = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch(e) { return def; }
  },

  /* ── حفظ الصور في sessionStorage (لا تُرسل للـ Gist) ── */
  saveImages(prefix, id, imgs) {
    if (!imgs?.length) return;
    try { sessionStorage.setItem(prefix + id, JSON.stringify(imgs)); } catch(e) {}
  },
  loadImages(prefix, id) {
    try { const v = sessionStorage.getItem(prefix + id); return v ? JSON.parse(v) : []; }
    catch(e) { return []; }
  },

  /* ── تجميع كل البيانات (بدون صور) ── */
  collectData() {
    const products = (Storage.loadLocal(Config.keys.products) || []).map(p => ({ ...p, imgs: [] }));
    const queue    = (Storage.loadLocal(Config.keys.queue) || []).map(q => ({ ...q, imgs: [] }));
    const settings = Storage.loadLocal(Config.keys.settings) || {};
    // نحفظ مفتاح Anthropic في الـ Gist — يُجلب تلقائياً في أي جهاز جديد
    const anthropicKey = Storage.getAnthropic();
    return { version: 1, updatedAt: new Date().toISOString(), products, queue, settings, anthropicKey };
  },

  /* ── استعادة البيانات ── */
  applyData(data) {
    if (!data) return;
    if (data.products)     Storage.saveLocal(Config.keys.products, data.products);
    if (data.queue)        Storage.saveLocal(Config.keys.queue, data.queue);
    if (data.settings)     Storage.saveLocal(Config.keys.settings, data.settings);
    // استعادة مفتاح Anthropic تلقائياً
    if (data.anthropicKey) localStorage.setItem(Config.keys.anthropic, data.anthropicKey);
  },

  /* ══ GitHub Gist API ══════════════════════════════ */

  async createGist(token, data) {
    const r = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: Config.gistDescription,
        public: false,
        files: { [Config.gistFilename]: { content: JSON.stringify(data, null, 2) } }
      })
    });
    if (!r.ok) throw new Error('GitHub API: ' + r.status);
    const d = await r.json();
    localStorage.setItem(Config.keys.gistId, d.id);
    return d.id;
  },

  async updateGist(token, gistId, data) {
    const r = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: { [Config.gistFilename]: { content: JSON.stringify(data, null, 2) } }
      })
    });
    if (!r.ok) throw new Error('GitHub API: ' + r.status);
  },

  async readGist(token, gistId) {
    const r = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (!r.ok) throw new Error('GitHub API: ' + r.status);
    const d = await r.json();
    const content = d.files?.[Config.gistFilename]?.content;
    return content ? JSON.parse(content) : null;
  },

  /* ══ مزامنة رئيسية ══════════════════════════════ */

  async syncNow() {
    const token = Storage.getGithub();
    if (!token) return;

    UI.setSyncStatus('syncing', '☁️ جارٍ الحفظ...');
    try {
      const data = Storage.collectData();
      let gistId = Storage.getGistId();

      if (gistId) {
        await Storage.updateGist(token, gistId, data);
      } else {
        await Storage.createGist(token, data);
      }

      const t = new Date().toLocaleTimeString('ar-SA');
      localStorage.setItem(Config.keys.syncTime, t);
      UI.setSyncStatus('ok', '☁️ محفوظ ' + t);
      document.getElementById('sync-info').textContent = 'آخر مزامنة: ' + t;
    } catch(e) {
      UI.setSyncStatus('error', '⚠️ خطأ في المزامنة');
      console.error('Sync error:', e);
    }
  },

  /* مزامنة مؤجلة (بعد 3 ثواني من آخر تغيير) */
  schedulSync() {
    clearTimeout(Storage._syncTimer);
    Storage._syncTimer = setTimeout(() => Storage.syncNow(), 3000);
  },

  /* جلب البيانات عند أول تشغيل */
  async loadFromGist() {
    const token = Storage.getGithub();
    const gistId = Storage.getGistId();
    if (!token || !gistId) return false;

    UI.setSyncStatus('syncing', '☁️ جارٍ التحميل...');
    try {
      const data = await Storage.readGist(token, gistId);
      if (data) Storage.applyData(data);
      UI.setSyncStatus('ok', '☁️ محفوظ');
      return true;
    } catch(e) {
      UI.setSyncStatus('error', '⚠️ تعذّر الجلب');
      return false;
    }
  },

  /* محاولة جلب الـ Gist بـ GitHub token فقط (بحث في كل Gists) */
  async findAndLoadGist(token) {
    try {
      const r = await fetch('https://api.github.com/gists', {
        headers: { 'Authorization': `token ${token}` }
      });
      if (!r.ok) return false;
      const gists = await r.json();
      const found = gists.find(g => g.files?.[Config.gistFilename]);
      if (!found) return false;
      localStorage.setItem(Config.keys.gistId, found.id);
      const data = await Storage.readGist(token, found.id);
      if (data) Storage.applyData(data);
      return true;
    } catch(e) { return false; }
  },

  /* ══ تصدير / استيراد JSON ══════════════════════ */

  exportJSON() {
    const data = Storage.collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'malaz-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  },

  importJSON() {
    document.getElementById('import-file').click();
  },

  doImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        Storage.applyData(data);
        Storage.syncNow();
        App.refreshAll();
        UI.flash('a-sett', 'تم الاستيراد بنجاح ✅');
      } catch(err) {
        alert('ملف غير صالح');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }
};
