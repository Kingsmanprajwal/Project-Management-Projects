// Data layer. Two interchangeable backends with the same API:
//   LocalStore    – saves to localStorage (single device, no login)
//   FirebaseStore – Firebase Auth + Firestore (multi-user, real-time sync)
import { firebaseConfig } from './firebase-config.js';

const FB_VERSION = '10.12.2';
const FB_URL = (m) => `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}.js`;
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const COLLECTIONS = ['notes', 'docs', 'tasks', 'people'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per uploaded file
const CHUNK_BYTES = 750 * 1024; // stays under Firestore's 1 MiB per-document limit

export async function createStore() {
  const store = firebaseConfig ? new FirebaseStore() : new LocalStore();
  await store.init();
  return store;
}

/* ───────────────────────────── Local mode ───────────────────────────── */
class LocalStore {
  mode = 'local';
  listeners = {};

  async init() {
    // Keep multiple open tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key === 'tn:profile') this._authCb?.(this._profile());
      else if (e.key?.startsWith('tn:')) this._emit(e.key.slice(3));
    });
  }

  _profile() {
    try { return JSON.parse(localStorage.getItem('tn:profile')); } catch { return null; }
  }
  _read(c) {
    try { return JSON.parse(localStorage.getItem('tn:' + c) || '[]'); } catch { return []; }
  }
  _write(c, arr) {
    try {
      localStorage.setItem('tn:' + c, JSON.stringify(arr));
    } catch (err) {
      throw new Error('Device storage is full. Delete some documents or enable cloud sync.');
    }
    this._emit(c);
  }
  _emit(c) {
    (this.listeners[c] || []).forEach((cb) => cb(this._read(c)));
  }

  onAuth(cb) {
    this._authCb = cb;
    cb(this._profile());
  }
  async signUp({ name }) {
    const p = { uid: 'local-' + newId(), name: name || 'Me', email: '', workspaceId: 'local' };
    localStorage.setItem('tn:profile', JSON.stringify(p));
    this._authCb?.(p);
  }
  async signIn(args) { return this.signUp(args); }
  async signInWithGoogle() { throw new Error('Google sign-in needs cloud sync to be enabled.'); }
  async resetPassword() {}
  async signOut() {
    localStorage.removeItem('tn:profile');
    this._authCb?.(null);
  }
  async updateProfile(data) {
    const p = { ...this._profile(), ...data };
    localStorage.setItem('tn:profile', JSON.stringify(p));
    this._authCb?.(p);
  }

  watchWorkspace(cb) {
    const p = this._profile();
    cb({ id: 'local', name: 'My Workspace', ownerId: p?.uid, members: { [p?.uid]: { name: p?.name, email: p?.email } } });
    return () => {};
  }
  async createWorkspace() {}
  async joinWorkspace() { throw new Error('Joining a team needs cloud sync to be enabled.'); }
  async leaveWorkspace() {}
  async renameWorkspace() {}

  subscribe(c, cb) {
    (this.listeners[c] ||= []).push(cb);
    cb(this._read(c));
    return () => { this.listeners[c] = this.listeners[c].filter((x) => x !== cb); };
  }
  async add(c, data) {
    const now = Date.now();
    const item = { ...data, id: newId(), createdAt: now, updatedAt: now };
    this._write(c, [...this._read(c), item]);
    return item.id;
  }
  async update(c, id, data) {
    this._write(c, this._read(c).map((x) => (x.id === id ? { ...x, ...data, updatedAt: Date.now() } : x)));
  }
  async remove(c, id) {
    this._write(c, this._read(c).filter((x) => x.id !== id));
  }
  maxFileBytes() { return MAX_FILE_BYTES; }

  // File contents live in IndexedDB (large quota); only metadata goes in localStorage.
  _idb() {
    return (this._db ||= new Promise((res, rej) => {
      const req = indexedDB.open('tasknest-files', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    }));
  }
  async _tx(mode, fn) {
    const db = await this._idb();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = tx.onabort = () => rej(tx.error || new Error('Could not save the file on this device (storage full?).'));
    });
  }
  async saveFile(file, meta, onProgress) {
    const id = newId();
    await this._tx('readwrite', (st) => st.put(file, id));
    onProgress?.(1);
    const now = Date.now();
    const item = { ...meta, id, storage: 'idb', createdAt: now, updatedAt: now };
    try {
      this._write('docs', [...this._read('docs'), item]);
    } catch (err) {
      await this._tx('readwrite', (st) => st.delete(id));
      throw err;
    }
    return id;
  }
  async readFile(doc) {
    const blob = await this._tx('readonly', (st) => st.get(doc.id));
    if (!blob) throw new Error('This file is not stored on this device.');
    return blob;
  }
  async deleteFile(doc) {
    if (doc.storage === 'idb') await this._tx('readwrite', (st) => st.delete(doc.id)).catch(() => {});
    await this.remove('docs', doc.id);
  }
}

