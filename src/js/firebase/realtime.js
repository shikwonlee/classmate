// ClassMate+ — Realtime Database layer
// RTDB stores ONLY: chat messages, presence, typing, seen, unread counters.
// Never user profiles — those stay in Firestore (see firestore.rules).

import {
  ref, push, set, onValue, off, serverTimestamp as rtdbServerTimestamp,
  onDisconnect, query, orderByChild, limitToLast,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { rtdb } from "./config.js";

export function sendMessage(chatId, senderId, text) {
  const messagesRef = ref(rtdb, `messages/${chatId}`);
  const newMsgRef = push(messagesRef);
  return set(newMsgRef, {
    senderId,
    text,
    sentAt: rtdbServerTimestamp(),
  });
}

/** Subscribes to the last N messages of a chat. Returns an unsubscribe fn. */
export function watchMessages(chatId, callback, limit = 100) {
  const messagesQuery = query(ref(rtdb, `messages/${chatId}`), orderByChild("sentAt"), limitToLast(limit));
  const handler = (snap) => {
    const val = snap.val() || {};
    const messages = Object.entries(val)
      .map(([id, msg]) => ({ id, ...msg }))
      .sort((a, b) => (a.sentAt || 0) - (b.sentAt || 0));
    callback(messages);
  };
  onValue(messagesQuery, handler);
  return () => off(messagesQuery, "value", handler);
}

export function setPresence(uid) {
  const presenceRef = ref(rtdb, `presence/${uid}`);
  set(presenceRef, { online: true, lastSeen: rtdbServerTimestamp() });
  onDisconnect(presenceRef).set({ online: false, lastSeen: rtdbServerTimestamp() });
}

export function watchPresence(uid, callback) {
  const presenceRef = ref(rtdb, `presence/${uid}`);
  const handler = (snap) => callback(snap.val() || { online: false });
  onValue(presenceRef, handler);
  return () => off(presenceRef, "value", handler);
}

export function setTyping(chatId, uid, isTyping) {
  return set(ref(rtdb, `typing/${chatId}/${uid}`), isTyping ? rtdbServerTimestamp() : null);
}

export function watchTyping(chatId, myUid, callback) {
  const typingRef = ref(rtdb, `typing/${chatId}`);
  const handler = (snap) => {
    const val = snap.val() || {};
    const othersTyping = Object.keys(val).filter((uid) => uid !== myUid);
    callback(othersTyping);
  };
  onValue(typingRef, handler);
  return () => off(typingRef, "value", handler);
}
