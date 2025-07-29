import { kv } from '@vercel/kv';
import nodemailer from 'nodemailer';

const BTC_API = 'https://blockchain.info/q/addressbalance';

export default async function handler(req, res) {
  // 仅允许 Cron Job 访问
  if (req.headers['x-vercel-cron'] !== '1') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY;

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  const keys = await kv.keys('subscriber:*');
  let notified = [];

  for (let key of keys) {
    const email = key.split(':')[1];
    const data = await kv.get(key);
    if (!data) continue;

    let subscriber = typeof data === 'string' ? JSON.parse(data) : data;
    let changedAddresses = [];

    for (let addrObj of subscriber.addresses) {
      const res = await fetch(`${BTC_API}/${addrObj.address}?confirmations=1`);
      const satoshi = await res.text();
      const balance = parseInt(satoshi, 10) / 1e8;

      if (balance !== addrObj.balance) {
        changedAddresses.push({
          address: addrObj.address,
          oldBalance: addrObj.balance,
          newBalance: balance,
        });
        addrObj.balance = balance;
      }
    }

    if (changedAddresses.length > 0) {
      await transporter.sendMail({
        from: `"BTC监控" <wengkailong@gmail.com>`,
        to: email,
        subject: 'BTC 地址余额变动提醒',
        html: `
          <h3>您订阅的 BTC 地址有余额变动：</h3>
          <ul>
            ${changedAddresses
              .map(a => `<li>${a.address}: ${a.oldBalance} → ${a.newBalance} BTC</li>`)
              .join('')}
          </ul>
        `,
      });
      notified.push({ email, changedAddresses });

      await kv.set(key, JSON.stringify(subscriber));
    }
  }

  return res.status(200).json({ message: '检测完成', notified });
}
