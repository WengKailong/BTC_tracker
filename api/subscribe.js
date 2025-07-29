const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { email, address } = req.body;

    if (!email || !address) {
      return res.status(400).json({ message: "邮箱和BTC地址必填" });
    }

    // 使用 Brevo SMTP 配置
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com", // Brevo SMTP 地址
      port: 587,                    // 587 TLS端口
      secure: false,                 // 465时用true
      auth: {
        user: process.env.SMTP_USER, // Brevo 登录邮箱
        pass: process.env.SMTP_PASS  // Brevo SMTP 密钥
      }
    });

    // 发送确认邮件
    const info = await transporter.sendMail({
      from: `"BTC Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "订阅成功 - BTC地址追踪",
      text: `您已成功订阅 BTC 地址：${address}\n\n当余额发生变化时，我们会通过邮件提醒您。`
    });

    console.log("邮件已发送：", info.messageId);
    return res.status(200).json({ message: "订阅成功，确认邮件已发送！" });
  } catch (error) {
    console.error("发送邮件失败：", error);
    return res.status(500).json({ message: "服务器错误，发送邮件失败" });
  }
};
