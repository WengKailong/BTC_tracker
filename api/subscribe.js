const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  // 仅允许 POST 请求
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { email, address } = req.body;

    if (!email || !address) {
      return res.status(400).json({ message: "邮箱和BTC地址必填" });
    }

    // 使用环境变量配置 SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,     // SMTP服务器地址
      port: Number(process.env.SMTP_PORT || 587), // 端口（587常用）
      secure: process.env.SMTP_SECURE === "true", // 如果是465端口用true
      auth: {
        user: process.env.SMTP_USER,   // SMTP用户名（邮箱地址）
        pass: process.env.SMTP_PASS    // SMTP密码或应用专用密码
      }
    });

    // 发送确认邮件
    const info = await transporter.sendMail({
      from: `"BTC Tracker" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "订阅成功 - BTC地址追踪",
      text: `您已成功订阅 BTC 地址追踪：${address}\n\n当余额变化时，我们将邮件提醒您。`
    });

    console.log("邮件已发送：", info.messageId);

    return res.status(200).json({ message: "订阅成功，确认邮件已发送！" });
  } catch (error) {
    console.error("发送邮件失败：", error);
    return res.status(500).json({ message: "服务器错误，发送邮件失败" });
  }
};
