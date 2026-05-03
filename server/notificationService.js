const admin = require("firebase-admin");
const fs = require('fs');
const path = require('path');

// تعديل المسار ليشير إلى المجلد الجديد config
// استبدل 'اسم_ملفك_هنا.json' بالاسم الحقيقي لملف الـ JSON الخاص بك
const fileName = "satha-app-iq-firebase-adminsdk-fbsvc-e6a....json"; 
const serviceAccountPath = path.join(__dirname, "config", fileName);

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ تم تفعيل خدمة Firebase للإشعارات بنجاح");
} else {
    console.warn("⚠️ تحذير: ملف إعدادات Firebase غير موجود في مسار config. لن تعمل الإشعارات.");
}

// دالة لإرسال إشعار (تصديرها لاستخدامها في ملفات أخرى)
const sendPushNotification = async (token, title, body) => {
    const message = {
        notification: { title, body },
        token: token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log("🚀 تم إرسال الإشعار بنجاح:", response);
        return response;
    } catch (error) {
        console.error("❌ فشل إرسال الإشعار:", error);
        throw error;
    }
};

module.exports = { sendPushNotification };