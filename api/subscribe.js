import nodemailer from "nodemailer";
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, addresses } = req.body;

  if (!email || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ message: "邮箱和至少一个BTC地址必填" });
  }

  try {
    // 将邮箱作为 key，地址数组作为 value
    await kv.set(`subscriber:${email}`, addresses);

    // 配置 Brevo SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_KEY,
      },
    });

    // 发送确认邮件
    await transporter.sendMail({
      from: `"BTC监控" <wengkailong@gmail.com>`,
      to: email,
      subject: "BTC 地址订阅确认",
      html: `
        <h3>您已成功订阅BTC地址余额变化提醒</h3>
        <p>以下BTC地址已加入监控列表：</p>
        <ul>
          ${addresses.map((addr) => `<li>${addr}</li>`).join("")}
        </ul>
      `,
    });

    return res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱" });
  } catch (err) {
    console.error("订阅处理失败:", err);
    return res.status(500).json({ message: `订阅失败: ${err.message}` });
  }
}
