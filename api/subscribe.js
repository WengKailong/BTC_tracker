import { kv } from '@vercel/kv';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, addresses } = req.body;

  if (!email || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ message: '邮箱和至少一个BTC地址必填' });
  }

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY;
  if (!user || !pass) {
    return res.status(500).json({ message: "SMTP环境变量未配置完整" });
  }

  // 保存到 Vercel KV
  const key = `subscriber:${email}`;
  const existing = await kv.get(key);
  let subscriber = existing ? JSON.parse(existing) : { addresses: [] };

  // 合并新地址
  addresses.forEach(addr => {
    if (!subscriber.addresses.some(a => a.address === addr)) {
      subscriber.addresses.push({ address: addr, balance: 0 });
    }
  });
  await kv.set(key, JSON.stringify(subscriber));

  // 发送确认邮件
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"BTC监控" <${user}>`,
    to: email,
    subject: 'BTC 地址订阅确认',
    html: `
      <h3>您已成功订阅BTC地址余额变化提醒</h3>
      <p>以下BTC地址已加入监控列表：</p>
      <ul>${addresses.map(a => `<li>${a}</li>`).join('')}</ul>
    `,
  });

  return res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱" });
}
