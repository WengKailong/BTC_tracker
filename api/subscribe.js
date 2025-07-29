import nodemailer from 'nodemailer';

let subscribers = []; // 简单存内存，可换数据库

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, addresses } = req.body;
    if (!email) return res.status(400).json({message:'缺少邮箱'});
    
    subscribers.push({ email, addresses });
    
    // 可选：发送欢迎邮件
    const transporter = nodemailer.createTransport({
      service: 'gmail', // 或者用SendGrid SMTP
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'BTC 地址追踪已订阅',
      text: '您已成功订阅 BTC 地址余额变化提醒'
    });

    return res.json({ message: '订阅成功，余额变化将发送邮件通知' });
  } else {
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
