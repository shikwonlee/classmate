# ClassMate+

All-in-one student collaboration PWA — announcements, tasks, schedules, and
chat for a class, in one place. Vanilla HTML/CSS/JS (ES modules), Material
Design 3 influence, Poppins type, Firebase backend.

## What's built and working

- **Auth**: Google Sign-In only, auto-creates a user doc, gates the app
  behind Complete Profile.
- **Home dashboard**: layout for every spec widget. The hero stats (classes
  today, tasks due, attendance %, etc.) are still **illustrative placeholder
  numbers** — wiring them to live counts from your real Class Spaces/Tasks
  is a fast follow-up once you've used the app a bit and have real data to
  show.
- **Class Spaces**: create (auto-generates an invite code), join by code,
  list your spaces, and a basic space detail view (Announcements/
  Assignments/Shared Schedule/Files sections are scaffolded, not yet
  populated with real posts).
- **Tasks**: full create/read/update-status/delete, live-synced from
  Firestore.
- **Schedule**: manual weekly class builder (day/time/room/instructor),
  live-synced. The AI photo-scanner (OCR) is **not built** — it needs a
  Cloud Function + an OCR API (e.g. Google Cloud Vision) behind it, which is
  a backend piece beyond this client-side scaffold.
- **Chat**: create/join by invite code, chat list, and a real-time message
  thread over Realtime Database (send/receive text, typing indicator).
  Media/voice messages, reactions, replies, and read receipts are not yet
  built.
- **Files**: drag-and-drop upload to Cloudinary (metadata stored in
  Firestore, URL only — per spec), list, download, delete.
- **Settings**: theme switcher (Light/Dark/Gray/Blue/System — persisted),
  notification/privacy toggles (saved to Firestore), logout.
- **Profile**: edit name, status, bio.
- **Security rules**: `firestore.rules` (role-based: admin/moderator/member,
  invite-code protection, self-only writes) and `database.rules.json` (RTDB
  scoped strictly to messages/presence/typing — no profile data there).
- **PWA plumbing**: manifest wired to the icon set, service worker with
  app-shell offline caching that correctly ignores Firestore/Auth's
  cross-origin streaming requests.

## Cloudinary setup required for Files to work

`src/js/firebase/cloudinary.js` uses an **unsigned upload preset** so file
uploads can happen straight from the browser with no secret key exposed.
Before Files will work:

1. Cloudinary dashboard → Settings → Upload → Upload presets → Add preset.
2. Signing Mode: **Unsigned**. Name it (e.g. `classmate_unsigned`).
3. Update `UPLOAD_PRESET` in `src/js/firebase/cloudinary.js` to match.

## Still to build

- Announcements, Assignments, Polls, and member management *inside* a Class
  Space (the detail page is scaffolded, not wired to real data yet).
- Chat: media/voice messages, reactions, reply/forward, read receipts,
  pinned/favorite messages, search.
- Smart Reminders + FCM push scheduling (7d/3d/1d/3h/1h/30m/due/overdue).
- Attendance, Grade Calculator, Global Search.
- AI Schedule Scanner (OCR) — requires a backend (Cloud Function + Vision
  API), can't be done client-only.
- Firestore composite indexes: the Tasks and Files queries (`where` +
  `orderBy` on different fields) will prompt you for an index the first
  time you run them — Firestore gives you a direct console link in the
  error message when that happens; just click it.

## Running it locally

This is a static ES-module app — no build step required.

```bash
# from the classmate-plus/ directory
npx serve .
# or: python3 -m http.server 8080
```

Then open the served `index.html` (at the project root). Google Sign-In
requires the page to be served over `http://localhost` or a domain
authorized in the Firebase console (Authentication → Settings → Authorized
domains) — it will not work from a plain `file://` path.

## Deploying to GitHub Pages

`index.html` sits at the **project root** on purpose, so GitHub Pages serves
it immediately as the site's home page. Every path in the project is
relative with no leading slash, so it works unmodified whether hosted at a
root site (`username.github.io`) or a project subpath
(`username.github.io/classmate-plus/`). Push the repo, turn on Pages
(Settings → Pages → Deploy from branch → `/ (root)`) — done.

## Project structure

```
classmate-plus/
├─ index.html
├─ service-worker.js
├─ firestore.rules
├─ database.rules.json
├─ public/
│  ├─ manifest.json
│  └─ icons/
└─ src/
   ├─ css/                (tokens, base, layout, components)
   └─ js/
      ├─ firebase/         (config, auth, firestore, realtime, cloudinary)
      ├─ components/       (sidebar, bottom nav, icons, nav config)
      ├─ pages/            (login, complete-profile, home, class-spaces,
      │                      tasks, schedule, chat, files, settings, profile)
      └─ app.js            (router / entry point)
```
