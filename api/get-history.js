// api/get-history.js
import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}

const db = admin.database();

export default async function handler(req, res) {
  try {
    const snapshot = await db.ref("history").once("value");
    const rawData = snapshot.val() || {};

    // 结构化输出 [{ time, totalBTC, totalUSD }]
    const history = Object.entries(rawData)
      .map(([timestamp, data]) => ({
        time: timestamp,
        totalBTC: data.totalBTC || 0,
        totalUSD: data.totalUSD || 0,
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time)); // 按时间升序

    res.status(200).json({ history });
  } catch (err) {
    console.error("读取历史记录失败", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
}
