// Home dashboard — every widget here is wired to live Firestore data.
// Widgets with no real feature behind them yet (reminders, assignments)
// say so honestly instead of showing invented numbers.

import {
  watchMyTasks, watchMySchedule, watchMyFiles, watchMyAttendance,
  listMyClassSpaces, listMyChats, countUnreadAnnouncements,
} from "../firebase/firestore.js";

let unsubTasks = null, unsubSchedule = null, unsubFiles = null, unsubAttendance = null;
let tasks = [], schedule = [], files = [], attendance = [];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayDayName() {
  return DAYS[(new Date().getDay() + 6) % 7];
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function minutesUntil(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  return Math.round((target - new Date()) / 60000);
}

function withinNextNDays(dateStr, n) {
  if (!dateStr) return false;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + n);
  return target >= start && target <= end;
}

/* ------------------------------- Hero stats ------------------------------- */

function renderHero() {
  const el = document.getElementById("home-hero-stats");
  if (!el) return;

  const todaysClasses = schedule.filter((e) => e.day === todayDayName());
  const tasksDue = tasks.filter((t) => withinNextNDays(t.dueDate, 7) && !["Completed", "Submitted"].includes(t.status));

  const upcoming = todaysClasses
    .map((e) => ({ ...e, mins: minutesUntil(e.startTime) }))
    .filter((e) => e.mins >= 0)
    .sort((a, b) => a.mins - b.mins)[0];
  const nextClassLabel = upcoming ? (upcoming.mins < 60 ? `${upcoming.mins}m` : `${Math.floor(upcoming.mins / 60)}h ${upcoming.mins % 60}m`) : "—";

  el.innerHTML = `
    <div>
      <div style="font-size: var(--fs-2xl); font-family: var(--font-mono); font-weight: 700;">${todaysClasses.length}</div>
      <div style="opacity:.85; font-size: var(--fs-sm);">classes today</div>
    </div>
    <div>
      <div style="font-size: var(--fs-2xl); font-family: var(--font-mono); font-weight: 700;">${tasksDue.length}</div>
      <div style="opacity:.85; font-size: var(--fs-sm);">tasks due this week</div>
    </div>
    <div>
      <div style="font-size: var(--fs-2xl); font-family: var(--font-mono); font-weight: 700;">${nextClassLabel}</div>
      <div style="opacity:.85; font-size: var(--fs-sm);">${upcoming ? "until next class" : "no more classes today"}</div>
    </div>
  `;
}

/* ----------------------------- Today's classes ----------------------------- */

function renderTodaysClasses() {
  const el = document.getElementById("widget-todays-classes");
  if (!el) return;
  const todays = schedule.filter((e) => e.day === todayDayName()).sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (todays.length === 0) {
    el.innerHTML = `<p style="margin:0;">No classes scheduled today.</p>`;
    return;
  }
  el.innerHTML = todays.map((e) => `
    <div style="padding: var(--space-2) 0; border-top: 1px solid var(--color-border);">
      <strong>${e.subject}</strong>
      <div style="font-size: var(--fs-sm); color: var(--color-text-muted);">${e.startTime}–${e.endTime}${e.room ? " · " + e.room : ""}</div>
    </div>
  `).join("");
}

/* --------------------------- Upcoming assignments --------------------------- */
// No global cross-Class-Space assignment listing exists yet in the data
// layer (assignments live per-space, per-moderator). Showing this honestly
// rather than inventing numbers.

function renderAssignmentsPlaceholder() {
  const el = document.getElementById("widget-assignments");
  if (!el) return;
  el.innerHTML = `<p style="margin:0; color: var(--color-text-muted);">Assignment tracking across Class Spaces is coming soon.</p>`;
}

function renderRemindersPlaceholder() {
  const el = document.getElementById("widget-reminders");
  if (!el) return;
  el.innerHTML = `<p style="margin:0; color: var(--color-text-muted);">Reminders aren't set up yet — coming soon.</p>`;
}

/* -------------------------- Unread announcements -------------------------- */

