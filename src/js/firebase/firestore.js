// ClassMate+ — Firestore data layer
// Every function here maps directly to the collections defined in
// firestore.rules. RTDB (chat messages/presence) lives in realtime.js.

import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./config.js";

function randomCode(prefix = "") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/* ------------------------------ Class Spaces ------------------------------ */

export async function createClassSpace(uid, { name, description }) {
  const spaceRef = await addDoc(collection(db, "classSpaces"), {
    name,
    description: description || "",
    ownerId: uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });

  await setDoc(doc(db, "classSpaces", spaceRef.id, "members", uid), {
    uid,
    role: "admin",
    joinedAt: serverTimestamp(),
  });

  const code = randomCode();
  await setDoc(doc(db, "inviteCodes", code), {
    type: "classSpace",
    spaceId: spaceRef.id,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "classSpaces", spaceRef.id), { inviteCode: code });

  return { id: spaceRef.id, inviteCode: code };
}

export async function joinClassSpaceByCode(uid, code) {
  const codeSnap = await getDoc(doc(db, "inviteCodes", code.trim().toUpperCase()));
  if (!codeSnap.exists() || codeSnap.data().type !== "classSpace") {
    throw new Error("That invite code doesn't match any Class Space.");
  }
  const { spaceId } = codeSnap.data();
  await setDoc(doc(db, "classSpaces", spaceId, "members", uid), {
    uid,
    role: "member",
    joinedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "classSpaces", spaceId), { memberCount: increment(1) });
  return spaceId;
}

