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
    const snapshot = await db.ref("subscribers").once("value");
    const data = snapshot.val() || {};
    res.status(200).json(data);
  } catch (err) {
    console.error("获取订阅列表失败", err);
    res.status(500).json({ message: "Failed to fetch subscribers" });
  }
}
