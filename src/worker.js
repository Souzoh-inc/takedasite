/**
 * 武田敏弘税理士事務所 サイト Worker
 *
 * 役割は2つだけ:
 *   1. public/ の静的アセットを配信する（assets バインディング）
 *   2. /api/news（microCMS の読み取り代理）と /api/contact（問い合わせ受付）を処理する
 *
 * microCMS の API キーと Lark の資格情報は Worker のシークレットに置き、
 * ブラウザには一切渡さない。
 */

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

  // fields は指定しない。存在しないフィールド名を渡すと microCMS が 400 を返すため、
  // 先方のスキーマに依存しないようにしている（返る件数は5件なので全項目でも軽い）。
  const api = `https://${domain}.microcms.io/api/v1/${endpoint}?limit=${NEWS_LIMIT}&orders=-publishedAt`;

  let upstream;
  try {
    upstream = await fetch(api, { headers: { 'X-MICROCMS-API-KEY': key } });
  } catch (e) {
    console.error('microCMS に到達できません:', e);
    return json({ items: [], error: 'upstream unreachable' }, 200);
  }
  if (!upstream.ok) {
    // 画面は「お知らせはありません」で保たせ、原因はログに残す
    console.error(`microCMS ${upstream.status}:`, (await upstream.text()).slice(0, 300));
    return json({ items: [], error: `upstream ${upstream.status}` }, 200);
  }

  const data = await upstream.json();
  const items = (data.contents || [])
    .map((c) => ({
      date: c.publishedAt || c.createdAt || '',
      title: c.title || c.name || '',
      // 相対パスや誤入力でリンクが壊れないよう、http(s) のものだけ採用する
      url: typeof c.url === 'string' && /^https?:\/\//.test(c.url) ? c.url : '',
    }))
    .filter((c) => c.title);

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
          ua: request.headers.get('user-agent') || '',
        }),
      );
      stored = true;
    } catch (e) {
      console.error('KV への保存に失敗:', e);
    }
  }

  // ② Lark Base へ送る
  let delivered = false;
  let deliverError = null;
  if (env.LARK_APP_ID && env.LARK_APP_SECRET && env.LARK_BASE_APP_TOKEN && env.LARK_BASE_TABLE_ID) {
    try {
      await sendToLark(env, record, receivedAt);
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

// Base にいまある列の名前を読む。列が消された・名前が変わったときに、
// 無い列へ書き込んで記録ごと失敗するのを防ぐため（2026-11-12 に列の削除で届かなくなった件）。
async function larkFieldNames(env, token) {
  const url = `${env.LARK_BASE_HOST}/open-apis/bitable/v1/apps/${env.LARK_BASE_APP_TOKEN}/tables/${env.LARK_BASE_TABLE_ID}/fields?page_size=100`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`fields: ${d.code} ${d.msg}`);
  return new Set((d.data.items || []).map((f) => f.field_name));
}

async function sendToLark(env, record, receivedAt) {
  const token = await larkToken(env);
  const have = await larkFieldNames(env, token);

  // 11/12 の納品MTGで「種別」と「決算書の添付」はフォームから外した
  const wanted = {
    '受付日時': new Date(receivedAt).getTime(),
    '会社名': record.company,
    'お名前': record.name,
    'メールアドレス': record.email,
    'ご相談内容': record.message,
    'ステータス': '未対応',
  };
  const fields = {};
  const missing = [];
  for (const [k, v] of Object.entries(wanted)) {
    if (have.has(k)) fields[k] = v;
    else missing.push(k);
  }
  if (missing.length) console.error('Lark Base に無い列のため書き込まなかった:', missing.join(' / '));
  if (!Object.keys(fields).length) throw new Error('書き込める列がありません');

  const url = `${env.LARK_BASE_HOST}/open-apis/bitable/v1/apps/${env.LARK_BASE_APP_TOKEN}/tables/${env.LARK_BASE_TABLE_ID}/records`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ fields }),
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error(`records: ${d.code} ${d.msg}`);
}
