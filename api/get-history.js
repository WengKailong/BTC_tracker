// api/get-history.js
import admin from "firebase-admin";

if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
}
const db = admin.database();

function normalizeToISO(t) {
  if (t == null) return null;

  // 纯数字或数字字符串 -> 毫秒时间戳
  if (typeof t === "number" || (/^\d+$/.test(String(t)))) {
    const d = new Date(Number(t));
    return isNaN(d) ? null : d.toISOString();
  }

  // 像 2025-08-07T14-06-46_248Z -> 修正为 ISO
  if (typeof t === "string" && /T\d{2}-\d{2}-\d{2}_\d{3}Z$/.test(t)) {
    const fixed = t.replace(/T(\d{2})-(\d{2})-(\d{2})_(\d{3})Z$/, "T$1:$2:$3.$4Z");
    const d = new Date(fixed);
    return isNaN(d) ? null : d.toISOString();
  }

  // 已经像 ISO 的字符串
  if (typeof t === "string") {
    const d = new Date(t);
    if (!isNaN(d)) return d.toISOString();
  }

  return null;
}

export default async function handler(req, res) {
  const { secret } = req.query;
  if (!secret || secret !== process.env.MY_INDEX_SECRET) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const snap = await db.ref("history").once("value");
    const raw = snap.val() || {};

    const history = Object.entries(raw).map(([key, val]) => {
      // 先用 val.time，否则用 key（你的 key 也可能是毫秒时间戳）
      const iso = normalizeToISO(val?.time ?? key);
      return {
        time: iso ?? String(val?.time ?? key), // 就算失败也给个字符串，前端会兜底
        totalBTC: val?.totalBTC ?? 0,
        totalUSD: val?.totalUSD ?? 0,
      };
    }).sort((a, b) => new Date(a.time) - new Date(b.time));

    return res.status(200).json({ history });
  } catch (e) {
    console.error("获取历史记录失败", e);
    return res.status(500).json({ message: "获取历史记录失败" });
  }
}
