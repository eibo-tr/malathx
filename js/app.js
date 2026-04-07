/* ═══════════════════════════════════════════════════
   app.js — تهيئة التطبيق ونقطة البداية
   هذا الملف يربط كل شيء معاً
═══════════════════════════════════════════════════ */

const App = {

  /* ══ إعداد المفاتيح ══════════════════════════ */

  setup() {
    const ant = document.getElementById('s-ant').value.trim();
    const gh  = document.getElementById('s-gh').value.trim();
    const err = document.getElementById('setup-err');

    if (!ant.startsWith('sk-') || !gh.startsWith('ghp_') && !gh.startsWith('github_pat_')) {
      err.classList.add('show'); return;
    }
    err.classList.remove('show');
    localStorage.setItem(Config.keys.anthropic, ant);
    localStorage.setItem(Config.keys.github, gh);
    App.launch();
  },

  /* ══ تغيير المفاتيح ════════════════════════════ */

  changeKey() {
    if (!confirm('هل تريد تغيير مفاتيح API؟')) return;
    localStorage.removeItem(Config.keys.anthropic);
    localStorage.removeItem(Config.keys.github);
    document.getElementById('setup-screen').style.display = 'flex';
    document.getElementById('app').classList.remove('show');
    document.getElementById('s-ant').value = '';
    document.getElementById('s-gh').value  = '';
  },

  /* ══ تشغيل التطبيق ════════════════════════════ */

  async launch() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('app').classList.add('show');

    // جلب البيانات من GitHub Gist
    UI.setSyncStatus('syncing', '☁️ جارٍ التحميل...');
    const loaded = await Storage.loadFromGist();
    if (!loaded) UI.setSyncStatus('ok', '☁️ جديد');

    // تهيئة الواجهة
    UI.fillPlatformSelects();
    UI.fillCategorySelect();
    Generate.buildHashtagPicker();
    Products.updateSelect();
    UI.buildImageGrid('gen-imgs', Generate.images, 'Generate.addImg');
    UI.buildImageGrid('p-imgs', Products.formImages, 'Products.addImg');
    UI.updateStats();
  },

  /* ══ تحديث كل الواجهة ═════════════════════════ */

  refreshAll() {
    UI.fillPlatformSelects();
    UI.fillCategorySelect();
    Generate.buildHashtagPicker();
    Products.render();
    Products.updateSelect();
    Queue.render();
    Queue.renderPosted();
    Settings.render();
    UI.updateStats();
  }
};

/* ══ نقطة البداية ═══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // إذا كانت المفاتيح محفوظة، شغّل مباشرة
  if (Storage.getAnthropic() && Storage.getGithub()) {
    App.launch();
  }

  // Enter في شاشة الإعداد
  ['s-ant', 's-gh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') App.setup(); });
  });
});
