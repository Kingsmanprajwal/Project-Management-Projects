// Social Content Saver & Smart Collections.
// Personal library of links, social posts, shared text and files, organised into
// collections. Replaces the old team "Documents" section.
import { MAX_FILE_BYTES } from './store.js';

/* ═════════════════════════════ Content detection (pure helpers) ═════════════════════════════ */
export const PLATFORMS = {
  instagram: { label: 'Instagram', emoji: '📸', bg: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)' },
  youtube: { label: 'YouTube', emoji: '▶️', bg: 'linear-gradient(135deg,#e62117,#a50f0a)' },
  facebook: { label: 'Facebook', emoji: '📘', bg: 'linear-gradient(135deg,#1877f2,#0b4fb3)' },
  linkedin: { label: 'LinkedIn', emoji: '💼', bg: 'linear-gradient(135deg,#0a66c2,#06427e)' },
  whatsapp: { label: 'WhatsApp', emoji: '💬', bg: 'linear-gradient(135deg,#25d366,#128c7e)' },
  gdrive: { label: 'Google Drive', emoji: '📁', bg: 'linear-gradient(135deg,#0f9d58,#4285f4)' },
  x: { label: 'X / Twitter', emoji: '𝕏', bg: 'linear-gradient(135deg,#14171a,#3b4148)' },
  web: { label: 'Website', emoji: '🌐', bg: 'linear-gradient(135deg,#2f6fed,#6aa0ff)' },
  device: { label: 'File', emoji: '📎', bg: 'linear-gradient(135deg,#5f6b7a,#8a96a5)' },
  text: { label: 'Text', emoji: '📝', bg: 'linear-gradient(135deg,#8a4fd1,#b88af0)' },
};
export const TYPES = {
  video: ['🎬', 'Video'], post: ['🖼️', 'Post'], article: ['📰', 'Article / link'], note: ['📝', 'Note'],
  pdf: ['📕', 'PDF'], document: ['📄', 'Document'], image: ['🖼️', 'Image'], file: ['📎', 'File'],
};

