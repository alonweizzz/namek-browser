const $ = (selector) => document.querySelector(selector);
const api = window.namek;
let state = { tabs: [], activeId: null, bookmarks: [], history: [], downloads: [], theme: 'dark' };
let panelSection = 'bookmarks';
let addressEditing = false;
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
    const button = el('button', 'tab' + (tab.id === state.activeId ? ' active' : ''));
    button.title = tab.title;
    const mark = el('span', '', tab.loading ? '◌' : '✦');
    mark.style.color = 'var(--accent)';
    const text = el('span', 'tab-label', tab.title || 'New Tab');
    const close = el('span', 'tab-close', '×');
    close.title = 'Close tab';
    close.addEventListener('click', (event) => { event.stopPropagation(); send('close-tab', tab.id); });
    button.append(mark, text, close);
    button.addEventListener('click', () => send('select-tab', tab.id));
    host.append(button);
  }
}
function renderPanel() {
  const host = $('#panel-items'); host.replaceChildren();
  const items = state[panelSection] || [];
  $('#clear-history').classList.toggle('hidden', panelSection !== 'history' || !items.length);
  if (!items.length) { host.append(el('p', 'empty', panelSection === 'bookmarks' ? 'No capsules collected yet. Bookmark a page with ☆.' : 'Nothing here yet.')); return; }
  for (const item of items) {
    const row = el('div', 'panel-item');
    if (panelSection === 'downloads') {
      row.append(el('span', '', item.name + ' · ' + item.status));
    } else {
      const link = el('button', '', item.title || item.url);
      link.title = item.url;
      link.addEventListener('click', () => { send('open-bookmark', item.url); $('#side-panel').classList.add('hidden'); });
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
$('#panel-toggle').addEventListener('click', () => $('#side-panel').classList.toggle('hidden'));
$('#panel-close').addEventListener('click', () => $('#side-panel').classList.add('hidden'));
document.querySelectorAll('[data-section]').forEach(btn => btn.addEventListener('click', () => {
  panelSection = btn.dataset.section;
  document.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b === btn));
  renderPanel();
}));
$('#clear-history').addEventListener('click', () => send('clear-history'));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') { event.preventDefault(); $('#address').focus(); }
  if (event.ctrlKey && event.key.toLowerCase() === 't') { event.preventDefault(); send('new-tab'); }
  if (event.ctrlKey && event.key.toLowerCase() === 'w') { event.preventDefault(); send('close-tab', state.activeId); }
  if (event.ctrlKey && event.key.toLowerCase() === 'd') { event.preventDefault(); send('bookmark'); }
  if (event.key === 'F5') { event.preventDefault(); send('reload'); }
  if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); send('back'); }
  if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); send('forward'); }
  if (event.key === 'Escape') $('#side-panel').classList.add('hidden');
});
api.onState(render);
send('ready').then(render);
