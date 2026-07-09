import {
  createClassSpace, joinClassSpaceByCode, listMyClassSpaces, getClassSpace,
  getMemberDoc, postAnnouncement, watchSpaceAnnouncements, deleteAnnouncement,
  markAnnouncementsRead,
} from "../firebase/firestore.js";

let uid = null;
let onNavigate = null;
let announcementsUnsub = null;

function spaceCard(space) {
  return `
    <a href="#/class-spaces/${space.id}" class="card" style="display:block; margin-bottom: var(--space-3);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="margin-bottom:2px;">${space.name}</h4>
          <p style="margin:0; font-size: var(--fs-sm);">${space.memberCount || 1} member${(space.memberCount || 1) === 1 ? "" : "s"}</p>
        </div>
        <span class="badge ${space.role === "admin" ? "badge--accent" : "badge--muted"}">${space.role}</span>
      </div>
    </a>
  `;
}

function modalShell(title, bodyHtml) {
  return `
    <div class="modal-overlay" id="cs-modal-overlay">
      <div class="modal-panel card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-4);">
          <h3 style="margin:0;">${title}</h3>
          <button class="btn btn--icon btn--secondary" id="cs-modal-close">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

async function refreshList() {
  const listEl = document.getElementById("cs-list");
  if (!listEl) return;
  listEl.innerHTML = `<div class="skeleton" style="height:64px; margin-bottom:8px;"></div><div class="skeleton" style="height:64px;"></div>`;
  let spaces = [];
  try {
    spaces = await listMyClassSpaces(uid);
  } catch (err) {
    console.error("Couldn't load class spaces:", err);
    listEl.innerHTML = `<div class="empty-state card"><h3>Couldn't load your Class Spaces</h3><p>Please try again.</p></div>`;
    return;
  }
  if (spaces.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state card">
        <h3>No Class Spaces yet</h3>
        <p>Create one for your section, or join an existing one with an invite code.</p>
      </div>`;
    return;
  }
  listEl.innerHTML = spaces.map(spaceCard).join("");
}

function openCreateModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Create a Class Space", `
    <div class="field"><label for="cs-name">Name</label><input id="cs-name" placeholder="BSIT 2A" required /></div>
    <div class="field"><label for="cs-desc">Description (optional)</label><textarea id="cs-desc" rows="2"></textarea></div>
    <button class="btn btn--primary btn--full" id="cs-create-submit">Create</button>
  `));
  document.getElementById("cs-modal-close").addEventListener("click", closeModal);
  document.getElementById("cs-create-submit").addEventListener("click", async () => {
    const name = document.getElementById("cs-name").value.trim();
    if (!name) return;
    const btn = document.getElementById("cs-create-submit");
    btn.disabled = true;
    btn.textContent = "Creating...";
    try {
      const { inviteCode } = await createClassSpace(uid, {
        name,
        description: document.getElementById("cs-desc").value.trim(),
      });
      closeModal();
      await refreshList();
      alert(`Created! Invite code: ${inviteCode}`);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Create";
      alert("Couldn't create the Class Space. Please try again.");
    }
  });
}

function openJoinModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Join a Class Space", `
    <div class="field"><label for="cs-code">Invite code</label><input id="cs-code" placeholder="BSIT26A82" style="text-transform:uppercase;" required /></div>
    <button class="btn btn--primary btn--full" id="cs-join-submit">Join</button>
  `));
  document.getElementById("cs-modal-close").addEventListener("click", closeModal);
  document.getElementById("cs-join-submit").addEventListener("click", async () => {
    const code = document.getElementById("cs-code").value.trim();
    if (!code) return;
    const btn = document.getElementById("cs-join-submit");
    btn.disabled = true;
    btn.textContent = "Joining...";
    try {
      await joinClassSpaceByCode(uid, code);
      closeModal();
      await refreshList();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Join";
      alert(err.message || "Couldn't join. Check the code and try again.");
    }
  });
}

function closeModal() {
  document.getElementById("cs-modal-overlay")?.remove();
}

export function renderClassSpaces(currentUid) {
  uid = currentUid;
  setTimeout(refreshList, 0);
  return `
    <div class="page-content">
      <div style="display:flex; gap: var(--space-3); margin-bottom: var(--space-4);">
        <button class="btn btn--primary" id="cs-open-create">+ Create Class Space</button>
        <button class="btn btn--outline" id="cs-open-join">Join Class Space</button>
      </div>
      <div id="cs-list"></div>
    </div>
  `;
}

function timeAgo(ts) {
  if (!ts?.toMillis) return "";
  const diffMs = Date.now() - ts.toMillis();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function announcementCard(a, canManage) {
  return `
    <div class="card" style="margin-bottom: var(--space-3);" data-announcement-id="${a.id}">
      <div style="display:flex; justify-content:space-between; gap: var(--space-3);">
        <h4 style="margin-bottom:4px;">${a.title}</h4>
        ${canManage ? `<button class="btn btn--icon btn--secondary" data-delete-announcement="${a.id}" aria-label="Delete">✕</button>` : ""}
      </div>
      <p style="margin:0 0 6px;">${a.body || ""}</p>
      <span class="badge badge--muted">${timeAgo(a.createdAt)}</span>
    </div>
  `;
}

function renderAnnouncementsList(announcements, canManage) {
  const el = document.getElementById("cs-announcements-list");
  if (!el) return;
  if (announcements.length === 0) {
    el.innerHTML = `<p style="margin:0;">Nothing posted yet.</p>`;
    return;
  }
  el.innerHTML = announcements.map((a) => announcementCard(a, canManage)).join("");
  el.querySelectorAll("[data-delete-announcement]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this announcement?")) return;
      const spaceId = document.querySelector("[data-space-id]")?.dataset.spaceId;
      try {
        await deleteAnnouncement(spaceId, btn.dataset.deleteAnnouncement);
      } catch (err) {
        console.error(err);
        alert("Couldn't delete that announcement.");
      }
    });
  });
}

/** Detail view for a single Class Space (Home / Announcements / Members). */
export async function renderClassSpaceDetail(spaceId, currentUid) {
  uid = currentUid;
  let space = null;
  try {
    space = await getClassSpace(spaceId);
  } catch (err) {
    // Firestore rules deny read access to non-members (e.g. stale link,
    // you left the space, or it was deleted) — this is expected, not a
    // bug, so we handle it instead of throwing an uncaught rejection.
    console.warn(`Can't open class space ${spaceId}:`, err);
  }
  if (!space) return `<div class="page-content"><div class="empty-state card"><h3>Not found</h3><p>This Class Space doesn't exist or you don't have access.</p></div></div>`;

  let role = "member";
  try {
    const member = await getMemberDoc(spaceId, uid);
    role = member?.role || "member";
  } catch (err) {
    console.warn(`Couldn't read membership role for ${spaceId}:`, err);
  }
  const canManage = role === "admin" || role === "moderator";

  // Viewing this page counts as "read" — clears the unread badge on Home.
  markAnnouncementsRead(spaceId, uid).catch((err) => console.warn("markAnnouncementsRead failed:", err));

  return `
    <div class="page-content" data-space-id="${spaceId}">
      <div class="card" style="margin-bottom: var(--space-4);">
        <h2 style="margin-bottom:4px;">${space.name}</h2>
        <p style="margin:0;">${space.description || "No description yet."}</p>
        <div style="margin-top: var(--space-3); display:flex; gap: var(--space-2); align-items:center;">
          <span class="badge badge--muted">Invite code: ${space.inviteCode}</span>
          <span class="badge badge--muted">${space.memberCount || 1} members</span>
        </div>
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-3);">
          <h4 style="margin:0;">Announcements</h4>
          ${canManage ? `<button class="btn btn--primary" id="cs-post-announcement" data-space-id="${spaceId}">+ Post</button>` : ""}
        </div>
        ${canManage ? `
          <div id="cs-announcement-form" style="display:none; margin-bottom: var(--space-4);">
            <div class="field"><label for="cs-ann-title">Title</label><input id="cs-ann-title" /></div>
            <div class="field"><label for="cs-ann-body">Message</label><textarea id="cs-ann-body" rows="2"></textarea></div>
            <button class="btn btn--primary" id="cs-ann-submit">Post announcement</button>
          </div>
        ` : ""}
        <div id="cs-announcements-list">
          <div class="skeleton" style="height:20px; margin-bottom:8px;"></div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card"><h4>Assignments</h4><p>Nothing due yet.</p></div>
        <div class="card"><h4>Shared schedule</h4><p>No shared classes yet.</p></div>
        <div class="card"><h4>Files</h4><p>No files shared yet.</p></div>
      </div>
    </div>
  `;
}

