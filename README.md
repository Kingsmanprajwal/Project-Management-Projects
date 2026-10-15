# TaskNest – Notes, Saved Content & Deadlines

TaskNest is a Notion-style team workspace that runs in any browser and installs like an app on Android, iPhone, Windows, Mac and Linux. It's a single Progressive Web App (PWA): one website that works on every device, with no app store needed.

| Section | What it does |
|---|---|
| **Notes** | Notion-like pages: a title plus a rich-text body (headings, bold/italic, bullet and numbered lists, checklists, quotes, links). Autosaves, can be pinned and searched, and turns selected text into a task. |
| **Saved Content** | Your private library of things shared from other apps: Instagram Reels and posts, YouTube videos and Shorts, Facebook and LinkedIn posts, WhatsApp text, PDFs and Word files, Google Drive links, websites and images. Organise them into **collections** (like Instagram Saved), with notes, tags, favorites, archive, search and filters. |
| **Ideas & To-Do** | Quick-add ideas and tasks. Switch between a **List**, a **Board** (To do → In progress → Done) and a **Calendar**. Every item shows how many days are left until its deadline. |
| **Deadline Tracker** | A month calendar of all deadlines next to a countdown list grouped into *Overdue / Due today / Next 7 days / Later*, with days-left counters and progress bars. |
| **Task Assigner** | Assign a task to a teammate with a deadline and a reminder time. The assignee gets an in-app or phone notification when the reminder is due. One tap also sends the reminder by **email**, **WhatsApp**, **Google Calendar** or a **.ics** calendar file. Shows each person's open and late tasks. |
| **Home** | Today's overview: stats, upcoming deadlines, tasks assigned to you, recent notes. |

