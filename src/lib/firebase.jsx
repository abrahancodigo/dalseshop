import { initializeApp, getApps } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAyVHRnsKONa1gxrjDTQ8kT6KYc1CuJSgw",
  authDomain: "dalseshop.firebaseapp.com",
  projectId: "dalseshop",
  storageBucket: "dalseshop.firebasestorage.app",
  messagingSenderId: "568482014164",
  appId: "1:568482014164:web:3f9b6b4b310bd748bf6c41",
  measurementId: "G-642B6QP6RB",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase's default browser persistence prioritizes IndexedDB. Some local
// browser environments can leave that storage locked, causing sign-in to wait
// indefinitely while production works normally. In development, session
// persistence avoids IndexedDB; production keeps Firebase's default behavior.
function createAuth() {
  if (!import.meta.env.DEV) return getAuth(app);

  try {
    return initializeAuth(app, { persistence: browserSessionPersistence });
  } catch (error) {
    // Vite HMR can evaluate this module after Auth was already initialized.
    if (error?.code === "auth/already-initialized") return getAuth(app);
    throw error;
  }
}

export const auth = createAuth();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

export const SUPER_ADMIN_EMAIL = "abrahanramos@gmail.com";

export default app;
