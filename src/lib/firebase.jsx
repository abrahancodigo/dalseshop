import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAyVHRnsKONa1gxrjDTQ8kT6KYc1CuJSgw",
  authDomain: "dalseshop.firebaseapp.com",
  projectId: "dalseshop",
  storageBucket: "dalseshop.firebasestorage.app",
  messagingSenderId: "568482014164",
  appId: "1:568482014164:web:3f9b6b4b310bd748bf6c41",
  measurementId: "G-642B6QP6RB",
};

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
const useLiveStorefrontPreview = useEmulators && import.meta.env.VITE_LOCAL_STOREFRONT_PREVIEW === 'true';
const app = !getApps().length ? initializeApp(useEmulators ? {
  ...firebaseConfig, projectId: 'demo-dalseshop', apiKey: 'demo-key',
  authDomain: 'demo-dalseshop.firebaseapp.com', storageBucket: 'demo-dalseshop.appspot.com',
} : firebaseConfig) : getApps()[0];

const liveStorefrontApp = useLiveStorefrontPreview
  ? getApps().find((firebaseApp) => firebaseApp.name === "dalseshop-live-storefront-preview")
    || initializeApp(firebaseConfig, "dalseshop-live-storefront-preview")
  : null;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
// In local preview mode, public storefront reads use production data while writes stay on the emulator.
export const storefrontDb = liveStorefrontApp ? getFirestore(liveStorefrontApp) : db;
export { storefrontCacheScope } from "./storefrontEnvironment.mjs";
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");

if (useEmulators && !globalThis.__dalseshopEmulatorsConnected) {
  const host = import.meta.env.VITE_EMULATOR_HOST || window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
  globalThis.__dalseshopEmulatorsConnected = true;
}

export const SUPER_ADMIN_EMAIL = "abrahanramos@gmail.com";

export default app;
