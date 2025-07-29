import nodemailer from "nodemailer";
import { kv } from "@vercel/kv";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // 获取所有订阅者
    const keys = await kv.keys("subscriber:*");
    let notifications = [];

    for (const key of keys) {
      const email = key.split(":")[1];
      const addresses = await kv.get(key);

      for (const addr of addresses) {
        const balance = await fetchBalance(addr);

        // 获取上次余额
        const prevBalance = (await kv.get(`balance:${addr}`)) || 0;

        // 检查余额变化
        if (balance !== prevBalance) {
          notifications.push({ email, addr, balance });
          await kv.set(`balance:${addr}`, balance);
        }
      }
    }

    // 邮件提醒
    if (notifications.length > 0) {
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.BREVO_USER,
          pass: process.env.BREVO_KEY,
        },
      });

      for (const note of notifications) {
        await transporter.sendMail({
          from: `"BTC监控" <wengkailong@gmail.com>`,
          to: note.email,
          subject: `BTC地址余额变化提醒`,
          html: `<p>地址 ${note.addr} 的最新余额为 ${note.balance} BTC</p>`,
        });
      }
    }

    res.status(200).json({ message: "检查完成", notifications });
  } catch (err) {
    console.error("余额检查失败:", err);
    res.status(500).json({ message: `检查失败: ${err.message}` });
  }
}

async function fetchBalance(address) {
  try {
    const res = await fetch(`https://blockstream.info/api/address/${address}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const satoshi = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    return satoshi / 1e8;
  } catch {
    return 0;
  }
}
