// scripts/check-balances.js
import admin from "firebase-admin";
import nodemailer from "nodemailer";
import fetch from "node-fetch"; // 如果是 Node 18+ 可直接用 fetch

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const db = admin.database();

// 获取 BTC 地址余额（示例用 blockstream API，可换成其他）
async function getBalance(address) {
  const url = `https://blockstream.info/api/address/${address}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`获取余额失败: ${address}`);
  const data = await res.json();
  return data.chain_stats.funded_txo_sum / 1e8 - data.chain_stats.spent_txo_sum / 1e8;
}

// 邮件发送
async function sendMail(email, changes) {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_KEY,
    },
  });

  const htmlChanges = changes.map(
    c => `<li>${c.address}：${c.oldBalance} → ${c.newBalance} BTC</li>`
  ).join('');

  const mailOptions = {
    from: `"BTC监控" <wengkailong@gmail.com>`,
    to: email,
    subject: 'BTC 地址余额变化提醒',
    html: `
      <h3>以下 BTC 地址余额发生变化：</h3>
      <ul>${htmlChanges}</ul>
      <p>这是系统自动提醒，请勿回复。</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function checkBalances() {
  const snapshot = await db.ref("subscribers").once("value");
  const subscribers = snapshot.val() || {};

  const updates = {};
  const changesByEmail = {};

  for (const [key, subscriber] of Object.entries(subscribers)) {
    const { email, addresses = [], lastBalances = {} } = subscriber;

    for (const addr of addresses) {
      try {
        const newBalance = await getBalance(addr);
        const oldBalance = lastBalances[addr] ?? newBalance;

        // 发现余额变化
        if (newBalance !== oldBalance) {
          if (!changesByEmail[email]) changesByEmail[email] = [];
          changesByEmail[email].push({
            address: addr,
            oldBalance,
            newBalance,
          });
        }

        // 记录新余额
        updates[`${key}/lastBalances/${addr}`] = newBalance;
      } catch (err) {
        console.error(`获取地址余额失败 ${addr}`, err.message);
      }
    }
  }

  // 更新 Firebase 中的余额
  if (Object.keys(updates).length > 0) {
    await db.ref("subscribers").update(updates);
  }

  // 给每个邮箱发送汇总邮件
  for (const [email, changes] of Object.entries(changesByEmail)) {
    await sendMail(email, changes);
    console.log(`已发送余额变化提醒给 ${email}`);
  }

  console.log("余额检查完成");
}

// 如果是直接运行 node scripts/check-balances.js
if (process.argv[1].includes("check-balances.js")) {
  checkBalances().then(() => process.exit(0));
}
