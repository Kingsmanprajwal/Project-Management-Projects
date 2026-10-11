import { createStore, COLLECTIONS } from './store.js';

/* ═════════════════════════════ Helpers ═════════════════════════════ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysLeft = (s) => Math.round((parseISO(s) - parseISO(todayISO())) / 86400000);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (s) => { if (!s) return ''; const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const fmtDateTime = (s) => { if (!s) return ''; const d = new Date(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const timeAgo = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const initials = (n) => (n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const stripHtml = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent || ''; };

// Allow-list HTML sanitizer for note bodies written by other team members.
const ALLOWED_TAGS = new Set(['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'span', 'hr']);
function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const walk = (node) => {
    [...node.childNodes].forEach((ch) => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) return ch.remove();
      const tag = ch.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'img', 'video', 'audio', 'form'].includes(tag)) return ch.remove();
        walk(ch);
        return ch.replaceWith(...ch.childNodes);
      }
      [...ch.attributes].forEach((a) => {
        const n = a.name.toLowerCase();
        const ok = (tag === 'a' && n === 'href' && /^(https?:|mailto:)/i.test(a.value.trim())) ||
          (n === 'class' && /^(checklist|checked)$/.test(a.value));
        if (!ok) ch.removeAttribute(a.name);
      });
      if (tag === 'a') { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
      walk(ch);
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  notes: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h8M9 17h6"/>',
  docs: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ideas: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  tracker: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  assign: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 14v4M10 16h4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4A8 8 0 1 1 21 12z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
  file: '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ═════════════════════════════ State ═════════════════════════════ */
const S = {
  user: null, ws: null, notes: [], docs: [], tasks: [], people: [],
  sessionKey: undefined, unsubs: [],
  calMonth: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
  selDate: todayISO(),
  ideasView: localGet('ideasView', 'list'), ideasFilter: 'all', ideasStatus: 'open',
  assignTab: 'me', noteSearch: '', docSearch: '', docFolder: 'All',
};
let store;
let installPrompt = null;

function localGet(k, d) { try { return localStorage.getItem('tn-ui:' + k) ?? d; } catch { return d; } }
function localSet(k, v) { try { localStorage.setItem('tn-ui:' + k, v); } catch { /* ignore */ } }

const NAV = [
  ['home', 'Home', 'home', 'Home'],
  ['notes', 'Notes', 'notes', 'Notes'],
  ['docs', 'Documents', 'docs', 'Docs'],
  ['ideas', 'Ideas & To-Do', 'ideas', 'To-Do'],
  ['tracker', 'Deadline Tracker', 'tracker', 'Deadlines'],
  ['assign', 'Task Assigner', 'assign', 'Assign'],
];

/* ═════════════════════════════ UI primitives ═════════════════════════════ */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('hide'), 3500);
  setTimeout(() => el.remove(), 4000);
}
const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email. Create an account first.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'That email address is not valid.',
  'auth/network-request-failed': 'No internet connection.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
  'auth/unauthorized-domain': 'This website is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.',
  'permission-denied': 'You do not have permission to do that.',
};
function fail(err) {
  console.error(err);
  toast(AUTH_ERRORS[err?.code] || String(err?.message || err).replace(/^Firebase:\s*/, ''), 'error');
}

