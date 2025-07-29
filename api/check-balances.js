import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

const DB_FILE = path.resolve('/tmp/subscribers.json');

function loadSubscribers() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveSubscribers(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function fetchBalance(address) {
  try {
    const res = await fetch(`https://blockchain.info/q/addressbalance/${address}?confirmations=1`);
    if (!res.ok) return 0;
    const satoshi = await res.text();
    return parseInt(satoshi, 10) / 1e8;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY;
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  const subs = loadSubscribers();
  let updates = [];

  for (const sub of subs) {
    let changed = [];
    for (const addr of sub.addresses) {
      const balance = await fetchBalance(addr);
      if (sub.lastBalances[addr] !== undefined && sub.lastBalances[addr] !== balance) {
        changed.push({ address: addr, old: sub.lastBalances[addr], new: balance });
      }
      sub.lastBalances[addr] = balance;
    }

    if (changed.length > 0) {
      updates.push({ email: sub.email, changes: changed });
      // 发提醒邮件
      await transporter.sendMail({
        from: `"BTC监控" <${user}>`,
        to: sub.email,
        subject: 'BTC余额变动提醒',
        html: `
          <h3>以下BTC地址余额发生变化：</h3>
          <ul>
            ${changed.map(c => `<li>${c.address}: ${c.old} → ${c.new} BTC</li>`).join('')}
          </ul>
        `,
      });
    }
  }

  saveSubscribers(subs);
  return res.status(200).json({ message: "检查完成", updates });
}
