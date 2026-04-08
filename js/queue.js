/* ═══════════════════════════════════════════════════
   queue.js — قائمة الانتظار وأرشيف تم النشر
═══════════════════════════════════════════════════ */

const Queue = {

  /* ══ جلب القائمة ══════════════════════════════ */

  getAll() {
    const items = Storage.loadLocal(Config.keys.queue, []);
    items.forEach(q => { q.imgs = Storage.loadImages('qi-', q.id); });
    return items;
  },

  saveAll(items) {
    const meta = items.map(q => ({ ...q, imgs: [] }));
    Storage.saveLocal(Config.keys.queue, meta);
    items.forEach(q => {
      if (q.imgs?.length) Storage.saveImages('qi-', q.id, q.imgs);
    });
    Storage.schedulSync();
    UI.updateStats();
  },

  /* ══ حفظ تغريدة جديدة ════════════════════════ */

  save() {
    if (!Generate.currentTweet || Generate.currentTweet.startsWith('⚠️')) return;

    const item = {
      id:     Date.now(),
      text:   Generate.currentTweet,
      tweets: Generate.currentTweets,
      type:   Generate.tweetType,
      imgs:   [...Generate.images],
      product: document.getElementById('g-name').value,
      status: 'ready',
      date:   new Date().toLocaleDateString('ar-SA')
    };

    const all = Queue.getAll();
    all.push(item);
    Queue.saveAll(all);
    UI.flash('a-save');
  },

  /* ══ تحديد التغريدة كمنشورة ═══════════════════ */

  markPosted(id) {
    const all = Queue.getAll();
    const q   = all.find(x => x.id === id); if (!q) return;
    q.status   = 'posted';
    q.postedAt = new Date().toLocaleDateString('ar-SA');
    Queue.saveAll(all);
    Queue.render();
    Queue.renderPosted();
  },

  /* ══ إعادة للانتظار من الأرشيف ════════════════ */

  moveToQueue(id) {
    const all = Queue.getAll();
    const q   = all.find(x => x.id === id); if (!q) return;
    q.status = 'ready';
    delete q.postedAt;
    Queue.saveAll(all);
    Queue.render();
    Queue.renderPosted();
  },

  /* ══ حذف (مع تأكيد) ════════════════════════════ */

  delete(id) {
    if (!confirm('هل تريد حذف هذه التغريدة نهائياً؟')) return;
    const all = Queue.getAll().filter(x => x.id !== id);
    Queue.saveAll(all);
    Queue.render();
    Queue.renderPosted();
  },

  /* ══ نسخ نص تغريدة ═════════════════════════════ */

  copy(id, btn) {
    const all = Queue.getAll();
    const q   = all.find(x => x.id === id); if (!q) return;
    UI.copyText(q.text);
    if (btn) { btn.textContent = '✅ تم'; setTimeout(() => btn.textContent = '📋 نسخ', 1500); }
  },

  /* ══ فتح في تويتر (تطبيق أو متصفح) ══════════ */

  openTwitter(id) {
    const all = Queue.getAll();
    const q   = all.find(x => x.id === id); if (!q) return;

    const firstTweet = q.tweets?.length > 1 ? q.tweets[0] : q.text;
    const encoded    = encodeURIComponent(firstTweet);

    // نسخ النص كاملاً للحافظة
    UI.copyText(q.text);

    const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isIOS) {
      // iOS: جرّب فتح التطبيق أولاً، وإذا فشل افتح المتصفح
      const appUrl     = 'twitter://post?message=' + encoded;
      const browserUrl = 'https://twitter.com/intent/tweet?text=' + encoded;
      const start = Date.now();
      window.location.href = appUrl;
      // إذا لم يُفتح التطبيق خلال 1.5 ثانية → افتح المتصفح
      setTimeout(() => {
        if (Date.now() - start < 2000) window.open(browserUrl, '_blank');
      }, 1500);

    } else if (isAndroid) {
      // Android: intent لفتح التطبيق مع fallback للمتصفح
      const intentUrl = 'intent://post?message=' + encoded +
        '#Intent;package=com.twitter.android;scheme=twitter;' +
        'S.browser_fallback_url=' + encodeURIComponent('https://twitter.com/intent/tweet?text=' + encoded) +
        ';end';
      window.location.href = intentUrl;

    } else {
      // كمبيوتر: جرّب فتح تطبيق تويتر أولاً ثم المتصفح
      const browserUrl = 'https://twitter.com/intent/tweet?text=' + encoded;
      const appUrl     = 'twitter://post?message=' + encoded;
      // افتح التطبيق
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);
      // إذا لم يُفتح خلال 1.5 ثانية → افتح المتصفح
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (!document.hidden) window.open(browserUrl, '_blank');
      }, 1500);
    }
  },

  /* ══ تحميل صور التغريدة ════════════════════════ */

  downloadImgs(id) {
    const all = Queue.getAll();
    const q   = all.find(x => x.id === id); if (!q || !q.imgs?.length) return;
    q.imgs.forEach((img, i) => setTimeout(() => UI.downloadImg(img, 'tweet_img_' + (i+1) + '.jpg'), i * 400));
  },

  /* ══ رسم قائمة الانتظار ════════════════════════ */

  render() {
    const el      = document.getElementById('q-list');
    const all     = Queue.getAll();
    const pending = all.filter(q => q.status === 'ready');

    document.getElementById('q-cnt').textContent = pending.length;

    if (!pending.length) {
      el.innerHTML = '<div class="empty"><div class="ei">📋</div><p>ولّد تغريدات واحفظها هنا</p></div>';
      return;
    }
    el.innerHTML = pending.map(q => UI.queueCard(q, false)).join('');
  },

  /* ══ رسم أرشيف تم النشر ════════════════════════ */

  renderPosted() {
    const el     = document.getElementById('po-list');
    const all    = Queue.getAll();
    const posted = all.filter(q => q.status === 'posted');

    document.getElementById('po-cnt').textContent = posted.length;

    if (!posted.length) {
      el.innerHTML = '<div class="empty"><div class="ei">✅</div><p>لا توجد تغريدات منشورة بعد</p></div>';
      return;
    }
    // عرض الأحدث أولاً
    el.innerHTML = [...posted].reverse().map(q => UI.queueCard(q, true)).join('');
  }
};
