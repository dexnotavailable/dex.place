---
title: Error reports and privacy
summary: What dexCode and dexClient send Dex when something breaks, how to send one by hand, and how to turn it off.
group: dexcode
order: 2
placeholder: false
---

When something breaks, dexCode sends Dex a short report so it can be fixed. That way a problem on your PC reaches Dex even if nobody finds the log. Reports are on by default, and one switch turns them off. Your chats, prompts, files and pictures stay on your PC.

dexClient has its own reports too; they're covered [further down](#reports-from-dexclient).

## Where to find it

In dexCode, open Settings <span class="keys">(<kbd>Ctrl</kbd> + <kbd>,</kbd>)</span> and choose **Privacy**.

## What a report contains

- what failed;
- the dexCode and Windows versions;
- your graphics card, memory and processor;
- the last lines of dexCode's own log;
- a random id made on your PC, so Dex can tell which reports are yours.

Taken out before anything is sent: your user name, folders and file names, full web addresses, and the text of errors from the model or its tools.

Never sent: your chats, prompts, files, pictures or clipboard.

## Turn reports off

Switch off **Send error reports to Dex**. Reports that are waiting to go, and one that is being sent, are cancelled. The switch stays off after you restart dexCode. With it off, nothing is sent unless you press **Send report** yourself.

## Send a report by hand

Use **Send a report now** when something is stuck without an error message. Press **Send report**. It sends the same kind of report once, even when automatic reports are off.

When it has gone, dexCode shows a reference that starts with `r_`. If you tell Dex about the problem, quote that reference. If sending fails, press **Send report** again; a report you send by hand isn't retried by itself.

## Your report id

**This PC's report id** is random and made on your PC; it isn't made from your name or your hardware. Press **Copy** and give it to Dex, and he can find all of your reports.

## Limits and retries

- At most 20 reports a day. The same error is sent once and counted after that.
- If an automatic report can't be sent, for example because you're offline, it waits on your PC and dexCode tries again by itself, first after about a minute.
- If dexCode crashes, it sends the report about the crash the next time it starts.

## What has been checked

On 30 September 2026, with installed builds on Dex's PC:

- turning the switch off, and it staying off after a restart;
- **Send report** reaching Dex and showing its reference, with automatic reports on and with them off;
- an automatic report about a real crash, sent when dexCode started again;
- a report that failed to send going out by itself on the automatic retry, about a minute later.

These haven't been checked yet on a fresh install on someone else's PC.

## Reports from dexClient

dexClient sends its own reports when setup, a download, an update or launching dexCode fails, or when dexCode never opens after setup finished. The switch is in dexClient: **Settings**, then **Help & diagnostics**, then **Send error reports to Dex**. It's on by default, and it takes effect at once. The first time dexClient opens, a short notice says what is sent and where to turn it off.

A dexClient report contains:

- the dexClient version and build;
- a random id made on your PC;
- the Windows version;
- the processor, the amount of memory, and each graphics card's name, memory and driver version;
- the error, and what dexClient was doing when it happened (setup, downloads, updates, launching dexCode);
- the last 200 lines of dexClient's own log.

Before it's saved or sent, your profile folder, Windows user name and PC name are replaced with placeholders, and anything that looks like a password, key, token or e-mail address is removed. It never contains chat text, prompts, model output, file contents, the clipboard or screenshots.

- **Send a report now** sends one right away, even with the switch off. **Copy the report id** copies your id for Dex.
- At most 20 a day. If a report can't be sent, dexClient tries again after 1 minute, 5 minutes, 30 minutes, 2 hours, then every 6 hours. A report older than 7 days is dropped.

The switch and **Send a report now** were checked on an installed dexClient 0.4.21.

## Logs

You can also send Dex the log yourself. In dexClient, **Settings**, then **Help & diagnostics**, has **Open logs**, which opens the folder with `main.log`, and **Copy diagnostics**, which copies a short summary you can paste into a message. The log never holds keys or passwords, and your user name is masked.
