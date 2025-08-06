import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // raw bodyを扱うため
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Bufferでraw bodyを取得
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  // ---- HMAC検証スキップ（テスト用） ----
  console.warn("HMAC verification skipped (test mode)");

  // Webhookペイロード処理
  const order = JSON.parse(rawBody.toString('utf8'));
  console.log("Webhook received:", order);

  // ユニークURL生成（サンプル）
  const token = crypto.randomBytes(8).toString('hex');
  const uniqueUrl = `https://your-domain.com/ticket/${order.id}-${token}`;
  console.log(`Generated unique URL: ${uniqueUrl}`);

  // TODO:
  // - メール送信処理
  // - DB保存処理
  // - Thanksページへの反映 など

  return res.status(200).send('OK');
}