/** One-time fetch of every Class Space the user belongs to (dashboard/list use). */
export async function listMyClassSpaces(uid) {
  // members are subcollections, so we can't query across spaces directly
  // without a collectionGroup query — using that here.
  const { collectionGroup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(collectionGroup(db, "members"), where("uid", "==", uid));
  const memberDocs = await getDocs(q);
  const spaces = [];
  for (const m of memberDocs.docs) {
    const spaceId = m.ref.parent.parent.id;
    try {
      const spaceSnap = await getDoc(doc(db, "classSpaces", spaceId));
      if (spaceSnap.exists()) spaces.push({ id: spaceId, role: m.data().role, ...spaceSnap.data() });
    } catch (err) {
      // Membership doc exists but the parent Class Space was deleted, or
      // rules briefly disagree during a role change — skip it instead of
      // failing the whole list.
      console.warn(`Skipping class space ${spaceId}:`, err);
    }
  }
  return spaces;
}

export async function getClassSpace(spaceId) {
  const snap = await getDoc(doc(db, "classSpaces", spaceId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function regenerateInviteCode(spaceId, uid) {
  const code = randomCode();
  await setDoc(doc(db, "inviteCodes", code), {
    type: "classSpace", spaceId, createdBy: uid, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "classSpaces", spaceId), { inviteCode: code });
  return code;
}

/* ---------------------------------- Tasks ---------------------------------- */

export function watchMyTasks(uid, callback) {
  // Equality-only filter — no orderBy here on purpose. Combining where()
  // with orderBy() on a different field requires a composite index to be
  // manually created in the Firebase console; sorting client-side avoids
  // that requirement entirely.
  const q = query(collection(db, "tasks"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      tasks.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      callback(tasks);
    },
    (err) => console.error("watchMyTasks failed:", err)
  );
}

export async function createTask(uid, task) {
  return addDoc(collection(db, "tasks"), {
    ownerId: uid,
    title: task.title,
    description: task.description || "",
    subject: task.subject || "",
    priority: task.priority || "Normal",
    dueDate: task.dueDate || "",
    dueTime: task.dueTime || "",
    status: "Not Started",
    createdAt: serverTimestamp(),
  });
}

export async function updateTaskStatus(taskId, status) {
  await updateDoc(doc(db, "tasks", taskId), { status });
}

export async function deleteTask(taskId) {
  await deleteDoc(doc(db, "tasks", taskId));
}

/* -------------------------------- Schedule -------------------------------- */

export function watchMySchedule(uid, callback) {
  const q = query(collection(db, "personalSchedule"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("watchMySchedule failed:", err)
  );
}

export async function addScheduleEntry(uid, entry) {
  return addDoc(collection(db, "personalSchedule"), {
    ownerId: uid,
    subject: entry.subject,
    day: entry.day,
    instructor: entry.instructor || "",
    room: entry.room || "",
    startTime: entry.startTime,
    endTime: entry.endTime,
    createdAt: serverTimestamp(),
  });
}

export async function deleteScheduleEntry(entryId) {
  await deleteDoc(doc(db, "personalSchedule", entryId));
}

/* ----------------------------------- Chat ---------------------------------- */

export async function createChat(uid, { name, description, privacy, maxMembers, themeColor }) {
  const chatRef = await addDoc(collection(db, "chats"), {
    name,
    description: description || "",
    privacy: privacy || "private",
    maxMembers: maxMembers || 100,
    themeColor: themeColor || "#5B4FE8",
    ownerId: uid,
    createdAt: serverTimestamp(),
    memberCount: 1,
  });
  await setDoc(doc(db, "chats", chatRef.id, "members", uid), {
    uid, role: "admin", joinedAt: serverTimestamp(),
  });
  const code = randomCode();
  await setDoc(doc(db, "inviteCodes", code), {
    type: "chat", spaceId: chatRef.id, createdBy: uid, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "chats", chatRef.id), { inviteCode: code });
  return { id: chatRef.id, inviteCode: code };
}

export async function joinChatByCode(uid, code) {
  const codeSnap = await getDoc(doc(db, "inviteCodes", code.trim().toUpperCase()));
  if (!codeSnap.exists() || codeSnap.data().type !== "chat") {
    throw new Error("That invite code doesn't match any chat.");
  }
  const { spaceId: chatId } = codeSnap.data();
  await setDoc(doc(db, "chats", chatId, "members", uid), {
    uid, role: "member", joinedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "chats", chatId), { memberCount: increment(1) });
  return chatId;
}

export async function listMyChats(uid) {
  const { collectionGroup } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(collectionGroup(db, "members"), where("uid", "==", uid));
  const memberDocs = await getDocs(q);
  const chats = [];
  for (const m of memberDocs.docs) {
    const parentCollection = m.ref.parent.parent.parent.id;
    if (parentCollection !== "chats") continue;
    const chatId = m.ref.parent.parent.id;
    try {
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) chats.push({ id: chatId, role: m.data().role, ...chatSnap.data() });
    } catch (err) {
      console.warn(`Skipping chat ${chatId}:`, err);
    }
  }
  return chats;
}

/* ---------------------------------- Files ---------------------------------- */

export function watchMyFiles(uid, callback) {
  // Same reasoning as watchMyTasks: avoid where()+orderBy() on different
  // fields so no composite index is required. Sort newest-first in JS.
  const q = query(collection(db, "personalFiles"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const files = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      files.sort((a, b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
      callback(files);
    },
    (err) => console.error("watchMyFiles failed:", err)
  );
}

export async function createFileRecord(uid, { name, url, resourceType, format, bytes }) {
  return addDoc(collection(db, "personalFiles"), {
    ownerId: uid,
    name,
    url,
    resourceType,
    format,
    bytes,
    uploadedAt: serverTimestamp(),
  });
}

export async function deleteFileRecord(fileId) {
  await deleteDoc(doc(db, "personalFiles", fileId));
}

/* ------------------------------ Announcements ------------------------------ */

export async function postAnnouncement(spaceId, uid, { title, body }) {
  return addDoc(collection(db, "classSpaces", spaceId, "announcements"), {
    title,
    body: body || "",
    authorId: uid,
    createdAt: serverTimestamp(),
  });
}

export function watchSpaceAnnouncements(spaceId, callback) {
  const q = query(collection(db, "classSpaces", spaceId, "announcements"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("watchSpaceAnnouncements failed:", err)
  );
}

export async function deleteAnnouncement(spaceId, announcementId) {
  await deleteDoc(doc(db, "classSpaces", spaceId, "announcements", announcementId));
}

/** Stamps "I've seen everything up to now" for this member in this space. */
export async function markAnnouncementsRead(spaceId, uid) {
  await updateDoc(doc(db, "classSpaces", spaceId, "members", uid), {
    lastReadAnnouncementsAt: serverTimestamp(),
  });
}

/**
 * Counts announcements posted after this member's last-read stamp, for
 * every Class Space the user belongs to. `spaces` = the array returned by
 * listMyClassSpaces (each item already has .id and, once fetched, a
 * .lastReadAnnouncementsAt from the member doc — see getMemberDoc below).
 */
export async function getMemberDoc(spaceId, uid) {
  const snap = await getDoc(doc(db, "classSpaces", spaceId, "members", uid));
  return snap.exists() ? snap.data() : null;
}

export async function countUnreadAnnouncements(uid, spaceIds) {
  const { Timestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  let total = 0;
  for (const spaceId of spaceIds) {
    try {
      const member = await getMemberDoc(spaceId, uid);
      const since = member?.lastReadAnnouncementsAt || Timestamp.fromMillis(0);
      const q = query(
        collection(db, "classSpaces", spaceId, "announcements"),
        where("createdAt", ">", since)
      );
      const snap = await getDocs(q);
      total += snap.size;
    } catch (err) {
      console.warn(`Couldn't count unread announcements for ${spaceId}:`, err);
    }
  }
  return total;
}

/* -------------------------------- Attendance -------------------------------- */

/**
 * Self-reported attendance check-in, tied to a personalSchedule entry for
 * a given calendar date. Uses a deterministic doc ID so re-marking the same
 * class/date upserts instead of creating duplicates.
 */
export async function markAttendance(uid, { scheduleEntryId, subject, date, status }) {
  const recordId = `${uid}_${scheduleEntryId}_${date}`;
  await setDoc(doc(db, "attendance", recordId), {
    ownerId: uid,
    scheduleEntryId,
    subject,
    date, // "YYYY-MM-DD"
    status, // "present" | "absent" | "late"
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function watchMyAttendance(uid, callback) {
  const q = query(collection(db, "attendance"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("watchMyAttendance failed:", err)
  );
}



export async function saveUserSettings(uid, settings) {
  await setDoc(doc(db, "users", uid), { settings }, { merge: true });
}

export async function updateProfileFields(uid, fields) {
  await updateDoc(doc(db, "users", uid), fields);
}
