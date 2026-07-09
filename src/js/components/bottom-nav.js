import { icons } from "./icons.js";
import { BOTTOM_NAV_ROUTES, FAB_ACTIONS } from "./nav-config.js";

export function renderBottomNav(activePath) {
  const items = BOTTOM_NAV_ROUTES.map((route) => `
    <a href="#/${route.path}" class="bottom-nav__item ${activePath === route.path ? "is-active" : ""}" data-route="${route.path}">
      ${icons[route.icon]}
      <span>${route.label}</span>
    </a>
  `).join("");

  return `<nav class="bottom-nav">${items}</nav>`;
}

export function renderFab(activePath) {
  const action = FAB_ACTIONS[activePath];
  if (!action) return "";
  return `
    <button class="fab" aria-label="${action.label}" data-fab="${activePath}">
      ${icons[action.icon]}
    </button>
  `;
}
