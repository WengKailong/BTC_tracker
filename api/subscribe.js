// api/subscribe.js
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, get, update } from 'firebase/database';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, addresses } = req.body;

  if (!email || !addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ message: '邮箱和至少一个BTC地址必填' });
  }

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DB_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
  };

  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }

  const db = getDatabase();
  const refPath = ref(db, 'subscribers');

  // 查询现有订阅
  const snapshot = await get(refPath);
  const existingData = snapshot.val() || {};
  
  let existingKey = null;
  let existingAddresses = [];

  // 查找是否已有此邮箱的订阅
  Object.entries(existingData).forEach(([key, value]) => {
    if (value.email === email) {
      existingKey = key;
      existingAddresses = value.addresses || [];
    }
  });

  // 合并去重
  const newAddresses = [...new Set([...existingAddresses, ...addresses])];
  const hasNew = newAddresses.length > existingAddresses.length;

  if (existingKey) {
    await update(ref(db, `subscribers/${existingKey}`), {
      addresses: newAddresses,
      subscribedAt: new Date().toISOString(),
    });
  } else {
    await push(refPath, {
      email,
      addresses: newAddresses,
      subscribedAt: new Date().toISOString(),
    });
  }

  // 邮件通知用户（仅首次订阅或新增地址时发送）
  if (hasNew || !existingKey) {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_KEY,
      },
    });

    const mailOptions = {
      from: `"BTC监控" <wengkailong@gmail.com>`,
      to: email,
      subject: 'BTC 地址订阅确认',
      html: `
        <h3>您已成功订阅BTC地址余额变化提醒</h3>
        <p>当前监控的BTC地址列表：</p>
        <ul>
          ${newAddresses.map(addr => `<li>${addr}</li>`).join('')}
        </ul>
        <p>我们将在余额变化时向您发送邮件通知。</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  res.status(200).json({ message: '订阅成功并已保存到 Firebase' });
}
