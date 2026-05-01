import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if we have the minimum required config
const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app;
let db: any = null;
let storage: any = null;

if (isFirebaseConfigured) {
    try {
        app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        db = getDatabase(app);
        storage = getStorage(app);
    } catch (error) {
        console.error("Error inicializando Firebase:", error);
    }
} else {
    console.warn("Firebase no está configurado. El sistema de cache de audio estará desactivado.");
}

export { app, db, storage };
