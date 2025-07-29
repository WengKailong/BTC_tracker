// api/check-balances.js
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update } from "firebase/database";

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Brevo SMTP 配置
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_KEY,
  },
});

export default async function handler(req, res) {
  try {
    const snapshot = await get(ref(db, "subscribers"));
    const subscribers = snapshot.val() || {};

    const updates = [];

    for (let key in subscribers) {
      const sub = subscribers[key];
      const lastBalances = sub.lastBalances || {};

      for (let addr of sub.addresses) {
        // 查询BTC余额
        const resp = await fetch(`https://blockstream.info/api/address/${addr}`);
        if (!resp.ok) continue;

        const data = await resp.json();
        const satoshi =
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
        const balance = satoshi / 1e8;

        const prevBalance = lastBalances[addr] ?? null;

        // 如果首次记录或余额变化
        if (prevBalance === null || prevBalance !== balance) {
          // 发送邮件通知
          if (prevBalance !== null) {
            await transporter.sendMail({
              from: `"BTC监控" <${process.env.BREVO_USER}>`,
              to: sub.email,
              subject: "BTC 地址余额变化提醒",
              html: `
                <h3>您的BTC地址余额发生变化</h3>
                <p>地址：${addr}</p>
                <p>上次余额：${prevBalance ?? 0} BTC</p>
                <p>当前余额：${balance} BTC</p>
              `,
            });
          }

          // 更新Firebase中的lastBalances
          updates.push({ key, addr, old: prevBalance, new: balance });
          await update(ref(db, `subscribers/${key}/lastBalances`), {
            [addr]: balance,
          });
        }
      }
    }

    res.status(200).json({ message: "Balance check complete", updates });
  } catch (error) {
    console.error("Error checking balances:", error);
    res.status(500).json({ error: error.message });
  }
}
