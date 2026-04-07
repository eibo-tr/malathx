/* ═══════════════════════════════════════════════════
   app.js — تهيئة التطبيق ونقطة البداية
   هذا الملف يربط كل شيء معاً
═══════════════════════════════════════════════════ */

const App = {

  /* ══ إعداد المفاتيح ══════════════════════════ */

  async setup() {
    const ant = document.getElementById('s-ant').value.trim();
    const gh  = document.getElementById('s-gh').value.trim();
    const err = document.getElementById('setup-err');
    const btn = document.getElementById('setup-btn');

    // GitHub token مطلوب دائماً
    const ghValid = gh.startsWith('ghp_') || gh.startsWith('github_pat_');
    if (!ghValid) { err.textContent = 'يرجى إدخال GitHub Token صحيح (يبدأ بـ ghp_)'; err.classList.add('show'); return; }

    err.classList.remove('show');
    btn.textContent = '⏳ جارٍ التحقق...'; btn.disabled = true;
    localStorage.setItem(Config.keys.github, gh);

    // إذا أدخل مفتاح Anthropic — احفظه
    if (ant.startsWith('sk-')) {
      localStorage.setItem(Config.keys.anthropic, ant);
    }

    // ابحث عن Gist موجود وجلب البيانات (بما فيها مفتاح Anthropic المحفوظ سابقاً)
    const found = await Storage.findAndLoadGist(gh);

    // تحقق من وجود مفتاح Anthropic (محلي أو من الـ Gist)
    if (!Storage.getAnthropic()) {
      err.textContent = 'مفتاح Anthropic API غير موجود — أدخله في الخانة الأولى';
      err.classList.add('show');
      btn.textContent = '✅ ابدأ الاستخدام'; btn.disabled = false;
      return;
    }

    btn.textContent = '✅ ابدأ الاستخدام'; btn.disabled = false;
    App.launch();
  },

  /* ══ تغيير المفاتيح ════════════════════════════ */

  changeKey() {
    if (!confirm('هل تريد تغيير مفاتيح API؟')) return;
    localStorage.removeItem(Config.keys.anthropic);
    localStorage.removeItem(Config.keys.github);
    localStorage.removeItem(Config.keys.gistId);
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
    if (!loaded) UI.setSyncStatus('ok', '☁️ جاهز');

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
document.addEventListener('DOMContentLoaded', async () => {
  const gh  = Storage.getGithub();
  const ant = Storage.getAnthropic();

  // إذا كلا المفتاحين موجودين — شغّل مباشرة
  if (gh && ant) {
    App.launch();
    return;
  }

  // إذا GitHub token موجود فقط — جرّب جلب Anthropic key من الـ Gist
  if (gh && !ant) {
    UI.setSyncStatus('syncing', '☁️ جارٍ تحميل البيانات...');
    const found = await Storage.findAndLoadGist(gh);
    if (found && Storage.getAnthropic()) {
      App.launch();
      return;
    }
  }

  // Enter في شاشة الإعداد
  ['s-ant', 's-gh'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') App.setup(); });
  });
});
