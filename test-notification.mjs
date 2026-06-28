#!/usr/bin/env node

import * as admin from "firebase-admin";

const serviceAccount = {
  type: "service_account",
  project_id: "redcarpet-1eb15",
  private_key_id: "0aa5d8ac207731c12d786017d84a3c42b5e43ddc",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5Ubd9I335stg5\nXiMuJLu1F8EOR6mKQooJAeTXNVlMMHR2ecrj2CQ8yhOM+QFEV/pM0Gtlr6O5iRjm\nsjaTdECBmVdFNHwO5qa1TLlAVhyjpMBQJWp3450NmnQOVYhyQn6VAWHRo11v6Riu\nSUGfxfHel2U6dXMTVPqERriJdB9OxbOVYepb4vKJGYdwFnehg/hJ1y36yHs3xTNj\n+FnPrSzLsIYCf5bZC/47uG0IL2zjoNV59ls2mhXR++tuztVaWE8DF7dK8D4QK5K7\nCpw30hFQ9lt/NAN35+Lc0dePnddfW9M/KSIHyi+toynKXMnFR/2wSePUBM+JL59s\nt6xnPdP1AgMBAAECggEAJYsdjjeLhPOrhGvC2s1MTdLDJL515XG3fz2n+8VuEtZa\nMcpYxTH7nWke7tdfX1YnejpbF52uoJ7asZn3HoZVryu+l2GbpHUr3tztRtBrOufc\noiACYsl0/tWEn4bKfsNj25INHChpfIuPmXdz2QeECaFIO8ChkJANtJCTQB2LXiys\n4F0xxr+hSH1a45ntkIKOzqKU/e9wE4na3GkVEGYA+f5WaIOcVT/IECX0/zqI2ZiY\n+BqGxFzqgn/LVOTvBHHjh0SLXDHRfgRgdxqgXDoFPXxuLsL8FphxUwBZMsUevjoR\nC6m3OHUkbNZXTFXVIcr1oQjTt404Ho5V1+2pAPu+3QKBgQDmoPRqXFCKfAhmtvyU\nm9T3XL0lUT5YRRrAcZfe/2RFs9mEL7BZjDe0DdON2847PVR0dWiRu931HSEcouKi\njWPpMibfQj7q1qKk9YrwiDMCl3OYQ0ig7awQIs/SbWuQgcsK4uFWxF51kPxBvcuo\nHwH7f1IZP5gXDPiouYYvR9pvswKBgQDNtL1cccSnQN0oL5HpJS/p0sF2RHU3RWJ2\nrqlV0o8FrG+hpoAXjLnPb1DOfcaX+Uvi04zTUKs4aicH2z8NduJP7b7zXF7sEnQx\nIbNus5rxCmwTIfuQoXoVpNzIoEWRUuWdqEEHSIEN96fFgMEnDjfUG9OfxIOOZeqj\n0rpjclKZtwKBgEq2k9etBk6GtfYIi7Tc8tYbzg67zhWsdWkoo4mTdPl7tRi0lk28\nNgN3gzRuo9XfHXAI5RJpKROSFzr+rar5YQeXvq4O+PD9DX2hKhyYEuZhCAqoqWuw\n80/a5zaFShZrZcqmC1gfj3ZIvN/TS5mwSeUerwsM5gl5o0iNqaHBhksvAoGAbYCk\nOPzbCYnO8OB51NmV6uvlTpbcqwKFitYpkGUY+5Uyi6O9lku0cgc4xeNQf4AW9HVX\nBvpvWwWvJ1B//SPnD1NpDdWDNjoQnkLpaKm1dlDs/TZe2zwKaFEtsqMWxWiSkN2L\nWFwxTwUhy1Jh/+9iqsfxXKBYw8nfITxBOkUWUXsCgYEAsvGdT+eIueW0tirl2ntQ\n4b+649hMSz+5mL5IwHRY0sc9EwLorrxXjTELWgNverRtMIwJM9U03FPCwMZaCesA\nkWyWoNyLicSkbJ4r5vEF2Zah5vgPU5DqE/MhSi5tj2YDoQKhJOXrCgxxxLojp7tH\noZZ/jE5IaR/xpxIWS35A1BA=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@redcarpet-1eb15.iam.gserviceaccount.com",
  client_id: "117888074059418620250",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40redcarpet-1eb15.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "redcarpet-1eb15"
});

const messaging = admin.messaging();
const token = process.argv[2] || "fZJoTICTWUWMpvR6b-sfKx:APA91bHojFwqhrIlJBIRyuSLwv6dbP310kTj0gV8l-H2mrHQTpyfbWWM9RxpNo5WEZJMtQaqQCX36u6xIkAgPPqirPDrE9dstpDdZIbjufxEKCEjYHpooiI";

const message = {
  notification: {
    title: "🔴 Test Notification",
    body: "RedCarpet notifications are working!"
  },
  data: {
    type: "test",
    timestamp: new Date().toISOString()
  },
  apns: {
    headers: {
      "apns-priority": "10",
      "apns-push-type": "alert"
    },
    payload: {
      aps: {
        sound: "default",
        badge: 1,
        "content-available": 1
      }
    }
  },
  android: {
    priority: "high"
  }
};

console.log("📱 Sending test notification to:", token);

try {
  const response = await messaging.send(message);
  console.log("✅ Successfully sent message:", response);
  process.exit(0);
} catch (error) {
  console.error("❌ Error sending message:", error);
  process.exit(1);
}
