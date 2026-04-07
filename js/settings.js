/* ═══════════════════════════════════════════════════
   settings.js — إدارة الإعدادات
═══════════════════════════════════════════════════ */

const Settings = {

  /* ── جلب الإعدادات (أو الافتراضية) ── */
  get() {
    return Storage.loadLocal(Config.keys.settings) || {
      platforms: [...Config.defaultPlatforms],
      categories: [...Config.defaultCategories],
      hashtags: [...Config.defaultHashtags]
    };
  },

  /* ── حفظ الإعدادات ── */
  save(s) {
    Storage.saveLocal(Config.keys.settings, s);
    Storage.schedulSync();
  },

  /* ══ المنصات ══════════════════════════════════ */

  addPlat() {
    const v = document.getElementById('s-new-plat').value.trim();
    if (!v) return;
    const s = Settings.get();
    if (s.platforms.includes(v)) { alert('هذه المنصة موجودة بالفعل'); return; }
    s.platforms.push(v);
    Settings.save(s);
    document.getElementById('s-new-plat').value = '';
    Settings.render();
    UI.fillPlatformSelects();
    UI.flash('a-sett');
  },

  delPlat(v) {
    if (Config.defaultPlatforms.includes(v)) return; // لا يمكن حذف الافتراضية
    const s = Settings.get();
    s.platforms = s.platforms.filter(x => x !== v);
    Settings.save(s);
    Settings.render();
    UI.fillPlatformSelects();
  },

  /* ══ الفئات ════════════════════════════════════ */

  addCat() {
    const v = document.getElementById('s-new-cat').value.trim();
    if (!v) return;
    const s = Settings.get();
    if (s.categories.includes(v)) { alert('هذه الفئة موجودة بالفعل'); return; }
    // أضف قبل "أخرى"
    const idx = s.categories.indexOf('أخرى');
    if (idx >= 0) s.categories.splice(idx, 0, v);
    else s.categories.push(v);
    Settings.save(s);
    document.getElementById('s-new-cat').value = '';
    Settings.render();
    UI.fillCategorySelect();
    UI.flash('a-sett');
  },

  delCat(v) {
    if (Config.defaultCategories.includes(v)) return;
    const s = Settings.get();
    s.categories = s.categories.filter(x => x !== v);
    Settings.save(s);
    Settings.render();
    UI.fillCategorySelect();
  },

  /* ══ الهاشتاقات ════════════════════════════════ */

  addTag() {
    let v = document.getElementById('s-new-tag').value.trim();
    if (!v) return;
    if (!v.startsWith('#')) v = '#' + v;
    v = v.replace(/\s+/g, '_');
    const s = Settings.get();
    if (s.hashtags.includes(v)) { alert('هذا الهاشتاق موجود بالفعل'); return; }
    s.hashtags.push(v);
    Settings.save(s);
    document.getElementById('s-new-tag').value = '';
    Settings.render();
    Generate.buildHashtagPicker();
    UI.flash('a-sett');
  },

  delTag(v) {
    const s = Settings.get();
    s.hashtags = s.hashtags.filter(x => x !== v);
    Settings.save(s);
    Generate.selectedTags.delete(v);
    Settings.render();
    Generate.buildHashtagPicker();
  },

  /* ══ إضافة سريعة من نموذج المنتج ════════════ */

  saveCustPlat() {
    const v = document.getElementById('custom-plat').value.trim();
    if (!v) return;
    const s = Settings.get();
    if (!s.platforms.includes(v)) {
      s.platforms.push(v);
      Settings.save(s);
      UI.fillPlatformSelects();
      Settings.render();
    }
    document.getElementById('p-plat').value = v;
    document.getElementById('custom-plat').value = '';
    UI.flash('a-sett', '✅ تم حفظ المنصة الجديدة!');
  },

  saveCustCat() {
    const v = document.getElementById('custom-cat').value.trim();
    if (!v) return;
    const s = Settings.get();
    if (!s.categories.includes(v)) {
      const idx = s.categories.indexOf('أخرى');
      if (idx >= 0) s.categories.splice(idx, 0, v);
      else s.categories.push(v);
      Settings.save(s);
      UI.fillCategorySelect();
      Settings.render();
    }
    document.getElementById('p-cat').value = v;
    document.getElementById('custom-cat').value = '';
    document.getElementById('custom-cat-w').style.display = 'none';
    UI.flash('a-sett', '✅ تم حفظ الفئة الجديدة!');
  },

  onCatChange() {
    const v = document.getElementById('p-cat').value;
    document.getElementById('custom-cat-w').style.display = v === 'أخرى' ? 'block' : 'none';
  },

  /* ══ رسم صفحة الإعدادات ════════════════════════ */

  render() {
    const s = Settings.get();

    // المنصات
    document.getElementById('s-plats').innerHTML = s.platforms.map(p => {
      const isDef = Config.defaultPlatforms.includes(p);
      return `<span class="tag-item tp">${p}${isDef ? '' : `<button onclick="Settings.delPlat('${p}')">×</button>`}</span>`;
    }).join('');

    // الفئات
    document.getElementById('s-cats').innerHTML = s.categories.map(c => {
      const isDef = Config.defaultCategories.includes(c);
      return `<span class="tag-item tc">${c}${isDef ? '' : `<button onclick="Settings.delCat('${c}')">×</button>`}</span>`;
    }).join('');

    // الهاشتاقات
    document.getElementById('s-tags').innerHTML = s.hashtags.map(t =>
      `<span class="tag-item th">${t}<button onclick="Settings.delTag('${t}')">×</button></span>`
    ).join('');

    // وقت آخر مزامنة
    const lastSync = localStorage.getItem(Config.keys.syncTime);
    if (lastSync) {
      document.getElementById('sync-info').textContent = 'آخر مزامنة: ' + lastSync;
    }
  }
};
