export default async function handler(req, res) {
  try {
    const store = process.env.SHOPIFY_STORE_DOMAIN; // 例: h0mf1i-9n.myshopify.com
    const token = process.env.SHOPIFY_ACCESS_TOKEN;
    const version = '2025-04';

    // 最新1件を取得して financial_status を見る（読み取り権限の健全性チェック）
    const url = `https://${store}/admin/api/${version}/orders.json?limit=1&fields=id,order_number,financial_status`;
    const r = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': token, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    const text = await r.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { /* noop */ }

    return res.status(r.status).json({
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      body: parsed ?? text
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
