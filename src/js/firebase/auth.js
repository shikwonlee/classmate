// ClassMate+ — Authentication
// Google Sign-In is the only supported method. This module also owns the
// "has this user finished Complete Profile?" check that gates app access.

import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, googleProvider, db } from "./config.js";

/**
 * Trigger Google Sign-In. On first login, creates a minimal user document
 * (profileComplete: false) so the router can redirect to Complete Profile.
 * On return visits, only bumps lastLoginAt.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      photoURL: user.photoURL,
      profileComplete: false,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, { lastLoginAt: serverTimestamp() });
  }

  return user;
}

export function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Reads the current user's Firestore profile document.
 * Returns null if not signed in or the doc doesn't exist yet.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Persists the Complete Profile form (full name, birthday, age, status).
 * Sets profileComplete: true so the router stops redirecting here.
 */
export async function completeProfile(uid, { fullName, birthday, age, status }) {
  await updateDoc(doc(db, "users", uid), {
    fullName,
    birthday,
    age,
    status,
    profileComplete: true,
  });
}

/**
 * Subscribes to auth state. Callback receives (user, profile | null).
 * This is the single source of truth the router uses to decide between
 * the Auth screen, Complete Profile screen, and the main App Shell.
 */
export function watchAuthAndProfile(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null, null);
    const profile = await getUserProfile(user.uid);
    callback(user, profile);
  });
}
