// Single source of truth for navigation destinations so the desktop
// sidebar and mobile bottom nav never drift out of sync.

// Full set — desktop sidebar shows all of these.
export const SIDEBAR_ROUTES = [
  { path: "home", label: "Home", icon: "home" },
  { path: "class-spaces", label: "Class Spaces", icon: "classSpaces" },
  { path: "schedule", label: "Schedule", icon: "schedule" },
  { path: "chat", label: "Chat", icon: "chat" },
  { path: "tasks", label: "Tasks", icon: "tasks" },
  { path: "files", label: "Files", icon: "files" },
  { path: "settings", label: "Settings", icon: "settings" },
];

// Reduced set for one-handed mobile use — Class Spaces/Files live one tap
// away inside Home instead of consuming a slot in the bottom bar.
export const BOTTOM_NAV_ROUTES = [
  { path: "home", label: "Home", icon: "home" },
  { path: "schedule", label: "Schedule", icon: "schedule" },
  { path: "chat", label: "Chat", icon: "chat" },
  { path: "tasks", label: "Tasks", icon: "tasks" },
  { path: "settings", label: "Settings", icon: "settings" },
];

// Which routes get a Floating Action Button, and what it does.
export const FAB_ACTIONS = {
  "class-spaces": { icon: "plus", label: "Join or create a Class Space" },
  chat: { icon: "plus", label: "Create or join a chat" },
  tasks: { icon: "plus", label: "Add a task" },
  schedule: { icon: "plus", label: "Add a class" },
};
