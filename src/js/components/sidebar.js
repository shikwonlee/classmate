import { icons } from "./icons.js";
import { SIDEBAR_ROUTES } from "./nav-config.js";

export function renderSidebar(activePath, profile) {
  const items = SIDEBAR_ROUTES.map((route) => `
    <a href="#/${route.path}" class="nav-item ${activePath === route.path ? "is-active" : ""}" data-route="${route.path}">
      <span class="nav-item__icon">${icons[route.icon]}</span>
      <span>${route.label}</span>
    </a>
  `).join("");

  return `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <img src="public/icons/icon-96.png" alt="ClassMate+ logo" />
        <span>ClassMate+</span>
      </div>
      <nav>${items}</nav>
      <div class="sidebar__footer">
        <a href="#/profile" class="nav-item" data-route="profile">
          <img class="avatar avatar--sm" src="${profile?.photoURL || "public/icons/icon-32.png"}" alt="" />
          <span>${profile?.fullName || "Complete your profile"}</span>
        </a>
      </div>
    </aside>
  `;
}
