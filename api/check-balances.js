import fetch from "node-fetch";
import nodemailer from "nodemailer";
import admin from "firebase-admin";

// 使用环境变量初始化 Firebase Admin，不依赖 firebase-key.json
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const db = admin.database();

// 配置 Brevo 邮件
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_KEY,
  },
});

// 获取 BTC 地址余额
async function getBalance(addr) {
  const res = await fetch(`https://blockstream.info/api/address/${addr}`);
  if (!res.ok) return 0;
  const data = await res.json();
  const satoshi = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
  return satoshi / 1e8;
}

// 发送邮件
async function sendEmail(email, addr, oldBal, newBal) {
  const mailOptions = {
    from: `"BTC监控" <wengkailong@gmail.com>`,
    to: email,
    subject: "BTC地址余额变化提醒",
    html: `
      <h3>您的BTC地址余额发生变化</h3>
      <p>地址: ${addr}</p>
      <p>原余额: ${oldBal} BTC</p>
      <p>新余额: ${newBal} BTC</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export default async function handler(req, res) {
  const snapshot = await db.ref("subscribers").once("value");
  const subscribers = snapshot.val() || {};

  const updates = [];

  for (const [key, sub] of Object.entries(subscribers)) {
    const addresses = sub.addresses || [];
    const lastBalances = sub.lastBalances || {};

    for (const addr of addresses) {
      const oldBal = lastBalances[addr] ?? null;
      const newBal = await getBalance(addr);

      if (oldBal === null) {
        // 初始化，不发邮件
        await db.ref(`subscribers/${key}/lastBalances/${addr}`).set(newBal);
        continue;
      }

      if (oldBal !== newBal) {
        // 余额变化 -> 更新数据库 & 发邮件
        await db.ref(`subscribers/${key}/lastBalances/${addr}`).set(newBal);
        await sendEmail(sub.email, addr, oldBal, newBal);

        updates.push({ key, addr, old: oldBal, new: newBal });
      }
    }
  }

  res.json({ message: "Balance check complete", updates });
}
