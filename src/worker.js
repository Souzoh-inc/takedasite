/**
 * UNITE税理士法人 サイト Worker
 *
 * 役割は2つだけ:
 *   1. public/ の静的アセットを配信する（assets バインディング）
 *   2. /api/news（microCMS の読み取り代理）と /api/contact（問い合わせ受付）を処理する
 *
 * microCMS の API キーと Lark の資格情報は Worker のシークレットに置き、
 * ブラウザには一切渡さない。
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const NEWS_LIMIT = 5;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    let res;
    if (url.pathname === '/api/news') {
      res = await handleNews(request, env, ctx);
    } else if (url.pathname === '/api/contact') {
      res = await handleContact(request, env);
    } else {
      res = await env.ASSETS.fetch(request);
    }

    // 一般公開しない運用のため、全レスポンスに noindex を付ける（要件定義書 §1）
    res = new Response(res.body, res);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return res;
  },
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

/* ══════════════════════════════════════════════
   お知らせ（microCMS）
   ══════════════════════════════════════════════ */
async function handleNews(request, env, ctx) {
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const domain = env.MICROCMS_SERVICE_DOMAIN;
  const key = env.MICROCMS_API_KEY;
  const endpoint = env.MICROCMS_ENDPOINT || 'news';

  // まだ microCMS を開設していない段階では空で返す（画面は「お知らせはありません」を表示する）
  if (!domain || !key) return json({ items: [], configured: false });

  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const api = `https://${domain}.microcms.io/api/v1/${endpoint}?limit=${NEWS_LIMIT}&orders=-publishedAt&fields=id,title,publishedAt,createdAt,url`;

  let upstream;
  try {
    upstream = await fetch(api, { headers: { 'X-MICROCMS-API-KEY': key } });
  } catch (e) {
    return json({ items: [], error: 'upstream unreachable' }, 200);
  }
  if (!upstream.ok) return json({ items: [], error: `upstream ${upstream.status}` }, 200);

  const data = await upstream.json();
  const items = (data.contents || []).map((c) => ({
    date: c.publishedAt || c.createdAt || '',
    title: c.title || '',
    url: c.url || '',
  }));

  const res = json({ items, configured: true }, 200, { 'cache-control': 'public, max-age=300' });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

/* ══════════════════════════════════════════════
   お問い合わせ
   受け取った内容は必ず KV に控えを残したうえで Lark Base に送る。
   Lark 側が未設定・失敗でも、控えが残っていれば取りこぼしにはならない。
   ══════════════════════════════════════════════ */
async function handleContact(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  // 別サイトからの投稿を弾く
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: 'bad origin' }, 403);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'bad request' }, 400);
  }

  const str = (k) => String(form.get(k) ?? '').trim();
  const record = {
    kind: str('kind') || 'お問い合わせ',
    company: str('company'),
    name: str('name'),
    email: str('email'),
    message: str('message'),
  };

  // ハニーポット（画面には出していない入力欄が埋まっていたら機械投稿とみなす）
  if (str('website')) return json({ ok: true });

  if (!record.company || !record.name || !record.message) {
    return json({ ok: false, error: '必須項目が入力されていません。' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    return json({ ok: false, error: 'メールアドレスの形式をご確認ください。' }, 400);
  }
  if (record.message.length > 5000) {
    return json({ ok: false, error: 'ご相談内容が長すぎます。' }, 400);
  }

  const file = form.get('file');
  const hasFile = file && typeof file === 'object' && 'size' in file && file.size > 0;
  if (hasFile && file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, error: 'ファイルサイズは10MBまでです。' }, 400);
  }

  const receivedAt = new Date().toISOString();
  const id = `${receivedAt}-${crypto.randomUUID().slice(0, 8)}`;

  // ① まず控えを残す
  let stored = false;
  if (env.INQUIRIES) {
    try {
      await env.INQUIRIES.put(
        `inq:${id}`,
        JSON.stringify({
          ...record,
          receivedAt,
          fileName: hasFile ? file.name : null,
          fileSize: hasFile ? file.size : 0,
          ua: request.headers.get('user-agent') || '',
        }),
      );
      stored = true;
      if (hasFile) {
        await env.INQUIRIES.put(`file:${id}`, await file.arrayBuffer(), {
          metadata: { name: file.name, type: file.type },
        });
      }
    } catch (e) {
      console.error('KV への保存に失敗:', e);
    }
  }

  // ② Lark Base へ送る
  let delivered = false;
  let deliverError = null;
  if (env.LARK_APP_ID && env.LARK_APP_SECRET && env.LARK_BASE_APP_TOKEN && env.LARK_BASE_TABLE_ID) {
    try {
      await sendToLark(env, record, receivedAt, hasFile ? file : null);
      delivered = true;
    } catch (e) {
      deliverError = String(e && e.message ? e.message : e);
      console.error('Lark Base への送信に失敗:', deliverError);
    }
  }

  // 控えも取れず Lark にも渡せていない場合だけ、利用者にエラーを返す
  if (!stored && !delivered) {
    return json({ ok: false, error: '送信を受け付けられませんでした。' }, 503);
  }
  return json({ ok: true, stored, delivered });
}

/* ───── Lark ───── */
async function larkToken(env) {
  const r = await fetch(`${env.LARK_BASE_HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`token: ${d.code} ${d.msg}`);
  return d.tenant_access_token;
}

async function larkUpload(env, token, file) {
  const fd = new FormData();
  fd.set('file_name', file.name);
  fd.set('parent_type', 'bitable_file');
  fd.set('parent_node', env.LARK_BASE_APP_TOKEN);
  fd.set('size', String(file.size));
  fd.set('file', file, file.name);

  const r = await fetch(`${env.LARK_BASE_HOST}/open-apis/drive/v1/medias/upload_all`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: fd,
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`upload: ${d.code} ${d.msg}`);
  return d.data.file_token;
}

async function sendToLark(env, record, receivedAt, file) {
  const token = await larkToken(env);

  const fields = {
    '受付日時': new Date(receivedAt).getTime(),
    '種別': record.kind,
    '会社名': record.company,
    'お名前': record.name,
    'メールアドレス': record.email,
    'ご相談内容': record.message,
    'ステータス': '未対応',
  };

  if (file) {
    const fileToken = await larkUpload(env, token, file);
    fields['添付ファイル'] = [{ file_token: fileToken }];
  }

  const url = `${env.LARK_BASE_HOST}/open-apis/bitable/v1/apps/${env.LARK_BASE_APP_TOKEN}/tables/${env.LARK_BASE_TABLE_ID}/records`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ fields }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`records: ${d.code} ${d.msg}`);
}
