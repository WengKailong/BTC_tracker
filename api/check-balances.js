// api/check-balances.js
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

export default async function handler(req, res) {
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
  const snapshot = await get(ref(db, 'subscribers'));

  if (!snapshot.exists()) {
    return res.status(200).json({ message: 'No subscribers' });
  }

  const subscribers = snapshot.val();

  // TODO: 遍历 subscribers 检查余额变化并邮件通知
  // 这里可以沿用你之前的余额检测逻辑
  return res.status(200).json({ message: 'Checked balances', count: Object.keys(subscribers).length });
}
