// api/check-balances.js
import admin from "firebase-admin";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

// 初始化 Firebase Admin
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

// 获取 BTC 地址余额
async function fetchBalance(address) {
  try {
    const res = await fetch(`https://blockstream.info/api/address/${address}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const satoshi = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    return satoshi / 1e8;
  } catch (err) {
    console.error("获取余额失败", address, err);
    return 0;
  }
}

// 发送邮件通知
async function sendNotifications(notifications) {
  if (!notifications.length) return;

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_KEY,
    },
  });

  for (const { email, changedBalances } of notifications) {
    const html = `
      <h3>以下 BTC 地址余额发生变化：</h3>
      <ul>
        ${Object.entries(changedBalances)
          .map(([addr, { old, new: now }]) => 
            `<li>${addr}: ${old} → ${now} BTC</li>`
          )
          .join("")}
      </ul>
    `;

    await transporter.sendMail({
      from: `"BTC监控" <wengkailong@gmail.com>`,
      to: email,
      subject: "BTC 地址余额变化提醒",
      html,
    });

    console.log(`已发送通知给 ${email}`);
  }
}

// 核心逻辑
async function checkBalances() {
  console.log(`[check-balances] 任务触发于 ${new Date().toISOString()}`);

  const snapshot = await db.ref("subscribers").once("value");
  const subscribers = snapshot.val() || {};

  const notifications = [];
  const emailAddressMap = {}; // email -> {addresses:Set, lastBalances: {}}

  // 合并相同邮箱的订阅记录，避免重复通知
  for (const key of Object.keys(subscribers)) {
    const sub = subscribers[key];
    const email = sub.email;
    const addresses = sub.addresses || [];
    const lastBalances = sub.lastBalances || {};

    if (!emailAddressMap[email]) {
      emailAddressMap[email] = { addresses: new Set(), lastBalances: {} };
    }

    // 合并地址
    addresses.forEach(addr => emailAddressMap[email].addresses.add(addr));

    // 合并最后余额记录
    Object.entries(lastBalances).forEach(([addr, bal]) => {
      emailAddressMap[email].lastBalances[addr] = bal;
    });
  }

  // 遍历每个邮箱检查余额
  for (const [email, { addresses, lastBalances }] of Object.entries(emailAddressMap)) {
    const changedBalances = {};
    const newBalances = { ...lastBalances };

    for (const addr of addresses) {
      const balance = await fetchBalance(addr);
      newBalances[addr] = balance;

      if (balance !== lastBalances[addr]) {
        changedBalances[addr] = { old: lastBalances[addr] || 0, new: balance };
      }
    }

    // 更新数据库中所有该邮箱的记录
    for (const key of Object.keys(subscribers)) {
      if (subscribers[key].email === email) {
        await db.ref(`subscribers/${key}/lastBalances`).set(newBalances);
      }
    }

    if (Object.keys(changedBalances).length > 0) {
      notifications.push({ email, changedBalances });
    }
  }

  // 发送邮件通知
  await sendNotifications(notifications);

  console.log(`余额检查完成，共发送 ${notifications.length} 封通知`);
}

// 默认导出函数，兼容 GET & POST
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await checkBalances();
    return res.status(200).json({ message: "余额检查完成" });
  } catch (err) {
    console.error("检查余额失败", err);
    return res.status(500).json({ message: "检查余额失败" });
  }
}
