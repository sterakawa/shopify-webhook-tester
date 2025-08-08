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

  // 長さが違う場合は false（重要）
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

  // 🔍 注文情報のログ出力
  console.log('🧾 注文を受信しました:');
  console.log('🆔 注文ID:', order.id);
  console.log('📧 購入者メール:', order.email);
  console.log('🛒 商品リスト:');
  order.line_items.forEach((item, idx) => {
    console.log(`  商品${idx + 1}: ${item.title}`);
    console.log(`    SKU: ${item.sku}`);
    console.log(`    数量: ${item.quantity}`);
    console.log(`    商品ID: ${item.product_id}`);
    console.log(`    バリアントID: ${item.variant_id}`);
  });

  // ✅ ユニークURL生成をする
  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;
  console.log(`🔗 ユニークURL: ${uniqueUrl}`);

  return res.status(200).send('OK');
}
