---
title: Updates, repair and going back
summary: How dexClient keeps dexCode current, fixes broken files, and keeps the version you had.
group: dexclient
order: 2
placeholder: false
---

Once dexCode is installed, dexClient looks after it. It finds new versions, installs them, keeps the version you had, and fixes files that break.

## How updates arrive

dexClient checks for new versions of dexCode and of itself on its own. It downloads only the pieces that changed and checks each one. Every version is signed, and dexClient won't install one that isn't signed by Dex. Updates don't bring back the Windows warnings you saw at install.

To check right away: in dexClient, open **Settings**, then **Updates**, then press **Check now**. That page also shows which version is on your PC and which is the newest.

### dexCode

When a new dexCode is ready, the big button on dexClient's home says **Update**. If dexCode is open, the new version goes in when dexCode closes. Your choices, settings and models stay as they were.

### dexClient itself

dexClient updates itself too. When its update is ready, **Settings**, then **Updates** shows **Restart dexClient to update**. If something is still downloading, it waits for that to finish first.

### What has been checked

On 30 September 2026, dexClient 0.4.22 updated itself to 0.4.23 and brought a new dexCode build on Dex's PC, through the normal update path. The saved choices and app data stayed the same, and the previous dexCode was kept. A fresh install of 0.4.23 on someone else's PC hasn't been checked yet.

## Going back to the version you had

Each time dexCode updates, dexClient keeps the previous version in a folder next to the app (`<your folder>\Apps\.dexclient-lifecycle\dexcode\previous`), so it has something to go back to.

- **If a new version won't start:** dexClient is built to switch back to the previous version by itself. Its home then says **Back on dexCode …** with the reason. This is covered by dexClient's own tests, but it hasn't been checked on an installed PC yet.
- **By hand:** there's no button for going back yet. If an update breaks something for you, send a report (see [Error reports and privacy](/docs/error-reports/)) and tell Dex.

## Repair

Repair checks every dexCode file against its fingerprint and downloads only what's broken. Your chats, memory and everything you made are never touched.

You can start it three ways:

- The big button says **Repair** when dexCode needs fixing, with "Something in dexCode needs fixing" under it.
- The gear menu next to the big button has **Repair**.
- **Settings**, then **Help & diagnostics**, then **Repair dexCode**.

If dexCode asks for help after an update, or because it couldn't start, dexClient's home shows a note with **Open logs**. Press Repair first, then send the log to Dex if it still doesn't work.

> [!NOTE]
> Repair is covered by dexClient's own tests. A real repair on an installed PC is still being checked for this version.

## Changing what's installed

The gear menu's **Skill tree** shows what's installed and what you can add. You can also reach it from **Settings**, then **Downloads & storage**.

## What the button says

| Button | What it means |
|---|---|
| **Install** | dexCode isn't on this PC. Press it to start setup. |
| **Installing** | dexCode is downloading and installing. The button fills as it goes. |
| **Resume** | The install is paused. Press it to carry on. |
| **Launch** | dexCode is installed and up to date. |
| **Update** | A new dexCode is ready. |
| **Repair** | Something in dexCode needs fixing. |
