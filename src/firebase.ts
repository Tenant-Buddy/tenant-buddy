import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

const emulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;

export const db = emulatorHost ? getFirestore(app) : initializeFirestore(app, { localCache: persistentLocalCache() });

export const auth = getAuth(app);

if (emulatorHost) {
  const [host, port] = emulatorHost.split(':');
  connectFirestoreEmulator(db, host, parseInt(port));
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export const authReady = new Promise<void>((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsub();
      resolve();
    }
  });
});

onAuthStateChanged(auth, (user) => {
  if (!user) signInAnonymously(auth).catch((err) => console.error('Anonymous auth failed:', err));
});
