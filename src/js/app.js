import { watchAuthAndProfile } from "./firebase/auth.js";
import { renderLogin } from "./pages/login.js";
import { renderCompleteProfile } from "./pages/complete-profile.js";
import { renderHome, wireHomeWidgets } from "./pages/home.js";
import {
  renderClassSpaces, renderClassSpaceDetail, wireClassSpacesFab, wireClassSpaceDetailButtons,
} from "./pages/class-spaces.js";
import { renderTasks, wireTasksButtons } from "./pages/tasks.js";
import { renderSchedule, wireScheduleButtons } from "./pages/schedule.js";
import {
  renderChatList, renderChatThread, wireChatListButtons,
} from "./pages/chat.js";
import { renderFiles } from "./pages/files.js";
import { renderSettings, initSavedTheme } from "./pages/settings.js";
import { renderProfile } from "./pages/profile.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderBottomNav, renderFab } from "./components/bottom-nav.js";
import { icons } from "./components/icons.js";
import { setPresence } from "./firebase/realtime.js";

const root = document.getElementById("app");

let currentUser = null;
let currentProfile = null;

initSavedTheme();

/** Parses "#/class-spaces/abc123" into { base: "class-spaces", id: "abc123" }. */
function parseRoute() {
  const raw = (location.hash.replace(/^#\//, "") || "home").split("?")[0];
  const [base, id] = raw.split("/");
  return { base, id };
}

/** Renders the page body for the current route. Some pages are async
 * (need a Firestore fetch) — those return a Promise<string>. */
function pageBody({ base, id }) {
  switch (base) {
    case "home": return renderHome(currentProfile);
    case "class-spaces": return id ? renderClassSpaceDetail(id, currentUser.uid) : renderClassSpaces(currentUser.uid);
    case "schedule": return renderSchedule(currentUser.uid);
    case "chat": return id ? renderChatThread(currentUser.uid, id) : renderChatList(currentUser.uid);
    case "tasks": return renderTasks(currentUser.uid);
    case "files": return renderFiles(currentUser.uid);
    case "settings": return renderSettings(currentUser.uid, currentProfile);
    case "profile": return renderProfile(currentUser.uid, currentProfile);
    default: return `<div class="page-content"><div class="empty-state card"><h3>Not found</h3></div></div>`;
  }
}

function wireRouteButtons(base, id) {
  if (base === "home") wireHomeWidgets(currentUser.uid);
  if (base === "class-spaces") {
    if (id) wireClassSpaceDetailButtons();
    else wireClassSpacesFab();
  }
  if (base === "tasks") wireTasksButtons();
  if (base === "schedule") wireScheduleButtons();
  if (base === "chat") wireChatListButtons();
}

async function renderAppShell() {
  const { base, id } = parseRoute();
  const body = await pageBody({ base, id });
  const activeSidebarRoute = base; // sidebar/bottom-nav highlight by top-level section

  root.innerHTML = `
    <div class="app-shell">
      ${renderSidebar(activeSidebarRoute, currentProfile)}
      <div class="app-main">
        <header class="topbar">
          <h3 style="margin:0; text-transform:capitalize;">${base.replace("-", " ")}</h3>
          <div style="display:flex; gap: var(--space-3); align-items:center;">
            <button class="btn btn--icon btn--secondary" aria-label="Search">${icons.search}</button>
            <button class="btn btn--icon btn--secondary" aria-label="Notifications">${icons.bell}</button>
            <a href="#/profile"><img class="avatar avatar--sm" src="${currentProfile?.photoURL || "public/icons/icon-32.png"}" alt="" /></a>
          </div>
        </header>
        ${body}
      </div>
    </div>
    ${renderBottomNav(activeSidebarRoute)}
    ${renderFab(activeSidebarRoute)}
  `;

  wireRouteButtons(base, id);
}

function renderForState() {
  if (!currentUser) {
    renderLogin(root);
    return;
  }
  if (!currentProfile?.profileComplete) {
    renderCompleteProfile(root, currentUser, (savedProfile) => {
      currentProfile = { ...currentProfile, ...savedProfile };
      renderAppShell();
    });
    return;
  }
  setPresence(currentUser.uid);
  renderAppShell();
}

window.addEventListener("hashchange", () => {
  if (currentUser && currentProfile?.profileComplete) renderAppShell();
});

watchAuthAndProfile((user, profile) => {
  currentUser = user;
  currentProfile = profile;
  renderForState();
});
