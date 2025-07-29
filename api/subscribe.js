import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { email, addresses } = req.body;
  if (!email || !addresses || !addresses.length) {
    return res.status(400).json({ message: "邮箱和BTC地址必填" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_KEY
      }
    });

    const info = await transporter.sendMail({
      from: `"BTC 余额提醒" <${process.env.BREVO_USER}>`,
      to: email,
      subject: "BTC 余额订阅确认",
      text: `您已成功订阅以下BTC地址的余额提醒：\n${addresses.join("\n")}`
    });

    console.log("邮件发送成功", info.messageId);
    res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱" });
  } catch (err) {
    console.error("发送邮件失败:", err);
    res.status(500).json({ message: "邮件发送失败，请检查服务器配置" });
  }
}