Other features: works offline (changes sync when you're back online), dark mode, an invite link for teammates, and JSON export/import for backups.

---

## 1. Host it (get your public link)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that publishes the `app/` folder to **GitHub Pages** for free.

1. Merge this branch into `main`.
2. On GitHub, open **Settings → Pages** and set **Source: GitHub Actions**.
3. The workflow runs on every push to `main`. When it finishes, your app is live at:

   **`https://kingsmanprajwal.github.io/Project-Management-Projects/`**

> GitHub Pages is free for **public** repositories. For a private repo you need GitHub Pro/Team, or you can host the `app/` folder on Netlify, Vercel or Firebase Hosting (all free; drag and drop the `app` folder at https://app.netlify.com/drop).

## 2. Install on phones and computers (the "download")

Share the link above. Each person opens it and installs:

- **Android (Chrome):** open the link, then tap **Install app** (or ⋮ → *Add to Home screen*).
- **iPhone / iPad (Safari):** open the link, then tap **Share** → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** click the install icon in the address bar, or use **Install app** in the sidebar.

TaskNest then gets its own icon and opens full-screen like a native app.

> Want a Play Store **APK**? Go to https://www.pwabuilder.com, paste your GitHub Pages link and download the Android package it generates.

## 3. Enable multi-user sync (needed for teams)

Out of the box the app runs in **Local mode**: data is saved only on the device you're using. To let several people sign in, share one workspace, and sync across devices, connect a free Firebase project (about 10 minutes):

1. Go to https://console.firebase.google.com and click **Add project**. Analytics is optional.
2. **Build → Authentication → Get started**. Enable **Email/Password** and, if you want it, **Google**.
3. **Authentication → Settings → Authorized domains**: add `kingsmanprajwal.github.io`.
4. **Build → Firestore Database → Create database**. Production mode, pick a region close to you.
5. **Firestore → Rules**: replace the rules with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
6. **Project settings (⚙) → General → Your apps → Web (`</>`)**: register an app and copy the `firebaseConfig` object.
7. Paste it into [`app/js/firebase-config.js`](app/js/firebase-config.js):

   ```js
   export const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef",
   };
   ```

8. Commit and push to `main`. The site redeploys automatically.

The Firebase web config is meant to be public. Your data is protected by the Firestore rules: only members of a workspace can read or change its notes and tasks, and each person's Saved Content is readable only by that person.

**Team flow:**
1. The first person signs up and creates a team workspace.
2. In **Settings → Team access** they add their teammates' email addresses.
3. Each teammate opens the app and taps **Create account** (or **Continue with Google**) using that email. Email/password users click the confirmation link Firebase emails them, then tap **I've confirmed my email**. They join the team automatically, with no invite link or code needed.
4. People whose email isn't on the list can't see the team.

The invite link in Settings still works as an alternative. Tasks can be assigned to anyone on the team, and reminders show on the assignee's own devices.

> **After updating the app, re-publish `firestore.rules`** (Firestore → Rules → paste → Publish). Team access and Saved Content need the latest rules.

Firebase's free Spark plan covers small teams comfortably (50k reads and 20k writes per day, 1 GB storage).

## Reminders: how they work

- When a task's reminder time arrives, the assignee gets a notification on every device where TaskNest is open or installed. Allow notifications under **Task Assigner → Enable reminders**.
- Teammates without an app account can be added as contacts. Their reminders go to whoever created the task, who can then forward them with the ✉️ email / 💬 WhatsApp buttons.
- The 📅 Google Calendar and ⬇ .ics buttons put the deadline in the person's phone calendar, so they get an alert even when TaskNest is closed.
- Each time you open the app it also shows how many of your tasks are due today and how many are overdue.

## Saved Content & collections

**Saving something**
- **Android (installed app):** in Instagram, YouTube, WhatsApp, Chrome or any app, tap **Share → TaskNest**. A save screen opens with a preview. Pick or create a collection, add notes or tags, and tap **Save**. Links, text, PDFs, Word/Excel/PowerPoint files and images are supported, including several files at once.
- **iPhone, desktop, or Android without installing:** copy the link, open TaskNest, go to **Saved → + Save**, and tap **Paste**. You can also attach files, or drag them onto the Saved page on a computer.

**What gets saved**
- **Links:** the original URL, the detected platform (Instagram, YouTube, Facebook, LinkedIn, Google Drive, X, WhatsApp, website) and the content type (video, post, article, document).
- **Shared text:** saved as a note. When it comes through the Share menu, WhatsApp is preselected as the source.
- **Files:** stored privately, up to 10 MB each.
- **Duplicates:** if you save the same link again (ignoring tracking parameters), you get a warning.

**Previews**
- YouTube thumbnails and titles come from YouTube's public oEmbed service.
- Instagram, Facebook and LinkedIn only provide previews through their developer APIs (an app review and access token are needed), so their items show a clean platform-styled card instead.
- Saving never depends on a preview working.
- TaskNest stores the link, not the original video or post.

**Collections**
- **Ready-made:** *All Saved*, *Reels & Videos*, *Articles & Links*, *Documents & PDFs* and *Favorites* fill themselves automatically. A *Read Later* collection is created for you.
- **Your own:** create collections with a name, description, icon, color and optional cover image.
- **Organising:** an item can be in several collections. To move it, open the item and tap the collection chips.
- **Removing and deleting:** removing an item from a collection, or deleting a whole collection, never deletes the item. It stays in All Saved.

**Library**
- Grid or list view.
- Search across titles, links, notes and #tags.
- Filter by source, type and collection, and sort by newest, oldest or title.
- Favorites and Archived tabs.
- From each item: edit, copy link, open original, download file, or delete.

**Old team Documents.** The previous shared Documents section has been replaced. Anything already uploaded is kept untouched in Firebase. Saved Content shows a banner where anyone can open those files and **import** a private copy.

**Privacy.**
- Saved Content is private to each account. Teammates can't see it; this is enforced by `firestore.rules` under `users/{uid}/…`.
- TaskNest only receives what you explicitly share to it. It never reads WhatsApp or other apps in the background.

## File size limit

You can upload files up to **10 MB each**.

- **Cloud mode:** each file is split into pieces of about 750 KB and stored in Firestore, so the free Spark plan is enough and no paid Firebase Storage is needed. The free plan includes 1 GB of storage in total, which is roughly 100 files of 10 MB.
- **Local mode:** files are kept in the browser's file database (IndexedDB) on that device.

For files over 10 MB, upload them to Google Drive/OneDrive and save the share link in **Saved Content → + Save**. The **Export data** backup includes file names and details but not the contents of uploaded files.

## Run locally

```bash
cd app
python3 -m http.server 8080
# open http://localhost:8080
```

There is no build step: plain HTML, CSS and JavaScript modules.

## Project structure

```
app/
  index.html              App shell
  manifest.webmanifest    Install metadata (name, icons, colours, share_target)
  sw.js                   Service worker (offline cache, Android share target, notification clicks)
  css/styles.css          Responsive styles (desktop sidebar, mobile bottom tabs, dark mode)
  js/app.js               UI shell: notes, to-do, tracker, assigner, settings, routing
  js/saved.js             Saved Content: library, collections, save sheet, share handling
  js/store.js             Data layer: Local mode (localStorage/IndexedDB) or Cloud mode (Firebase)
  js/firebase-config.js   Paste your Firebase config here
  icons/                  App icons
firestore.rules           Firestore security rules
.github/workflows/deploy.yml  Auto-deploy to GitHub Pages
```
