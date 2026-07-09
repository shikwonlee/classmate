import { signOut } from "../firebase/auth.js";
import { saveUserSettings } from "../firebase/firestore.js";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "gray", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "system", label: "System Default" },
];

function applyTheme(theme) {
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem("classmate-theme", theme);
}

export function renderSettings(currentUid, profile) {
  const savedTheme = localStorage.getItem("classmate-theme") || "system";

  setTimeout(() => {
    document.getElementById("settings-theme")?.addEventListener("change", (e) => {
      applyTheme(e.target.value);
      saveUserSettings(currentUid, { theme: e.target.value });
    });

    document.getElementById("settings-logout")?.addEventListener("click", () => signOut());

    document.querySelectorAll(".settings-toggle").forEach((toggle) => {
      toggle.addEventListener("change", () => {
        saveUserSettings(currentUid, { [toggle.dataset.setting]: toggle.checked });
      });
    });
  }, 0);

  return `
    <div class="page-content">
      <div class="card" style="margin-bottom: var(--space-4);">
        <h4>Theme</h4>
        <select id="settings-theme">
          ${THEMES.map((t) => `<option value="${t.value}" ${t.value === savedTheme ? "selected" : ""}>${t.label}</option>`).join("")}
        </select>
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <h4>Notifications</h4>
        ${["Assignment due reminders", "Announcements", "Chat mentions & replies", "Schedule reminders", "Birthdays"].map((label, i) => `
          <label style="display:flex; align-items:center; gap: var(--space-2); padding: var(--space-2) 0;">
            <input type="checkbox" class="settings-toggle" data-setting="notif_${i}" checked />
            ${label}
          </label>
        `).join("")}
      </div>

      <div class="card" style="margin-bottom: var(--space-4);">
        <h4>Privacy</h4>
        <label style="display:flex; align-items:center; gap: var(--space-2); padding: var(--space-2) 0;">
          <input type="checkbox" class="settings-toggle" data-setting="show_online_status" checked />
          Show my online status to others
        </label>
      </div>

      <div class="card">
        <h4>Account</h4>
        <p>${profile?.email || ""}</p>
        <button class="btn btn--danger" id="settings-logout">Log out</button>
      </div>
    </div>
  `;
}

export function initSavedTheme() {
  applyTheme(localStorage.getItem("classmate-theme") || "system");
}
