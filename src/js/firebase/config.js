// ClassMate+ — Firebase initialization
// Single entry point: every other module imports the initialized
// service instances from here rather than calling initializeApp() again.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getMessaging, isSupported as isMessagingSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { getAnalytics, isSupported as isAnalyticsSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtEz6YZaRa1GGlzqGIUMZvJ7PssAALRXY",
  authDomain: "classmate-2026.firebaseapp.com",
  databaseURL: "https://classmate-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "classmate-2026",
  storageBucket: "classmate-2026.firebasestorage.app",
  messagingSenderId: "646309805684",
  appId: "1:646309805684:web:8f583d4c20b936981bdb21",
  measurementId: "G-VZ4PZYDF05"
};

export const app = initializeApp(firebaseConfig);

// Cloud Firestore — profiles, class spaces, tasks, schedules, everything
// that is NOT a chat message / presence signal (see firestore.js docstring).
export const db = getFirestore(app);

// Realtime Database — chat messages, presence, typing/seen indicators only.
export const rtdb = getDatabase(app);

// Auth — Google Sign-In is the ONLY provider. Email/password/phone/anonymous
// are intentionally never wired up anywhere in this codebase.
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Messaging (push notifications) and Analytics only initialize in
// environments that support them (e.g. not in some in-app browsers).
export const messagingPromise = isMessagingSupported().then((ok) => (ok ? getMessaging(app) : null));
export const analyticsPromise = isAnalyticsSupported().then((ok) => (ok ? getAnalytics(app) : null));
