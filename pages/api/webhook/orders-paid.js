import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifyHmac(hmac, rawBody, secret) {
  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest();
  const receivedHash = Buffer.from(hmac, 'base64');
  if (receivedHash.length !== generatedHash.length) return false;
  return crypto.timingSafeEqual(generatedHash, receivedHash);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  const isVerified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);
  if (!isVerified) {
    console.error('❌ HMAC verification failed');
    return res.status(401).send('Unauthorized');
  }

  const order = JSON.parse(rawBody.toString('utf8'));

  console.log('🛒 注文作成Webhook受信');
  console.log(`🆔 注文ID: ${order.id}`);
  console.log(`📧 メール: ${order.email}`);
  console.log(`📦 商品リスト:`);
  if (Array.isArray(order.line_items)) {
    order.line_items.forEach((item) => {
      console.log(`- ${item.title}（SKU: ${item.sku}）`);
    });
  }

  return res.status(200).send('OK');
}