function openModal(html, { onSubmit, onOpen, wide } = {}) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
  $$('[data-close]', root).forEach((b) => b.addEventListener('click', closeModal));
  const form = $('form', root);
  if (form && onSubmit) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      try { if ((await onSubmit(data, form)) !== false) closeModal(); } catch (err) { fail(err); }
    });
  }
  onOpen?.(root);
  if (!root.contains(document.activeElement)) $('input:not([type=hidden]),textarea,select', root)?.focus();
}
function closeModal() { $('#modal-root').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function confirmDialog(msg, okLabel = 'Delete') {
  return new Promise((resolve) => {
    openModal(`<h3>${esc(msg)}</h3><div class="modal-actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn danger" id="confirm-ok">${esc(okLabel)}</button></div>`, {
      onOpen: (root) => {
        $('#confirm-ok', root).onclick = () => { closeModal(); resolve(true); };
        $$('[data-close]', root).forEach((b) => b.addEventListener('click', () => resolve(false)));
      },
    });
  });
}

/* ═════════════════════════════ People / assignees ═════════════════════════════ */
function members() {
  const m = S.ws?.members || {};
  return Object.entries(m).map(([uid, v]) => ({ id: uid, name: v.name, email: v.email || '', isUser: true }));
}
function assignees() {
  const list = members();
  S.people.forEach((p) => list.push({ id: 'p:' + p.id, name: p.name, email: p.email || '', phone: p.phone || '', isUser: false }));
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
const findAssignee = (id) => assignees().find((a) => a.id === id);

/* ═════════════════════════════ Tasks helpers ═════════════════════════════ */
const PRIORITY = { high: 'High', medium: 'Medium', low: 'Low' };
const STATUS = { todo: 'To do', doing: 'In progress', done: 'Done' };

function dueInfo(t) {
  if (!t.dueDate) return { label: 'No deadline', cls: 'muted', n: Infinity };
  if (t.status === 'done') return { label: 'Completed', cls: 'ok', n: daysLeft(t.dueDate) };
  const n = daysLeft(t.dueDate);
  if (n < 0) return { label: `${-n} day${n === -1 ? '' : 's'} overdue`, cls: 'danger', n };
  if (n === 0) return { label: 'Due today', cls: 'warn', n };
  if (n === 1) return { label: '1 day left', cls: 'warn', n };
  if (n <= 3) return { label: `${n} days left`, cls: 'warn', n };
  return { label: `${n} days left`, cls: 'info', n };
}
const dueBadge = (t) => { const d = dueInfo(t); return `<span class="badge ${d.cls}">${esc(d.label)}</span>`; };
const sortByDue = (a, b) => (a.dueDate || '9999') .localeCompare(b.dueDate || '9999') || (a.createdAt - b.createdAt);
const openTasks = () => S.tasks.filter((t) => t.status !== 'done');

function taskRow(t, { showAssignee = true, actions = false } = {}) {
  const a = t.assigneeName ? `<span class="chip" title="Assigned to">${esc(initials(t.assigneeName))}<span>${esc(t.assigneeName)}</span></span>` : '';
  return `<div class="task-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
    <button class="check ${t.status === 'done' ? 'on' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="Mark done">${icon('check')}</button>
    <div class="task-main" data-action="edit-task" data-id="${t.id}">
      <div class="task-title">${t.type === 'idea' ? '<span class="tag idea">Idea</span>' : ''}${esc(t.title)}</div>
      <div class="task-meta">
        ${dueBadge(t)}
        ${t.dueDate ? `<span>${icon('tracker', 'sm')} ${fmtDate(t.dueDate)}</span>` : ''}
        ${t.priority ? `<span class="prio ${t.priority}">${PRIORITY[t.priority]}</span>` : ''}
        ${t.status === 'doing' ? '<span class="tag">In progress</span>' : ''}
        ${t.remindAt ? `<span title="Reminder">${icon('bell', 'sm')} ${fmtDateTime(t.remindAt)}</span>` : ''}
        ${showAssignee ? a : ''}
      </div>
    </div>
    ${actions ? reminderActions(t) : ''}
  </div>`;
}
function reminderActions(t) {
  return `<div class="row-actions">
    <button class="icon-btn" data-action="mail" data-id="${t.id}" title="Send reminder by email">${icon('mail')}</button>
    <button class="icon-btn" data-action="wa" data-id="${t.id}" title="Send reminder on WhatsApp">${icon('chat')}</button>
    <button class="icon-btn" data-action="gcal" data-id="${t.id}" title="Add to Google Calendar">${icon('cal')}</button>
    <button class="icon-btn" data-action="ics" data-id="${t.id}" title="Download calendar reminder (.ics)">${icon('download')}</button>
  </div>`;
}

function openTaskModal(task = null, defaults = {}) {
  const t = { type: 'task', status: 'todo', priority: 'medium', ...defaults, ...(task || {}) };
  const opts = assignees().map((a) => `<option value="${esc(a.id)}" ${a.id === t.assigneeId ? 'selected' : ''}>${esc(a.name)}${a.id === S.user.uid ? ' (me)' : ''}</option>`).join('');
  openModal(`
    <form>
      <div class="modal-head"><h3>${task ? 'Edit' : 'New'} ${t.type === 'idea' ? 'idea' : 'task'}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <label>Title<input name="title" required maxlength="200" value="${esc(t.title)}" placeholder="What needs to be done?" /></label>
      <div class="grid2">
        <label>Type<select name="type"><option value="task" ${t.type === 'task' ? 'selected' : ''}>Task</option><option value="idea" ${t.type === 'idea' ? 'selected' : ''}>Idea</option></select></label>
        <label>Status<select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Deadline<input type="date" name="dueDate" value="${esc(t.dueDate || '')}" /></label>
        <label>Priority<select name="priority">${Object.entries(PRIORITY).map(([k, v]) => `<option value="${k}" ${t.priority === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Assign to<select name="assigneeId"><option value="">— Unassigned —</option>${opts}</select></label>
        <label>Reminder<input type="datetime-local" name="remindAt" value="${esc(t.remindAt || '')}" /></label>
      </div>
      <label>Description<textarea name="description" rows="4" placeholder="Details, links, acceptance criteria…">${esc(t.description || '')}</textarea></label>
      ${task ? `<p class="muted small">Created by ${esc(t.createdByName || 'someone')} · ${timeAgo(t.createdAt)}</p>` : ''}
      <div class="modal-actions">
        ${task ? `<button type="button" class="btn danger ghost" id="del-task">${icon('trash')} Delete</button><span class="spacer"></span>` : ''}
        <button type="button" class="btn" data-close>Cancel</button>
        <button class="btn primary">${task ? 'Save' : 'Create'}</button>
      </div>
    </form>`, {
    onOpen: (root) => {
      $('#del-task', root)?.addEventListener('click', async () => {
        if (await confirmDialog(`Delete "${task.title}"?`)) store.remove('tasks', task.id).catch(fail);
      });
    },
    onSubmit: (d) => saveTask(task, d),
  });
}

function saveTask(task, d) {
  const a = findAssignee(d.assigneeId);
  const data = {
    title: d.title.trim(), type: d.type, status: d.status, priority: d.priority,
    dueDate: d.dueDate || '', remindAt: d.remindAt || '', description: d.description || '',
    assigneeId: a?.id || '', assigneeName: a?.name || '', assigneeEmail: a?.email || '', assigneePhone: a?.phone || '',
  };
  if (!task || task.remindAt !== data.remindAt || task.assigneeId !== data.assigneeId) data.reminded = false;
  if (!task) {
    Object.assign(data, { createdById: S.user.uid, createdByName: S.user.name });
    store.add('tasks', data).catch(fail);
    toast(a && a.id !== S.user.uid ? `Task assigned to ${a.name}` : 'Task created', 'ok');
  } else {
    store.update('tasks', task.id, data).catch(fail);
  }
}

/* ═════════════════════════════ Reminders ═════════════════════════════ */
function reminderText(t) {
  const d = dueInfo(t);
  return `Reminder: "${t.title}"${t.dueDate ? ` is due on ${fmtDate(t.dueDate)} (${d.label})` : ''}.` +
    `${t.description ? `\n\n${t.description}` : ''}\n\nAssigned by ${t.createdByName || S.user.name} via TaskNest.\n${location.href.split('#')[0]}`;
}
const gcalDate = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function gcalUrl(t) {
  let dates;
  if (t.remindAt) { const s = new Date(t.remindAt); dates = `${gcalDate(s)}/${gcalDate(new Date(+s + 30 * 60000))}`; } else if (t.dueDate) { const s = parseISO(t.dueDate); const e = new Date(+s + 86400000); dates = `${toISO(s).replace(/-/g, '')}/${toISO(e).replace(/-/g, '')}`; } else { const s = new Date(); dates = `${gcalDate(s)}/${gcalDate(new Date(+s + 30 * 60000))}`; }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${t.title}${t.dueDate ? ` (due ${fmtDate(t.dueDate)})` : ''}`, dates, details: reminderText(t) });
  if (t.assigneeEmail) p.set('add', t.assigneeEmail);
  return `https://calendar.google.com/calendar/render?${p}`;
}
function icsFor(t) {
  const icsEsc = (s) => String(s).replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TaskNest//EN', 'BEGIN:VEVENT',
    `UID:${t.id}@tasknest`, `DTSTAMP:${gcalDate(new Date())}`];
  if (t.dueDate) {
    const s = parseISO(t.dueDate);
    lines.push(`DTSTART;VALUE=DATE:${toISO(s).replace(/-/g, '')}`, `DTEND;VALUE=DATE:${toISO(new Date(+s + 86400000)).replace(/-/g, '')}`);
  } else {
    const s = t.remindAt ? new Date(t.remindAt) : new Date();
    lines.push(`DTSTART:${gcalDate(s)}`, `DTEND:${gcalDate(new Date(+s + 30 * 60000))}`);
  }
  lines.push(`SUMMARY:${icsEsc(t.title)}`, `DESCRIPTION:${icsEsc(reminderText(t))}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`,
    t.remindAt ? `TRIGGER;VALUE=DATE-TIME:${gcalDate(new Date(t.remindAt))}` : 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
function download(name, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function notify(title, body) {
  toast(`🔔 ${title}: ${body}`, 'info');
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: title + body });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  } catch { /* ignore */ }
}
function isMyReminder(t) {
  if (t.assigneeId === S.user.uid) return true;
  // Contacts without an account and unassigned tasks remind the person who created them.
  return (!t.assigneeId || t.assigneeId.startsWith('p:')) && t.createdById === S.user.uid;
}
function checkReminders() {
  if (!S.user || !S.ws) return;
  const now = Date.now();
  S.tasks.forEach((t) => {
    if (t.status === 'done' || !t.remindAt || t.reminded || !isMyReminder(t)) return;
    if (new Date(t.remindAt).getTime() <= now) {
      const who = t.assigneeId && t.assigneeId !== S.user.uid ? ` (assigned to ${t.assigneeName})` : '';
      notify('Task reminder', `${t.title}${who} — ${dueInfo(t).label}`);
      store.update('tasks', t.id, { reminded: true }).catch(() => {});
    }
  });
}
let dailyShown = false;
function dailySummary() {
  if (dailyShown || !S.tasksLoaded) return;
  dailyShown = true;
  const mine = openTasks().filter((t) => t.dueDate && (t.assigneeId === S.user.uid || !t.assigneeId));
  const over = mine.filter((t) => daysLeft(t.dueDate) < 0).length;
  const today = mine.filter((t) => daysLeft(t.dueDate) === 0).length;
  if (over || today) toast(`You have ${today} task${today === 1 ? '' : 's'} due today${over ? ` and ${over} overdue` : ''}.`, over ? 'error' : 'info');
}

/* ═════════════════════════════ Auth screens ═════════════════════════════ */
function renderAuth(mode = 'signin') {
  const cloud = store.mode === 'cloud';
  $('#app').innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <div class="brand big"><img src="icons/icon.svg" alt="" /> TaskNest</div>
    <p class="muted">Notes, documents, ideas, deadlines and team tasks — on every device.</p>
    ${cloud ? `
      <div class="seg"><button class="${mode === 'signin' ? 'on' : ''}" data-mode="signin">Sign in</button><button class="${mode === 'signup' ? 'on' : ''}" data-mode="signup">Create account</button></div>
      <form id="auth-form">
        ${mode === 'signup' ? '<label>Your name<input name="name" required autocomplete="name" /></label>' : ''}
        <label>Email<input type="email" name="email" required autocomplete="email" /></label>
        <label>Password<input type="password" name="password" required minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" /></label>
        <button class="btn primary block">${mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <div class="or"><span>or</span></div>
      <button class="btn block" id="google">Continue with Google</button>
      ${mode === 'signin' ? '<button class="link-btn" id="forgot">Forgot password?</button>' : ''}
    ` : `
      <form id="auth-form">
        <label>What should we call you?<input name="name" required placeholder="Your name" /></label>
        <button class="btn primary block">Get started</button>
      </form>
      <p class="note small">Running in <b>local mode</b>: your data is saved on this device only. To share with your team across devices, enable cloud sync (see README).</p>
    `}
  </div></div>`;
  $$('[data-mode]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    const btn = $('button.primary', e.target); btn.disabled = true;
    try { await (mode === 'signup' || !cloud ? store.signUp(d) : store.signIn(d)); } catch (err) { fail(err); btn.disabled = false; }
  };
  $('#google')?.addEventListener('click', () => store.signInWithGoogle().catch(fail));
  $('#forgot')?.addEventListener('click', async () => {
    const email = $('input[name=email]').value;
    if (!email) return toast('Enter your email first', 'error');
    await store.resetPassword(email).then(() => toast('Password reset email sent', 'ok')).catch(fail);
  });
}

function renderWorkspaceSetup() {
  const code = new URLSearchParams(location.search).get('join') || '';
  $('#app').innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <div class="brand big"><img src="icons/icon.svg" alt="" /> TaskNest</div>
    <p>Hi <b>${esc(S.user.name)}</b>! Create a team workspace or join one with an invite code.</p>
    <form id="join-form" class="card">
      <h3>Join a team</h3>
      <label>Invite code<input name="code" required value="${esc(code)}" placeholder="Paste the code your teammate shared" /></label>
      <button class="btn primary block">Join team</button>
    </form>
    <form id="create-form" class="card">
      <h3>Create a new team</h3>
      <label>Team name<input name="name" required placeholder="e.g. Marketing team" /></label>
      <button class="btn block">Create workspace</button>
    </form>
    <button class="link-btn" id="signout">Sign out</button>
  </div></div>`;
  $('#join-form').onsubmit = (e) => { e.preventDefault(); store.joinWorkspace(e.target.code.value).then(() => history.replaceState(null, '', location.pathname + '#home')).catch(fail); };
  $('#create-form').onsubmit = (e) => { e.preventDefault(); store.createWorkspace(e.target.name.value.trim()).catch(fail); };
  $('#signout').onclick = () => store.signOut();
}

/* ═════════════════════════════ Shell & routing ═════════════════════════════ */
function renderShell() {
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><img src="icons/icon.svg" alt="" /> <span>TaskNest</span></div>
      <div class="ws-name" title="Workspace">${esc(S.ws?.name || '')}</div>
      <nav>${NAV.map(([r, label, ic]) => `<a href="#${r}" data-route="${r}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>
      <div class="sidebar-foot">
        <button class="nav-btn install-btn" data-action="install" hidden>${icon('download')}<span>Install app</span></button>
        <a href="#settings" data-route="settings">${icon('settings')}<span>Settings</span></a>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="brand mobile-only"><img src="icons/icon.svg" alt="" /> <span>TaskNest</span></div>
        <h1 id="page-title"></h1>
        <div class="top-actions">
          <span class="sync ${store.mode}" title="${store.mode === 'cloud' ? 'Synced with cloud' : 'Saved on this device'}">${store.mode === 'cloud' ? '● Cloud' : '● Local'}</span>
          <button class="btn primary sm" data-action="new-task">${icon('plus')}<span class="hide-sm">New task</span></button>
          <a href="#settings" class="avatar" title="${esc(S.user.name)}">${esc(initials(S.user.name))}</a>
        </div>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav">${NAV.map(([r, , ic, short]) => `<a href="#${r}" data-route="${r}">${icon(ic)}<span>${short}</span></a>`).join('')}</nav>
  </div>`;
  updateInstallButton();
}

function currentRoute() {
  const [r, id] = location.hash.slice(1).split('/');
  return { r: r || 'home', id };
}
const TITLES = { home: 'Home', notes: 'Notes', docs: 'Documents', ideas: 'Ideas & To-Do', tracker: 'Deadline Tracker', assign: 'Task Assigner', settings: 'Settings' };

let lastRoute = '';
function renderView(soft = false) {
  if (!$('#view')) return;
  const { r, id } = currentRoute();
  const routeKey = r + '/' + (id || '');
  if (routeKey !== lastRoute) soft = false;
  lastRoute = routeKey;
  $('#page-title').textContent = TITLES[r] || 'TaskNest';
  $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  document.title = `${TITLES[r] || 'Home'} · TaskNest`;

  if (r === 'notes') return renderNotes(id, soft);

  // Preserve typed input values and focus across soft re-renders.
  const view = $('#view');
  const saved = soft ? $$('input[id],textarea[id],select[id]', view).map((el) => [el.id, el.value]) : [];
  const focusId = soft ? document.activeElement?.id : null;
  const scroll = view.scrollTop;
  const fn = { home: viewHome, docs: viewDocs, ideas: viewIdeas, tracker: viewTracker, assign: viewAssign, settings: viewSettings }[r] || viewHome;
  view.innerHTML = fn();
  if (soft) {
    saved.forEach(([i, v]) => { const el = document.getElementById(i); if (el && el.type !== 'file') el.value = v; });
    if (focusId) document.getElementById(focusId)?.focus();
    view.scrollTop = scroll;
  } else {
    view.scrollTop = 0;
  }
}
let refreshQueued = false;
function refresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  setTimeout(() => { refreshQueued = false; renderView(true); }, 0);
}
window.addEventListener('hashchange', () => renderView());

/* ═════════════════════════════ Home ═════════════════════════════ */
function statCards() {
  const open = openTasks();
  const over = open.filter((t) => t.dueDate && daysLeft(t.dueDate) < 0).length;
  const week = open.filter((t) => t.dueDate && daysLeft(t.dueDate) >= 0 && daysLeft(t.dueDate) <= 7).length;
  const done = S.tasks.length - open.length;
  return `<div class="stats">
    <a class="stat" href="#tracker"><b>${open.length}</b><span>Open tasks</span></a>
    <a class="stat warn" href="#tracker"><b>${week}</b><span>Due in 7 days</span></a>
    <a class="stat danger" href="#tracker"><b>${over}</b><span>Overdue</span></a>
    <a class="stat ok" href="#ideas"><b>${done}</b><span>Completed</span></a>
  </div>`;
}
function viewHome() {
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const upcoming = openTasks().filter((t) => t.dueDate).sort(sortByDue).slice(0, 6);
  const mine = openTasks().filter((t) => t.assigneeId === S.user.uid).sort(sortByDue).slice(0, 5);
  const notes = [...S.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const total = S.tasks.length;
  const pct = total ? Math.round(((total - openTasks().length) / total) * 100) : 0;
  return `
  <section class="hero">
    <div><h2>${greet}, ${esc(S.user.name.split(' ')[0])} 👋</h2><p class="muted">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    <div class="progress-ring" style="--p:${pct}"><span>${pct}%</span><small>done</small></div>
  </section>
  ${statCards()}
  <div class="cols">
    <section class="card">
      <div class="card-head"><h3>Upcoming deadlines</h3><a href="#tracker" class="link">Open tracker →</a></div>
      ${upcoming.length ? upcoming.map((t) => taskRow(t)).join('') : empty('No upcoming deadlines', 'Add a task with a deadline to see it here.')}
    </section>
    <section class="card">
      <div class="card-head"><h3>Assigned to me</h3><a href="#assign" class="link">Task assigner →</a></div>
      ${mine.length ? mine.map((t) => taskRow(t, { showAssignee: false })).join('') : empty('Nothing assigned to you', 'Tasks your team assigns to you show up here.')}
    </section>
  </div>
  <section class="card">
    <div class="card-head"><h3>Recent notes</h3><button class="btn sm" data-action="new-note">${icon('plus')} New note</button></div>
    <div class="note-cards">${notes.length ? notes.map((n) => `<a class="note-card" href="#notes/${n.id}"><b>${esc(n.title || 'Untitled')}</b><p>${esc(stripHtml(n.body).slice(0, 120))}</p><small>${timeAgo(n.updatedAt)}</small></a>`).join('') : empty('No notes yet', 'Capture meeting notes, ideas and plans.')}</div>
  </section>
  ${installCard()}`;
}
function empty(title, sub) { return `<div class="empty"><b>${esc(title)}</b><span>${esc(sub)}</span></div>`; }
function installCard() {
  if (matchMedia('(display-mode: standalone)').matches || localGet('hideInstall', '') === '1') return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<section class="card install-card">
    <div><h3>📲 Install TaskNest on this device</h3>
    <p class="muted">${ios ? 'Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.' : installPrompt ? 'Install the app for quick access, full-screen mode and reminders.' : 'Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.'}</p></div>
    <div class="row">${installPrompt ? `<button class="btn primary" data-action="install">${icon('download')} Install</button>` : ''}<button class="btn ghost sm" data-action="hide-install">Dismiss</button></div>
  </section>`;
}

/* ═════════════════════════════ Notes ═════════════════════════════ */
let noteSaveTimer = null;
let editingNoteId = null;
function renderNotes(id, soft) {
  const view = $('#view');
  const list = S.notes
    .filter((n) => !S.noteSearch || (n.title + ' ' + stripHtml(n.body)).toLowerCase().includes(S.noteSearch.toLowerCase()))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
  const listHtml = list.length ? list.map((n) => `<a href="#notes/${n.id}" class="note-item ${n.id === id ? 'active' : ''}">
      <b>${n.pinned ? '📌 ' : ''}${esc(n.title || 'Untitled')}</b>
      <span>${esc(stripHtml(n.body).slice(0, 70)) || '<i>Empty note</i>'}</span>
      <small>${timeAgo(n.updatedAt)}${n.updatedByName ? ' · ' + esc(n.updatedByName) : ''}</small></a>`).join('')
    : empty(S.noteSearch ? 'No matching notes' : 'No notes yet', S.noteSearch ? 'Try a different search.' : 'Create your first note.');
  const note = S.notes.find((n) => n.id === id);

  if (soft && $('.notes-layout', view)) {
    $('.notes-list-items', view).innerHTML = listHtml;
    const editor = $('#note-body');
    if (note && editor && editingNoteId === id) {
      const focused = editor.contains(document.activeElement) || document.activeElement === $('#note-title');
      if (!focused && !noteSaveTimer) {
        if ($('#note-title').value !== (note.title || '')) $('#note-title').value = note.title || '';
        const clean = sanitize(note.body);
        if (editor.innerHTML !== clean) editor.innerHTML = clean;
      }
      $('#note-meta').textContent = noteMeta(note);
    } else if (id && !note && S.notesLoaded) {
      location.hash = '#notes';
    }
    return;
  }

  editingNoteId = note ? id : null;
  view.innerHTML = `
  <div class="notes-layout ${note ? 'has-note' : ''}">
    <aside class="notes-list">
      <div class="notes-list-head">
        <div class="search">${icon('search')}<input id="note-search" placeholder="Search notes" value="${esc(S.noteSearch)}" /></div>
        <button class="btn primary sm" data-action="new-note">${icon('plus')} New</button>
      </div>
      <div class="notes-list-items">${listHtml}</div>
    </aside>
    <section class="note-editor">
      ${note ? `
        <div class="editor-top">
          <a href="#notes" class="icon-btn mobile-only" aria-label="Back">${icon('back')}</a>
          <span id="note-meta" class="muted small">${esc(noteMeta(note))}</span>
          <span id="save-state" class="muted small"></span>
          <span class="spacer"></span>
          <button class="icon-btn" data-action="pin-note" data-id="${note.id}" title="${note.pinned ? 'Unpin' : 'Pin'}">📌</button>
          <button class="icon-btn" data-action="delete-note" data-id="${note.id}" title="Delete note">${icon('trash')}</button>
        </div>
        <input id="note-title" class="note-title" placeholder="Untitled" value="${esc(note.title || '')}" maxlength="200" />
        <div class="toolbar" role="toolbar">
          <button data-cmd="formatBlock" data-arg="H1" title="Heading 1">H1</button>
          <button data-cmd="formatBlock" data-arg="H2" title="Heading 2">H2</button>
          <button data-cmd="formatBlock" data-arg="P" title="Paragraph">¶</button>
          <button data-cmd="bold" title="Bold"><b>B</b></button>
          <button data-cmd="italic" title="Italic"><i>I</i></button>
          <button data-cmd="underline" title="Underline"><u>U</u></button>
          <button data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
          <button data-cmd="insertUnorderedList" title="Bullet list">• List</button>
          <button data-cmd="insertOrderedList" title="Numbered list">1. List</button>
          <button data-cmd="checklist" title="Checklist">☑ Checklist</button>
          <button data-cmd="formatBlock" data-arg="BLOCKQUOTE" title="Quote">❝</button>
          <button data-cmd="link" title="Link">${icon('link', 'sm')}</button>
          <button data-cmd="to-task" title="Turn selected text into a task">→ Task</button>
        </div>
        <div id="note-body" class="note-body" contenteditable="true" data-placeholder="Start writing… use the toolbar for headings, lists and checklists.">${sanitize(note.body)}</div>
      ` : `<div class="note-empty">${icon('notes', 'xl')}<h3>Select a note or create a new one</h3><p class="muted">Each note has a title and a rich-text page — like Notion.</p><button class="btn primary" data-action="new-note">${icon('plus')} New note</button></div>`}
    </section>
  </div>`;
  if (id && !note && S.notesLoaded) location.hash = '#notes';
  if (note) bindNoteEditor(note);
}
const noteMeta = (n) => `Edited ${timeAgo(n.updatedAt)}${n.updatedByName ? ' by ' + n.updatedByName : ''}`;

function placeCaretAtEnd(el) {
  el.focus();
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

// Caret bookmark as a character offset, so toolbar commands don't lose the cursor position.
function getCaret(el) {
  const sel = getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return null;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(sel.focusNode, sel.focusOffset);
  return r.toString().length;
}
function setCaret(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (offset <= node.length) {
      const r = document.createRange();
      r.setStart(node, offset);
      r.collapse(true);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    offset -= node.length;
  }
  placeCaretAtEnd(el);
}

function bindNoteEditor(note) {
  document.execCommand('defaultParagraphSeparator', false, 'p');
  const title = $('#note-title');
  const body = $('#note-body');
  const state = $('#save-state');
  const save = () => {
    clearTimeout(noteSaveTimer);
    state.textContent = 'Saving…';
    noteSaveTimer = setTimeout(() => {
      noteSaveTimer = null;
      store.update('notes', note.id, { title: title.value.trim(), body: sanitize(body.innerHTML), updatedByName: S.user.name })
        .then(() => { state.textContent = 'Saved'; })
        .catch(fail);
      if (store.mode === 'cloud') state.textContent = 'Saved';
    }, 600);
  };
  title.addEventListener('input', save);
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); } });
  body.addEventListener('input', save);
  body.addEventListener('click', (e) => {
    const li = e.target.closest('ul.checklist > li');
    if (li && e.offsetX < 26) { li.classList.toggle('checked'); if (!li.className) li.removeAttribute('class'); save(); }
  });
  $$('.toolbar button').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));
  $$('.toolbar button').forEach((b) => b.addEventListener('click', () => {
    const { cmd, arg } = b.dataset;
    if (!body.contains(getSelection().anchorNode)) placeCaretAtEnd(body);
    const caret = getSelection().isCollapsed ? getCaret(body) : null;
    if (cmd === 'link') {
      const url = prompt('Link URL (https://…)');
      if (url && /^(https?:|mailto:)/i.test(url)) document.execCommand('createLink', false, url);
    } else if (cmd === 'checklist') {
      document.execCommand('insertUnorderedList');
      const sel = getSelection();
      const ul = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement).closest('ul');
      if (ul && body.contains(ul)) ul.classList.add('checklist');
    } else if (cmd === 'to-task') {
      const text = getSelection().toString().trim();
      return openTaskModal(null, { title: text.slice(0, 200), description: `From note: ${title.value || 'Untitled'}` });
    } else {
      document.execCommand(cmd, false, arg);
    }
    if (caret !== null && /List|formatBlock|checklist/.test(cmd)) setCaret(body, caret);
    save();
  }));
  if (!note.title && !stripHtml(note.body)) title.focus();
}

async function newNote() {
  const id = await store.add('notes', { title: '', body: '', createdByName: S.user.name, updatedByName: S.user.name });
  location.hash = '#notes/' + id;
}

/* ═════════════════════════════ Documents ═════════════════════════════ */
const fileKind = (d) => {
  if (d.kind === 'link') return ['🔗', 'Link'];
  const t = d.mime || '';
  if (t.startsWith('image/')) return ['🖼️', 'Image'];
  if (t.includes('pdf')) return ['📕', 'PDF'];
  if (/sheet|excel|csv/.test(t)) return ['📊', 'Sheet'];
  if (/presentation|powerpoint/.test(t)) return ['📽️', 'Slides'];
  if (/word|document|text/.test(t)) return ['📄', 'Doc'];
  return ['📎', 'File'];
};
function viewDocs() {
  const folders = ['All', ...new Set(S.docs.map((d) => d.folder || 'General'))];
  const q = S.docSearch.toLowerCase();
  const list = S.docs
    .filter((d) => S.docFolder === 'All' || (d.folder || 'General') === S.docFolder)
    .filter((d) => !q || `${d.name} ${d.folder} ${d.description}`.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt);
  return `
  <div class="toolbar-row">
    <div class="search">${icon('search')}<input id="doc-search" placeholder="Search documents" value="${esc(S.docSearch)}" /></div>
    <span class="spacer"></span>
    <button class="btn" data-action="add-link">${icon('link')} Add link</button>
    <button class="btn primary" data-action="upload-doc">${icon('upload')} Upload</button>
    <input type="file" id="file-input" multiple hidden />
  </div>
  <div class="pills">${folders.map((f) => `<button class="pill ${f === S.docFolder ? 'on' : ''}" data-action="doc-folder" data-folder="${esc(f)}">${esc(f)}</button>`).join('')}</div>
  <div class="drop-zone" id="drop-zone">Drag & drop files here · max ${fmtSize(store.maxFileBytes())} per file${store.mode === 'cloud' ? ' · for bigger files add a Google Drive / OneDrive link' : ''}</div>
  <div class="doc-grid">${list.length ? list.map((d) => {
    const [ic, kind] = fileKind(d);
    return `<div class="doc-card">
      <div class="doc-ic">${ic}</div>
      <div class="doc-info"><b title="${esc(d.name)}">${esc(d.name)}</b>
      <small>${kind}${d.size ? ' · ' + fmtSize(d.size) : ''} · ${esc(d.folder || 'General')}</small>
      <small class="muted">${esc(d.uploadedByName || '')} · ${timeAgo(d.createdAt)}</small>
      ${d.description ? `<p>${esc(d.description)}</p>` : ''}</div>
      <div class="doc-actions">
        <button class="btn sm" data-action="open-doc" data-id="${d.id}">Open</button>
        ${d.kind !== 'link' ? `<button class="icon-btn" data-action="dl-doc" data-id="${d.id}" title="Download">${icon('download')}</button>` : ''}
        <button class="icon-btn" data-action="edit-doc" data-id="${d.id}" title="Edit">${icon('edit')}</button>
        <button class="icon-btn" data-action="del-doc" data-id="${d.id}" title="Delete">${icon('trash')}</button>
      </div></div>`;
  }).join('') : empty('No documents', 'Upload files or save links to keep your team documents in one place.')}</div>`;
}
function docForm(d = {}) {
  const folders = [...new Set(S.docs.map((x) => x.folder || 'General'))];
  return `
    <label>Name<input name="name" required value="${esc(d.name || '')}" /></label>
    ${d.kind === 'link' || d.isNewLink ? `<label>URL<input name="url" type="url" required placeholder="https://drive.google.com/…" value="${esc(d.url || '')}" /></label>` : ''}
    <label>Folder<input name="folder" list="folders" value="${esc(d.folder || (S.docFolder !== 'All' ? S.docFolder : 'General'))}" /><datalist id="folders">${folders.map((f) => `<option value="${esc(f)}">`).join('')}</datalist></label>
    <label>Description<textarea name="description" rows="2">${esc(d.description || '')}</textarea></label>`;
}
async function uploadFiles(files) {
  const max = store.maxFileBytes();
  for (const f of files) {
    if (f.size > max) { toast(`${f.name} is larger than ${fmtSize(max)}. Upload it to Google Drive and add it as a link instead.`, 'error'); continue; }
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    try {
      await store.add('docs', { kind: 'file', name: f.name, mime: f.type, size: f.size, data, folder: S.docFolder !== 'All' ? S.docFolder : 'General', description: '', uploadedByName: S.user.name });
      toast(`Uploaded ${f.name}`, 'ok');
    } catch (err) { fail(err); }
  }
}
function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function openDoc(d, forceDownload = false) {
  if (d.kind === 'link') { if (/^https?:/i.test(d.url)) window.open(d.url, '_blank', 'noopener'); return; }
  const blob = dataUrlToBlob(d.data);
  const previewable = /^(image\/|application\/pdf|text\/plain)/.test(blob.type);
  if (forceDownload || !previewable) return download(d.name, blob);
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) download(d.name, blob);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ═════════════════════════════ Calendar ═════════════════════════════ */
function calendar(tasks, { compact = false } = {}) {
  const { y, m } = S.calMonth;
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7)); // Monday first
  const byDate = {};
  tasks.forEach((t) => { if (t.dueDate) (byDate[t.dueDate] ||= []).push(t); });
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = toISO(d);
    const items = (byDate[iso] || []).sort((a, b) => (a.status === 'done') - (b.status === 'done'));
    const cls = [d.getMonth() !== m ? 'other' : '', iso === today ? 'today' : '', iso === S.selDate ? 'sel' : ''].join(' ');
    cells += `<button class="cal-cell ${cls}" data-action="cal-day" data-date="${iso}">
      <span class="cal-num">${d.getDate()}</span>
      ${compact ? (items.length ? `<span class="dots">${items.slice(0, 4).map((t) => `<i class="dot ${dueInfo(t).cls}"></i>`).join('')}</span>` : '')
        : `<span class="cal-items">${items.slice(0, 3).map((t) => `<span class="cal-item ${dueInfo(t).cls} ${t.status === 'done' ? 'done' : ''}">${esc(t.title)}</span>`).join('')}${items.length > 3 ? `<span class="more">+${items.length - 3} more</span>` : ''}</span>`}
    </button>`;
  }
  return `<div class="calendar ${compact ? 'compact' : ''}">
    <div class="cal-head">
      <button class="icon-btn" data-action="cal-prev" aria-label="Previous month">${icon('back')}</button>
      <h3>${MONTHS[m]} ${y}</h3>
      <button class="icon-btn" data-action="cal-next" aria-label="Next month">${icon('next')}</button>
      <button class="btn sm" data-action="cal-today">Today</button>
    </div>
    <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
  </div>`;
}

/* ═════════════════════════════ Ideas & To-Do ═════════════════════════════ */
function filteredIdeas() {
  return S.tasks.filter((t) => (S.ideasFilter === 'all' || t.type === S.ideasFilter))
    .filter((t) => S.ideasStatus === 'all' || (S.ideasStatus === 'open' ? t.status !== 'done' : t.status === 'done'));
}
function viewIdeas() {
  const tasks = filteredIdeas();
  const seg = (key, val, label) => `<button class="${S[key] === val ? 'on' : ''}" data-action="set" data-key="${key}" data-val="${val}">${label}</button>`;
  let body;
  if (S.ideasView === 'board') {
    const all = S.tasks.filter((t) => S.ideasFilter === 'all' || t.type === S.ideasFilter);
    body = `<div class="board">${Object.entries(STATUS).map(([k, label]) => {
      const col = all.filter((t) => (t.status || 'todo') === k).sort(sortByDue);
      return `<div class="board-col"><div class="board-head"><b>${label}</b><span class="count">${col.length}</span></div>
        ${col.map((t) => `<div class="board-card" data-action="edit-task" data-id="${t.id}">
          <div class="task-title">${t.type === 'idea' ? '<span class="tag idea">Idea</span>' : ''}${esc(t.title)}</div>
          <div class="task-meta">${dueBadge(t)}${t.assigneeName ? `<span class="chip">${esc(initials(t.assigneeName))}<span>${esc(t.assigneeName)}</span></span>` : ''}</div>
          <div class="move">${k !== 'todo' ? `<button class="icon-btn sm" data-action="move-task" data-id="${t.id}" data-dir="-1" title="Move left">${icon('back')}</button>` : '<span></span>'}
          ${k !== 'done' ? `<button class="icon-btn sm" data-action="move-task" data-id="${t.id}" data-dir="1" title="Move right">${icon('next')}</button>` : ''}</div>
        </div>`).join('') || '<div class="muted small pad">Nothing here</div>'}</div>`;
    }).join('')}</div>`;
  } else if (S.ideasView === 'calendar') {
    const day = tasks.filter((t) => t.dueDate === S.selDate).sort(sortByDue);
    body = `<div class="cal-layout">${calendar(tasks)}
      <section class="card"><div class="card-head"><h3>${fmtDate(S.selDate)}</h3><button class="btn sm" data-action="new-task" data-date="${S.selDate}">${icon('plus')} Add</button></div>
      ${day.length ? day.map((t) => taskRow(t)).join('') : empty('Nothing due', 'Click + Add to schedule something on this day.')}</section></div>`;
  } else {
    const sorted = tasks.sort(sortByDue);
    body = `<section class="card list-card">${sorted.length ? sorted.map((t) => taskRow(t)).join('') : empty('Your list is empty', 'Type an idea or task above and press Enter.')}</section>`;
  }
  return `
  <form class="quick-add" data-form="quick-add">
    <select id="qa-type" aria-label="Type"><option value="idea">💡 Idea</option><option value="task">✅ Task</option></select>
    <input id="qa-title" placeholder="Add an idea or to-do… (press Enter)" maxlength="200" />
    <input id="qa-date" type="date" title="Deadline" />
    <button class="btn primary">${icon('plus')}<span class="hide-sm">Add</span></button>
  </form>
  <div class="filters">
    <div class="seg">${seg('ideasView', 'list', 'List')}${seg('ideasView', 'board', 'Board')}${seg('ideasView', 'calendar', 'Calendar')}</div>
    <div class="seg">${seg('ideasFilter', 'all', 'All')}${seg('ideasFilter', 'idea', 'Ideas')}${seg('ideasFilter', 'task', 'Tasks')}</div>
    ${S.ideasView !== 'board' ? `<div class="seg">${seg('ideasStatus', 'open', 'Open')}${seg('ideasStatus', 'done', 'Done')}${seg('ideasStatus', 'all', 'All')}</div>` : ''}
  </div>
  ${body}`;
}

/* ═════════════════════════════ Deadline Tracker ═════════════════════════════ */
function viewTracker() {
  const open = openTasks().filter((t) => t.dueDate);
  const groups = [
    ['Overdue', open.filter((t) => daysLeft(t.dueDate) < 0), 'danger'],
    ['Due today', open.filter((t) => daysLeft(t.dueDate) === 0), 'warn'],
    ['Next 7 days', open.filter((t) => daysLeft(t.dueDate) > 0 && daysLeft(t.dueDate) <= 7), 'warn'],
    ['Later', open.filter((t) => daysLeft(t.dueDate) > 7), 'info'],
  ];
  const noDate = openTasks().filter((t) => !t.dueDate);
  const day = S.tasks.filter((t) => t.dueDate === S.selDate).sort(sortByDue);
  return `
  ${statCards()}
  <div class="tracker">
    <div class="tracker-left">
      ${calendar(S.tasks)}
      <section class="card">
        <div class="card-head"><h3>${S.selDate === todayISO() ? 'Today' : fmtDate(S.selDate)}</h3><button class="btn sm" data-action="new-task" data-date="${S.selDate}">${icon('plus')} Add on this day</button></div>
        ${day.length ? day.map((t) => taskRow(t)).join('') : empty('No deadlines on this day', 'Pick another day or add a task.')}
      </section>
    </div>
    <div class="tracker-right">
      <section class="card">
        <div class="card-head"><h3>Deadline countdown</h3></div>
        ${groups.map(([label, list, cls]) => list.length ? `<div class="group"><div class="group-head ${cls}">${label} <span class="count">${list.length}</span></div>
          ${list.sort(sortByDue).map((t) => countdownRow(t)).join('')}</div>` : '').join('') || empty('No deadlines', 'Tasks with a deadline appear here with the number of days left.')}
      </section>
      ${noDate.length ? `<section class="card"><div class="card-head"><h3>To-do without deadline</h3><span class="count">${noDate.length}</span></div>${noDate.map((t) => taskRow(t)).join('')}</section>` : ''}
    </div>
  </div>`;
}
function countdownRow(t) {
  const d = dueInfo(t);
  const total = Math.max(1, Math.round((parseISO(t.dueDate) - new Date(new Date(t.createdAt).toDateString())) / 86400000));
  const used = Math.min(100, Math.max(0, Math.round(((total - Math.max(d.n, 0)) / total) * 100)));
  return `<div class="countdown" data-action="edit-task" data-id="${t.id}">
    <div class="cd-num ${d.cls}"><b>${d.n < 0 ? -d.n : d.n}</b><small>${d.n < 0 ? 'days late' : d.n === 1 ? 'day left' : d.n === 0 ? 'today' : 'days left'}</small></div>
    <div class="cd-body"><div class="task-title">${esc(t.title)}</div>
      <div class="task-meta"><span>${fmtDate(t.dueDate)}</span>${t.assigneeName ? `<span class="chip">${esc(initials(t.assigneeName))}<span>${esc(t.assigneeName)}</span></span>` : ''}${t.priority ? `<span class="prio ${t.priority}">${PRIORITY[t.priority]}</span>` : ''}</div>
      <div class="bar"><i class="${d.cls}" style="width:${d.n < 0 ? 100 : used}%"></i></div></div>
  </div>`;
}

/* ═════════════════════════════ Task Assigner ═════════════════════════════ */
function viewAssign() {
  const people = assignees();
  const tabs = { me: 'Assigned to me', byme: 'Assigned by me', team: 'All team tasks' };
  let list = S.tasks.filter((t) => t.assigneeId);
  if (S.assignTab === 'me') list = list.filter((t) => t.assigneeId === S.user.uid);
  if (S.assignTab === 'byme') list = list.filter((t) => t.createdById === S.user.uid);
  list.sort((a, b) => (a.status === 'done') - (b.status === 'done') || sortByDue(a, b));
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const load = people.map((p) => ({ ...p, open: openTasks().filter((t) => t.assigneeId === p.id).length, over: openTasks().filter((t) => t.assigneeId === p.id && t.dueDate && daysLeft(t.dueDate) < 0).length }));
  return `
  ${perm !== 'granted' && perm !== 'unsupported' ? `<div class="banner">${icon('bell')}<span>Turn on notifications to get reminder alerts on this device.</span><button class="btn sm primary" data-action="notify-perm">Enable reminders</button></div>` : ''}
  <div class="assign-layout">
    <section class="card">
      <div class="card-head"><h3>Assign a task</h3></div>
      <form data-form="assign" class="assign-form">
        <label>Task<input id="as-title" name="title" required maxlength="200" placeholder="What should be done?" /></label>
        <div class="grid2">
          <label>Assign to<select id="as-who" name="assigneeId" required><option value="">Choose person…</option>${people.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.id === S.user.uid ? ' (me)' : ''}</option>`).join('')}</select></label>
          <label>Priority<select id="as-prio" name="priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label>
          <label>Deadline<input id="as-due" type="date" name="dueDate" required /></label>
          <label>Reminder at<input id="as-remind" type="datetime-local" name="remindAt" /></label>
        </div>
        <label>Notes<textarea id="as-desc" name="description" rows="2" placeholder="Optional details"></textarea></label>
        <div class="row"><button class="btn primary">${icon('assign')} Assign task</button>
        <span class="muted small">The person gets an in-app reminder${store.mode === 'cloud' ? ' on their devices' : ''}. Use ✉️ 💬 📅 to also remind them by email, WhatsApp or calendar.</span></div>
      </form>
    </section>
    <section class="card">
      <div class="card-head"><h3>Team</h3><button class="btn sm" data-action="add-person">${icon('plus')} Add person</button></div>
      ${load.map((p) => `<div class="person">
        <span class="avatar sm">${esc(initials(p.name))}</span>
        <div><b>${esc(p.name)}${p.id === S.user.uid ? ' (me)' : ''}</b><small class="muted">${esc(p.email || (p.isUser ? '' : 'Contact — no app account'))}</small></div>
        <span class="spacer"></span>
        <span class="badge info">${p.open} open</span>${p.over ? `<span class="badge danger">${p.over} late</span>` : ''}
        ${!p.isUser ? `<button class="icon-btn" data-action="del-person" data-id="${esc(p.id.slice(2))}" title="Remove contact">${icon('trash')}</button>` : ''}
      </div>`).join('')}
      ${store.mode === 'cloud' ? `<p class="muted small">Invite teammates from <a href="#settings">Settings</a> so they can log in and receive reminders on their phones.</p>` : '<p class="muted small">Add people you want to assign tasks to. Enable cloud sync so they can use the app too.</p>'}
    </section>
  </div>
  <section class="card">
    <div class="card-head"><div class="seg">${Object.entries(tabs).map(([k, v]) => `<button class="${S.assignTab === k ? 'on' : ''}" data-action="set" data-key="assignTab" data-val="${k}">${v}</button>`).join('')}</div></div>
    ${list.length ? list.map((t) => taskRow(t, { actions: true, showAssignee: S.assignTab !== 'me' })).join('') : empty('No tasks here', 'Assigned tasks will appear in this list.')}
  </section>`;
}
function openPersonModal() {
  openModal(`<form><div class="modal-head"><h3>Add person</h3><button type="button" class="icon-btn" data-close>✕</button></div>
    <label>Name<input name="name" required /></label>
    <label>Email<input name="email" type="email" placeholder="For email reminders" /></label>
    <label>Phone (with country code)<input name="phone" type="tel" placeholder="+91 98765 43210 — for WhatsApp reminders" /></label>
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Add</button></div></form>`, {
    onSubmit: (d) => { store.add('people', { name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim() }).catch(fail); },
  });
}

/* ═════════════════════════════ Settings ═════════════════════════════ */
function viewSettings() {
  const cloud = store.mode === 'cloud';
  const inviteLink = cloud ? `${location.origin}${location.pathname}?join=${S.ws?.id}` : '';
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  return `
  <section class="card narrow">
    <h3>Profile</h3>
    <form data-form="profile" class="row wrap"><input id="set-name" name="name" value="${esc(S.user.name)}" required /><button class="btn">Save name</button></form>
    ${S.user.email ? `<p class="muted small">Signed in as ${esc(S.user.email)}</p>` : ''}
  </section>
  ${cloud ? `<section class="card narrow">
    <h3>Team workspace</h3>
    <form data-form="ws-name" class="row wrap"><input id="set-ws" name="name" value="${esc(S.ws?.name || '')}" required /><button class="btn">Rename</button></form>
    <p>Invite teammates — they open this link, create an account and join automatically:</p>
    <div class="copy-box"><code>${esc(inviteLink)}</code></div>
    <div class="row wrap"><button class="btn" data-action="copy" data-text="${esc(inviteLink)}">${icon('copy')} Copy invite link</button>
    <button class="btn" data-action="share-invite" data-text="${esc(inviteLink)}">${icon('share')} Share</button>
    <button class="btn ghost" data-action="copy" data-text="${esc(S.ws?.id)}">Copy code only</button></div>
    <p class="muted small">Members: ${members().map((m) => esc(m.name)).join(', ')}</p>
    <button class="btn ghost sm" data-action="leave-ws">Switch / join another team</button>
  </section>` : `<section class="card narrow"><h3>Local mode</h3><p class="muted">Your data is stored only in this browser. To use TaskNest with your team on multiple devices, add a Firebase config to <code>app/js/firebase-config.js</code> (see README).</p></section>`}
  <section class="card narrow">
    <h3>Reminders</h3>
    <p class="muted">Notification permission: <b>${perm}</b></p>
    ${perm !== 'granted' && perm !== 'unsupported' ? `<button class="btn primary" data-action="notify-perm">${icon('bell')} Enable notifications</button>` : ''}
    <button class="btn" data-action="test-notify">Send test reminder</button>
  </section>
  <section class="card narrow">
    <h3>Install app</h3>
    <p class="muted">Android/Chrome/Edge: use <b>Install app</b> from the browser menu. iPhone/iPad: Safari → Share → <b>Add to Home Screen</b>.</p>
    ${installPrompt ? `<button class="btn primary" data-action="install">${icon('download')} Install now</button>` : ''}
  </section>
  <section class="card narrow">
    <h3>Backup</h3>
    <div class="row wrap"><button class="btn" data-action="export">${icon('download')} Export data (JSON)</button>
    <label class="btn">${icon('upload')} Import<input type="file" id="import-file" accept="application/json" hidden /></label></div>
  </section>
  <button class="btn danger block-sm" data-action="signout">Sign out</button>`;
}

/* ═════════════════════════════ Event handling ═════════════════════════════ */
const actions = {
  'new-task': (el) => openTaskModal(null, el.dataset.date ? { dueDate: el.dataset.date } : {}),
  'edit-task': (el) => { const t = S.tasks.find((x) => x.id === el.dataset.id); if (t) openTaskModal(t); },
  'toggle-task': (el) => {
    const t = S.tasks.find((x) => x.id === el.dataset.id);
    if (t) store.update('tasks', t.id, { status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : Date.now() }).catch(fail);
  },
  'move-task': (el) => {
    const t = S.tasks.find((x) => x.id === el.dataset.id);
    const order = Object.keys(STATUS);
    const next = order[Math.min(2, Math.max(0, order.indexOf(t.status || 'todo') + Number(el.dataset.dir)))];
    store.update('tasks', t.id, { status: next }).catch(fail);
  },
  set: (el) => { S[el.dataset.key] = el.dataset.val; if (el.dataset.key === 'ideasView') localSet('ideasView', el.dataset.val); renderView(true); },
  'cal-prev': () => { const { y, m } = S.calMonth; S.calMonth = m ? { y, m: m - 1 } : { y: y - 1, m: 11 }; renderView(true); },
  'cal-next': () => { const { y, m } = S.calMonth; S.calMonth = m < 11 ? { y, m: m + 1 } : { y: y + 1, m: 0 }; renderView(true); },
  'cal-today': () => { const d = new Date(); S.calMonth = { y: d.getFullYear(), m: d.getMonth() }; S.selDate = todayISO(); renderView(true); },
  'cal-day': (el) => {
    const d = parseISO(el.dataset.date);
    if (S.selDate === el.dataset.date) return openTaskModal(null, { dueDate: el.dataset.date });
    S.selDate = el.dataset.date; S.calMonth = { y: d.getFullYear(), m: d.getMonth() }; renderView(true);
  },
  'new-note': () => newNote().catch(fail),
  'delete-note': async (el) => {
    const n = S.notes.find((x) => x.id === el.dataset.id);
    if (await confirmDialog(`Delete note "${n?.title || 'Untitled'}"?`)) { location.hash = '#notes'; store.remove('notes', el.dataset.id).catch(fail); }
  },
  'pin-note': (el) => { const n = S.notes.find((x) => x.id === el.dataset.id); store.update('notes', n.id, { pinned: !n.pinned }).catch(fail); },
  'upload-doc': () => $('#file-input').click(),
  'add-link': () => openModal(`<form><div class="modal-head"><h3>Add document link</h3><button type="button" class="icon-btn" data-close>✕</button></div>${docForm({ isNewLink: true })}
    <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, {
    onSubmit: (d) => { store.add('docs', { kind: 'link', name: d.name.trim(), url: d.url.trim(), folder: d.folder.trim() || 'General', description: d.description, uploadedByName: S.user.name }).catch(fail); },
  }),
  'edit-doc': (el) => {
    const doc = S.docs.find((x) => x.id === el.dataset.id);
    openModal(`<form><div class="modal-head"><h3>Edit document</h3><button type="button" class="icon-btn" data-close>✕</button></div>${docForm(doc)}
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, {
      onSubmit: (d) => { store.update('docs', doc.id, { name: d.name.trim(), folder: d.folder.trim() || 'General', description: d.description, ...(d.url ? { url: d.url.trim() } : {}) }).catch(fail); },
    });
  },
  'open-doc': (el) => openDoc(S.docs.find((x) => x.id === el.dataset.id)),
  'dl-doc': (el) => openDoc(S.docs.find((x) => x.id === el.dataset.id), true),
  'del-doc': async (el) => { const d = S.docs.find((x) => x.id === el.dataset.id); if (await confirmDialog(`Delete "${d.name}"?`)) store.remove('docs', d.id).catch(fail); },
  'doc-folder': (el) => { S.docFolder = el.dataset.folder; renderView(true); },
  'add-person': openPersonModal,
  'del-person': async (el) => { if (await confirmDialog('Remove this contact?', 'Remove')) store.remove('people', el.dataset.id).catch(fail); },
  'notify-perm': async () => {
    if (!('Notification' in window)) return toast('Notifications are not supported on this browser. On iPhone, install the app to the Home Screen first.', 'error');
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Reminders enabled' : 'Notifications blocked — enable them in browser settings', p === 'granted' ? 'ok' : 'error');
    renderView(true);
  },
  'test-notify': () => notify('TaskNest', 'Reminders are working 🎉'),
  mail: (el) => {
    const t = S.tasks.find((x) => x.id === el.dataset.id);
    location.href = `mailto:${encodeURIComponent(t.assigneeEmail || '')}?subject=${encodeURIComponent(`Reminder: ${t.title}`)}&body=${encodeURIComponent(reminderText(t))}`;
  },
  wa: (el) => {
    const t = S.tasks.find((x) => x.id === el.dataset.id);
    const phone = (t.assigneePhone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(reminderText(t))}`, '_blank', 'noopener');
  },
  gcal: (el) => window.open(gcalUrl(S.tasks.find((x) => x.id === el.dataset.id)), '_blank', 'noopener'),
  ics: (el) => { const t = S.tasks.find((x) => x.id === el.dataset.id); download(`${t.title.replace(/[^\w-]+/g, '_').slice(0, 40)}.ics`, icsFor(t), 'text/calendar'); },
  copy: (el) => navigator.clipboard.writeText(el.dataset.text).then(() => toast('Copied', 'ok')).catch(() => prompt('Copy this:', el.dataset.text)),
  'share-invite': (el) => {
    const data = { title: 'Join my TaskNest team', text: `Join "${S.ws?.name}" on TaskNest:`, url: el.dataset.text };
    if (navigator.share) navigator.share(data).catch(() => {}); else actions.copy(el);
  },
  'leave-ws': async () => { if (await confirmDialog('Switch to another team? You can rejoin with the invite code.', 'Switch')) store.leaveWorkspace().catch(fail); },
  signout: async () => { if (await confirmDialog('Sign out?', 'Sign out')) store.signOut().catch(fail); },
  install: async () => {
    if (!installPrompt) return toast('Use your browser menu → "Install app" / "Add to Home Screen"', 'info');
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null; updateInstallButton(); renderView(true);
  },
  'hide-install': () => { localSet('hideInstall', '1'); renderView(true); },
  export: () => {
    const data = { exportedAt: new Date().toISOString(), workspace: S.ws?.name, notes: S.notes, docs: S.docs, tasks: S.tasks, people: S.people };
    download(`tasknest-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  if (el.tagName === 'A') e.preventDefault();
  e.stopPropagation();
  try { const r = actions[el.dataset.action](el, e); r?.catch?.(fail); } catch (err) { fail(err); }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const type = form.dataset.form;
  if (type === 'quick-add') {
    const title = $('#qa-title').value.trim();
    if (!title) return;
    store.add('tasks', { title, type: $('#qa-type').value, status: 'todo', priority: 'medium', dueDate: $('#qa-date').value || '', remindAt: '', description: '', assigneeId: '', assigneeName: '', createdById: S.user.uid, createdByName: S.user.name }).catch(fail);
    $('#qa-title').value = ''; $('#qa-date').value = '';
    $('#qa-title').focus();
  } else if (type === 'assign') {
    const d = Object.fromEntries(new FormData(form).entries());
    saveTask(null, { ...d, type: 'task', status: 'todo' });
    form.reset();
  } else if (type === 'profile') {
    store.updateProfile({ name: form.name.value.trim() }).then(() => toast('Saved', 'ok')).catch(fail);
  } else if (type === 'ws-name') {
    store.renameWorkspace(form.name.value.trim()).then(() => toast('Workspace renamed', 'ok')).catch(fail);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'note-search') { S.noteSearch = e.target.value; renderNotes(currentRoute().id, true); }
  if (e.target.id === 'doc-search') { S.docSearch = e.target.value; debouncedRefresh(); }
});
const debouncedRefresh = debounce(refresh, 150);

document.addEventListener('change', async (e) => {
  if (e.target.id === 'file-input') { await uploadFiles([...e.target.files]); e.target.value = ''; }
  if (e.target.id === 'import-file') {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!(await confirmDialog(`Import ${data.notes?.length || 0} notes, ${data.docs?.length || 0} documents and ${data.tasks?.length || 0} tasks?`, 'Import'))) return;
      for (const c of COLLECTIONS) for (const item of data[c] || []) { const { id, createdAt, updatedAt, ...rest } = item; await store.add(c, rest); }
      toast('Import complete', 'ok');
    } catch (err) { fail(err); }
    e.target.value = '';
  }
});

