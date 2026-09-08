/**
 * Lark Base の「問い合わせ管理」テーブルを、サイト側が送る内容にそろえる。
 *
 * 武田様が作成された Base は空の状態で渡ってくるため、`src/worker.js` の
 * sendToLark() が書き込むフィールドをこのスクリプトで用意する。
 * 既にある列はそのまま使い、足りない列だけ追加する（何度流しても安全）。
 *
 *   LARK_APP_ID=cli_xxx LARK_APP_SECRET=xxx \
 *     node scripts/setup-lark-base.mjs "<BaseのURL>"
 *
 * BaseのURL は Lark でベースを開いたときのアドレスをそのまま貼ればよい。
 *   https://xxx.larksuite.com/base/<app_token>?table=<table_id>&view=...
 * app_token だけ分かっている場合は、それを直接渡してもよい。
 */

const HOST = process.env.LARK_BASE_HOST || 'https://open.larksuite.com';
const APP_ID = process.env.LARK_APP_ID;
const APP_SECRET = process.env.LARK_APP_SECRET;

/* サイトが送る内容。src/worker.js の sendToLark() と対応させる。
   ここを変えたら worker 側も必ず直すこと。 */
const FIELDS = [
  { field_name: '受付日時', type: 5, property: { date_formatter: 'yyyy/MM/dd HH:mm', auto_fill: false } },
  { field_name: '種別', type: 3, property: { options: [{ name: '決算書の無料診断' }, { name: 'お問い合わせ' }] } },
  { field_name: '会社名', type: 1 },
  { field_name: 'お名前', type: 1 },
  { field_name: 'メールアドレス', type: 1 },
  { field_name: 'ご相談内容', type: 1 },
  { field_name: 'ステータス', type: 3, property: { options: [{ name: '未対応' }, { name: '対応中' }, { name: '対応済み' }, { name: '対応不要' }] } },
  { field_name: '添付ファイル', type: 17 },
];

const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

function parseTarget(arg) {
  if (!arg) die('Base の URL（または app_token）を引数で渡してください。');
  // URL でなければ app_token そのものとみなす
  if (!arg.includes('/')) return { appToken: arg, tableId: null };
  const m = arg.match(/\/(?:base|wiki)\/([A-Za-z0-9]+)/);
  if (!m) die(`URL から app_token を読み取れませんでした: ${arg}`);
  const tableId = new URL(arg).searchParams.get('table');
  return { appToken: m[1], tableId };
}

async function api(path, token, init = {}) {
  const res = await fetch(`${HOST}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`${path} → code ${data.code}: ${data.msg}`);
  return data.data;
}

async function main() {
  if (!APP_ID || !APP_SECRET) die('LARK_APP_ID と LARK_APP_SECRET を環境変数で渡してください。');
  const { appToken, tableId: tableIdFromUrl } = parseTarget(process.argv[2]);

  const auth = await fetch(`${HOST}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  }).then((r) => r.json());
  if (auth.code !== 0) die(`トークンを取得できません: ${auth.code} ${auth.msg}`);
  const token = auth.tenant_access_token;
  console.log('✓ tenant_access_token を取得');

  // ── 対象テーブルを決める
  const { items: tables = [] } = await api(`/open-apis/bitable/v1/apps/${appToken}/tables?page_size=100`, token);
  if (!tables.length) die('Base にテーブルがありません。');
  console.log(`  Base 内のテーブル: ${tables.map((t) => `${t.name}(${t.table_id})`).join(', ')}`);

  const table = tableIdFromUrl
    ? tables.find((t) => t.table_id === tableIdFromUrl) || die(`URL の table=${tableIdFromUrl} が Base に見つかりません。`)
    : tables[0];
  console.log(`✓ 対象テーブル: ${table.name} (${table.table_id})`);

  // ── 足りない列だけ足す
  const { items: existing = [] } = await api(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${table.table_id}/fields?page_size=200`, token);
  const have = new Set(existing.map((f) => f.field_name));
  console.log(`  既存の列: ${existing.map((f) => f.field_name).join(' / ') || '（なし）'}`);

  for (const field of FIELDS) {
    if (have.has(field.field_name)) { console.log(`  - ${field.field_name}: 既にあるので触らない`); continue; }
    await api(`/open-apis/bitable/v1/apps/${appToken}/tables/${table.table_id}/fields`, token, {
      method: 'POST',
      body: JSON.stringify(field),
    });
    console.log(`  + ${field.field_name}: 追加した`);
  }

  console.log(`
✓ 列の準備が終わりました。次のコマンドで Worker に登録してください。

  printf '${appToken}' | npx wrangler secret put LARK_BASE_APP_TOKEN
  printf '${table.table_id}' | npx wrangler secret put LARK_BASE_TABLE_ID
`);
}

main().catch((e) => die(e.message));
