import crypto from 'crypto';

const VERSION = '2025-04';

// base64url（= URLに安全な文字列）
function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// 署名（期限なし：oid.li.n.sku でHMAC）
function sign({ oid, li, n, sku }) {
  const secret = process.env.SERVICE_SIGNING_SECRET; // FzxEUzgHAxY4vfqJsHViEUN8 をVercelに設定
  const payload = `${oid}.${li}.${n}.${sku || ''}`;
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

// SKU → AR起動URL マッピング
const AR_BASE_MAP = {
  // ログで見えたSKUと、例で挙げたSKUの両方をケア
  'ARM001': 'https://c.spixd.com/8pebgge2l0',
  'ARMoo1': 'https://c.spixd.com/8pebgge2l0',
};
// 未定義SKUのフォールバック
const AR_DEFAULT_BASE = 'https://c.spixd.com/8pebgge2l0';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const orderId = req.query.order_id;
  const autoRedirect = String(req.query.redirect) === '1';
  if (!orderId) return res.status(400).send('missing order_id');

  try {
    // Admin APIから都度取得（DB不要）
    const store = process.env.SHOPIFY_STORE_DOMAIN;   // 例: your-shop.myshopify.com
    const token = process.env.SHOPIFY_ACCESS_TOKEN;   // shpat_...
    const url = `https://${store}/admin/api/${VERSION}/orders/${orderId}.json?fields=id,financial_status,line_items`;
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      return res.status(502).send(`admin api error: ${r.status} ${txt || r.statusText}`);
    }
    const order = (await r.json()).order;
    if (!order) return res.status(404).send('order not found');

    // 念のための支払い確認
    if (order.financial_status !== 'paid') {
      return res.status(202).send('order not paid yet');
    }

    const links = [];
    for (const li of order.line_items || []) {
      const sku = (li.sku || '').trim();
      const base = AR_BASE_MAP[sku] || AR_DEFAULT_BASE;
      const qty = Math.max(1, Number(li.quantity || 1));
      for (let i = 1; i <= qty; i++) {
        const sig = sign({ oid: order.id, li: li.id, n: i, sku });
        const arUrl = `${base}?oid=${order.id}&li=${li.id}&n=${i}&sku=${encodeURIComponent(sku)}&sig=${sig}`;
        links.push({ title: li.title || sku || 'item', url: arUrl });
      }
    }

    if (links.length === 0) return res.status(404).send('no deliverables for this order');

    // 1件だけ & 自動遷移指定 → 302リダイレクト
    if (autoRedirect && links.length === 1) {
      res.writeHead(302, { Location: links[0].url });
      return res.end();
    }

    // 複数は一覧表示（簡易HTML）
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!doctype html>
<html lang="ja"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ご購入リンク</title>
<body style="font-family:system-ui;padding:20px;line-height:1.6">
  <h2>ご購入アイテム</h2>
  <ul>${links.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener">${l.title}</a></li>`).join('')}</ul>
  <p style="color:#666">このページは注文ID ${order.id} のリンク一覧です。</p>
</body></html>`);
  } catch (e) {
    console.error('receive error', e);
    return res.status(500).send('internal error');
  }
}
