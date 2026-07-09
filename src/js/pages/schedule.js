import {
  watchMySchedule, addScheduleEntry, deleteScheduleEntry,
  watchMyAttendance, markAttendance,
} from "../firebase/firestore.js";

let uid = null;
let unsubscribe = null;
let attendanceUnsub = null;
let latestEntries = [];
let latestAttendance = [];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayDayName() {
  return DAYS[(new Date().getDay() + 6) % 7]; // JS getDay(): 0=Sun..6=Sat -> Monday-first
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function attendanceFor(entryId) {
  const date = todayDateStr();
  return latestAttendance.find((a) => a.scheduleEntryId === entryId && a.date === date) || null;
}

function attendanceControls(entry) {
  if (entry.day !== todayDayName()) return "";
  const current = attendanceFor(entry.id);
  const opts = [
    { status: "present", label: "Present" },
    { status: "late", label: "Late" },
    { status: "absent", label: "Absent" },
  ];
  return `
    <div style="display:flex; gap:6px; margin-top:8px;">
      ${opts.map((o) => `
        <button
          class="btn btn--sm ${current?.status === o.status ? "btn--primary" : "btn--outline"}"
          data-mark-attendance="${entry.id}" data-status="${o.status}" data-subject="${entry.subject}"
        >${o.label}</button>
      `).join("")}
    </div>
  `;
}

function renderGrid() {
  const gridEl = document.getElementById("schedule-grid");
  if (!gridEl) return;
  const entries = latestEntries;

  if (entries.length === 0) {
    gridEl.innerHTML = `<div class="empty-state card"><h3>No classes yet</h3><p>Add your weekly classes manually below, or scan a photo of your schedule.</p></div>`;
    return;
  }

  gridEl.innerHTML = DAYS.map((day) => {
    const dayEntries = entries.filter((e) => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (dayEntries.length === 0) return "";
    return `
      <div class="card" style="margin-bottom: var(--space-3);">
        <h4>${day}${day === todayDayName() ? ` <span class="badge badge--accent">Today</span>` : ""}</h4>
        ${dayEntries.map((e) => `
          <div style="padding: var(--space-2) 0; border-top: 1px solid var(--color-border);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${e.subject}</strong>
                <div style="font-size: var(--fs-sm); color: var(--color-text-muted);">
                  ${e.startTime}–${e.endTime}${e.room ? " · " + e.room : ""}${e.instructor ? " · " + e.instructor : ""}
                </div>
              </div>
              <button class="btn btn--icon btn--secondary" data-delete-entry="${e.id}" aria-label="Remove">✕</button>
            </div>
            ${attendanceControls(e)}
          </div>
        `).join("")}
      </div>
    `;
  }).join("");

  gridEl.querySelectorAll("[data-delete-entry]").forEach((btn) => {
    btn.addEventListener("click", () => deleteScheduleEntry(btn.dataset.deleteEntry));
  });

  gridEl.querySelectorAll("[data-mark-attendance]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await markAttendance(uid, {
          scheduleEntryId: btn.dataset.markAttendance,
          subject: btn.dataset.subject,
          date: todayDateStr(),
          status: btn.dataset.status,
        });
      } catch (err) {
        console.error(err);
        alert("Couldn't save attendance. Please try again.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function modalShell(title, bodyHtml, idPrefix = "sched") {
  return `
    <div class="modal-overlay" id="${idPrefix}-modal-overlay">
      <div class="modal-panel card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-4);">
          <h3 style="margin:0;">${title}</h3>
          <button class="btn btn--icon btn--secondary" id="${idPrefix}-modal-close">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function openScheduleModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Add a class", `
    <div class="field"><label for="s-subject">Subject</label><input id="s-subject" required /></div>
    <div class="field"><label for="s-day">Day</label>
      <select id="s-day">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select>
    </div>
    <div style="display:flex; gap: var(--space-3);">
      <div class="field" style="flex:1;"><label for="s-start">Start time</label><input id="s-start" type="time" required /></div>
      <div class="field" style="flex:1;"><label for="s-end">End time</label><input id="s-end" type="time" required /></div>
    </div>
    <div class="field"><label for="s-instructor">Instructor</label><input id="s-instructor" /></div>
    <div class="field"><label for="s-room">Room</label><input id="s-room" /></div>
    <button class="btn btn--primary btn--full" id="s-submit">Add class</button>
  `));

  document.getElementById("sched-modal-close").addEventListener("click", () => {
    document.getElementById("sched-modal-overlay")?.remove();
  });

  document.getElementById("s-submit").addEventListener("click", async () => {
    const subject = document.getElementById("s-subject").value.trim();
    const startTime = document.getElementById("s-start").value;
    const endTime = document.getElementById("s-end").value;
    if (!subject || !startTime || !endTime) return;
    const btn = document.getElementById("s-submit");
    btn.disabled = true;
    btn.textContent = "Adding...";
    try {
      await addScheduleEntry(uid, {
        subject,
        day: document.getElementById("s-day").value,
        startTime,
        endTime,
        instructor: document.getElementById("s-instructor").value.trim(),
        room: document.getElementById("s-room").value.trim(),
      });
      document.getElementById("sched-modal-overlay")?.remove();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Add class";
      alert("Couldn't add that class. Please try again.");
    }
  });
}

/* --------------------------- Scan schedule photo (OCR) --------------------------- */
// Runs entirely in the browser via Tesseract.js — no API key, no backend.
// Accuracy on messy phone photos is limited, so every extracted row is
// shown for the user to review/edit/uncheck before anything is saved.

function to24Hour(raw) {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return "";
  let [, h, min, ampm] = m;
  h = parseInt(h, 10);
  if (ampm) {
    ampm = ampm.toLowerCase();
    if (ampm === "pm" && h !== 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
  }
  return `${String(h).padStart(2, "0")}:${min}`;
}

function guessDay(line) {
  const map = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const m = line.toLowerCase().match(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/);
  return m ? map[m[1]] : null;
}

function parseScheduleText(text) {
  const timeRangeRe = /(\d{1,2}:\d{2}\s?[APap]?[Mm]?)\s*(?:-|–|to)\s*(\d{1,2}:\d{2}\s?[APap]?[Mm]?)/;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let lastDay = null;
  for (const line of lines) {
    const day = guessDay(line);
    if (day) lastDay = day;
    const match = line.match(timeRangeRe);
    if (!match) continue;
    const startTime = to24Hour(match[1]);
    const endTime = to24Hour(match[2]);
    let subject = line
      .replace(match[0], "")
      .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i, "")
      .replace(/[-–|,]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    rows.push({ day: day || lastDay || "Monday", subject: subject || "Untitled class", startTime, endTime, room: "", instructor: "" });
  }
  return rows;
}

function reviewRow(row, i) {
  return `
    <div class="card" style="margin-bottom: var(--space-2);" data-scan-row="${i}">
      <div style="display:flex; gap: var(--space-2); align-items:center; margin-bottom: var(--space-2);">
        <input type="checkbox" data-scan-include="${i}" checked style="width:auto;" />
        <input data-scan-subject="${i}" value="${row.subject}" placeholder="Subject" style="flex:1;" />
      </div>
      <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
        <select data-scan-day="${i}">${DAYS.map((d) => `<option ${d === row.day ? "selected" : ""}>${d}</option>`).join("")}</select>
        <input data-scan-start="${i}" type="time" value="${row.startTime}" />
        <input data-scan-end="${i}" type="time" value="${row.endTime}" />
      </div>
    </div>
  `;
}

async function runOcrAndReview(file) {
  const statusEl = document.getElementById("scan-status");
  const resultsEl = document.getElementById("scan-results");
  statusEl.textContent = "Reading the photo… this can take up to a minute.";

  if (typeof Tesseract === "undefined") {
    statusEl.textContent = "OCR engine didn't load (check your internet connection) — try again, or add the classes manually instead.";
    return;
  }

  try {
    const { data } = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          statusEl.textContent = `Reading the photo… ${Math.round((m.progress || 0) * 100)}%`;
        }
      },
    });
    const rows = parseScheduleText(data.text || "");
    if (rows.length === 0) {
      statusEl.textContent = "Couldn't confidently find any class times in that photo. Try a clearer/brighter photo, or add classes manually below.";
      resultsEl.innerHTML = "";
      return;
    }
    statusEl.textContent = `Found ${rows.length} possible class${rows.length === 1 ? "" : "es"} — review and edit before saving. OCR isn't perfect, so double-check each row.`;
    resultsEl.innerHTML = `
      ${rows.map(reviewRow).join("")}
      <button class="btn btn--primary btn--full" id="scan-save-all">Save checked classes</button>
    `;
    resultsEl.dataset.rows = JSON.stringify(rows);

    document.getElementById("scan-save-all").addEventListener("click", async () => {
      const saveBtn = document.getElementById("scan-save-all");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const rowEls = resultsEl.querySelectorAll("[data-scan-row]");
      let saved = 0;
      for (const rowEl of rowEls) {
        const i = rowEl.dataset.scanRow;
        const include = resultsEl.querySelector(`[data-scan-include="${i}"]`).checked;
        if (!include) continue;
        const subject = resultsEl.querySelector(`[data-scan-subject="${i}"]`).value.trim();
        const day = resultsEl.querySelector(`[data-scan-day="${i}"]`).value;
        const startTime = resultsEl.querySelector(`[data-scan-start="${i}"]`).value;
        const endTime = resultsEl.querySelector(`[data-scan-end="${i}"]`).value;
        if (!subject || !startTime || !endTime) continue;
        try {
          await addScheduleEntry(uid, { subject, day, startTime, endTime, instructor: "", room: "" });
          saved++;
        } catch (err) {
          console.error(err);
        }
      }
      document.getElementById("scan-modal-overlay")?.remove();
      if (saved === 0) alert("Nothing was saved — check that each row has a subject and valid times.");
    });
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Something went wrong reading that photo. Please try again with a clearer image.";
  }
}

export function openScanModal() {
  document.body.insertAdjacentHTML("beforeend", modalShell("Scan schedule photo", `
    <p style="margin-top:0; font-size: var(--fs-sm); color: var(--color-text-muted);">
      Uses on-device OCR (no photo is uploaded anywhere). Works best with a clear, well-lit photo of a typed or printed schedule table.
    </p>
    <input type="file" accept="image/*" id="scan-file-input" style="margin-bottom: var(--space-3);" />
    <p id="scan-status" style="margin:0 0 var(--space-3);"></p>
    <div id="scan-results"></div>
  `, "scan"));

  document.getElementById("scan-modal-close").addEventListener("click", () => {
    document.getElementById("scan-modal-overlay")?.remove();
  });

  document.getElementById("scan-file-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) runOcrAndReview(file);
  });
}

