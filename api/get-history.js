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
  const { secret } = req.query;
  if (!secret || secret !== process.env.MY_INDEX_SECRET) {
    return res.status(403).json({ message: "Forbidden: invalid secret" });
  }

  try {
    const snapshot = await db.ref("history").once("value");
    const raw = snapshot.val() || {};
    const result = Object.entries(raw)
      .map(([timestamp, val]) => ({
        time: timestamp,
        totalBTC: val.totalBTC,
        totalUSD: val.totalUSD,
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    res.status(200).json({ history: result });
  } catch (err) {
    console.error("获取历史记录失败", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
}
