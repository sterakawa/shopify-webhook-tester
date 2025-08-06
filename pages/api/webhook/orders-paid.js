import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

function verifyHmac(hmac, rawBody, secret) {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');
  return digest === hmac;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const rawBody = await new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const verified = verifyHmac(hmacHeader, rawBody, process.env.SHOPIFY_API_SECRET);

  if (!verified) {
    return res.status(401).send('Unauthorized');
  }

  const order = JSON.parse(rawBody);
  const email = order.email;
  const orderId = order.id;

  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${orderId}-${token}`;

  console.log(`Send URL to ${email}: ${uniqueUrl}`);

  return res.status(200).send('OK');
}
