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
  const secret = req.query.secret;
  if (secret !== process.env.MY_INDEX_SECRET) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const snapshot = await db.ref("history").once("value");
    const raw = snapshot.val() || {};

    const history = Object.entries(raw)
      .map(([key, value]) => {
        // 修复时间格式：2025-08-07T14-06-46_248Z => 2025-08-07T14:06:46.248Z
        const fixedKey = key.replace(/-/g, ":").replace("_", "."); // 只修复时间部分
        const isoString = fixedKey.replace(/T(\d+):(\d+):(\d+)\.(\d+)Z/, (match, h, m, s, ms) => {
          return `T${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms}Z`;
        });

        const time = new Date(isoString);
        return {
          time: isNaN(time) ? key : time.toISOString(),
          totalBTC: value.totalBTC,
          totalUSD: value.totalUSD,
        };
      })
      .sort((a, b) => new Date(a.time) - new Date(b.time)); // 保证按时间排序

    res.status(200).json({ history });
  } catch (err) {
    console.error("获取历史记录失败", err);
    res.status(500).json({ message: "获取历史记录失败" });
  }
}
