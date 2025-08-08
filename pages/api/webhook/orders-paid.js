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

  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;
  console.log(`✅ Webhook received. Unique URL: ${uniqueUrl}`);

  return res.status(200).send('OK');
}
