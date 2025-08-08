import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // raw bodyを扱うため
  },
};

// HMAC署名の検証関数
function verifyHmac(hmac, rawBody, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  return digest === hmac;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 生のリクエストボディを取得（Buffer形式）
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // HMAC署名の取得
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const verified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);

  if (!verified) {
    console.error("❌ HMAC verification failed");
    return res.status(401).send('Unauthorized');
  }

  // HMAC OKならJSONデコードして注文情報取得
  const order = JSON.parse(rawBody.toString('utf8'));
  console.log("✅ Webhook received:", order);

  // ユニークURL生成（例：order.id + ランダムトークン）
  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;
  console.log(`🎫 Generated unique URL: ${uniqueUrl}`);

  // TODO:
  // - メール送信処理
  // - DB保存処理
  // - Thanksページへの反映など

  return res.status(200).send('OK');
}
