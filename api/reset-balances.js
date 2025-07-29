// api/reset-balances.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get, update } from "firebase/database";

export default async function handler(req, res) {
  // 只允许 GET
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed, use GET" });
  }

  // 简单密码保护（在 Vercel 环境变量里设置 RESET_SECRET）
  const { secret } = req.query;
  if (!secret || secret !== process.env.RESET_SECRET) {
    return res.status(403).json({ message: "Forbidden: invalid secret" });
  }

  // 初始化 Firebase（避免重复初始化）
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
  const snapshot = await get(ref(db, "subscribers"));
  const subscribers = snapshot.val() || {};

  const updates = [];

  for (const [key, sub] of Object.entries(subscribers)) {
    if (!sub.addresses || sub.addresses.length === 0) continue;

    const newBalances = {};
    sub.addresses.forEach(addr => {
      newBalances[addr] = 0;
    });

    await update(ref(db, `subscribers/${key}/lastBalances`), newBalances);
    updates.push({ key, lastBalances: newBalances });
  }

  res.status(200).json({ message: "All lastBalances reset to 0", updates });
}