document.addEventListener('dragover', (e) => { const z = e.target.closest?.('#drop-zone, .doc-grid'); if (z) { e.preventDefault(); $('#drop-zone')?.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { if (e.target.id === 'drop-zone') e.target.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  const z = e.target.closest?.('#drop-zone, .doc-grid');
  if (!z) return;
  e.preventDefault(); $('#drop-zone')?.classList.remove('over');
  uploadFiles([...e.dataTransfer.files]);
});

/* ═════════════════════════════ Install / service worker ═════════════════════════════ */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; updateInstallButton(); if (currentRoute().r === 'home') refresh(); });
window.addEventListener('appinstalled', () => { installPrompt = null; updateInstallButton(); toast('TaskNest installed 🎉', 'ok'); });
function updateInstallButton() { $$('.install-btn').forEach((b) => (b.hidden = !installPrompt)); }

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed', err));
  }
}

/* ═════════════════════════════ Data wiring & boot ═════════════════════════════ */
function stopData() {
  S.unsubs.forEach((u) => u?.());
  S.unsubs = [];
  COLLECTIONS.forEach((c) => { S[c] = []; S[c + 'Loaded'] = false; });
  S.ws = null;
  dailyShown = false;
}
function startData() {
  S.unsubs.push(store.watchWorkspace((ws) => {
    const nameChanged = S.ws?.name !== ws.name;
    S.ws = ws;
    if (nameChanged && $('.ws-name')) $('.ws-name').textContent = ws.name;
    refresh();
  }));
  COLLECTIONS.forEach((c) => {
    S.unsubs.push(store.subscribe(c, (items) => {
      S[c] = items; S[c + 'Loaded'] = true;
      if (c === 'tasks') { checkReminders(); dailySummary(); }
      refresh();
    }, (err) => fail(err)));
  });
}

async function boot() {
  registerSW();
  try {
    store = await createStore();
    store.onError = fail;
  } catch (err) {
    $('#app').innerHTML = `<div class="auth-wrap"><div class="auth-card"><h2>Can't connect</h2><p>${esc(err.message)}</p><p class="muted">Check your internet connection and reload.</p><button class="btn primary" onclick="location.reload()">Reload</button></div></div>`;
    return;
  }
  store.onAuth((profile) => {
    const key = profile ? `${profile.uid}|${profile.workspaceId}` : null;
    S.user = profile;
    if (key === S.sessionKey) {
      if (profile && $('.avatar')) { $('.topbar .avatar').textContent = initials(profile.name); refresh(); }
      return;
    }
    S.sessionKey = key;
    stopData();
    lastRoute = '';
    if (!profile) return renderAuth();
    if (!profile.workspaceId) return renderWorkspaceSetup();
    if (new URLSearchParams(location.search).has('join')) history.replaceState(null, '', location.pathname + location.hash);
    startData();
    renderShell();
    renderView();
  });
  setInterval(() => { checkReminders(); if (currentRoute().r !== 'notes') refresh(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
}
boot();
