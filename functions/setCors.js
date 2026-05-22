const admin = require("firebase-admin");
admin.initializeApp(); // Uses default credentials

async function setCors() {
  try {
const bucket = admin.storage().bucket("dalseshop.firebasestorage.app");
    const corsConfiguration = [
      {
        origin: ["*"],
        method: ["GET", "OPTIONS", "POST", "PUT", "DELETE", "HEAD"],
        responseHeader: ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
        maxAgeSeconds: 3600,
      },
    ];

    await bucket.setCorsConfiguration(corsConfiguration);
    console.log("CORS configuration applied successfully to the default bucket.");
  } catch (error) {
    console.error("Error setting CORS:", error);
  }
}

setCors();