const URL_RE = /https?:\/\/[^\s<>"'`]+/i;
export function extractUrl(text) {
  const m = String(text || '').match(URL_RE);
  return m ? m[0].replace(/[),.;:!?\]]+$/, '') : '';
}
const host = (url) => {
  try { return new URL(url).hostname.toLowerCase().replace(/^(www|m|mobile|web|music)\./, ''); } catch { return ''; }
};
export function detectPlatform(url) {
  const h = host(url);
  if (!h) return 'web';
  if (/(^|\.)instagram\.com$|^instagr\.am$/.test(h)) return 'instagram';
  if (/(^|\.)youtube\.com$|^youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(h)) return 'youtube';
  if (/(^|\.)facebook\.com$|^fb\.watch$|^fb\.com$|^fb\.me$/.test(h)) return 'facebook';
  if (/(^|\.)linkedin\.com$|^lnkd\.in$/.test(h)) return 'linkedin';
  if (/^wa\.me$|(^|\.)whatsapp\.com$/.test(h)) return 'whatsapp';
  if (/^(drive|docs)\.google\.com$/.test(h)) return 'gdrive';
  if (/^(x|twitter)\.com$|^t\.co$/.test(h)) return 'x';
  return 'web';
}
export function youtubeId(url) {
  try {
    const u = new URL(url);
    const h = host(url);
    let id = '';
    if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
      id = u.searchParams.get('v') || (u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]+)/) || [])[2] || '';
    }
    return /^[\w-]{6,20}$/.test(id) ? id : '';
  } catch { return ''; }
}
export function detectType(url, platform) {
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* ignore */ }
  switch (platform) {
    case 'youtube': return 'video';
    case 'instagram': return /^\/(reel|reels|tv)\//.test(path) ? 'video' : 'post';
    case 'facebook': return /\/(videos|watch|reel|reels)\b/.test(path) || host(url) === 'fb.watch' ? 'video' : 'post';
    case 'linkedin': return /^\/pulse\//.test(path) ? 'article' : 'post';
    case 'x': return 'post';
    case 'gdrive': return /\.pdf$/.test(path) ? 'pdf' : 'document';
    default: return /\.pdf$/.test(path) ? 'pdf' : 'article';
  }
}
export function typeForMime(mime = '', name = '') {
  const n = name.toLowerCase();
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (/word|document|sheet|excel|presentation|powerpoint|text\/|csv|rtf|opendocument/.test(mime) || /\.(docx?|xlsx?|pptx?|txt|csv|rtf|odt|ods|odp)$/.test(n)) return 'document';
  return 'file';
}
// Normalised key used to spot duplicates (ignores tracking params, www., trailing slashes).
export function urlKey(url) {
  const yt = youtubeId(url);
  if (yt) return 'youtube:' + yt;
  try {
    const u = new URL(url.trim());
    [...u.searchParams.keys()].forEach((k) => {
      if (/^(utm_.*|igsh|igshid|si|fbclid|gclid|feature|ref|ref_src|share_id|s|mibextid|rcm)$/i.test(k)) u.searchParams.delete(k);
    });
    const q = u.searchParams.toString();
    return host(url) + u.pathname.replace(/\/+$/, '') + (q ? '?' + q : '');
  } catch { return String(url || '').trim(); }
}
export function defaultTitle(url, platform, type) {
  const p = PLATFORMS[platform]?.label || 'Link';
  if (platform === 'youtube') return /\/shorts\//.test(url) ? 'YouTube Short' : 'YouTube video';
  if (platform === 'instagram') return type === 'video' ? 'Instagram Reel' : 'Instagram post';
  if (platform === 'facebook') return type === 'video' ? 'Facebook video' : 'Facebook post';
  if (platform === 'linkedin') return type === 'article' ? 'LinkedIn article' : 'LinkedIn post';
  if (platform === 'gdrive') return 'Google Drive file';
  if (platform === 'x') return 'Post on X';
  try {
    const u = new URL(url);
    const seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').trim();
    const nice = seg && !/^\d+$/.test(seg) && seg.length > 2 ? seg.charAt(0).toUpperCase() + seg.slice(1) : '';
    return (nice ? `${nice} – ` : '') + host(url);
  } catch { return p; }
}
export function parseTags(s) {
  return [...new Set(String(s || '').split(/[,#\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}
// Only http(s) and inline image data are rendered as thumbnails.
const safeImg = (u) => (/^https:\/\//i.test(u || '') || /^data:image\/(png|jpe?g|webp|gif);/i.test(u || '') ? u : '');

async function fetchWithTimeout(url, ms = 4000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(t); }
}
// Public metadata only. YouTube offers an open oEmbed endpoint; other platforms
// (Instagram, Facebook, LinkedIn) require developer API keys, so they get a fallback card.
export async function fetchMetadata(url, platform) {
  const meta = {};
  const yt = platform === 'youtube' ? youtubeId(url) : '';
  if (yt) meta.thumbnailUrl = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  if (yt) {
    try {
      const res = await fetchWithTimeout(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const j = await res.json();
        if (j.title) meta.title = String(j.title).slice(0, 300);
        if (j.author_name) meta.description = `by ${j.author_name}`;
      }
    } catch { /* fallback to defaults */ }
  }
  meta.ok = !!(meta.title || meta.thumbnailUrl);
  return meta;
}
export async function makeThumbnail(blob, max = 480) {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return ''; }
}

/* ═════════════════════════════ Feature ═════════════════════════════ */
const PAGE = 40;
const COLORS = ['#2f6fed', '#8a4fd1', '#dd2a7b', '#e62117', '#f08c00', '#1f8a4c', '#0a9396', '#5f6b7a'];
const ICONS_LIST = ['📁', '⭐', '🤖', '💻', '💡', '📈', '💰', '✈️', '🍳', '🎓', '🏋️', '🎵', '🎬', '📚', '🛍️', '❤️'];
const SMART = {
  'smart:all': { name: 'All Saved', icon: '🔖', color: '#2f6fed', match: () => true },
  'smart:videos': { name: 'Reels & Videos', icon: '🎬', color: '#e62117', match: (i) => i.contentType === 'video' },
  'smart:links': { name: 'Articles & Links', icon: '📰', color: '#0a66c2', match: (i) => ['article', 'post'].includes(i.contentType) },
  'smart:docs': { name: 'Documents & PDFs', icon: '📄', color: '#5f6b7a', match: (i) => ['pdf', 'document', 'file'].includes(i.contentType) },
  'smart:favorites': { name: 'Favorites', icon: '⭐', color: '#f08c00', match: (i) => i.isFavorite },
};

export function createSaved(ctx) {
  const { S, $, $$, esc, icon, toast, fail, openModal, closeModal, confirmDialog, timeAgo, fmtSize, download, progressToast, empty, refresh, localGet, localSet } = ctx;
  const store = () => ctx.getStore();
  const UI = { view: localGet('savedView', 'grid'), q: '', platform: '', type: '', coll: '', sort: 'newest', limit: PAGE };
  const handledShares = new Set();

  /* ── Data helpers ── */
  const items = () => S.savedItems || [];
  const colls = () => [...(S.collections || [])].sort((a, b) => a.name.localeCompare(b.name));
  const findItem = (id) => items().find((i) => i.id === id);
  const findColl = (id) => (SMART[id] ? { id, ...SMART[id], smart: true } : S.collections.find((c) => c.id === id));
  const inColl = (i, id) => (SMART[id] ? SMART[id].match(i) : (i.collectionIds || []).includes(id));
  const countIn = (id) => items().filter((i) => !i.isArchived && inColl(i, id)).length;

  // Give new users a "Read Later" collection to start with.
  function seedDefaults() {
    if (!S.collectionsLoaded || !S.savedItemsLoaded || S.collections.length || items().length) return;
    const flag = `seeded:${S.user.uid}`;
    if (localGet(flag, '')) return;
    localSet(flag, '1');
    store().addMine('collections', { name: 'Read Later', description: 'Things to read or watch when you have time', icon: '📚', color: '#8a4fd1', coverImageUrl: '' }).catch(fail);
  }

  function filtered(scope, collId) {
    let list = items().filter((i) => (scope === 'archived' ? i.isArchived : !i.isArchived));
    if (scope === 'favorites') list = list.filter((i) => i.isFavorite);
    if (scope === 'collection') list = list.filter((i) => inColl(i, collId));
    if (UI.platform) list = list.filter((i) => i.sourcePlatform === UI.platform);
    if (UI.type) list = list.filter((i) => i.contentType === UI.type);
    if (UI.coll && scope !== 'collection') list = list.filter((i) => inColl(i, UI.coll));
    const words = UI.q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) {
      list = list.filter((i) => {
        const hay = [i.title, i.originalUrl, i.notes, i.description, i.fileName, (i.tags || []).join(' ')].join(' ').toLowerCase();
        return words.every((w) => hay.includes(w.replace(/^#/, '')));
      });
    }
    const by = {
      newest: (a, b) => b.createdAt - a.createdAt,
      oldest: (a, b) => a.createdAt - b.createdAt,
      title: (a, b) => (a.title || '').localeCompare(b.title || ''),
    }[UI.sort];
    return list.sort(by);
  }

  /* ── Rendering ── */
  function tabs(active) {
    const t = [['all', '#saved', 'Saved Content'], ['collections', '#saved/collections', 'Collections'], ['favorites', '#saved/favorites', 'Favorites'], ['archived', '#saved/archived', 'Archived']];
    return `<nav class="sv-tabs" aria-label="Saved content sections">${t.map(([k, href, label]) => `<a href="${href}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  }

  function thumbHtml(i) {
    const p = PLATFORMS[i.sourcePlatform] || PLATFORMS.web;
    const [temoji] = TYPES[i.contentType] || TYPES.file;
    const img = safeImg(i.thumbnailUrl);
    const label = i.fileName || host(i.originalUrl) || p.label;
    return `<div class="sv-fallback" style="background:${p.bg}"><span class="sv-fb-emoji">${i.sourcePlatform === 'device' || i.sourcePlatform === 'text' ? temoji : p.emoji}</span><span class="sv-fb-label">${esc(label)}</span></div>
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback />` : ''}
      ${i.contentType === 'video' ? '<span class="sv-play" aria-hidden="true">▶</span>' : ''}`;
  }

  function cardHtml(i, scope, collId) {
    const p = PLATFORMS[i.sourcePlatform] || PLATFORMS.web;
    const [, tlabel] = TYPES[i.contentType] || TYPES.file;
    const cs = (i.collectionIds || []).map((id) => S.collections.find((c) => c.id === id)).filter(Boolean);
    const where = i.fileName ? `${esc(i.fileName)}${i.fileSize ? ' · ' + fmtSize(i.fileSize) : ''}` : esc(host(i.originalUrl) || '');
    const removable = scope === 'collection' && !SMART[collId];
    return `<article class="sv-card" data-id="${i.id}">
      <button class="sv-thumb" data-action="sv-details" data-id="${i.id}" aria-label="Details for ${esc(i.title)}">${thumbHtml(i)}
        <span class="sv-plat" style="background:${p.bg}">${p.label}</span></button>
      <div class="sv-body">
        <button class="sv-title" data-action="sv-details" data-id="${i.id}">${esc(i.title)}</button>
        <div class="sv-sub">${tlabel}${where ? ' · ' + where : ''}</div>
        ${i.notes ? `<p class="sv-notes">${esc(i.notes)}</p>` : ''}
        ${cs.length || (i.tags || []).length ? `<div class="sv-chips">${cs.map((c) => `<a class="sv-chip" href="#saved/c/${c.id}" style="--c:${esc(c.color || '#2f6fed')}">${esc(c.icon || '📁')} ${esc(c.name)}</a>`).join('')}${(i.tags || []).map((t) => `<span class="sv-tag">#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="sv-foot">
          <small class="muted">${timeAgo(i.createdAt)}${i.importStatus === 'no_preview' ? ' · no preview' : ''}</small>
          <span class="spacer"></span>
          <button class="icon-btn sv-star ${i.isFavorite ? 'on' : ''}" data-action="sv-fav" data-id="${i.id}" title="${i.isFavorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${!!i.isFavorite}">★</button>
          <button class="icon-btn" data-action="sv-open" data-id="${i.id}" title="Open original">${icon('link')}</button>
          ${i.originalUrl ? `<button class="icon-btn" data-action="sv-copy" data-id="${i.id}" title="Copy link">${icon('copy')}</button>` : ''}
          ${removable ? `<button class="icon-btn" data-action="sv-uncollect" data-id="${i.id}" data-coll="${collId}" title="Remove from this collection">✕</button>` : ''}
          <button class="icon-btn" data-action="sv-details" data-id="${i.id}" title="Edit">${icon('edit')}</button>
        </div>
      </div>
    </article>`;
  }

  function toolbar(scope) {
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    return `<div class="sv-toolbar">
      <div class="search">${icon('search')}<input id="sv-search" type="search" placeholder="Search titles, links, notes, #tags" value="${esc(UI.q)}" aria-label="Search saved content" /></div>
      <div class="sv-filters">
        <select id="sv-platform" aria-label="Filter by source">${opt('', 'All sources', UI.platform)}${Object.entries(PLATFORMS).map(([k, p]) => opt(k, p.label, UI.platform)).join('')}</select>
        <select id="sv-type" aria-label="Filter by type">${opt('', 'All types', UI.type)}${Object.entries(TYPES).map(([k, [, l]]) => opt(k, l, UI.type)).join('')}</select>
        ${scope !== 'collection' ? `<select id="sv-coll" aria-label="Filter by collection">${opt('', 'All collections', UI.coll)}${colls().map((c) => opt(c.id, c.name, UI.coll)).join('')}</select>` : ''}
        <select id="sv-sort" aria-label="Sort">${opt('newest', 'Newest first', UI.sort)}${opt('oldest', 'Oldest first', UI.sort)}${opt('title', 'Title A–Z', UI.sort)}</select>
        <div class="seg" role="group" aria-label="Layout"><button class="${UI.view === 'grid' ? 'on' : ''}" data-action="sv-layout" data-val="grid" aria-label="Grid view">▦</button><button class="${UI.view === 'list' ? 'on' : ''}" data-action="sv-layout" data-val="list" aria-label="List view">☰</button></div>
      </div>
    </div>`;
  }

  function library(scope, collId) {
    if (S.savedError) return `<div class="card sv-error"><b>Couldn't load your saved content.</b><p class="muted">${esc(S.savedError)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`;
    if (!S.savedItemsLoaded) return `<div class="sv-grid grid">${'<div class="sv-card skeleton"><div class="sv-thumb"></div><div class="sv-body"><i></i><i></i></div></div>'.repeat(6)}</div>`;
    const list = filtered(scope, collId);
    const filtersOn = UI.q || UI.platform || UI.type || UI.coll;
    const emptyMsg = {
      all: ['Nothing saved yet', 'Tap + Save, or share a link from Instagram, YouTube or WhatsApp to TaskNest.'],
      favorites: ['No favorites yet', 'Tap ★ on any saved item to keep it here.'],
      archived: ['Archive is empty', 'Archived items move here and can be restored any time.'],
      collection: ['This collection is empty', 'Save something and pick this collection, or add existing items from their edit screen.'],
    }[scope];
    return `${toolbar(scope)}
      <p class="muted small sv-count">${list.length} item${list.length === 1 ? '' : 's'}${filtersOn ? ` · <button class="link-btn" data-action="sv-clear">Clear filters</button>` : ''}</p>
      ${list.length ? `<div class="sv-grid ${UI.view}">${list.slice(0, UI.limit).map((i) => cardHtml(i, scope, collId)).join('')}</div>
        ${list.length > UI.limit ? `<div class="sv-more"><button class="btn" data-action="sv-more">Show more (${list.length - UI.limit} left)</button></div>` : ''}`
        : filtersOn ? empty('No matches', 'Try a different search or clear the filters.') : empty(...emptyMsg)}`;
  }

  function coverHtml(c) {
    const cover = safeImg(c.coverImageUrl);
    if (cover) return `<img src="${esc(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback />`;
    const thumbs = items().filter((i) => !i.isArchived && inColl(i, c.id) && safeImg(i.thumbnailUrl)).slice(0, 4);
    if (!thumbs.length) return '';
    return `<div class="coll-mosaic n${thumbs.length}">${thumbs.map((i) => `<img src="${esc(safeImg(i.thumbnailUrl))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-fallback />`).join('')}</div>`;
  }
  function collCard(c) {
    const n = countIn(c.id);
    return `<div class="coll-card">
      <a href="#saved/c/${c.id}" class="coll-cover" style="background:${esc(c.color || '#2f6fed')}">${coverHtml(c)}<span class="coll-ic">${esc(c.icon || '📁')}</span></a>
      <div class="coll-info">
        <a href="#saved/c/${c.id}"><b>${esc(c.name)}</b></a>
        <small class="muted">${n} item${n === 1 ? '' : 's'}${c.smart ? ' · automatic' : ''}</small>
        ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      </div>
      ${c.smart ? '' : `<div class="coll-actions"><button class="icon-btn" data-action="sv-coll-edit" data-id="${c.id}" title="Edit collection">${icon('edit')}</button><button class="icon-btn" data-action="sv-coll-delete" data-id="${c.id}" title="Delete collection">${icon('trash')}</button></div>`}
    </div>`;
  }
  function collectionsView() {
    if (!S.collectionsLoaded) return '<p class="muted">Loading collections…</p>';
    return `<div class="sv-head-row"><p class="muted">Group your saved content like Instagram Saved. Items can be in several collections.</p>
      <button class="btn primary" data-action="sv-coll-new">${icon('plus')} New collection</button></div>
      <h3 class="sv-h">Your collections</h3>
      <div class="coll-grid">${colls().map(collCard).join('') || '<p class="muted">No custom collections yet. Create one for AI tools, recipes, travel plans…</p>'}</div>
      <h3 class="sv-h">Smart collections</h3>
      <div class="coll-grid">${Object.keys(SMART).map((id) => collCard(findColl(id))).join('')}</div>`;
  }
  function collectionDetail(id) {
    const c = findColl(id);
    if (!c) return S.collectionsLoaded ? empty('Collection not found', 'It may have been deleted. Its items are still in All Saved.') : '<p class="muted">Loading…</p>';
    return `<div class="coll-hero" style="--c:${esc(c.color || '#2f6fed')}">
      <a href="#saved/collections" class="icon-btn" aria-label="Back to collections">${icon('back')}</a>
      <span class="coll-hero-ic">${esc(c.icon || '📁')}</span>
      <div><h2>${esc(c.name)}</h2><p class="muted">${countIn(c.id)} items${c.description ? ' · ' + esc(c.description) : ''}</p></div>
      <span class="spacer"></span>
      ${c.smart ? '' : `<button class="btn sm" data-action="sv-coll-edit" data-id="${c.id}">${icon('edit')} Edit</button><button class="btn sm danger ghost" data-action="sv-coll-delete" data-id="${c.id}">${icon('trash')}</button>`}
      ${c.smart ? '' : `<button class="btn sm primary" data-action="sv-new" data-coll="${c.id}">${icon('plus')} Save here</button>`}
    </div>${library('collection', id)}`;
  }

  function legacyDocs() {
    const imported = new Set(items().map((i) => i.legacyDocId).filter(Boolean));
    return (S.docs || []).filter((d) => !imported.has(d.id));
  }
  function legacyBanner() {
    const n = legacyDocs().length;
    if (!n) return '';
    return `<div class="banner">${icon('docs')}<span><b>${n} item${n === 1 ? '' : 's'} from the old team Documents section</b> are still stored safely. Import the ones you want into your saved content.</span><button class="btn sm" data-action="sv-legacy">View & import</button></div>`;
  }

  function view(parts) {
    const [r, sub, id] = parts;
    seedDefaults();
    let tab = 'all'; let body;
    if (r === 'share') { queueShare(sub); body = library('all'); }
    else if (sub === 'collections') { tab = 'collections'; body = collectionsView(); }
    else if (sub === 'favorites') { tab = 'favorites'; body = library('favorites'); }
    else if (sub === 'archived') { tab = 'archived'; body = library('archived'); }
    else if (sub === 'c') { tab = 'collections'; body = collectionDetail(id); }
    else body = legacyBanner() + library('all');
    return `<div class="sv-top">${tabs(tab)}<button class="btn primary sv-save-btn" data-action="sv-new">${icon('plus')} Save</button></div>${body}`;
  }

  /* ── Save sheet ── */
  function openSaveSheet(initial = {}, { shareId = null } = {}) {
    let files = [...(initial.files || [])];
    const selected = new Set(initial.collectionIds || []);
    const st = { titleEdited: false, platformEdited: false, typeEdited: false, meta: {}, metaFor: '', mode: 'empty', url: '', text: '' };
    const platformOpts = Object.entries(PLATFORMS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
    const typeOpts = Object.entries(TYPES).map(([k, [, l]]) => `<option value="${k}">${l}</option>`).join('');
    openModal(`<form class="save-sheet" novalidate>
      <div class="modal-head"><h3>${shareId ? 'Save shared content' : 'Save to TaskNest'}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <label>Link or text<textarea id="ss-input" name="input" rows="3" placeholder="Paste an Instagram, YouTube, LinkedIn, Drive or any link — or WhatsApp text">${esc(initial.input || '')}</textarea></label>
      <div class="row wrap ss-tools">
        <button type="button" class="btn sm" id="ss-paste">${icon('copy')} Paste</button>
        <label class="btn sm">${icon('upload')} Attach files<input type="file" id="ss-file" multiple hidden /></label>
        <span class="muted small">Max ${fmtSize(MAX_FILE_BYTES)} per file</span>
      </div>
      <div id="ss-files"></div>
      <div id="ss-preview" class="ss-preview" aria-live="polite"></div>
      <div id="ss-dup"></div>
      <label id="ss-title-wrap">Title<input id="ss-title" name="title" maxlength="300" /></label>
      <div class="grid2">
        <label>Source<select id="ss-platform" name="platform">${platformOpts}</select></label>
        <label>Type<select id="ss-type" name="type">${typeOpts}</select></label>
      </div>
      <div class="ss-colls">
        <div class="ss-lbl">Collections <span class="muted small">(pick any)</span></div>
        <div id="ss-chips" class="ss-chips"></div>
        <div class="row ss-newcoll"><input id="ss-newcoll" placeholder="New collection, e.g. AI Tools" maxlength="60" aria-label="New collection name" /><button type="button" class="btn sm" id="ss-addcoll">${icon('plus')} Create</button></div>
      </div>
      <label>Notes<textarea name="notes" rows="2" placeholder="Why did you save this?">${esc(initial.notes || '')}</textarea></label>
      <label>Tags<input name="tags" placeholder="ai, tutorial, ideas" /></label>
      <label class="check-row"><input type="checkbox" name="fav" /> ★ Add to Favorites</label>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="ss-save">Save</button></div>
    </form>`, {
      wide: true,
      onClose: () => { if (shareId) finishShare(shareId); },
      onOpen: (root) => {
        const $r = (s) => $(s, root);
        const input = $r('#ss-input');
        const pending = new Map(); // collections created here before the snapshot arrives

        const renderChips = () => {
          const list = colls();
          pending.forEach((c, id) => { if (!list.some((x) => x.id === id)) list.push(c); });
          $r('#ss-chips').innerHTML = list.length ? list.map((c) => `<button type="button" class="chip-toggle ${selected.has(c.id) ? 'on' : ''}" data-cid="${c.id}" aria-pressed="${selected.has(c.id)}" style="--c:${esc(c.color || '#2f6fed')}">${esc(c.icon || '📁')} ${esc(c.name)}</button>`).join('') : '<span class="muted small">No collections yet — create one below. It will still be in All Saved.</span>';
        };
        const renderFiles = () => {
          $r('#ss-files').innerHTML = files.length ? `<ul class="ss-filelist">${files.map((f, idx) => `<li><span>${TYPES[typeForMime(f.type, f.name)][0]}</span><b>${esc(f.name)}</b><small class="${f.size > MAX_FILE_BYTES ? 'err' : 'muted'}">${fmtSize(f.size)}${f.size > MAX_FILE_BYTES ? ' — too large, will be skipped' : ''}</small><button type="button" class="icon-btn sm" data-rm="${idx}" aria-label="Remove ${esc(f.name)}">✕</button></li>`).join('')}</ul>` : '';
        };
        const analyze = () => {
          st.text = input.value.trim();
          st.url = extractUrl(st.text);
          st.mode = files.length ? 'files' : st.url ? 'link' : st.text ? 'note' : 'empty';
          let platform; let type; let title; let thumb = '';
          if (st.mode === 'files') {
            platform = 'device';
            type = typeForMime(files[0].type, files[0].name);
            title = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} files`;
          } else if (st.mode === 'link') {
            platform = detectPlatform(st.url);
            type = detectType(st.url, platform);
            title = (st.metaFor === st.url && st.meta.title) || initial.title || defaultTitle(st.url, platform, type);
            thumb = st.metaFor === st.url ? st.meta.thumbnailUrl : (youtubeId(st.url) ? `https://i.ytimg.com/vi/${youtubeId(st.url)}/hqdefault.jpg` : '');
          } else if (st.mode === 'note') {
            platform = initial.fromShare ? 'whatsapp' : 'text';
            type = 'note';
            title = st.text.split('\n')[0].slice(0, 80);
          }
          if (platform && !st.platformEdited) $r('#ss-platform').value = platform;
          if (type && !st.typeEdited) $r('#ss-type').value = type;
          if (!st.titleEdited) $r('#ss-title').value = title || '';
          $r('#ss-title-wrap').hidden = files.length > 1;
          const fake = { title: $r('#ss-title').value || 'Untitled', sourcePlatform: $r('#ss-platform').value, contentType: $r('#ss-type').value, thumbnailUrl: thumb, originalUrl: st.url, fileName: files[0]?.name };
          $r('#ss-preview').innerHTML = st.mode === 'empty' ? '' : `<div class="ss-card"><div class="sv-thumb">${thumbHtml(fake)}</div><div><b>${esc(fake.title)}</b><small class="muted">${esc(PLATFORMS[fake.sourcePlatform]?.label || '')} · ${esc(TYPES[fake.contentType]?.[1] || '')}${st.url ? ' · ' + esc(host(st.url)) : ''}</small>${st.mode === 'link' && st.metaFor === st.url && !st.meta.ok && !thumb ? '<small class="muted">Preview not available for this site — the link will still be saved.</small>' : ''}</div></div>`;
          // Duplicate detection
          const key = st.url ? urlKey(st.url) : '';
          const dup = key && items().find((i) => i.urlKey === key);
          $r('#ss-dup').innerHTML = dup ? `<div class="ss-dup">⚠️ You already saved this ${timeAgo(dup.createdAt)}${(dup.collectionIds || []).length ? ' in ' + dup.collectionIds.map((cid) => esc(S.collections.find((c) => c.id === cid)?.name || '')).filter(Boolean).join(', ') : ''}. Saving again will create a second copy. <button type="button" class="link-btn" id="ss-open-dup">Open existing</button></div>` : '';
          $r('#ss-open-dup')?.addEventListener('click', () => { closeModal(); openDetails(dup.id); });
        };
        let metaTimer;
        const loadMeta = () => {
          clearTimeout(metaTimer);
          if (st.mode !== 'link' || st.metaFor === st.url) return;
          const url = st.url;
          metaTimer = setTimeout(async () => {
            const meta = await fetchMetadata(url, detectPlatform(url));
            if (url !== st.url || !document.body.contains(input)) return;
            st.meta = meta; st.metaFor = url;
            analyze();
          }, 350);
        };
        const update = () => { analyze(); loadMeta(); };

        input.addEventListener('input', update);
        $r('#ss-title').addEventListener('input', () => { st.titleEdited = true; });
        $r('#ss-platform').addEventListener('change', () => { st.platformEdited = true; analyze(); });
        $r('#ss-type').addEventListener('change', () => { st.typeEdited = true; analyze(); });
        $r('#ss-paste').addEventListener('click', async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (!t) return toast('Clipboard is empty', 'error');
            input.value = input.value ? `${input.value}\n${t}` : t;
            update();
          } catch { toast('Paste was blocked. Long-press the box and choose Paste.', 'error'); input.focus(); }
        });
        $r('#ss-file').addEventListener('change', (e) => { files = [...files, ...e.target.files]; e.target.value = ''; renderFiles(); update(); });
        $r('#ss-files').addEventListener('click', (e) => {
          const b = e.target.closest('[data-rm]');
          if (b) { files.splice(Number(b.dataset.rm), 1); renderFiles(); update(); }
        });
        $r('#ss-chips').addEventListener('click', (e) => {
          const b = e.target.closest('[data-cid]');
          if (!b) return;
          selected.has(b.dataset.cid) ? selected.delete(b.dataset.cid) : selected.add(b.dataset.cid);
          renderChips();
        });
        const addColl = async () => {
          const name = $r('#ss-newcoll').value.trim();
          if (!name) return $r('#ss-newcoll').focus();
          const existing = colls().find((c) => c.name.toLowerCase() === name.toLowerCase());
          if (existing) { selected.add(existing.id); $r('#ss-newcoll').value = ''; return renderChips(); }
          try {
            const data = { name: name.slice(0, 60), description: '', icon: '📁', color: COLORS[colls().length % COLORS.length], coverImageUrl: '' };
            const id = await store().addMine('collections', data);
            pending.set(id, { id, ...data });
            selected.add(id);
            $r('#ss-newcoll').value = '';
            renderChips();
            toast(`Collection "${name}" created`, 'ok');
          } catch (err) { fail(err); }
        };
        $r('#ss-addcoll').addEventListener('click', addColl);
        $r('#ss-newcoll').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addColl(); } });

        renderChips(); renderFiles(); update();
        if (!initial.input && !files.length) setTimeout(() => input.focus(), 0);
      },
      onSubmit: async (d) => {
        if (st.mode === 'empty') { toast('Paste a link or text, or attach a file first.', 'error'); return false; }
        const btn = $('#ss-save'); btn.disabled = true; btn.textContent = 'Saving…';
        const common = {
          notes: (d.notes || '').trim(), tags: parseTags(d.tags), collectionIds: [...selected],
          isFavorite: !!d.fav, isArchived: false, sourcePlatform: d.platform, contentType: d.type,
        };
        let saved = 0;
        try {
          if (st.mode === 'files') {
            const caption = st.text;
            for (const f of files) {
              if (f.size > MAX_FILE_BYTES) { toast(`${f.name} is larger than ${fmtSize(MAX_FILE_BYTES)} and was skipped. Save a Drive link instead.`, 'error'); continue; }
              const progress = f.size > 512 * 1024 ? progressToast(`Saving ${f.name}`) : null;
              try {
                const stored = await store().putMyFile(f, progress?.set);
                const type = files.length === 1 ? d.type : typeForMime(f.type, f.name);
                const thumb = type === 'image' ? await makeThumbnail(f) : '';
                await store().addMine('savedItems', {
                  ...common, contentType: type,
                  title: (files.length === 1 && d.title?.trim()) || f.name,
                  originalUrl: st.url || '', urlKey: st.url ? urlKey(st.url) : '',
                  description: caption, thumbnailUrl: thumb,
                  fileName: f.name, fileSize: f.size, mimeType: f.type || 'application/octet-stream', ...stored,
                  importStatus: 'complete',
                });
                saved++;
              } catch (err) { fail(err); } finally { progress?.done(); }
            }
          } else if (st.mode === 'link') {
            const meta = st.metaFor === st.url ? st.meta : await fetchMetadata(st.url, d.platform).catch(() => ({}));
            const description = st.text.replace(st.url, '').trim() || meta.description || '';
            await store().addMine('savedItems', {
              ...common, title: (d.title || '').trim() || defaultTitle(st.url, d.platform, d.type),
              originalUrl: st.url, urlKey: urlKey(st.url), thumbnailUrl: safeImg(meta.thumbnailUrl) || '',
              description, fileStorageKey: '', importStatus: meta.ok ? 'complete' : 'no_preview',
            });
            saved++;
          } else {
            await store().addMine('savedItems', {
              ...common, title: (d.title || '').trim() || st.text.slice(0, 80),
              originalUrl: '', urlKey: '', thumbnailUrl: '', description: st.text, fileStorageKey: '', importStatus: 'complete',
            });
            saved++;
          }
        } catch (err) { fail(err); }
        if (!saved) { btn.disabled = false; btn.textContent = 'Save'; return false; }
        const names = [...selected].map((id) => S.collections.find((c) => c.id === id)?.name).filter(Boolean);
        toast(`✓ Saved${saved > 1 ? ` ${saved} items` : ''}${names.length ? ' to ' + names.join(', ') : ''}`, 'ok');
        return true;
      },
    });
  }

  /* ── Item details / edit ── */
  function openDetails(id) {
    const i = findItem(id);
    if (!i) return;
    const sel = new Set(i.collectionIds || []);
    const platformOpts = Object.entries(PLATFORMS).map(([k, p]) => `<option value="${k}" ${k === i.sourcePlatform ? 'selected' : ''}>${p.label}</option>`).join('');
    const typeOpts = Object.entries(TYPES).map(([k, [, l]]) => `<option value="${k}" ${k === i.contentType ? 'selected' : ''}>${l}</option>`).join('');
    openModal(`<form class="save-sheet">
      <div class="modal-head"><h3>Saved item</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="ss-card"><div class="sv-thumb">${thumbHtml(i)}</div><div><b>${esc(i.title)}</b>
        <small class="muted">Saved ${timeAgo(i.createdAt)}${i.updatedAt !== i.createdAt ? ` · edited ${timeAgo(i.updatedAt)}` : ''}</small>
        ${i.originalUrl ? `<small class="ss-url">${esc(i.originalUrl)}</small>` : ''}
        ${i.fileName ? `<small class="muted">${esc(i.fileName)} · ${fmtSize(i.fileSize || 0)}</small>` : ''}</div></div>
      <div class="row wrap ss-tools">
        <button type="button" class="btn sm primary" data-act="open">${icon('link')} ${i.originalUrl || i.fileStorageKey ? 'Open original' : 'View'}</button>
        ${i.originalUrl ? `<button type="button" class="btn sm" data-act="copy">${icon('copy')} Copy link</button>` : ''}
        ${i.fileStorageKey ? `<button type="button" class="btn sm" data-act="download">${icon('download')} Download</button>` : ''}
        <button type="button" class="btn sm" data-act="archive">${i.isArchived ? '↩ Restore' : '🗄 Archive'}</button>
        <button type="button" class="btn sm danger ghost" data-act="delete">${icon('trash')} Delete</button>
      </div>
      ${i.description ? `<div class="ss-desc"><div class="ss-lbl">Shared text</div><p>${esc(i.description)}</p></div>` : ''}
      <label>Title<input name="title" required maxlength="300" value="${esc(i.title)}" /></label>
      ${!i.fileStorageKey && i.originalUrl ? `<label>Link<input name="originalUrl" type="url" value="${esc(i.originalUrl)}" /></label>` : ''}
      <div class="grid2"><label>Source<select name="platform">${platformOpts}</select></label><label>Type<select name="type">${typeOpts}</select></label></div>
      <div class="ss-colls"><div class="ss-lbl">Collections <span class="muted small">(tap to add or remove — moving = remove one, add another)</span></div>
        <div class="ss-chips" id="dt-chips">${colls().map((c) => `<button type="button" class="chip-toggle ${sel.has(c.id) ? 'on' : ''}" data-cid="${c.id}" aria-pressed="${sel.has(c.id)}" style="--c:${esc(c.color || '#2f6fed')}">${esc(c.icon || '📁')} ${esc(c.name)}</button>`).join('') || '<span class="muted small">No collections yet. Create them in the Collections tab.</span>'}</div></div>
      <label>Notes<textarea name="notes" rows="3">${esc(i.notes || '')}</textarea></label>
      <label>Tags<input name="tags" value="${esc((i.tags || []).join(', '))}" /></label>
      <label class="check-row"><input type="checkbox" name="fav" ${i.isFavorite ? 'checked' : ''} /> ★ Favorite</label>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save changes</button></div>
    </form>`, {
      wide: true,
      onOpen: (root) => {
        $('#dt-chips', root).addEventListener('click', (e) => {
          const b = e.target.closest('[data-cid]');
          if (!b) return;
          sel.has(b.dataset.cid) ? sel.delete(b.dataset.cid) : sel.add(b.dataset.cid);
          b.classList.toggle('on'); b.setAttribute('aria-pressed', sel.has(b.dataset.cid));
        });
        $$('[data-act]', root).forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.act;
          if (a === 'open') openItem(i);
          if (a === 'copy') copyUrl(i);
          if (a === 'download') openItem(i, true);
          if (a === 'archive') { closeModal(); toggleArchive(i); }
          if (a === 'delete') deleteItem(i);
        }));
      },
      onSubmit: (d) => {
        const url = d.originalUrl !== undefined ? d.originalUrl.trim() : i.originalUrl;
        if (d.originalUrl !== undefined && url && !/^https?:\/\//i.test(url)) { toast('Links must start with http:// or https://', 'error'); return false; }
        store().updateMine('savedItems', i.id, {
          title: d.title.trim() || i.title, sourcePlatform: d.platform, contentType: d.type,
          notes: (d.notes || '').trim(), tags: parseTags(d.tags), collectionIds: [...sel], isFavorite: !!d.fav,
          ...(url !== i.originalUrl ? { originalUrl: url, urlKey: url ? urlKey(url) : '' } : {}),
        }).catch(fail);
        toast('Saved', 'ok');
      },
    });
  }

  /* ── Item actions ── */
  async function openItem(i, forceDownload = false) {
    if (i.originalUrl && !i.fileStorageKey) {
      if (/^https?:\/\//i.test(i.originalUrl)) window.open(i.originalUrl, '_blank', 'noopener');
      return;
    }
    if (!i.fileStorageKey) return openDetails(i.id);
    const previewable = /^(image\/|application\/pdf|text\/plain)/.test(i.mimeType || '');
    const win = !forceDownload && previewable ? window.open('', '_blank') : null;
    const progress = (i.fileSize || 0) > 1024 * 1024 ? progressToast(`Opening ${i.fileName}`) : null;
    let blob;
    try { blob = await store().getMyFile(i, progress?.set); } catch (err) { win?.close(); return fail(err); } finally { progress?.done(); }
    if (!win) return download(i.fileName || 'file', blob);
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function copyUrl(i) {
    navigator.clipboard.writeText(i.originalUrl).then(() => toast('Link copied', 'ok')).catch(() => prompt('Copy this link:', i.originalUrl));
  }
  function toggleArchive(i) {
    store().updateMine('savedItems', i.id, { isArchived: !i.isArchived }).catch(fail);
    toast(i.isArchived ? 'Restored to Saved Content' : 'Archived — find it in the Archived tab', 'ok');
  }
  async function deleteItem(i) {
    if (!(await confirmDialog(`Delete "${i.title}" permanently?`))) return;
    try {
      await store().deleteMyFile(i);
      await store().removeMine('savedItems', i.id);
      toast('Deleted', 'ok');
    } catch (err) { fail(err); }
  }

  /* ── Collections ── */
  function openCollectionEditor(c = null) {
    const cur = { icon: '📁', color: COLORS[colls().length % COLORS.length], ...(c || {}) };
    let cover = c?.coverImageUrl || '';
    openModal(`<form>
      <div class="modal-head"><h3>${c ? 'Edit collection' : 'New collection'}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <label>Name<input name="name" required maxlength="60" value="${esc(cur.name || '')}" placeholder="e.g. AI Tools, Recipes, Travel Plans" /></label>
      <label>Description<textarea name="description" rows="2" maxlength="300">${esc(cur.description || '')}</textarea></label>
      <div class="ss-lbl">Icon</div>
      <div class="pick-row">${ICONS_LIST.map((e) => `<label class="pick"><input type="radio" name="icon" value="${e}" ${e === cur.icon ? 'checked' : ''} /><span>${e}</span></label>`).join('')}</div>
      <div class="ss-lbl">Color</div>
      <div class="pick-row">${COLORS.map((col) => `<label class="pick swatch"><input type="radio" name="color" value="${col}" ${col === cur.color ? 'checked' : ''} /><span style="background:${col}"></span></label>`).join('')}</div>
      <div class="ss-lbl">Cover image <span class="muted small">(optional — otherwise the latest saved thumbnails are used)</span></div>
      <div class="row wrap"><div id="cv-prev" class="cv-prev">${safeImg(cover) ? `<img src="${esc(cover)}" alt="" />` : ''}</div>
        <label class="btn sm">${icon('upload')} Choose image<input type="file" id="cv-file" accept="image/*" hidden /></label>
        <button type="button" class="btn sm ghost" id="cv-clear">Remove</button></div>
      <label>…or image link<input name="coverUrl" type="url" placeholder="https://…" value="${/^https:/.test(cover) ? esc(cover) : ''}" /></label>
      <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">${c ? 'Save' : 'Create'}</button></div>
    </form>`, {
      onOpen: (root) => {
        const prev = $('#cv-prev', root);
        $('#cv-file', root).addEventListener('change', async (e) => {
          const f = e.target.files[0]; if (!f) return;
          cover = await makeThumbnail(f, 720);
          if (!cover) return toast('Could not read that image', 'error');
          prev.innerHTML = `<img src="${cover}" alt="" />`;
          root.querySelector('[name=coverUrl]').value = '';
        });
        $('#cv-clear', root).addEventListener('click', () => { cover = ''; prev.innerHTML = ''; root.querySelector('[name=coverUrl]').value = ''; });
      },
      onSubmit: (d) => {
        const name = d.name.trim();
        if (!name) return false;
        const clash = colls().find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== c?.id);
        if (clash || Object.values(SMART).some((x) => x.name.toLowerCase() === name.toLowerCase())) { toast('A collection with that name already exists', 'error'); return false; }
        const coverImageUrl = d.coverUrl?.trim() ? (/^https:\/\//i.test(d.coverUrl.trim()) ? d.coverUrl.trim() : '') : cover;
        const data = { name, description: (d.description || '').trim(), icon: d.icon || '📁', color: d.color || COLORS[0], coverImageUrl };
        (c ? store().updateMine('collections', c.id, data) : store().addMine('collections', data)).catch(fail);
        toast(c ? 'Collection updated' : `Collection "${name}" created`, 'ok');
      },
    });
  }
  async function deleteCollection(id) {
    const c = S.collections.find((x) => x.id === id);
    if (!c) return;
    const members = items().filter((i) => (i.collectionIds || []).includes(id));
    if (!(await confirmDialog(`Delete collection "${c.name}"? Its ${members.length} item${members.length === 1 ? '' : 's'} stay in All Saved.`))) return;
    try {
      for (const i of members) await store().updateMine('savedItems', i.id, { collectionIds: i.collectionIds.filter((x) => x !== id) });
      await store().removeMine('collections', id);
      if (location.hash.startsWith('#saved/c/' + id)) location.hash = '#saved/collections';
      toast('Collection deleted. Items are still in All Saved.', 'ok');
    } catch (err) { fail(err); }
  }

  /* ── Legacy team documents → import ── */
  function openLegacy() {
    const list = legacyDocs();
    openModal(`<div class="modal-head"><h3>Old team documents</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <p class="muted small">These were uploaded to the team's old Documents section. They are kept unchanged. Importing makes a private copy in your Saved Content.</p>
      <ul class="legacy-list">${list.map((d) => `<li><span>${d.kind === 'link' ? '🔗' : '📄'}</span><div><b>${esc(d.name)}</b><small class="muted">${d.kind === 'link' ? esc(host(d.url)) : fmtSize(d.size || 0)} · ${esc(d.uploadedByName || '')}</small></div>
        <button type="button" class="btn sm" data-lopen="${d.id}">Open</button><button type="button" class="btn sm primary" data-limport="${d.id}">Import</button></li>`).join('')}</ul>
      <div class="modal-actions"><button type="button" class="btn" data-close>Close</button><button type="button" class="btn primary" id="legacy-all">Import all (${list.length})</button></div>`, {
      wide: true,
      onOpen: (root) => {
        root.addEventListener('click', async (e) => {
          const o = e.target.closest('[data-lopen]');
          if (o) ctx.openLegacyDoc(S.docs.find((d) => d.id === o.dataset.lopen));
          const imp = e.target.closest('[data-limport]');
          if (imp) {
            imp.disabled = true; imp.textContent = 'Importing…';
            if (await importLegacy(S.docs.find((d) => d.id === imp.dataset.limport))) imp.textContent = '✓ Imported';
            else { imp.disabled = false; imp.textContent = 'Import'; }
          }
        });
        $('#legacy-all', root).addEventListener('click', async (e) => {
          e.target.disabled = true;
          let n = 0;
          for (const d of list) if (await importLegacy(d)) n++;
          closeModal();
          toast(`Imported ${n} item${n === 1 ? '' : 's'}`, 'ok');
        });
      },
    });
  }
  async function importLegacy(d) {
    try {
      const base = { notes: d.description || '', tags: d.folder && d.folder !== 'General' ? parseTags(d.folder) : [], collectionIds: [], isFavorite: false, isArchived: false, legacyDocId: d.id, importStatus: 'complete', description: '' };
      if (d.kind === 'link') {
        const platform = detectPlatform(d.url);
        const meta = await fetchMetadata(d.url, platform).catch(() => ({}));
        await store().addMine('savedItems', { ...base, title: d.name, originalUrl: d.url, urlKey: urlKey(d.url), sourcePlatform: platform, contentType: detectType(d.url, platform), thumbnailUrl: safeImg(meta.thumbnailUrl) || '', fileStorageKey: '' });
      } else {
        const blob = d.data ? ctx.dataUrlToBlob(d.data) : await store().readFile(d);
        const file = new File([blob], d.name, { type: d.mime || blob.type });
        const stored = await store().putMyFile(file);
        const type = typeForMime(file.type, file.name);
        await store().addMine('savedItems', { ...base, title: d.name, originalUrl: '', urlKey: '', sourcePlatform: 'device', contentType: type, thumbnailUrl: type === 'image' ? await makeThumbnail(file) : '', fileName: d.name, fileSize: blob.size, mimeType: file.type || 'application/octet-stream', ...stored });
      }
      return true;
    } catch (err) { fail(err); return false; }
  }

  /* ── Android share target (handled by sw.js) ── */
  const shareBase = () => location.origin + location.pathname.replace(/[^/]*$/, '') + 'share-data/';
  function queueShare(id) {
    if (!id || handledShares.has(id)) return;
    handledShares.add(id);
    setTimeout(() => openShare(id), 0);
  }
  async function openShare(id) {
    try {
      if (!('caches' in window)) throw new Error('Sharing is not supported in this browser.');
      const cache = await caches.open('tasknest-share');
      const metaRes = await cache.match(`${shareBase()}${id}/meta`);
      if (!metaRes) { toast('That shared item has expired. Please share it again.', 'error'); location.replace('#saved'); return; }
      const meta = await metaRes.json();
      const files = [];
      for (let n = 0; n < meta.files.length; n++) {
        const r = await cache.match(`${shareBase()}${id}/file/${n}`);
        if (r) files.push(new File([await r.blob()], meta.files[n].name, { type: meta.files[n].type }));
      }
      const parts = [meta.text, meta.url].filter(Boolean);
      const input = parts.filter((p, n) => !(n === 1 && parts[0].includes(p))).join('\n');
      openSaveSheet({ input, title: meta.title && meta.title !== input ? meta.title : '', files, fromShare: true }, { shareId: id });
    } catch (err) { fail(err); }
  }
  async function finishShare(id) {
    try {
      const cache = await caches.open('tasknest-share');
      for (const req of await cache.keys()) if (req.url.includes(`/share-data/${id}/`)) await cache.delete(req);
    } catch { /* ignore */ }
    if (location.hash.startsWith('#share')) location.replace('#saved');
  }

  /* ── Wiring ── */
  const debounced = (() => { let t; return () => { clearTimeout(t); t = setTimeout(refresh, 150); }; })();
  const actions = {
    'sv-new': (el) => openSaveSheet({ collectionIds: el.dataset.coll ? [el.dataset.coll] : [] }),
    'sv-details': (el) => openDetails(el.dataset.id),
    'sv-open': (el) => openItem(findItem(el.dataset.id)),
    'sv-copy': (el) => copyUrl(findItem(el.dataset.id)),
    'sv-fav': (el) => { const i = findItem(el.dataset.id); store().updateMine('savedItems', i.id, { isFavorite: !i.isFavorite }).catch(fail); },
    'sv-uncollect': (el) => {
      const i = findItem(el.dataset.id);
      store().updateMine('savedItems', i.id, { collectionIds: (i.collectionIds || []).filter((x) => x !== el.dataset.coll) }).catch(fail);
      toast('Removed from collection (still in All Saved)', 'ok');
    },
    'sv-layout': (el) => { UI.view = el.dataset.val; localSet('savedView', UI.view); refresh(); },
    'sv-more': () => { UI.limit += PAGE; refresh(); },
    'sv-clear': () => { Object.assign(UI, { q: '', platform: '', type: '', coll: '', limit: PAGE }); refresh(); },
    'sv-coll-new': () => openCollectionEditor(),
    'sv-coll-edit': (el) => openCollectionEditor(S.collections.find((c) => c.id === el.dataset.id)),
    'sv-coll-delete': (el) => deleteCollection(el.dataset.id),
    'sv-legacy': openLegacy,
  };
  function onInput(e) {
    if (e.target.id === 'sv-search') { UI.q = e.target.value; UI.limit = PAGE; debounced(); return true; }
    return false;
  }
  function onChange(e) {
    const map = { 'sv-platform': 'platform', 'sv-type': 'type', 'sv-coll': 'coll', 'sv-sort': 'sort' };
    if (!map[e.target.id]) return false;
    UI[map[e.target.id]] = e.target.value; UI.limit = PAGE; refresh();
    return true;
  }
  // Broken thumbnails fall back to the platform card underneath.
  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG' && e.target.hasAttribute('data-fallback')) e.target.remove(); }, true);

  return { view, actions, onInput, onChange, openSaveSheet };
}
