/* ═══════════════════════════════════════════════════
   ui.js — واجهة المستخدم والتنقل
═══════════════════════════════════════════════════ */

const UI = {

  /* ── التنقل بين الأقسام ── */
  go(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('section-' + id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('active');
    // استدعاء render عند التنقل
    const renders = {
      prod:     () => { Products.editingId = null; Products.render(); },
      queue:    () => Queue.render(),
      posted:   () => Queue.renderPosted(),
      settings: () => Settings.render(),
      tips:     () => UI.renderTips()
    };
    if (renders[id]) renders[id]();
  },

  /* ── إظهار رسالة مؤقتة ── */
  flash(id, msg = null) {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  },

  /* ── تحديث الإحصاءات في الهيدر ── */
  updateStats() {
    const products = Storage.loadLocal(Config.keys.products, []);
    const queue    = Storage.loadLocal(Config.keys.queue, []);
    const pending  = queue.filter(q => q.status === 'ready');
    const posted   = queue.filter(q => q.status === 'posted');

    document.getElementById('hp').textContent   = products.length;
    document.getElementById('hd').textContent   = pending.length;
    document.getElementById('hpo').textContent  = posted.length;
    document.getElementById('nb-p').textContent = products.length;
    document.getElementById('nb-q').textContent = pending.length;
    document.getElementById('nb-po').textContent= posted.length;
  },

  /* ── حالة المزامنة ── */
  setSyncStatus(status, text) {
    const el = document.getElementById('sync-badge');
    el.className = 'sync-badge' + (status !== 'ok' ? ' ' + (status === 'syncing' ? 'syncing' : 'error') : '');
    el.textContent = text;
  },

  /* ── ملء قوائم المنصات ── */
  fillPlatformSelects() {
    const s = Settings.get();
    ['g-plat', 'p-plat'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const val = el.value;
      el.innerHTML = s.platforms.map(p => `<option>${p}</option>`).join('');
      if (val && s.platforms.includes(val)) el.value = val;
    });
  },

  /* ── ملء قائمة الفئات ── */
  fillCategorySelect() {
    const s = Settings.get();
    const el = document.getElementById('p-cat');
    if (!el) return;
    const val = el.value;
    el.innerHTML = s.categories.map(c => `<option>${c}</option>`).join('');
    if (val && s.categories.includes(val)) el.value = val;
  },

  /* ── نسخ نص ── */
  copyText(text) {
    try {
      navigator.clipboard.writeText(text).catch(() => UI._legacyCopy(text));
    } catch(e) { UI._legacyCopy(text); }
  },
  _legacyCopy(text) {
    const a = document.createElement('textarea');
    a.value = text;
    a.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(a);
    a.select(); a.setSelectionRange(0, 99999);
    document.execCommand('copy');
    document.body.removeChild(a);
  },

  /* ── تحميل صورة ── */
  downloadImg(src, name) {
    const a = document.createElement('a');
    a.href = src; a.download = name; a.click();
  },

  /* ── معاينة تغريدة ── */
  renderTweetPreview(tweets, images) {
    const w = document.getElementById('preview');
    const author = `<div class="tw-auth"><div class="tw-av">🎯</div><div><div style="font-size:13px;font-weight:700">حسابك</div><div style="font-size:11px;color:var(--text2)">@your_handle</div></div>`;

    if (tweets.length === 1) {
      const img = images[0] || '';
      w.innerHTML = `<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:12px">${author}</div><div class="tw-body">${UI.esc(tweets[0])}</div>${img ? UI.imgLayout([img]) : ''}</div>`;
      // Fix unclosed div
      w.innerHTML = `<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:12px">
        <div class="tw-auth"><div class="tw-av">🎯</div><div><div style="font-size:13px;font-weight:700">حسابك</div><div style="font-size:11px;color:var(--text2)">@your_handle</div></div></div>
        <div class="tw-body">${UI.esc(tweets[0])}</div>
        ${img ? UI.imgLayout([img]) : ''}
      </div>`;
    } else {
      let h = '<div style="display:grid;gap:0">';
      tweets.forEach((tw, i) => {
        const imgs = UI.getImgsForTweet(i, tweets.length, images);
        const last = i === tweets.length - 1;
        h += `<div class="thread-tweet">
          <div class="tw-auth"><div class="tw-av">🎯</div>
            <div><div style="font-size:13px;font-weight:700">حسابك</div><div style="font-size:11px;color:var(--text2)">@your_handle</div></div>
            <span style="margin-right:auto;font-size:10px;color:var(--text3);font-weight:700">${i+1}/${tweets.length}</span>
          </div>
          <div class="tw-body">${UI.esc(tw)}</div>
          ${imgs.length ? UI.imgLayout(imgs) : ''}
        </div>${!last ? '<div class="thread-con"></div>' : ''}`;
      });
      w.innerHTML = h + '</div>';
    }
  },

  getImgsForTweet(idx, total, imgs) {
    if (!imgs.length) return [];
    if (imgs.length >= total) return [imgs[idx]];
    return idx < imgs.length ? [imgs[idx]] : [];
  },

  imgLayout(imgs) {
    if (!imgs.length) return '';
    const cls = ['', 'one', 'two', 'three', 'four'][Math.min(imgs.length, 4)];
    return `<div class="tw-imgs ${cls}">${imgs.map(s => `<img src="${s}" onerror="this.style.display='none'" alt=""/>`).join('')}</div>`;
  },

  esc(t) {
    return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  /* ── شبكة الصور ── */
  buildImageGrid(containerId, imagesArray, addFnName) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    imagesArray.forEach((img, i) => {
      const s = document.createElement('div');
      s.className = 'img-slot';
      s.innerHTML = `<img src="${img}" onerror="this.style.opacity='.2'" alt=""/><button class="rm" onclick="UI.removeImg('${containerId}',${i},event)">×</button>`;
      el.appendChild(s);
    });
    if (imagesArray.length < 4) {
      const s = document.createElement('div');
      s.className = 'img-slot';
      const uid = 'fi_' + containerId + '_' + Date.now();
      s.innerHTML = `<span class="ai">+</span><input type="file" id="${uid}" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;z-index:1" onchange="${addFnName}(this)"/>`;
      el.appendChild(s);
    }
  },

  removeImg(cid, idx, e) {
    e?.stopPropagation();
    if (cid === 'gen-imgs') {
      Generate.images.splice(idx, 1);
      UI.buildImageGrid('gen-imgs', Generate.images, 'Generate.addImg');
    } else if (cid === 'p-imgs') {
      Products.formImages.splice(idx, 1);
      UI.buildImageGrid('p-imgs', Products.formImages, 'Products.addImg');
    }
  },

  async compressImage(b64, maxW = 700, quality = 0.65) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const ratio = Math.min(1, maxW / img.width);
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => res(b64);
      img.src = b64;
    });
  },

  readFile(f) {
    return new Promise(r => {
      const fr = new FileReader();
      fr.onload = e => r(e.target.result);
      fr.readAsDataURL(f);
    });
  },

  /* ── فتح تويتر مع النص جاهز ── */
  openInTwitter(text) {
    // للـ Thread: افتح أول تغريدة فقط
    const firstTweet = text.split('\n\n---\n\n')[0].trim();
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(firstTweet);
    window.open(url, '_blank');
  },

  /* ── بطاقة تغريدة (queue/posted) ── */
  queueCard(item, isPosted) {
    const isThread = item.tweets?.length > 1;
    return `<div class="qitem">
      <div class="qh">
        <div class="qdot" style="background:${isPosted ? 'var(--blue)' : 'var(--green)'}"></div>
        <span style="font-size:11px;font-weight:700;color:var(--text2)">${item.type}</span>
        ${isThread ? `<span style="font-size:10px;background:rgba(167,139,250,.12);color:var(--purple);padding:1px 5px;border-radius:6px">🧵 ${item.tweets.length}</span>` : ''}
        <span style="font-size:10px;color:var(--text3);margin-right:auto">${isPosted ? (item.postedAt || item.date) : item.date}</span>
        <span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${isPosted ? 'rgba(77,158,255,.1)' : 'rgba(0,214,143,.08)'};color:${isPosted ? 'var(--blue)' : 'var(--green)'}">
          ${isPosted ? '✅ منشور' : 'جاهز'}
        </span>
      </div>
      <div class="qtext">${item.text}</div>
      ${item.imgs?.length ? `<div class="qimgs">${item.imgs.map(s => `<img src="${s}" onerror="this.style.display='none'" alt=""/>`).join('')}</div>` : ''}
      <div class="qfooter">
        <button class="btn btn-sm btn-s" onclick="Queue.copy(${item.id}, this)">📋 نسخ</button>
        <button class="btn btn-sm" style="background:rgba(29,161,242,.12);color:#1da1f2;border:1px solid rgba(29,161,242,.3)" onclick="Queue.openTwitter(${item.id})">
          🐦 افتح في تويتر
        </button>
        ${item.imgs?.length ? `<button class="btn btn-sm btn-l" onclick="Queue.downloadImgs(${item.id})">⬇️ الصور</button>` : ''}
        ${isPosted
          ? `<button class="btn btn-sm btn-s" onclick="Queue.moveToQueue(${item.id})">↩️ للانتظار</button>`
          : `<button class="btn btn-sm btn-t" onclick="Queue.markPosted(${item.id})">✅ نُشرت</button>`}
        <button class="btn btn-sm btn-d" onclick="Queue.delete(${item.id})">🗑</button>
      </div>
    </div>`;
  },

  /* ── نصائح التسويق ── */
  renderTips() {
    const tips = [
      { i: '☁️', t: 'البيانات محفوظة في GitHub',          tx: 'كل إضافة أو تعديل يُحفظ في GitHub Gist الخاص بك تلقائياً. افتح المنصة من أي جهاز وكل شيء موجود.' },
      { i: '⚙️', t: 'قوالب قابلة للتعديل',               tx: 'كل ملف JS منفصل — عدّل config.js لتغيير الافتراضيات، أو style.css للتصميم. لا تحتاج لمس الكود الأساسي.' },
      { i: '📸', t: 'جلب الصور',                          tx: 'المنصة تستخدم CORS Proxy لجلب الصور من المواقع. إذا لم تُجلب، أضفها يدوياً بزر +.' },
      { i: '🔗', t: 'الرابط في آخر تغريدة فقط',          tx: 'في الـ Thread الرابط يظهر في التغريدة الأخيرة فقط — أفضل لخوارزمية تويتر.' },
      { i: '✅', t: 'أرشيف النشر',                        tx: 'بعد النشر اضغط "نُشرت" وتنتقل لأرشيف دائم. انسخها مجدداً بدون توليد جديد.' },
      { i: '🎯', t: 'قاعدة 80/20',                        tx: '80% تفاعل مع الآخرين — 20% محتوى خاص. الناس تتابع الشخص قبل المحتوى.' },
      { i: '🧵', t: 'Thread أسبوعي',                      tx: 'Thread واحد أسبوعياً يجلب متابعين أكثر من 7 تغريدات عادية.' }
    ];
    document.getElementById('tips-list').innerHTML = tips.map(t =>
      `<div style="display:flex;gap:11px;padding:12px;border-bottom:1px solid var(--border);align-items:flex-start">
        <span style="font-size:19px;flex-shrink:0">${t.i}</span>
        <div><div style="font-size:12px;font-weight:700;margin-bottom:2px">${t.t}</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.7">${t.tx}</div></div>
      </div>`
    ).join('');
  }
};
