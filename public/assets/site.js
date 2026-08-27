/* UNITE税理士法人 サイト共通スクリプト
   ビルド工程を持たないため、素の JavaScript のまま読み込んでいる。 */
(function () {
  'use strict';

  /* ───── モバイルメニュー ───── */
  var hdr = document.getElementById('hdr');
  var toggle = document.getElementById('navToggle');
  if (hdr && toggle) {
    toggle.addEventListener('click', function () {
      var open = hdr.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    });
    hdr.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        hdr.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ───── スクロールで表示（animation の fill-mode は使わない） ───── */
  var targets = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ───── CTA から種別を引き継いでフォームへ ───── */
  document.querySelectorAll('a[data-kind]').forEach(function (a) {
    a.addEventListener('click', function () {
      var kind = a.getAttribute('data-kind');
      document.querySelectorAll('input[name="kind"]').forEach(function (r) {
        if (r.value === kind) r.checked = true;
      });
    });
  });

  /* ───── お知らせ（microCMS を Worker 経由で取得） ───── */
  var newsList = document.getElementById('newsList');
  if (newsList) {
    fetch('/api/news', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
      .then(function (data) { renderNews(data && data.items ? data.items : []); })
      .catch(function () { renderNews([]); });
  }

  function renderNews(items) {
    if (!items.length) {
      newsList.innerHTML = '<p class="news-empty">現在お知らせはありません。</p>';
      return;
    }
    newsList.innerHTML = '';
    items.forEach(function (item) {
      var el = document.createElement(item.url ? 'a' : 'div');
      el.className = 'news-item';
      if (item.url) { el.href = item.url; }
      var d = document.createElement('span');
      d.className = 'news-date';
      d.textContent = formatDate(item.date);
      var t = document.createElement('span');
      t.className = 'news-title';
      t.textContent = item.title || '';
      el.appendChild(d);
      el.appendChild(t);
      newsList.appendChild(el);
    });
  }

  function formatDate(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[1] + '.' + m[2] + '.' + m[3] : String(v);
  }

  /* ───── お問い合わせフォーム ───── */
  var form = document.getElementById('contactForm');
  if (!form) return;

  var MAX_BYTES = 10 * 1024 * 1024;
  var fileInput = document.getElementById('file');
  var fileName = document.getElementById('fileName');
  var msg = document.getElementById('formMsg');
  var submitBtn = document.getElementById('submitBtn');

  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    fileName.textContent = f ? f.name + '（' + Math.ceil(f.size / 1024) + ' KB）' : '選択されていません';
    setInvalid('file', !!f && f.size > MAX_BYTES);
  });

  function fieldEl(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function setInvalid(name, bad) {
    var el = fieldEl(name);
    if (el) el.classList.toggle('is-invalid', !!bad);
  }

  function validate() {
    var ok = true;
    ['company', 'name', 'message'].forEach(function (n) {
      var bad = !form.elements[n].value.trim();
      setInvalid(n, bad);
      if (bad) ok = false;
    });
    var email = form.elements.email.value.trim();
    var badEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setInvalid('email', badEmail);
    if (badEmail) ok = false;

    var f = fileInput.files && fileInput.files[0];
    if (f && f.size > MAX_BYTES) { setInvalid('file', true); ok = false; }

    if (!form.elements.consent.checked) {
      show('err', 'プライバシーポリシーへの同意にチェックをお願いします。');
      ok = false;
    }
    return ok;
  }

  function show(kind, text) {
    msg.className = 'form-msg ' + (kind === 'ok' ? 'is-ok' : 'is-err');
    msg.textContent = text;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '';

    if (!validate()) {
      var firstBad = form.querySelector('.is-invalid input, .is-invalid textarea');
      if (firstBad) firstBad.focus();
      if (!msg.textContent) show('err', 'ご入力内容をご確認ください。');
      return;
    }

    var fd = new FormData(form);
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';

    fetch('/api/contact', { method: 'POST', body: fd })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.ok) throw new Error(res.body && res.body.error || 'failed');
        form.reset();
        fileName.textContent = '選択されていません';
        show('ok', 'お問い合わせを承りました。担当者より2営業日以内にご連絡いたします。');
      })
      .catch(function () {
        show('err', '送信に失敗しました。お手数ですが時間をおいて再度お試しいただくか、お電話にてご連絡ください。');
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = '送信する';
      });
  });
})();
