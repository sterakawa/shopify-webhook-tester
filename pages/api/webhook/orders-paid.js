import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] || req.headers['X-Shopify-Hmac-Sha256'];
  const verified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);

  if (!verified) {
    console.error("HMAC verification failed");
    return res.status(401).send('Unauthorized');
  }

  const order = JSON.parse(rawBody.toString('utf8'));
  console.log("Webhook received:", order);

  return res.status(200).send('OK');
}
