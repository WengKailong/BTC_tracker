// api/get-subscribers.js
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
    // 从查询参数或 header 获取 secret
    const clientSecret =
      req.query.secret || req.headers["x-secret"] || "";

    // 校验 secret
    if (clientSecret !== process.env.MY_INDEX_SECRET) {
      return res.status(403).json({ message: "无权访问" });
    }

    // 查询数据库
    const snapshot = await db.ref("subscribers").once("value");
    const data = snapshot.val() || {};
    res.status(200).json(data);
  } catch (err) {
    console.error("获取订阅列表失败", err);
    res.status(500).json({ message: "Failed to fetch subscribers" });
  }
}
