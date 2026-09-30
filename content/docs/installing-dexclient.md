---
title: Installing dexClient
summary: Download the setup, get past the Windows warnings, and let it install dexCode.
group: dexclient
order: 1
placeholder: false
---

dexClient is the launcher and installer for dexCode. You download one setup file. It installs dexClient, checks your PC, asks what you want, installs the dexCode app and opens it. After that it keeps dexCode up to date and repairs it when something breaks.

> [!IMPORTANT]
> This is a test build and it isn't signed yet. Your browser and Windows will both warn you before it runs. That's expected, and the steps below say what to click. You only see the warnings when you first install; updates arrive without them.

## Before you start

- **A Windows PC.** The setup is for 64-bit Windows.
- **A personal PC.** Work or school PCs often block unsigned apps completely.
- **Smart App Control.** Open Windows Security, then App & browser control, then Smart App Control.
  - **On:** this build can't run on your PC until it's signed. Windows gives no way past it, and we won't ask you to turn that protection off. Tell Dex.
  - **Evaluation:** it may work now and stop later. If dexClient ever stops opening with no message, that's probably why.
  - **Off:** nothing to do.
- **An internet connection.** dexCode downloads from `updates.dex.place`, and the models download from where their makers publish them, such as Hugging Face. The models are big files, so the first install can take a while on a slow connection.

## Download

Get the setup from [Downloads](/downloads/#dexclient). The page lists the file's name, size and SHA-256.

Your browser may block it at first because it isn't signed:

- **Chrome** says "Suspicious download blocked". Click the message, then **Download suspicious file**.
- **Edge** says the file "isn't commonly downloaded". Hover over it, click **…**, then **Keep**, then **Show more**, then **Keep anyway**.
- **Firefox** says it's not commonly downloaded. Open the downloads list and choose **Allow download**.

## Check the file (optional)

This makes sure the file you got is the one on the Downloads page. Open your Downloads folder in File Explorer, click the address bar, type `powershell` and press <kbd>Enter</kbd>. Then run:

```powershell title="Print the SHA-256 of the setup"
Get-FileHash .\dexClient-Setup-*.exe -Algorithm SHA256
```

The long code it prints should match the SHA-256 on the Downloads page. Letter case doesn't matter. If it doesn't match, don't run the file, and tell Dex.

## Run the setup

A blue box says **Windows protected your PC**.

1. Click **More info**.
2. Check that it says **App: dexClient-Setup-…exe** and **Publisher: Unknown publisher**. That's normal for this build.
3. Click **Run anyway**.

If there's no **Run anyway** button, your PC's settings don't allow unsigned apps. Stop there and tell Dex.

## Install

dexClient installs just for your Windows user, so it doesn't ask for admin. It adds a Start menu and a desktop shortcut, and opens by itself on its home page. Then:

1. Press **Install**. dexClient checks your PC. This takes a second or two.
2. Press **Continue**. It shows what fits your PC, already ticked. Untick what you don't want, or change the folder it installs into.
3. **One quick thing.** dexCode is for adults. Tick **I'm 18 or older** if you are; that turns off its content filters. Tick **I want explicit content** too if you want that available (it needs the 18+ box first). You can change both later in dexCode, under Settings, then Content.
4. Press **Agree and install**. Agreeing also means you're fine with dexCode working as a desktop agent with full access to this PC: when you ask, it can open apps, read and change your files, and run commands.
5. dexClient downloads the dexCode app, checks every file, and opens dexCode.

Nothing is saved until **Agree and install**. Cancel, or <kbd>Esc</kbd>, takes you back to dexClient's home with nothing changed.

Other parts, such as Yuki's brain and voice, can keep downloading after dexCode opens. dexClient's home shows their progress.

> [!NOTE]
> Pictures, video, music and styles aren't part of a normal install yet. They are still being tested and come in a later update.

## Where things go

| What | Where |
|---|---|
| dexClient | `%LOCALAPPDATA%\Programs\dex-client` |
| The dexCode app | `<your folder>\Apps\dexCode` |
| Models and engines | `<your folder>\AI` |
| dexClient's settings | `%APPDATA%\dexClient` |

`<your folder>` is the one you pick in step 2. dexClient suggests `\Dex\Library` on one of your drives, or `\Dex\dexClient` if you already have your own `Library` folder there.

## After that

Open dexClient from the Start menu or the desktop shortcut. Its big button always says what to do next: **Launch** when dexCode is ready, **Update** when a new version is waiting, **Repair** when something needs fixing. [Updates, repair and going back](/docs/updates-and-repair/) explains each one.

You shouldn't see any more Windows warnings, even when dexCode updates.

## If your antivirus complains

- If Windows Security or another antivirus says it found something (often with a name like `Trojan:Win32/Wacatac.B!ml`), **don't turn your antivirus off**.
- Send Dex a screenshot with the exact name. He reports it to Microsoft, and these usually clear within days.
- If you're sure the file is the right one because its SHA-256 matched, you can choose to allow that one file from Windows Security's Protection history. That's your call.

## If something goes wrong

- dexClient retries downloads by itself. It only asks you to do something when it really needs you, such as no space left, a sign-in, or being offline for a long time, and it says what to do.
- dexClient and dexCode can send Dex an error report on their own. See [Error reports and privacy](/docs/error-reports/).
- In dexClient, **Settings**, then **Help & diagnostics**, then **Open logs** opens the folder with `main.log`. Send that file to Dex with a screenshot. The log never holds keys or passwords, and your user name is masked.

To remove it all later, see [Removing dexCode and dexClient](/docs/removing/).
