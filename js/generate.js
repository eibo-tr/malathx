/* ═══════════════════════════════════════════════════
   generate.js — توليد المحتوى بالذكاء الاصطناعي
═══════════════════════════════════════════════════ */

const Generate = {

  images:      [],      // صور الجلسة الحالية
  selectedTags: new Set(), // الهاشتاقات المختارة
  tmpTags:     [],      // هاشتاقات مؤقتة
  tweetType:   'مقارنة',
  currentTweet:  '',
  currentTweets: [],

  /* ══ الهاشتاقات ════════════════════════════════ */

  buildHashtagPicker() {
    const s = Settings.get();
    document.getElementById('h-picker').innerHTML = s.hashtags.map(t =>
      `<span class="htag-chip${Generate.selectedTags.has(t) ? ' sel' : ''}" onclick="Generate.toggleTag(this,'${t}')">${t}</span>`
    ).join('');
    Generate.updateHashtagPreview();
  },

  toggleTag(el, t) {
    if (Generate.selectedTags.has(t)) {
      Generate.selectedTags.delete(t); el.classList.remove('sel');
    } else {
      if (Generate.selectedTags.size >= 5) { alert('5 هاشتاقات كحد أقصى'); return; }
      Generate.selectedTags.add(t); el.classList.add('sel');
    }
    Generate.updateHashtagPreview();
  },

  addTmpTag() {
    let v = document.getElementById('h-input').value.trim();
    if (!v) return;
    if (!v.startsWith('#')) v = '#' + v;
    v = v.replace(/\s+/g, '_');
    if (Generate.tmpTags.includes(v)) return;
    Generate.tmpTags.push(v);
    document.getElementById('h-input').value = '';
    Generate.renderTmpTags();
    Generate.updateHashtagPreview();
  },

  removeTmpTag(t) {
    Generate.tmpTags = Generate.tmpTags.filter(x => x !== t);
    Generate.renderTmpTags();
    Generate.updateHashtagPreview();
  },

  renderTmpTags() {
    document.getElementById('h-tmp').innerHTML = Generate.tmpTags.map(t =>
      `<span class="htag-ci">${t}<button onclick="Generate.removeTmpTag('${t}')">×</button></span>`
    ).join('');
  },

  allHashtags() { return [...Generate.selectedTags, ...Generate.tmpTags].join(' '); },

  updateHashtagPreview() {
    document.getElementById('h-prev').textContent = Generate.allHashtags() || 'لم تختر بعد';
  },

  /* ══ نوع التغريدة ══════════════════════════════ */

  pickType(el, type) {
    document.querySelectorAll('#type-chips .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    Generate.tweetType = type;
  },

  /* ══ الصور ═════════════════════════════════════ */

  async addImg(input) {
    const f = input.files[0]; if (!f) return;
    const b64 = await UI.readFile(f);
    const compressed = await UI.compressImage(b64);
    Generate.images.push(compressed);
    UI.buildImageGrid('gen-imgs', Generate.images, 'Generate.addImg');
  },

  /* ══ جلب بيانات الموقع (CORS Proxy) ══════════ */

  async fetchValidImages(url) {
    const imgs = [];

    // ══ iHerb ══════════════════════════════════════
    if (/iherb\.com/i.test(url)) {
      const dec = decodeURIComponent(url);
      // رقم المنتج في نهاية الرابط: /pr/product-name/64903
      const numM = dec.match(/\/(\d{4,7})(?:\/|\?|#|$)/);
      if (numM) {
        const id = numM[1];
        imgs.push('https://cloudinary.iherb.com/img/' + id + '/fd/76.jpg');
        imgs.push('https://cloudinary.iherb.com/img/' + id + '/fd/75.jpg');
        imgs.push('https://cloudinary.iherb.com/img/' + id + '/fd/74.jpg');
      }
      return imgs;
    }

    // ══ Amazon ══════════════════════════════════════
    if (/amazon\.|amzn\./i.test(url)) {
      const dec = decodeURIComponent(url);
      const asinM = dec.match(/\/dp\/([A-Z0-9]{10})/i)
                 || dec.match(/\/gp\/product\/([A-Z0-9]{10})/i)
                 || dec.match(/([A-Z0-9]{10})(?:\/|\?|$)/);
      if (asinM) {
        const asin = asinM[1].toUpperCase();
        imgs.push('https://m.media-amazon.com/images/P/' + asin + '.01.L.jpg');
        imgs.push('https://m.media-amazon.com/images/P/' + asin + '.02.L.jpg');
        imgs.push('https://m.media-amazon.com/images/P/' + asin + '.03.L.jpg');
      }
      return imgs;
    }

    // ══ مواقع أخرى — CORS Proxy ══════════════════
    try {
      const px = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(px, { signal: ctrl.signal });
      if (r.ok) {
        const html = await r.text();
        const ogM = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{10,})["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+property=["']og:image["']/i);
        if (ogM?.[1]) imgs.push(ogM[1]);
      }
    } catch(e) {}
    return imgs;
  },

  /* ══ استدعاء AI ════════════════════════════════ */

  async callAI(prompt, maxTokens = 1500) {
    const key = Storage.getAnthropic();
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: Config.aiModel,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error?.message || 'API ' + r.status);
    }
    const d = await r.json();
    return d.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
  },

  /* ══ التوليد الرئيسي ════════════════════════════ */

  async run() {
    const name  = document.getElementById('g-name').value.trim();
    const link  = document.getElementById('g-link').value.trim();
    const plat  = document.getElementById('g-plat').value;
    const notes = document.getElementById('g-notes').value.trim();

    if (!name) { alert('يرجى إدخال اسم المنتج'); return; }

    const htags  = Generate.allHashtags();
    const isThread = Generate.tweetType === 'خيط Thread';
    const typeDesc = Config.tweetTypes[Generate.tweetType] || '';

    document.getElementById('thinking').classList.add('show');
    document.getElementById('gen-result').style.display = 'none';

    const linkRule = isThread
      ? `الرابط في التغريدة الأخيرة (5/5) فقط: 🔗 ${link || '[الرابط]'} — لا في أي تغريدة أخرى`
      : `أضف الرابط في النهاية: 🔗 ${link || '[الرابط]'}`;

    const prompt = `أنت مسوق محترف لـ ${plat} للجمهور الخليجي على تويتر.
المنتج: ${name} | المنصة: ${plat}
${notes ? 'ملاحظات: ' + notes : ''}

المطلوب: ${typeDesc}

قواعد صارمة:
1. عربية فصيحة مع لمسة خليجية طبيعية
2. ابدأ بجملة مثيرة أو سؤال يشد الانتباه
3. الطول: ${isThread ? 'كل تغريدة 150-230 حرف' : '180-230 حرف'}
4. ${linkRule}
5. لا تضيف هاشتاقات إطلاقاً
6. استخدم 2-4 إيموجي فقط
7. اكتب التغريدة مباشرة بدون مقدمة أو شرح
${isThread ? '8. افصل التغريدات بـ ---' : ''}`;

    try {
      const raw = await Generate.callAI(prompt);
      if (isThread) {
        let parts = raw.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
        while (parts.length < 5) parts.push('...');
        parts = parts.slice(0, 5);
        parts[parts.length - 1] += (htags ? '\n\n' + htags : '');
        Generate.currentTweets = parts;
        Generate.currentTweet  = parts.join('\n\n---\n\n');
      } else {
        Generate.currentTweet  = raw + (htags ? '\n\n' + htags : '');
        Generate.currentTweets = [Generate.currentTweet];
      }
    } catch(e) {
      const msg = e.message?.includes('401') ? '⚠️ مفتاح API غير صحيح — اضغط ⚙️' : '⚠️ خطأ: ' + (e.message || '');
      Generate.currentTweet  = msg;
      Generate.currentTweets = [msg];
    }

    // عرض المعاينة
    UI.renderTweetPreview(Generate.currentTweets, Generate.images);
    document.getElementById('copy-ta').value = Generate.currentTweet;

    const len = Generate.currentTweet.length;
    const cc  = document.getElementById('char-c');
    cc.textContent = (Generate.currentTweets.length > 1 ? 'إجمالي: ' : '') + len + ' حرف';
    cc.style.color = len <= 280 ? 'var(--green)' : len <= 600 ? 'var(--amber)' : 'var(--red)';

    // قسم تحميل الصور
    if (Generate.images.length) {
      document.getElementById('img-dl-sec').style.display = 'block';
      document.getElementById('img-dl').innerHTML = Generate.images.map((img, i) => {
        const label = Generate.currentTweets.length > 1 ? `تغريدة ${i+1}` : `صورة ${i+1}`;
        return `<div class="img-dl-item">
          <img src="${img}" onerror="this.style.display='none'" alt=""/>
          <span class="twn">${label}</span>
          <button class="dlb" onclick="UI.downloadImg('${img}','img${i+1}.jpg')">⬇️</button>
        </div>`;
      }).join('');
    } else {
      document.getElementById('img-dl-sec').style.display = 'none';
    }

    document.getElementById('gen-result').style.display = 'block';
    document.getElementById('res-title').textContent = Generate.currentTweets.length > 1 ? '🧵 معاينة الـ Thread' : '🐦 معاينة التغريدة';
    document.getElementById('thinking').classList.remove('show');
    document.getElementById('gen-result').scrollIntoView({ behavior: 'smooth' });
  },

  copyFull() {
    const ta = document.getElementById('copy-ta');
    if (!ta?.value) return;
    UI.copyText(ta.value);
    UI.flash('a-copy');
  },

  dlAll() {
    Generate.images.forEach((img, i) => setTimeout(() => UI.downloadImg(img, 'img' + (i+1) + '.jpg'), i * 300));
  }
};
