# 🌍 Namek Browser

A modern **Dragon Ball / Planet Namek-inspired web browser** for Windows, built with Electron and Chromium.

## Features

- Real Chromium-powered website rendering and multiple tabs
- Custom Namek home page with planet art created in CSS
- Dark/light theme switcher
- Address bar with Google search fallback
- Back, forward, reload, new tab, and home
- Persistent bookmarks and browsing history
- Downloads list (completed downloads in the current session)
- Anime-friendly quick launch: YouTube, Google, Crunchyroll, Dragon Ball Wiki
- Scouter-themed welcome screen
- Custom window controls
- Security-oriented remote content isolation

## Run on Windows

1. Install [Node.js LTS](https://nodejs.org/).
2. Download or clone this repository.
3. Open a terminal inside the project folder.
4. Run:

```powershell
npm install
npm start
```

To build a Windows installer (on Windows):

```powershell
npm run dist
```

The installer will appear under `dist/`.

## Keyboard shortcuts

- `Ctrl+L` — focus address bar
- `Ctrl+T` — new tab
- `Ctrl+W` — close current tab
- `Ctrl+D` — bookmark current page

## Project structure

- `main.js` — browser window, site views, tabs, storage, IPC
- `preload.js` — limited bridge between UI and Electron
- `index.html`, `styles.css`, `renderer.js` — browser user interface

## Security and limitations

This is an **early desktop browser prototype**, not a security-audited alternative to mainstream browsers. Remote pages load with Node integration disabled, context isolation and sandboxing enabled, and website permission requests denied by default. Some websites require DRM or permissions and may not work. It does not yet include sync, extensions, auto-update, private browsing, safe-browsing services, or automatic security-update distribution. Keep dependencies updated before everyday browsing.

Inspired by Dragon Ball; unofficial fan project, not affiliated with or endorsed by Toei Animation, Bird Studio, Shueisha, or official rights holders. Original CSS artwork, no official assets bundled.