async function renderAnnouncementsWidget(uid) {
  const el = document.getElementById("widget-announcements");
  const badgeEl = document.getElementById("widget-announcements-badge");
  if (!el) return;
  try {
    const spaces = await listMyClassSpaces(uid);
    if (spaces.length === 0) {
      el.innerHTML = `<p style="margin:0;">Join or create a Class Space to see announcements.</p>`;
      if (badgeEl) badgeEl.style.display = "none";
      return;
    }
    const unread = await countUnreadAnnouncements(uid, spaces.map((s) => s.id));
    el.innerHTML = unread > 0
      ? `<p style="margin:0;">You have ${unread} unread announcement${unread === 1 ? "" : "s"} across your Class Spaces.</p>`
      : `<p style="margin:0;">You're all caught up.</p>`;
    if (badgeEl) {
      if (unread > 0) {
        badgeEl.textContent = `${unread} new`;
        badgeEl.style.display = "inline-block";
      } else {
        badgeEl.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Couldn't load announcements:", err);
    el.innerHTML = `<p style="margin:0;">Couldn't load announcements right now.</p>`;
  }
}

/* -------------------------------- Recent files ------------------------------ */

function renderRecentFiles() {
  const el = document.getElementById("widget-recent-files");
  if (!el) return;
  if (files.length === 0) {
    el.innerHTML = `<p style="margin:0;">No files uploaded yet.</p>`;
    return;
  }
  el.innerHTML = files.slice(0, 3).map((f) => `
    <div style="padding: var(--space-2) 0; border-top: 1px solid var(--color-border); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
      ${f.name || "Untitled file"}
    </div>
  `).join("");
}

/* -------------------------------- Recent chats ------------------------------- */

async function renderRecentChats(uid) {
  const el = document.getElementById("widget-recent-chats");
  if (!el) return;
  try {
    const chats = await listMyChats(uid);
    if (chats.length === 0) {
      el.innerHTML = `<p style="margin:0;">No chats yet.</p>`;
      return;
    }
    el.innerHTML = chats.slice(0, 3).map((c) => `
      <div style="display:flex; align-items:center; gap:10px; padding: var(--space-2) 0;">
        <span class="dot dot--offline"></span>
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.name}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error("Couldn't load chats:", err);
    el.innerHTML = `<p style="margin:0;">Couldn't load chats right now.</p>`;
  }
}

/* ------------------------------ Attendance summary ---------------------------- */

function renderAttendance() {
  const el = document.getElementById("widget-attendance");
  if (!el) return;
  if (attendance.length === 0) {
    el.innerHTML = `<p style="margin:0; color: var(--color-text-muted);">No attendance logged yet — mark yourself present from the Schedule page.</p>`;
    return;
  }
  const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const pct = Math.round((present / attendance.length) * 100);
  el.innerHTML = `
    <span class="badge ${pct >= 90 ? "badge--success" : pct >= 75 ? "badge--accent" : "badge--muted"}">${pct}% present</span>
    <p style="margin:8px 0 0; font-size: var(--fs-sm); color: var(--color-text-muted);">${present} of ${attendance.length} logged classes</p>
  `;
}

/* ---------------------------- Productivity summary ---------------------------- */

function renderProductivity() {
  const el = document.getElementById("widget-productivity");
  if (!el) return;
  const dueThisWeek = tasks.filter((t) => withinNextNDays(t.dueDate, 7));
  const completed = dueThisWeek.filter((t) => ["Completed", "Submitted"].includes(t.status)).length;
  el.innerHTML = dueThisWeek.length === 0
    ? `<p style="margin:0;">No tasks due this week.</p>`
    : `<p style="margin:0;">${completed} of ${dueThisWeek.length} tasks completed this week.</p>`;
}

/* ---------------------------------- Render ---------------------------------- */

export function renderHome(profile) {
  return `
    <div class="page-content">
      <div class="card card--hero cut-corner" style="margin-bottom: var(--space-5);">
        <h2>${greeting()}, ${profile?.fullName?.split(" ")[0] || "there"} 👋</h2>
        <p>Here's what's happening across your Class Spaces today.</p>
        <div id="home-hero-stats" style="display:flex; gap: var(--space-5); margin-top: var(--space-4); flex-wrap: wrap;">
          <div class="skeleton" style="height:44px; width:80px;"></div>
          <div class="skeleton" style="height:44px; width:80px;"></div>
          <div class="skeleton" style="height:44px; width:80px;"></div>
        </div>
      </div>

      <div class="dashboard-grid">

        <div class="card" data-widget="todays-classes">
          <h4>Today's classes</h4>
          <div id="widget-todays-classes"><div class="skeleton" style="height:40px;"></div></div>
        </div>

        <div class="card" data-widget="upcoming-assignments">
          <h4>Upcoming assignments</h4>
          <div id="widget-assignments"><div class="skeleton" style="height:40px;"></div></div>
        </div>

        <div class="card" data-widget="reminders">
          <h4>Today's reminders</h4>
          <div id="widget-reminders"><div class="skeleton" style="height:20px;"></div></div>
        </div>

        <div class="card" data-widget="unread-announcements">
          <h4>Unread announcements <span class="badge badge--accent" id="widget-announcements-badge" style="display:none;"></span></h4>
          <div id="widget-announcements"><div class="skeleton" style="height:40px;"></div></div>
        </div>

        <div class="card" data-widget="recent-files">
          <h4>Recent files</h4>
          <div id="widget-recent-files"><div class="skeleton" style="height:40px;"></div></div>
        </div>

        <div class="card" data-widget="recent-chats">
          <h4>Recent chats</h4>
          <div id="widget-recent-chats"><div class="skeleton" style="height:40px;"></div></div>
        </div>

        <div class="card" data-widget="attendance-summary">
          <h4>Attendance summary</h4>
          <div id="widget-attendance"><div class="skeleton" style="height:20px;"></div></div>
        </div>

        <div class="card" data-widget="productivity-summary">
          <h4>Productivity summary</h4>
          <div id="widget-productivity"><div class="skeleton" style="height:20px;"></div></div>
        </div>

      </div>
    </div>
  `;
}

export function wireHomeWidgets(uid) {
  if (unsubTasks) unsubTasks();
  if (unsubSchedule) unsubSchedule();
  if (unsubFiles) unsubFiles();
  if (unsubAttendance) unsubAttendance();

  unsubTasks = watchMyTasks(uid, (t) => { tasks = t; renderHero(); renderProductivity(); });
  unsubSchedule = watchMySchedule(uid, (s) => { schedule = s; renderHero(); renderTodaysClasses(); });
  unsubFiles = watchMyFiles(uid, (f) => { files = f; renderRecentFiles(); });
  unsubAttendance = watchMyAttendance(uid, (a) => { attendance = a; renderAttendance(); });

  renderAssignmentsPlaceholder();
  renderRemindersPlaceholder();
  renderAnnouncementsWidget(uid);
  renderRecentChats(uid);
}
