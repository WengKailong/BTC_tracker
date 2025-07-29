// api/reset-balances.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get, update } from "firebase/database";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed, use POST" });
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
