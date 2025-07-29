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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const { email, addresses } = req.body;

  if (!email || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ message: '邮箱和至少一个BTC地址必填' });
  }

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY;
  if (!user || !pass) return res.status(500).json({ message: "SMTP环境变量未配置完整" });

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  // 1. 发送确认邮件
  const mailOptions = {
    from: `"BTC监控" <wengkailong@gmail.com>`, // 必须是 Brevo 验证过的邮箱
    to: email,
    subject: 'BTC 地址订阅确认',
    html: `
      <h3>您已成功订阅BTC地址余额变化提醒</h3>
      <p>以下BTC地址已加入监控列表：</p>
      <ul>${addresses.map(addr => `<li>${addr}</li>`).join('')}</ul>
      <p>我们将在余额变化时向您发送邮件通知。</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("发送邮件失败:", err);
    return res.status(500).json({ message: `发送邮件失败: ${err.message}` });
  }

  // 2. 存储订阅信息
  const subs = loadSubscribers();
  subs.push({ email, addresses, lastBalances: {} });
  saveSubscribers(subs);

  return res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱" });
}
