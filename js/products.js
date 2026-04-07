/* ═══════════════════════════════════════════════════
   products.js — إدارة المنتجات
═══════════════════════════════════════════════════ */

const Products = {

  formImages: [],   // صور نموذج الإضافة
  editingId:  null, // معرّف المنتج الذي يُعدَّل

  /* ══ جلب المنتجات ══════════════════════════════ */

  getAll() {
    const products = Storage.loadLocal(Config.keys.products, []);
    // إعادة تحميل الصور من sessionStorage
    products.forEach(p => {
      p.imgs = Storage.loadImages('pi-', p.id);
    });
    return products;
  },

  saveAll(products) {
    const meta = products.map(p => ({ ...p, imgs: [] }));
    Storage.saveLocal(Config.keys.products, meta);
    products.forEach(p => {
      if (p.imgs?.length) Storage.saveImages('pi-', p.id, p.imgs);
    });
    Storage.schedulSync();
    UI.updateStats();
  },

  /* ══ إضافة منتج ════════════════════════════════ */

  async add() {
    const name = document.getElementById('p-name').value.trim();
    if (!name) { alert('يرجى إدخال اسم المنتج'); return; }

    const product = {
      id:       Date.now(),
      name,
      platform: document.getElementById('p-plat').value,
      category: document.getElementById('p-cat').value,
      link:     document.getElementById('p-link').value.trim(),
      notes:    document.getElementById('p-notes').value.trim(),
      imgs:     [...Products.formImages]
    };

    const all = Products.getAll();
    all.push(product);
    Products.saveAll(all);
    Products.clearForm();
    Products.render();
    Products.updateSelect();
    UI.flash('a-prod');
  },

  /* ══ جلب تلقائي ════════════════════════════════ */

  async fetch() {
    const url = document.getElementById('fetch-url').value.trim();
    if (!url) { alert('يرجى إدخال الرابط'); return; }

    const isAmz  = /amazon\.(sa|com|ae|eg)|amzn\.(eu|to|com)/i.test(url);
    const plat   = isAmz ? 'Amazon' : 'iHerb';
    const btn    = document.getElementById('fetch-btn');
    const st     = document.getElementById('fetch-st');
    btn.textContent = '⏳'; btn.disabled = true;
    st.className = 'fetch-status fload show';
    st.textContent = '🤖 يجلب البيانات والصور...';

    let hints = '';
    try {
      const dec = decodeURIComponent(url);
      const iM  = dec.match(/iherb\.com\/(?:pr\/)?([a-z0-9\-]+)/i);
      if (iM) hints = 'slug: ' + iM[1].replace(/-/g, ' ');
      const aM  = dec.match(/\/dp\/([A-Z0-9]{10})/);
      if (aM) hints += ' ASIN:' + aM[1];
    } catch(e) {}

    const s      = Settings.get();
    const catList = s.categories.filter(c => c !== 'أخرى').join('، ');
    const prompt = `استنتج بيانات هذا المنتج من الرابط (بدون بحث إنترنت).
الرابط: ${url}
${hints ? 'مساعدة: ' + hints : ''}
المنصة: ${plat}
أرجع JSON فقط بدون markdown:
{"nameAr":"الاسم بالعربية","nameEn":"name","description":"وصف جملتين","platform":"${plat}","category":"من: ${catList}"}`;

    const [aiResult, imgResult] = await Promise.allSettled([
      Generate.callAI(prompt, 350),
      Generate.fetchImages(url)
    ]);

    let ok = false;
    if (aiResult.status === 'fulfilled') {
      try {
        const m   = aiResult.value.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
        if (m) {
          const inf = JSON.parse(m[0]);
          if (inf.nameAr || inf.nameEn) {
            document.getElementById('p-name').value = inf.nameAr || inf.nameEn || '';
            document.getElementById('p-notes').value = inf.description || '';
            document.getElementById('p-link').value  = url;
            if (s.platforms.includes(plat)) document.getElementById('p-plat').value = plat;
            if (inf.category && s.categories.includes(inf.category)) {
              document.getElementById('p-cat').value = inf.category;
              document.getElementById('custom-cat-w').style.display = 'none';
            }
            ok = true;
          }
        }
      } catch(e) {}
    }

    const imgs = imgResult.status === 'fulfilled' ? imgResult.value : [];
    if (imgs.length) {
      Products.formImages = [...imgs];
      UI.buildImageGrid('p-imgs', Products.formImages, 'Products.addImg');
    }
    if (!ok) document.getElementById('p-link').value = url;

    st.className = 'fetch-status ' + (ok ? 'fok' : 'ferr') + ' show';
    st.textContent = ok
      ? (imgs.length ? '✅ تم الجلب مع ' + imgs.length + ' صور' : '✅ تم الجلب — أضف الصور يدوياً')
      : '⚠️ لم يتعرف — الرابط حُفظ، أكمل يدوياً';
    btn.textContent = '🔍 جلب'; btn.disabled = false;
  },

  /* ══ الصور ═════════════════════════════════════ */

  async addImg(input) {
    const f = input.files[0]; if (!f) return;
    const b64 = await UI.readFile(f);
    Products.formImages.push(await UI.compressImage(b64));
    UI.buildImageGrid('p-imgs', Products.formImages, 'Products.addImg');
  },

  /* ══ مسح النموذج ═══════════════════════════════ */

  clearForm() {
    ['p-name', 'p-link', 'p-notes', 'fetch-url'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    Products.formImages = [];
    UI.buildImageGrid('p-imgs', Products.formImages, 'Products.addImg');
    document.getElementById('custom-cat-w').style.display = 'none';
    const fs = document.getElementById('fetch-st');
    if (fs) { fs.className = 'fetch-status'; fs.textContent = ''; }
  },

  /* ══ ملء نموذج التوليد من منتج محفوظ ════════ */

  fillGen() {
    const i = document.getElementById('g-sel').value;
    if (i === '') return;
    const all = Products.getAll();
    const p   = all[i]; if (!p) return;
    document.getElementById('g-name').value  = p.name;
    document.getElementById('g-link').value  = p.link || '';
    document.getElementById('g-plat').value  = p.platform;
    document.getElementById('g-notes').value = p.notes || '';
    Generate.images = p.imgs ? [...p.imgs] : [];
    UI.buildImageGrid('gen-imgs', Generate.images, 'Generate.addImg');
  },

  updateSelect() {
    const s   = document.getElementById('g-sel');
    const all = Products.getAll();
    s.innerHTML = '<option value="">— اختر —</option>';
    all.forEach((p, i) => s.innerHTML += `<option value="${i}">${p.name} (${p.platform})</option>`);
  },

  /* ══ التعديل ═══════════════════════════════════ */

  toggleEdit(id) {
    Products.editingId = Products.editingId === id ? null : id;
    Products.render();
    if (Products.editingId) {
      setTimeout(() => {
        const el = document.getElementById('ep-' + id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  },

  saveEdit(id) {
    const all = Products.getAll();
    const p   = all.find(x => x.id === id); if (!p) return;
    p.name     = document.getElementById('en-' + id).value.trim() || p.name;
    p.platform = document.getElementById('eplat-' + id).value;
    p.category = document.getElementById('ecat-' + id).value;
    p.link     = document.getElementById('el-' + id).value.trim();
    p.notes    = document.getElementById('eno-' + id).value.trim();
    const ei   = window['ei_' + id];
    if (ei) { p.imgs = ei; Storage.saveImages('pi-', id, ei); }
    Products.saveAll(all);
    Products.editingId = null;
    Products.render();
    Products.updateSelect();
  },

  delete(id) {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;
    const all = Products.getAll().filter(p => p.id !== id);
    Products.saveAll(all);
    if (Products.editingId === id) Products.editingId = null;
    Products.render();
    Products.updateSelect();
  },

  use(id) {
    const all = Products.getAll();
    const p   = all.find(x => x.id === id); if (!p) return;
    document.getElementById('g-name').value  = p.name;
    document.getElementById('g-link').value  = p.link || '';
    document.getElementById('g-plat').value  = p.platform;
    document.getElementById('g-notes').value = p.notes || '';
    Generate.images = p.imgs ? [...p.imgs] : [];
    UI.buildImageGrid('gen-imgs', Generate.images, 'Generate.addImg');
    UI.go('gen');
  },

  /* ══ صور التعديل ═══════════════════════════════ */

  buildEditGrid(gid, pid) {
    const imgs = window['ei_' + pid] || [];
    const el   = document.getElementById(gid); if (!el) return;
    el.innerHTML = '';
    imgs.forEach((img, i) => {
      const s = document.createElement('div'); s.className = 'img-slot';
      s.innerHTML = `<img src="${img}" alt=""/><button class="rm" onclick="Products.rmEditImg(${pid},${i},event)">×</button>`;
      el.appendChild(s);
    });
    if (imgs.length < 4) {
      const s = document.createElement('div'); s.className = 'img-slot';
      const uid = 'ef_' + pid + '_' + Date.now();
      s.innerHTML = `<span class="ai">+</span><input type="file" id="${uid}" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;z-index:1" onchange="Products.addEditImg(this,${pid})"/>`;
      el.appendChild(s);
    }
  },

  rmEditImg(pid, idx, e) {
    e?.stopPropagation();
    const imgs = window['ei_' + pid] || [];
    imgs.splice(idx, 1);
    Products.buildEditGrid('eg-' + pid, pid);
  },

  async addEditImg(input, pid) {
    const f = input.files[0]; if (!f) return;
    const b64 = await UI.readFile(f);
    const c   = await UI.compressImage(b64);
    if (!window['ei_' + pid]) window['ei_' + pid] = [];
    window['ei_' + pid].push(c);
    Products.buildEditGrid('eg-' + pid, pid);
  },

  /* ══ رسم القائمة ═══════════════════════════════ */

  render() {
    const el  = document.getElementById('p-list');
    const all = Products.getAll();
    document.getElementById('p-cnt').textContent = all.length;

    if (!all.length) {
      el.innerHTML = '<div class="empty"><div class="ei">📦</div><p>أضف أول منتج أعلاه</p></div>';
      return;
    }

    const s = Settings.get();

    el.innerHTML = all.map(p => {
      const isEd = Products.editingId === p.id;
      const fi   = p.imgs?.[0] || '';
      return `<div>
        <div class="pcard${isEd ? ' editing' : ''}">
          <div class="pthumb">${fi ? `<img src="${fi}" onerror="this.innerHTML='📦'" alt=""/>` : '📦'}</div>
          <div class="pinfo">
            <div class="pname">${p.name}</div>
            <div class="pmeta">${p.platform} · ${p.category}</div>
            ${p.link ? `<div class="pmeta" style="color:var(--blue)">🔗 ${p.link.substring(0,45)}...</div>` : '<div class="pmeta" style="color:var(--red)">⚠️ لا يوجد رابط</div>'}
            <div class="pmeta" style="color:${p.imgs?.length ? 'var(--green)' : 'var(--text3)'}">📸 ${p.imgs?.length ? p.imgs.length + ' صور' : 'لا صور'}</div>
          </div>
          <div class="pact">
            <button class="btn btn-sm ${isEd ? 'btn-p' : 'btn-e'}" onclick="Products.toggleEdit(${p.id})">${isEd ? '✕' : '✏️'}</button>
            <button class="btn btn-sm btn-s" onclick="Products.use(${p.id})" title="استخدم في التوليد">✨</button>
            <button class="btn btn-sm btn-d" onclick="Products.delete(${p.id})">🗑</button>
          </div>
        </div>
        ${isEd ? `<div class="edit-panel open" id="ep-${p.id}">
          <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:9px">✏️ تعديل</div>
          <div class="fg">
            <div class="fg-g full"><label>الاسم</label><input id="en-${p.id}" value="${p.name.replace(/"/g, '&quot;')}"/></div>
            <div class="fg-g"><label>المنصة</label><select id="eplat-${p.id}">${s.platforms.map(v => `<option${p.platform === v ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="fg-g"><label>الفئة</label><select id="ecat-${p.id}">${s.categories.map(c => `<option${p.category === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
            <div class="fg-g full"><label>الرابط</label><input id="el-${p.id}" value="${(p.link || '').replace(/"/g, '&quot;')}"/></div>
            <div class="fg-g full"><label>📸 الصور</label><div class="imgs-grid" id="eg-${p.id}"></div></div>
            <div class="fg-g full"><label>ملاحظات</label><textarea id="eno-${p.id}" style="min-height:48px">${p.notes || ''}</textarea></div>
          </div>
          <div class="brow">
            <button class="btn btn-p" onclick="Products.saveEdit(${p.id})">💾 حفظ</button>
            <button class="btn btn-s" onclick="Products.toggleEdit(${p.id})">إلغاء</button>
          </div>
        </div>` : ''}
      </div>`;
    }).join('');

    // بناء شبكات صور التعديل
    all.forEach(p => {
      if (Products.editingId === p.id) {
        window['ei_' + p.id] = p.imgs ? [...p.imgs] : [];
        Products.buildEditGrid('eg-' + p.id, p.id);
      }
    });
  }
};
