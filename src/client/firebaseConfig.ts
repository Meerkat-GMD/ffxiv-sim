import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

export type FirebaseWebConfig = {
  apiKey: string;
  appId: string;
  authDomain: string;
  databaseURL: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket?: string;
};

let app: FirebaseApp | undefined;

export function readFirebaseConfig(): FirebaseWebConfig | undefined {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  };

  if (
    !config.apiKey ||
    !config.appId ||
    !config.authDomain ||
    !config.databaseURL ||
    !config.messagingSenderId ||
    !config.projectId
  ) {
    return undefined;
  }

  return config;
}

export function getFirebaseDatabase(
  config = readFirebaseConfig(),
): Database | undefined {
  if (!config) {
    return undefined;
  }

  app ??= initializeApp(config);

  return getDatabase(app);
}
