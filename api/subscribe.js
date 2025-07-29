import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const dataFile = path.join(process.cwd(), "subscribers.json");

function loadSubscribers() {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function saveSubscribers(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { email, addresses } = req.body;

    if (!email || !addresses || !addresses.length) {
      return res.status(400).json({ message: "邮箱和至少一个BTC地址必填" });
    }

    const user = process.env.BREVO_USER;
    const pass = process.env.BREVO_KEY;

    if (!user || !pass) {
      return res.status(500).json({ message: "SMTP环境变量未配置完整" });
    }

    const subscribers = loadSubscribers();
    const existing = subscribers.find(s => s.email === email);
    if (existing) {
      existing.addresses = Array.from(new Set([...existing.addresses, ...addresses]));
    } else {
      subscribers.push({
        email,
        addresses,
        balances: Object.fromEntries(addresses.map(a => [a, 0]))
      });
    }
    saveSubscribers(subscribers);

    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: `"BTC监控" <wengkailong@gmail.com>`,
      to: email,
      subject: "BTC 地址订阅确认",
      html: `
        <h3>您已成功订阅BTC地址余额变化提醒</h3>
        <p>以下BTC地址已加入监控列表：</p>
        <ul>${addresses.map(a => `<li>${a}</li>`).join("")}</ul>
        <p>我们将在余额变化时向您发送邮件通知。</p>
      `
    });

    res.status(200).json({ message: "订阅成功，确认邮件已发送" });
  } catch (err) {
    console.error("Subscribe API Error:", err);
    res.status(500).json({ message: "订阅失败" });
  }
}
