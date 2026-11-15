import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  Auth,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

/**
 * Placeholder config reference for standalone deployment outside AI Studio:
 * const firebaseConfig = {
 *   apiKey: "PASTE_YOUR_API_KEY",
 *   authDomain: "PASTE_YOUR_AUTH_DOMAIN",
 *   projectId: "PASTE_YOUR_PROJECT_ID",
 *   storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
 *   messagingSenderId: "PASTE_YOUR_SENDER_ID",
 *   appId: "PASTE_YOUR_APP_ID"
 * };
 */
export const firebaseConfig = appletConfig;

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
export const twitterProvider = new TwitterAuthProvider();

/**
 * Secondary Firebase App instance used strictly by Admin (/admin/staff)
 * to create new staff accounts via createUserWithEmailAndPassword
 * without logging out the currently signed-in Admin session.
 */
export function getSecondaryAuth(): Auth {
  const secondaryAppName = 'StaffCreationSecondaryApp';
  const existingSecondary = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existingSecondary || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export default app;
