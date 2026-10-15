const $ = (selector) => document.querySelector(selector);
const api = window.namek;
let state = { tabs: [], activeId: null, bookmarks: [], history: [], downloads: [], theme: 'dark' };
let panelSection = 'bookmarks';
let addressEditing = false;
let settingsOpen = false;
const translations = {
  en: {kicker:'✦ YOUR GATEWAY TO THE UNIVERSE',headline:'Beyond the <em>ordinary.</em>',subtitle:'New worlds are one search away. Where will your next journey take you?',searchPlaceholder:'Search the universe or enter a destination...',launch:'Launch ↗',portals:'✦ QUICK PORTALS',capsules:'MY CAPSULES',bookmarks:'Bookmarks',history:'History',downloads:'Downloads',settings:'NAMEK SETTINGS',personalize:'Make Namek your own.',engine:'Default search engine',language:'Interface language',background:'Home background',upload:'Upload background image (PNG, JPG, WebP, max 1 MB)',reset:'Reset background',restore:'↶ Restore last closed tab'},
  he: {kicker:'✦ השער שלך ליקום',headline:'מעבר <em>לרגיל.</em>',subtitle:'עולמות חדשים נמצאים במרחק חיפוש אחד. לאן נצא היום?',searchPlaceholder:'חיפוש ביקום או הזנת כתובת...',launch:'צא לדרך ↗',portals:'✦ אתרים מהירים',capsules:'הקפסולות שלי',bookmarks:'מועדפים',history:'היסטוריה',downloads:'הורדות',settings:'הגדרות נאמק',personalize:'התאם את נאמק לטעם שלך.',engine:'מנוע חיפוש ברירת מחדל',language:'שפת הממשק',background:'רקע דף הבית',upload:'העלאת תמונת רקע (PNG, JPG, WebP, עד 1MB)',reset:'איפוס רקע',restore:'↶ שחזור הטאב האחרון'}
};
function applyPreferences() {
  const lang = state.language === 'he' ? 'he' : 'en'; const dict = translations[lang];
  document.documentElement.lang = lang;
  $('#language').value = lang;
  $('#home-background').value = state.homeBackground || 'namek';
  $('#home-screen').dataset.background = state.homeBackground || 'namek';
  $('#home-screen').style.setProperty('--custom-home-image', state.homeBackground === 'custom' && state.customBackground ? 'url("' + state.customBackground + '")' : 'none');
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = dict[node.dataset.i18n] || node.textContent; });
  document.querySelectorAll('[data-i18n-html]').forEach(node => { if (node.dataset.i18nHtml === 'headline') node.innerHTML = dict.headline; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = dict[node.dataset.i18nPlaceholder] || node.placeholder; });
}

