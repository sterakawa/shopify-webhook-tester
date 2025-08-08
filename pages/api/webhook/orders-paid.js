import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifyHmac(hmac, rawBody, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  console.log('Received HMAC:', hmac);
  console.log('Generated HMAC:', digest);

  return digest === hmac;
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
  const verified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);

  if (!verified) {
    console.error("❌ HMAC verification failed");
    return res.status(401).send('Unauthorized');
  }

  const order = JSON.parse(rawBody.toString('utf8'));
  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;

  console.log("✅ HMAC verified");
  console.log(`Generated URL: ${uniqueUrl}`);

  return res.status(200).send('OK');
}
