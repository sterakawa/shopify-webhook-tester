import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

// HMAC verify
function verifyHmac(hmac, rawBody, secret) {
  const gen = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const rec = Buffer.from(hmac || '', 'base64');
  if (rec.length !== gen.length) return false;
  return crypto.timingSafeEqual(gen, rec);
}

// Admin API: 注文確認
async function fetchOrderFromAdmin(orderId) {
  const store = process.env.SHOPIFY_STORE_DOMAIN;     // 例: h0mf1i-9n.myshopify.com
  const token = process.env.SHOPIFY_ACCESS_TOKEN;     // shpat_...
  const version = '2025-04';

  const url =
    `https://${store}/admin/api/${version}/orders/${orderId}.json` +
    `?fields=id,order_number,financial_status,email,line_items,total_price`;

  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Admin API ${res.status}: ${text || res.statusText}`);
  }
  const data = await res.json();
  return data.order;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // raw body
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const rawBody = Buffer.concat(chunks);

  // HMAC
  const ok = verifyHmac(
    req.headers['x-shopify-hmac-sha256'],
    rawBody,
    process.env.SHOPIFY_API_SECRET
  );
  if (!ok) {
    console.error('❌ HMAC verification failed');
    return res.status(401).send('Unauthorized');
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const orderId = payload?.id;
  console.log('📬 webhook orders/paid received', { orderId });

  if (!orderId) return res.status(400).send('Bad Request');

  try {
    // Adminで再確認
    const order = await fetchOrderFromAdmin(orderId);
    console.log('🧾 admin order snapshot', {
      id: order.id,
      number: order.order_number,
      financial_status: order.financial_status,
      total_price: order.total_price,
      email: order.email,
    });

    if (order.financial_status !== 'paid') {
      console.warn(`🔶 not paid yet: ${order.financial_status}`);
      // ACKは200で返す（Shopifyの再送ループを防ぐ）
      return res.status(200).send('ignored (not paid)');
    }

    // ここから確定購入リスト
    for (const li of order.line_items || []) {
      const token = crypto.randomBytes(8).toString('hex');
      const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${li.id}-${token}`;
      console.log('🎟️ item', {
        title: li.title, sku: li.sku, variant_id: li.variant_id, qty: li.quantity, url: uniqueUrl
      });
      // TODO: 保存／メール送信キュー／ARサーバー通知 など
    }

    return res.status(200).send('OK');
  } catch (e) {
    console.error('❌ admin check failed', e);
    // 内部で再試行する前提で、ACKは返す
    return res.status(200).send('received (admin check failed)');
  }
}