function send(command, payload) { return api.call(command, payload); }
function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function renderTabs() {
  const host = $('#tabs'); host.replaceChildren();
  for (const tab of state.tabs) {
    const button = el('button', 'tab' + (tab.id === state.activeId ? ' active' : '') + (tab.pinned ? ' pinned' : ''));
    button.title = tab.title;
    const mark = el('span', '', tab.pinned ? '📌' : tab.loading ? '◌' : '✦');
    mark.style.color = 'var(--accent)';
    const text = el('span', 'tab-label', tab.title || 'New Tab');
    const close = el('span', 'tab-close', tab.pinned ? '●' : '×');
    close.title = 'Close tab';
    close.addEventListener('click', (event) => { event.stopPropagation(); if (!tab.pinned) send('close-tab', tab.id); });
    button.addEventListener('contextmenu', event => { event.preventDefault(); showTabMenu(event.clientX, event.clientY, tab); });
    button.append(mark, text, close);
    button.addEventListener('click', () => send('select-tab', tab.id));
    host.append(button);
  }
}
function showTabMenu(x, y, tab) {
  const menu = $('#tab-menu'); menu.replaceChildren();
  for (const [label, command] of [['Duplicate tab', 'duplicate-tab'], [tab.pinned ? 'Unpin tab' : 'Pin tab', 'pin-tab'], ['Close tab', 'close-tab']]) {
    const b = el('button', '', label); b.disabled = command === 'close-tab' && tab.pinned;
    b.addEventListener('click', () => { send(command, tab.id); menu.classList.add('hidden'); }); menu.append(b);
  }
  menu.style.left = Math.min(x, window.innerWidth - 190) + 'px'; menu.style.top = Math.min(y, window.innerHeight - 155) + 'px'; menu.classList.remove('hidden');
}
function renderPanel() {
  const host = $('#panel-items'); host.replaceChildren();
  const items = state[panelSection] || [];
  $('#clear-history').classList.toggle('hidden', panelSection !== 'history' || !items.length);
  if (!items.length) { host.append(el('p', 'empty', panelSection === 'bookmarks' ? 'No capsules collected yet. Bookmark a page with ☆.' : 'Nothing here yet.')); return; }
  for (const item of items) {
    const row = el('div', 'panel-item');
    if (panelSection === 'downloads') {
      const info = el('div', 'download-info');
      info.append(el('strong', '', item.name));
      info.append(el('small', '', item.status + (item.progress == null ? '' : ' · ' + item.progress + '%')));
      if (item.status === 'downloading' && item.progress != null) { const track = el('div', 'progress-track'); const fill = el('div', 'progress-fill'); fill.style.width = item.progress + '%'; track.append(fill); info.append(track); }
      row.append(info);
      const actions = el('div', 'download-actions');
      if (item.status === 'completed') { for (const [label, command] of [['Open','open-download'],['Folder','show-download']]) { const b = el('button','',label); b.addEventListener('click',()=>send(command,item.id)); actions.append(b); } }
      if (item.status === 'downloading' || item.status === 'paused') { const b = el('button','','Cancel'); b.addEventListener('click',()=>send('cancel-download',item.id)); actions.append(b); }
      row.append(actions);
    } else {
      const link = el('button', '', item.title || item.url);
      link.title = item.url;
      link.addEventListener('click', () => { send('open-bookmark', item.url); setPanel(false); });
      row.append(link);
      if (panelSection === 'bookmarks') {
        const remove = el('button', 'remove', '×');
        remove.title = 'Remove bookmark';
        remove.addEventListener('click', () => send('remove-bookmark', item.url));
        row.append(remove);
      }
    }
    host.append(row);
  }
}
function render(incoming) {
  if (!incoming) return;
  state = incoming;
  const tab = state.tabs.find(t => t.id === state.activeId);
  document.body.dataset.theme = state.theme;
  $('#theme').textContent = state.theme === 'dark' ? '☼' : '☾';
  $('#home-screen').classList.toggle('hidden', !!tab && tab.url !== 'namek://home');
  if (!addressEditing) $('#address').value = !tab || tab.url === 'namek://home' ? '' : tab.url;
  $('#back').disabled = !tab?.canGoBack;
  $('#forward').disabled = !tab?.canGoForward;
  $('#bookmark').textContent = state.bookmarks.some(b => b.url === tab?.url) ? '★' : '☆';
  $('#bookmark').style.color = 'var(--accent)';
  $('#search-engine').value = state.searchEngine || 'google';
  applyPreferences();
  renderTabs();
  renderPanel();
}
$('#new-tab').addEventListener('click', () => send('new-tab'));
$('#back').addEventListener('click', () => send('back'));
$('#forward').addEventListener('click', () => send('forward'));
$('#reload').addEventListener('click', () => send('reload'));
$('#home').addEventListener('click', () => send('home'));
$('#bookmark').addEventListener('click', () => send('bookmark'));
$('#theme').addEventListener('click', () => send('theme', state.theme === 'dark' ? 'light' : 'dark'));
$('#minimize').addEventListener('click', () => send('minimize'));
$('#maximize').addEventListener('click', () => send('maximize'));
$('#close').addEventListener('click', () => send('close'));
$('#address-form').addEventListener('submit', (event) => { event.preventDefault(); addressEditing = false; send('navigate', $('#address').value); $('#address').blur(); });
$('#address').addEventListener('focus', () => { addressEditing = true; $('#address').select(); });
$('#address').addEventListener('blur', () => { addressEditing = false; render(state); });
$('#hero-search').addEventListener('submit', (event) => { event.preventDefault(); send('navigate', $('#hero-query').value); });
document.querySelectorAll('.shortcut').forEach(btn => btn.addEventListener('click', () => send('navigate', btn.dataset.url)));
function setPanel(open) { $('#side-panel').classList.toggle('hidden', !open); send('panel-open', open); }
$('#panel-toggle').addEventListener('click', () => setPanel($('#side-panel').classList.contains('hidden')));
$('#panel-close').addEventListener('click', () => setPanel(false));
$('#settings-toggle').addEventListener('click', () => { settingsOpen = !settingsOpen; $('#settings-panel').classList.toggle('hidden', !settingsOpen); });
$('#settings-close').addEventListener('click', () => { settingsOpen = false; $('#settings-panel').classList.add('hidden'); });
$('#search-engine').addEventListener('change', e => send('search-engine', e.target.value));
$('#language').addEventListener('change', e => send('language', e.target.value));
$('#home-background').addEventListener('change', e => send('home-background', e.target.value));
$('#reset-background').addEventListener('click', () => { $('#background-file').value = ''; $('#background-error').textContent = ''; send('reset-background'); });
$('#background-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  const error = $('#background-error'); error.textContent = '';
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1000000) { error.textContent = 'Please choose a PNG, JPG or WebP image under 1 MB.'; return; }
  const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') send('custom-background', reader.result); }; reader.onerror = () => { error.textContent = 'Could not read image.'; }; reader.readAsDataURL(file);
});
$('#restore-tab').addEventListener('click', () => send('restore-tab'));
document.addEventListener('click', event => { if (!event.target.closest('#tab-menu')) $('#tab-menu').classList.add('hidden'); });
api.onFocusAddress?.(() => $('#address').focus());
document.querySelectorAll('[data-section]').forEach(btn => btn.addEventListener('click', () => {
  panelSection = btn.dataset.section;
  document.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b === btn));
  renderPanel();
}));
$('#clear-history').addEventListener('click', () => send('clear-history'));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); $('#address').focus(); }
  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); send('new-tab'); }
  if (event.ctrlKey && event.key.toLowerCase() === 'w') { event.preventDefault(); send('close-tab', state.activeId); }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 't') { event.preventDefault(); send('restore-tab'); }
  if (event.ctrlKey && event.key === 'Tab') { event.preventDefault(); send('cycle-tab', event.shiftKey ? -1 : 1); }
  if (event.ctrlKey && /^[1-9]$/.test(event.key)) { event.preventDefault(); send('tab-index', event.key === '9' ? state.tabs.length - 1 : Number(event.key) - 1); }
  if (event.ctrlKey && event.key.toLowerCase() === 'd') { event.preventDefault(); send('bookmark'); }
  if (event.key === 'F5') { event.preventDefault(); send('reload'); }
  if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); send('back'); }
  if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); send('forward'); }
  if (event.key === 'Escape') { setPanel(false); $('#settings-panel').classList.add('hidden'); $('#tab-menu').classList.add('hidden'); }
});
api.onState(render);
send('ready').then(render);
