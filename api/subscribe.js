import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, addresses } = req.body;

  if (!email || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ message: '邮箱和至少一个BTC地址必填' });
  }

  // 读取 Vercel 环境变量
  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_KEY; // 在 Vercel -> Settings -> Environment Variables 设置

  console.log("DEBUG BREVO_USER:", user ? "存在" : "不存在");
  console.log("DEBUG BREVO_KEY:", pass ? "存在" : "不存在");

  if (!user || !pass) {
    return res.status(500).json({ message: "SMTP环境变量未配置完整" });
  }

  // 配置 Nodemailer SMTP (Brevo)
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: user,
      pass: pass,
    },
  });

  // 订阅确认邮件内容
  const mailOptions = {
    from: `"BTC监控" <wengkailong@gmail.com>`, // 发件人必须是 Brevo 验证过的邮箱
    to: email,
    subject: 'BTC 地址订阅确认',
    html: `
      <h3>您已成功订阅BTC地址余额变化提醒</h3>
      <p>以下BTC地址已加入监控列表：</p>
      <ul>
        ${addresses.map(addr => `<li>${addr}</li>`).join('')}
      </ul>
      <p>我们将在余额变化时向您发送邮件通知。</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "订阅成功，确认邮件已发送至您的邮箱" });
  } catch (error) {
    console.error("发送邮件失败:", error);
    return res.status(500).json({ message: `发送邮件失败: ${error.message}` });
  }
}
