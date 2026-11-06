// Firebase Web SDK — modular API
// All credentials come from environment variables (VITE_* are safe to expose in browser)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (import.meta.env.DEV ? 'AIzaSyDUMMYLOCALDEVKEYFORINTERVIEWDEMO00' : ''),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'travelsync-demo-local.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'travelsync-demo-local',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'travelsync-demo-local.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