export function wireClassSpaceDetailButtons() {
  const pageEl = document.querySelector("[data-space-id]");
  if (!pageEl) return;
  const spaceId = pageEl.dataset.spaceId;

  if (announcementsUnsub) announcementsUnsub();
  const canManage = !!document.getElementById("cs-post-announcement");
  announcementsUnsub = watchSpaceAnnouncements(spaceId, (list) => renderAnnouncementsList(list, canManage));

  document.getElementById("cs-post-announcement")?.addEventListener("click", () => {
    const form = document.getElementById("cs-announcement-form");
    form.style.display = form.style.display === "none" ? "block" : "none";
  });

  document.getElementById("cs-ann-submit")?.addEventListener("click", async () => {
    const title = document.getElementById("cs-ann-title").value.trim();
    if (!title) return;
    const btn = document.getElementById("cs-ann-submit");
    btn.disabled = true;
    btn.textContent = "Posting...";
    try {
      await postAnnouncement(spaceId, uid, {
        title,
        body: document.getElementById("cs-ann-body").value.trim(),
      });
      document.getElementById("cs-ann-title").value = "";
      document.getElementById("cs-ann-body").value = "";
      document.getElementById("cs-announcement-form").style.display = "none";
    } catch (err) {
      console.error(err);
      alert("Couldn't post that announcement. Please try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Post announcement";
    }
  });
}

export function wireClassSpacesFab() {
  document.querySelector('[data-fab="class-spaces"]')?.addEventListener("click", openCreateModal);
}