/* ───────────────────────────── Cloud mode ───────────────────────────── */
class FirebaseStore {
  mode = 'cloud';

  async init() {
    const [app, auth, fs] = await Promise.all([
      import(FB_URL('app')), import(FB_URL('auth')), import(FB_URL('firestore')),
    ]);
    this.A = auth;
    this.F = fs;
    this.app = app.initializeApp(firebaseConfig);
    this.auth = auth.getAuth(this.app);
    try {
      // Offline cache: the app keeps working without internet and syncs later.
      this.db = fs.initializeFirestore(this.app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
    } catch {
      this.db = fs.getFirestore(this.app);
    }
  }

  onAuth(cb) {
    const { F } = this;
    let unsubUser = null;
    this.A.onAuthStateChanged(this.auth, async (user) => {
      unsubUser?.();
      unsubUser = null;
      if (!user) { this.profile = null; return cb(null); }
      const ref = F.doc(this.db, 'users', user.uid);
      const snap = await F.getDoc(ref);
      if (!snap.exists()) {
        await F.setDoc(ref, {
          name: user.displayName || this._pendingName || user.email.split('@')[0],
          email: user.email,
          workspaceId: null,
        });
      }
      unsubUser = F.onSnapshot(ref, (s) => {
        const d = s.data() || {};
        this.profile = { uid: user.uid, email: user.email, name: d.name || user.email, workspaceId: d.workspaceId || null };
        cb(this.profile);
      });
    });
  }

  async signUp({ name, email, password }) {
    this._pendingName = name;
    const cred = await this.A.createUserWithEmailAndPassword(this.auth, email, password);
    await this.A.updateProfile(cred.user, { displayName: name });
  }
  async signIn({ email, password }) {
    await this.A.signInWithEmailAndPassword(this.auth, email, password);
  }
  async signInWithGoogle() {
    await this.A.signInWithPopup(this.auth, new this.A.GoogleAuthProvider());
  }
  async resetPassword(email) {
    await this.A.sendPasswordResetEmail(this.auth, email);
  }
  async signOut() {
    await this.A.signOut(this.auth);
  }
  async updateProfile(data) {
    const { F, profile } = this;
    await F.updateDoc(F.doc(this.db, 'users', profile.uid), data);
    if (data.name && profile.workspaceId) {
      await F.updateDoc(F.doc(this.db, 'workspaces', profile.workspaceId), {
        [`members.${profile.uid}.name`]: data.name,
      });
    }
  }

  watchWorkspace(cb) {
    const { F } = this;
    return F.onSnapshot(F.doc(this.db, 'workspaces', this.profile.workspaceId), (s) => {
      if (s.exists()) cb({ id: s.id, ...s.data() });
    });
  }
  async createWorkspace(name) {
    const { F, profile } = this;
    const ref = F.doc(F.collection(this.db, 'workspaces'));
    await F.setDoc(ref, {
      name,
      ownerId: profile.uid,
      memberIds: [profile.uid],
      members: { [profile.uid]: { name: profile.name, email: profile.email } },
      createdAt: Date.now(),
    });
    await F.updateDoc(F.doc(this.db, 'users', profile.uid), { workspaceId: ref.id });
  }
  async joinWorkspace(code) {
    const { F, profile } = this;
    const ref = F.doc(this.db, 'workspaces', code.trim());
    let snap;
    try { snap = await F.getDoc(ref); } catch { snap = null; }
    if (!snap?.exists()) throw new Error('No team found with that invite code.');
    if (!snap.data().memberIds.includes(profile.uid)) {
      await F.updateDoc(ref, {
        memberIds: F.arrayUnion(profile.uid),
        [`members.${profile.uid}`]: { name: profile.name, email: profile.email },
      });
    }
    await F.updateDoc(F.doc(this.db, 'users', profile.uid), { workspaceId: ref.id });
  }
  async leaveWorkspace() {
    const { F, profile } = this;
    await F.updateDoc(F.doc(this.db, 'users', profile.uid), { workspaceId: null });
  }
  async renameWorkspace(name) {
    const { F, profile } = this;
    await F.updateDoc(F.doc(this.db, 'workspaces', profile.workspaceId), { name });
  }

  _col(c) {
    return this.F.collection(this.db, 'workspaces', this.profile.workspaceId, c);
  }
  subscribe(c, cb, onError) {
    return this.F.onSnapshot(
      this._col(c),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => onError?.(err),
    );
  }
  // Writes are applied to the local cache immediately and synced in the background,
  // so the app stays responsive offline. Sync failures are reported via onError.
  _bg(promise) {
    promise.catch((err) => this.onError?.(err));
  }
  async add(c, data) {
    const now = Date.now();
    const ref = this.F.doc(this._col(c));
    this._bg(this.F.setDoc(ref, { ...data, createdAt: now, updatedAt: now }));
    return ref.id;
  }
  async update(c, id, data) {
    this._bg(this.F.updateDoc(this.F.doc(this._col(c), id), { ...data, updatedAt: Date.now() }));
  }
  async remove(c, id) {
    this._bg(this.F.deleteDoc(this.F.doc(this._col(c), id)));
  }
  maxFileBytes() { return MAX_FILE_BYTES; }

  // Files are split into ~750 KB chunks stored as Firestore documents in the
  // workspace's `fileChunks` collection, so the free Spark plan is enough
  // (no paid Firebase Storage bucket needed).
  async saveFile(file, meta, onProgress) {
    if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to upload files.');
    const { F } = this;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ref = F.doc(this._col('docs'));
    const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
    try {
      for (let i = 0; i < chunks; i++) {
        const part = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
        await F.setDoc(F.doc(this._col('fileChunks'), `${ref.id}_${i}`), { docId: ref.id, i, bytes: F.Bytes.fromUint8Array(part) });
        onProgress?.((i + 1) / chunks);
      }
    } catch (err) {
      for (let i = 0; i < chunks; i++) F.deleteDoc(F.doc(this._col('fileChunks'), `${ref.id}_${i}`)).catch(() => {});
      throw err;
    }
    const now = Date.now();
    await F.setDoc(ref, { ...meta, storage: 'chunks', chunks, createdAt: now, updatedAt: now });
    return ref.id;
  }
  async readFile(doc, onProgress) {
    const { F } = this;
    const parts = [];
    for (let i = 0; i < doc.chunks; i++) {
      const snap = await F.getDoc(F.doc(this._col('fileChunks'), `${doc.id}_${i}`));
      if (!snap.exists()) throw new Error('Part of this file is missing. Try uploading it again.');
      parts.push(snap.data().bytes.toUint8Array());
      onProgress?.((i + 1) / doc.chunks);
    }
    return new Blob(parts, { type: doc.mime || 'application/octet-stream' });
  }
  async deleteFile(doc) {
    const { F } = this;
    for (let i = 0; i < (doc.chunks || 0); i++) this._bg(F.deleteDoc(F.doc(this._col('fileChunks'), `${doc.id}_${i}`)));
    await this.remove('docs', doc.id);
  }
}
