import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

const dataFile = path.join(process.cwd(), "subscribers.json");

function loadSubscribers() {
  if (!fs.existsSync(dataFile)) return [];
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function saveSubscribers(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

async function fetchBalance(addr) {
  try {
    const res = await fetch(`https://blockstream.info/api/address/${addr}`);
    if (!res.ok) return 0;
    const data = await res.json();
    const satoshi = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    return satoshi / 1e8;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // 校验 CRON_SECRET
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY;

  if (!user || !pass) {
    return res.status(500).json({ message: "SMTP环境变量未配置完整" });
  }

  const subscribers = loadSubscribers();
  if (!subscribers.length) return res.status(200).json({ message: "No subscribers" });

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass }
  });

  for (let sub of subscribers) {
    let changes = [];
    for (let addr of sub.addresses) {
      const newBalance = await fetchBalance(addr);
      if (newBalance !== sub.balances[addr]) {
        changes.push({ addr, old: sub.balances[addr], new: newBalance });
        sub.balances[addr] = newBalance;
      }
    }

    if (changes.length > 0) {
      await transporter.sendMail({
        from: `"BTC监控" <${user}>`,
        to: sub.email,
        subject: "BTC地址余额变化提醒",
        html: `
          <h3>以下地址余额发生变化：</h3>
          <ul>
            ${changes.map(c => `<li>${c.addr}: ${c.old} → ${c.new} BTC</li>`).join("")}
          </ul>
        `
      });
    }
  }

  saveSubscribers(subscribers);

  res.status(200).json({ message: "Balance check completed" });
}
