import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Read Firebase config from Vite environment variables.
// Create a `.env.local` at project root with the VITE_FIREBASE_* values.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey) {
  // Helpful developer message — don't throw so the dev server still runs.
  // The auth calls will fail until this is fixed.
  // To fix: create a `.env.local` with VITE_FIREBASE_API_KEY and the other values.
  // See `.env.local.example` in the repo for the expected variables.
  // Example: VITE_FIREBASE_API_KEY=AIzaSy... (paste your web app config)
  // After adding, restart the dev server.
  // eslint-disable-next-line no-console
  console.error(
    "Missing Firebase API key. Create a .env.local with VITE_FIREBASE_API_KEY and other config values (see .env.local.example)."
  );
}

// Init Firebase
const app = initializeApp(firebaseConfig as any);

// Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);



