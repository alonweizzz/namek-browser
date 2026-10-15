const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { URL } = require('node:url');

const BAR_HEIGHT = 112;
const START_PAGE = 'namek://home';
const SEARCH_ENGINES = { google: 'https://www.google.com/search?q=', duckduckgo: 'https://duckduckgo.com/?q=', bing: 'https://www.bing.com/search?q=' };
const CLOSED_TAB_LIMIT = 12;
const MAX_TABS = 24;
let win;
let tabs = [];
let activeId = null;
let nextId = 1;
let theme = 'dark';
let searchEngine = 'google';
let closedTabs = [];
let panelOpen = false;
let activeDownloads = new Map();
let bookmarks = [];
let history = [];
let downloads = [];
const dataFile = () => path.join(app.getPath('userData'), 'namek-data.json');

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    theme = data.theme === 'light' ? 'light' : 'dark';
    searchEngine = Object.hasOwn(SEARCH_ENGINES, data.searchEngine) ? data.searchEngine : 'google';
    bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks.slice(0, 200) : [];
    history = Array.isArray(data.history) ? data.history.slice(0, 250) : [];
  } catch {}
}
function saveData() {
  try { fs.writeFileSync(dataFile(), JSON.stringify({ theme, searchEngine, bookmarks, history }, null, 2)); } catch {}
}
function normalize(input) {
  const value = String(input || '').trim();
  if (!value || value === START_PAGE || value.toLowerCase() === 'namek://home') return START_PAGE;
  if (/^https?:\/\//i.test(value)) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : START_PAGE; } catch { return START_PAGE; }
  }
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) return 'http://' + value;
  if (/^[^\s]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(value)) return 'https://' + value;
  return SEARCH_ENGINES[searchEngine] + encodeURIComponent(value);
}
function currentTab() { return tabs.find(tab => tab.id === activeId); }
function summarize() {
  return {
    theme, searchEngine, canRestoreTab: closedTabs.length > 0, panelOpen, activeId, bookmarks, history: history.slice(0, 60), downloads: downloads.slice(0, 20),
    tabs: tabs.map(t => ({
      id: t.id, title: t.title, url: t.url, loading: t.loading, pinned: t.pinned,
      canGoBack: t.view ? t.view.webContents.canGoBack() : false,
      canGoForward: t.view ? t.view.webContents.canGoForward() : false
    }))
  };
}
function publish() { if (win && !win.isDestroyed()) win.webContents.send('namek:state', summarize()); }
function resize() {
  if (!win || win.isDestroyed()) return;
  const [w, h] = win.getContentSize();
  for (const t of tabs) if (t.view) t.view.setBounds({ x: 0, y: BAR_HEIGHT, width: Math.max(0, w - (panelOpen ? 340 : 0)), height: Math.max(0, h - BAR_HEIGHT) });
}
function recordHistory(url, title) {
  if (!url || !/^https?:\/\//.test(url)) return;
  history.unshift({ url, title: title || url, at: Date.now() });
  history = history.filter((entry, index) => index === history.findIndex(other => other.url === entry.url)).slice(0, 250);
  saveData();
}
function addTab(address = START_PAGE) {
  if (tabs.length >= MAX_TABS) return activeId;
  const tab = { id: nextId++, url: START_PAGE, title: 'New Tab', view: null, loading: false, pinned: false };
  tabs.push(tab);
  selectTab(tab.id);
  navigate(tab, address);
  return tab.id;
}
function detach(tab) {
  if (tab.view && win && !win.isDestroyed()) {
    try { win.contentView.removeChildView(tab.view); } catch {}
  }
}
function selectTab(id) {
  const next = tabs.find(t => t.id === id);
  if (!next) return;
  const old = currentTab();
  if (old && old !== next) detach(old);
  activeId = id;
  if (next.view) { win.contentView.addChildView(next.view); resize(); }
  publish();
}
function createWebView(tab) {
  const view = new WebContentsView({
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, partition: 'persist:namek-web' }
  });
  tab.view = view;
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (ctrl && !input.alt && input.key.toLowerCase() === 't') { event.preventDefault(); addTab(); }
    else if (ctrl && input.shift && input.key.toLowerCase() === 't') { event.preventDefault(); restoreTab(); }
    else if (ctrl && input.key.toLowerCase() === 'w') { event.preventDefault(); closeTab(activeId); }
    else if (ctrl && input.key.toLowerCase() === 'l') { event.preventDefault(); win.webContents.send('namek:focus-address'); }
    else if (ctrl && input.key === 'Tab') { event.preventDefault(); cycleTab(input.shift ? -1 : 1); }
    else if (ctrl && /^[1-9]$/.test(input.key)) { event.preventDefault(); const index = input.key === '9' ? tabs.length - 1 : Number(input.key) - 1; if (tabs[index]) selectTab(tabs[index].id); }
    else if (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r')) { event.preventDefault(); sendKeyCommand('reload'); }
    else if (input.alt && input.key === 'Left') { event.preventDefault(); sendKeyCommand('back'); }
    else if (input.alt && input.key === 'Right') { event.preventDefault(); sendKeyCommand('forward'); }
  });
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) addTab(url);
    return { action: 'deny' };
  });
  view.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:\/\//i.test(url)) event.preventDefault();
  });
  view.webContents.on('render-process-gone', () => { tab.loading = false; tab.title = 'Tab crashed — reload to retry'; publish(); });
  view.webContents.on('did-start-loading', () => { tab.loading = true; publish(); });
  view.webContents.on('did-stop-loading', () => { tab.loading = false; publish(); });
  view.webContents.on('page-title-updated', (_event, title) => { tab.title = String(title).slice(0, 100); publish(); });
  view.webContents.on('did-navigate', (_event, url) => { tab.url = url; recordHistory(url, tab.title); publish(); });
  view.webContents.on('did-navigate-in-page', (_event, url) => { tab.url = url; publish(); });
  view.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3) { tab.title = 'Could not load page'; tab.loading = false; publish(); }
  });
  if (tab.id === activeId) { win.contentView.addChildView(view); resize(); }
  return view;
}
function navigate(tab, raw) {
  const address = normalize(raw);
  tab.url = address;
  if (address === START_PAGE) {
    detach(tab);
    if (tab.view) { tab.view.webContents.close(); tab.view = null; }
    tab.title = 'New Tab';
    tab.loading = false;
    publish();
    return;
  }
  const view = tab.view || createWebView(tab);
  tab.title = new URL(address).hostname;
  tab.loading = true;
  view.webContents.loadURL(address).catch(() => { tab.loading = false; publish(); });
  publish();
}
function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;
  const tab = tabs[index];
  if (tab.pinned) return;
  closedTabs.unshift({ url: tab.url, title: tab.title });
  closedTabs = closedTabs.slice(0, CLOSED_TAB_LIMIT);
  detach(tab);
  if (tab.view) tab.view.webContents.close();
  tabs.splice(index, 1);
  if (!tabs.length) addTab();
  else if (activeId === id) selectTab(tabs[Math.min(index, tabs.length - 1)].id);
  publish();
}
function restoreTab() { const last = closedTabs.shift(); if (last) addTab(last.url); publish(); }
function cycleTab(direction) { const i = tabs.findIndex(t => t.id === activeId); if (i >= 0 && tabs.length > 1) selectTab(tabs[(i + direction + tabs.length) % tabs.length].id); }
function duplicateTab(id) { const t = tabs.find(x => x.id === Number(id)); if (t) addTab(t.url); }
function togglePin(id) { const t = tabs.find(x => x.id === Number(id)); if (t) { t.pinned = !t.pinned; publish(); } }
function sendKeyCommand(command) {
  const tab = currentTab();
  if (!tab) return;
  if (command === 'back' && tab.view?.webContents.canGoBack()) tab.view.webContents.goBack();
  if (command === 'forward' && tab.view?.webContents.canGoForward()) tab.view.webContents.goForward();
  if (command === 'reload' && tab.view) tab.view.webContents.reload();
  if (command === 'home') navigate(tab, START_PAGE);
  publish();
}
function setTheme(value) { theme = value === 'light' ? 'light' : 'dark'; saveData(); publish(); }
function toggleBookmark() {
  const tab = currentTab();
  if (!tab || tab.url === START_PAGE) return;
  const index = bookmarks.findIndex(b => b.url === tab.url);
  if (index >= 0) bookmarks.splice(index, 1);
  else bookmarks.unshift({ url: tab.url, title: tab.title });
  bookmarks = bookmarks.slice(0, 200);
  saveData(); publish();
}
function handleCommand(command, payload) {
  const tab = currentTab();
  switch (command) {
    case 'ready': return summarize();
    case 'new-tab': addTab(payload); break;
    case 'select-tab': selectTab(Number(payload)); break;
    case 'close-tab': closeTab(Number(payload)); break;
    case 'restore-tab': restoreTab(); break;
    case 'duplicate-tab': duplicateTab(payload); break;
    case 'pin-tab': togglePin(payload); break;
    case 'cycle-tab': cycleTab(Number(payload) || 1); break;
    case 'tab-index': { const i = Number(payload); if (tabs[i]) selectTab(tabs[i].id); break; }
    case 'navigate': if (tab) navigate(tab, payload); break;
    case 'back': case 'forward': case 'reload': case 'home': sendKeyCommand(command); break;
    case 'theme': setTheme(payload); break;
    case 'search-engine': if (Object.hasOwn(SEARCH_ENGINES, payload)) { searchEngine = payload; saveData(); publish(); } break;
    case 'panel-open': panelOpen = Boolean(payload); resize(); publish(); break;
    case 'open-download': { const item = downloads.find(d => d.id === payload); if (item?.status === 'completed' && item.path && fs.existsSync(item.path)) shell.openPath(item.path); break; }
    case 'show-download': { const item = downloads.find(d => d.id === payload); if (item?.status === 'completed' && item.path && fs.existsSync(item.path)) shell.showItemInFolder(item.path); break; }
    case 'cancel-download': { const item = activeDownloads.get(payload); if (item && !item.isDestroyed()) item.cancel(); break; }
    case 'bookmark': toggleBookmark(); break;
    case 'open-bookmark': if (tab) navigate(tab, payload); break;
    case 'remove-bookmark': bookmarks = bookmarks.filter(b => b.url !== payload); saveData(); publish(); break;
    case 'clear-history': history = []; saveData(); publish(); break;
    case 'minimize': win.minimize(); break;
    case 'maximize': if (win.isMaximized()) win.unmaximize(); else win.maximize(); break;
    case 'close': win.close(); break;
  }
  return summarize();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 850, minWidth: 780, minHeight: 550, backgroundColor: '#081810',
    frame: false, title: 'Namek Browser',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  win.loadFile('index.html');
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    if (input.shift && input.key.toLowerCase() === 't') { event.preventDefault(); restoreTab(); }
  });
  win.on('resize', resize);
  win.on('enter-full-screen', resize);
  win.on('leave-full-screen', resize);
  win.on('maximize', publish);
  win.on('unmaximize', publish);
  win.on('closed', () => { win = null; });
  addTab();
}
app.whenReady().then(() => {
  loadData();
  const webSession = session.fromPartition('persist:namek-web');
  webSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  webSession.setPermissionCheckHandler(() => false);
  webSession.on('will-download', (_event, item) => {
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const entry = { id, name: item.getFilename(), status: 'downloading', progress: 0, received: 0, total: item.getTotalBytes(), path: '', at: Date.now() };
    downloads.unshift(entry);
    downloads = downloads.slice(0, 30);
    activeDownloads.set(id, item);
    item.on('updated', () => { entry.received = item.getReceivedBytes(); entry.total = item.getTotalBytes(); entry.progress = entry.total > 0 ? Math.round(100 * entry.received / entry.total) : null; entry.status = item.isPaused() ? 'paused' : 'downloading'; publish(); });
    item.on('done', (_e, status) => { entry.status = status; entry.path = status === 'completed' ? item.getSavePath() : ''; entry.progress = status === 'completed' ? 100 : entry.progress; activeDownloads.delete(id); publish(); });
    publish();
  });
  ipcMain.handle('namek:command', (_event, req) => {
    if (_event.sender !== win?.webContents) return null;
    return handleCommand(req?.command, req?.payload);
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
