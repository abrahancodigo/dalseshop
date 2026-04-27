import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAyVHRnsKONa1gxrjDTQ8kT6KYc1CuJSgw",
  authDomain: "dalseshop.firebaseapp.com",
  projectId: "dalseshop",
  storageBucket: "dalseshop.firebasestorage.app",
  messagingSenderId: "568482014164",
  appId: "1:568482014164:web:3f9b6b4b310bd748bf6c41",
  measurementId: "G-642B6QP6RB"
};

// Initialize Firebase (prevent duplicate initialization)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export const ADMIN_EMAIL = "abrahanramos@gmail.com";

export default app;
