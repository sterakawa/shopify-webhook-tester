import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // HMAC検証のためraw bodyを扱う
  },
};

// HMAC検証関数
function verifyHmac(hmac, rawBody, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody) // Bufferそのまま
    .digest('base64');
  return digest === hmac;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Bufferでraw body取得
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // HMACヘッダー取得（大文字小文字対応）
  const hmacHeader =
    req.headers['x-shopify-hmac-sha256'] || req.headers['X-Shopify-Hmac-Sha256'];

  // HMAC計算して比較
  const digest = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest('base64');

  // デバッグログ出力
  console.log('--- HMAC Debug ---');
  console.log('Received HMAC:', hmacHeader);
  console.log('Generated HMAC:', digest);
  console.log('Secret key (env):', process.env.SHOPIFY_API_SECRET);

  const verified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);

  if (!verified) {
    console.error('HMAC verification failed');
    return res.status(401).send('Unauthorized');
  }

  // Webhookペイロード処理
  const order = JSON.parse(rawBody.toString('utf8'));
  console.log('Webhook received:', order);

  // TODO: ユニークURL生成・メール送信・DB保存処理をここに追加
  // 例：
  // const token = crypto.randomBytes(8).toString('hex');
  // const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;
  // console.log(`Generated URL: ${uniqueUrl}`);

  return res.status(200).send('OK');
}
