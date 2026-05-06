import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let messagingInstance: any = null;

function initFirebase() {
  if (messagingInstance) return messagingInstance;
  try {
    const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'config');
    if (!fs.existsSync(configDir)) return null;
    const files = fs.readdirSync(configDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return null;
    const serviceAccountPath = path.join(configDir, files[0]);
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ [PUSH] Firebase initialized');
    }
    messagingInstance = admin.messaging();
    return messagingInstance;
  } catch (err: any) {
    console.warn('⚠️ [PUSH] Firebase init skipped:', err.message);
    return null;
  }
}

export async function sendPushNotification(token: string, title: string, body: string): Promise<void> {
  if (!token) return;
  const messaging = initFirebase();
  if (!messaging) return;
  try {
    await messaging.send({
      notification: { title, body },
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "default", priority: "high" },
      },
      apns: { payload: { aps: { sound: "default", contentAvailable: true } } },
      token,
    });
    console.log(`🔔 [PUSH] Sent: "${title}" → ${token.slice(0, 20)}...`);
  } catch (err: any) {
    console.warn('⚠️ [PUSH] Send failed:', err.message);
  }
}

export async function sendPushToMany(tokens: string[], title: string, body: string): Promise<void> {
  if (!tokens.length) return;
  await Promise.allSettled(tokens.map(t => sendPushNotification(t, title, body)));
}
