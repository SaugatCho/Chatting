# Chatting — GitHub Pages local-only edition

Live demo: https://SaugatCho.github.io/Chatting

A lightweight static chat-style app that runs on GitHub Pages without a separate backend.

## Important limitation

**This is a local demo, not a true multi-user online chat service.** GitHub Pages serves static files; it does not provide a shared database or secure server-side authentication. Accounts, settings, and messages are stored in the current browser's `localStorage`.

That means:
- Your saved account and messages are only available in the same browser profile on the same device.
- Another phone or computer will not automatically share or sync its data.
- The “accounts on this browser” list is not a live online-user list.
- Export/import can move a snapshot manually; it does not sync ongoing changes or merge multiple devices.
- Do not use a password you use on other websites. Client-side accounts are convenience features, not secure production authentication.

To create real accounts, shared message history, and live synchronization across devices, a server-side or hosted backend is required. This repository intentionally does **not** add one.

## Features in this version

- Existing dark green chat styling and light/dark theme
- Local sign-up and sign-in
- Message history saved in the current browser
- Escaped message text to reduce HTML injection risk
- Password hashes for newly created accounts using PBKDF2-SHA-256 and random salts
- Automatic upgrade of older plaintext local password records after the correct password is entered
- Manual JSON backup export and import for moving a snapshot between devices
- Small local attachment support (1 MB per file) to help avoid filling browser storage
- Settings for timestamps and sound
- Local account rename, password change, and account deletion

## Deploy on GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Select the branch and folder used for Pages (usually `main` and `/(root)`).
3. Save and wait for GitHub Pages to publish the site.
4. Open the published HTTPS URL.

GitHub Pages changes can take a little time to appear after merging a pull request.

## Manual data transfer

1. On the device with your saved data, sign in and open **Settings → Local data backup → Export Backup**.
2. Transfer the downloaded JSON backup file to your other device privately.
3. Open the chat on that device, choose **Import Backup**, select the file, and confirm replacement.
4. Sign in with the account from the backup.

**Import replaces the data currently stored by this app in that browser. Export the destination device's data first if you need to keep it.** Backups contain chat messages and account verification records; treat them as private and do not post them publicly.

## Storage notes

- Browser storage can be cleared by the user, browser settings, or private-browsing sessions.
- Large or numerous attachments can fill browser storage; keep attachments small and export backups.
- Old accounts created by the previous version may have been stored as plaintext locally. On successful login, the app upgrades that account record to a salted password hash. This is only a local browser safeguard, not a replacement for server-side authentication.


## Project files

- `index.html` — page structure and UI
- `style.css` — layout, theme, and responsive styles
- `app.js` — local account/message behaviour and backup tools
- `manifest.json` — app name, launch scope, and theme metadata
- `favicon.svg` — green chat icon
- `.nojekyll` — prevents GitHub Pages from running Jekyll processing

The manifest is metadata only. This project does not currently include a service worker or guarantee offline installation.
