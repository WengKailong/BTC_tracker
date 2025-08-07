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
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const snapshot = await db.ref("history").once("value");
    const raw = snapshot.val() || {};
    const history = Object.entries(raw)
      .map(([key, val]) => ({
        ...val,
        time: val.time || new Date(Number(key)).toISOString(), // fallback
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    return res.status(200).json({ history });
  } catch (err) {
    console.error("获取历史记录失败", err);
    return res.status(500).json({ message: "获取历史记录失败" });
  }
}
