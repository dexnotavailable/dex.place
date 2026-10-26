---
title: Installing YUKI
summary: Download the setup, get past the Windows warnings, and remove it again if you want to.
group: yuki
order: 2
placeholder: false
---

You download one setup file. It installs YUKI for your Windows user and opens it when it's done. After that, YUKI keeps itself up to date.

> [!IMPORTANT]
> YUKI isn't signed yet. Your browser and Windows will both warn you before it runs. That's expected, and the steps below say what to click. You only see the warnings when you first install.

## Before you start

- **A Windows PC.** The setup is for Windows 10 or 11, 64-bit.
- **A personal PC.** Work or school PCs often block unsigned apps completely.
- **Smart App Control.** Open Windows Security, then App & browser control, then Smart App Control.
  - **On:** this build can't run on your PC until it's signed. Windows gives no way past it, and we won't ask you to turn that protection off. Tell Dex.
  - **Evaluation:** it may work now and stop later. If YUKI ever stops opening with no message, that's probably why.
  - **Off:** nothing to do.

## Download

Get the setup from [Downloads](/downloads/#yuki) or [YUKI's page](/yuki/). The file comes from GitHub, and the page lists its name, size and SHA-256. Until the first release is out, both pages say there's no public download yet.

Your browser may block it at first because it isn't signed:

- **Chrome** says "Suspicious download blocked". Click the message, then **Download suspicious file**.
- **Edge** says the file "isn't commonly downloaded". Hover over it, click **…**, then **Keep**, then **Show more**, then **Keep anyway**.
- **Firefox** says it's not commonly downloaded. Open the downloads list and choose **Allow download**.

## Check the file (optional)

This makes sure the file you got is the one on the Downloads page. Open your Downloads folder in File Explorer, click the address bar, type `powershell` and press <kbd>Enter</kbd>. Then run:

```powershell title="Print the SHA-256 of the setup"
Get-FileHash .\YUKI-Setup-*.exe -Algorithm SHA256
```

The long code it prints should match the SHA-256 on the Downloads page. Letter case doesn't matter. If it doesn't match, don't run the file, and tell Dex.

## Run the setup

A blue box says **Windows protected your PC**. This is SmartScreen, and it shows up for any app that isn't signed yet.

1. Click **More info**.
2. Check that it says **App: YUKI-Setup-…exe** and **Publisher: Unknown publisher**. That's normal for this build.
3. Click **Run anyway**.

If there's no **Run anyway** button, your PC's settings don't allow unsigned apps. Stop there and tell Dex.

[YUKI's page](/yuki/#install) shows the box, both clicks drawn out.

## Install

YUKI installs just for your Windows user, so it doesn't ask for admin, and there's nothing to click through.

1. It copies the app into `%LOCALAPPDATA%\Programs\YUKI` and adds a Start menu and a desktop shortcut.
2. YUKI opens when it's done. Yuki hatches from her orb and looks over your PC: its graphics card and its memory.
3. She offers the setup that fits your PC. Nothing downloads until you pick one and accept its licences.

## Uninstalling

Open Windows Settings, then **Apps**, then **Installed apps**. Find **YUKI** and choose **Uninstall**.

This removes the app only. Your chats, memory and settings stay where they are, so installing YUKI again picks up where you left off. To remove them too, delete these folders after uninstalling:

| What | Where |
|---|---|
| Your chats, memory and settings | `%LOCALAPPDATA%\YUKI` |
| A note of where that folder is | `%APPDATA%\YUKI` |

## If your antivirus complains

- If Windows Security or another antivirus says it found something (often with a name like `Trojan:Win32/Wacatac.B!ml`), **don't turn your antivirus off**.
- Send Dex a screenshot with the exact name. He reports it to Microsoft, and these usually clear within days.
- If you're sure the file is the right one because its SHA-256 matched, you can choose to allow that one file from Windows Security's Protection history. That's your call.
