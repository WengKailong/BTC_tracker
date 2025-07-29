import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { email, addresses } = req.body;

  if (!email || !addresses || addresses.length === 0) {
    return res.status(400).json({ message: "邮箱和BTC地址必填" });
  }

  // 打印环境变量（调试用）
  console.log("DEBUG BREVO_USER:", process.env.BREVO_USER ? "存在" : "不存在");
  console.log("DEBUG BREVO_KEY:", process.env.BREVO_KEY ? "存在" : "不存在");

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_KEY
    }
  });

  const mailOptions = {
    from: `"BTC监控" <wengkailong@gmail.com>`,
    to: email,
    subject: "BTC 地址订阅确认",
    text: `您已成功订阅以下BTC地址余额提醒：\n\n${addresses.join("\n")}\n\n我们将在余额变化时发送提醒邮件。`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱。" });
  } catch (error) {
    console.error("发送邮件失败:", error);
    res.status(500).json({ message: "邮件发送失败，请检查服务器配置。", error: error.message });
  }
}
