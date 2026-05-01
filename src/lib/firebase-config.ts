import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyADGITZz8cjblzFSaL9bu3c2ZIBdUcs8vM",
  authDomain: "gestor-gastos-mathew-123.firebaseapp.com",
  projectId: "gestor-gastos-mathew-123",
  storageBucket: "gestor-gastos-mathew-123.firebasestorage.app",
  messagingSenderId: "306152243317",
  appId: "1:306152243317:web:1c994dbe26d5eefd11383c"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);

export { app, db, storage };