export function renderSchedule(currentUid) {
  uid = currentUid;
  latestEntries = [];
  latestAttendance = [];
  if (unsubscribe) unsubscribe();
  if (attendanceUnsub) attendanceUnsub();
  setTimeout(() => {
    unsubscribe = watchMySchedule(uid, (entries) => { latestEntries = entries; renderGrid(); });
    attendanceUnsub = watchMyAttendance(uid, (records) => { latestAttendance = records; renderGrid(); });
  }, 0);

  return `
    <div class="page-content">
      <div style="margin-bottom: var(--space-4); display:flex; gap: var(--space-3);">
        <button class="btn btn--primary" id="schedule-open-add">+ Add class</button>
        <button class="btn btn--outline" id="schedule-open-scan">Scan schedule photo</button>
      </div>
      <div id="schedule-grid">
        <div class="skeleton" style="height:80px; margin-bottom:8px;"></div>
        <div class="skeleton" style="height:80px;"></div>
      </div>
    </div>
  `;
}

export function wireScheduleButtons() {
  document.getElementById("schedule-open-add")?.addEventListener("click", openScheduleModal);
  document.getElementById("schedule-open-scan")?.addEventListener("click", openScanModal);
  document.querySelector('[data-fab="schedule"]')?.addEventListener("click", openScheduleModal);
}
