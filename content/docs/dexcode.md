---
title: dexCode overview
summary: What dexCode is, what works today, and what is still being tested.
group: dexcode
order: 1
placeholder: false
---

dexCode is a Windows app that runs an AI agent on your own PC. You talk to it in a chat, and it can edit files, run commands, browse the web and control the PC. Its chat model, the "brain", runs on your PC through llama.cpp, so it needs no cloud account and no subscription.

Yuki is its companion: an anime character who lives in one chat that keeps going and never restarts. Normal chats are for project work; Yuki is for everyday things on your PC.

> [!IMPORTANT]
> dexCode is a test build, and it is for adults (18+). It also works with full access to your PC: when you ask, it can open apps, read and change your files and run commands. You agree to that when you install it.

## Getting it

dexCode has no download of its own. dexClient installs it and keeps it up to date: see [Installing dexClient](/docs/installing-dexclient/).

## What works today

Some parts are ready to use, and some are still being tested. This table says which is which, so you know what to expect.

| Part | Today |
|---|---|
| Chat agent: files, commands, the web, controlling the PC | Available. Still being tested against a list of real everyday tasks, so expect rough edges. |
| Yuki's chat, and her small floating window (<kbd>Alt</kbd> + <kbd>Q</kbd>) | Available. |
| Yuki reading her replies out loud | Available, and still being fixed: it can be slow to start and can stop partway through a long reply. |
| Talking with Yuki by voice, back and forth | Still being tested. |
| Making pictures, video and music | Still being tested. Results aren't good enough yet, and a normal install doesn't include them. |
| A phone version | Not available. |
| An account or sign-in | Not needed. |

## The brain

The brain is the model you chat with. When you install, dexClient's PC check picks a version of it that fits your graphics card and memory, and ticks it for you. You can change the pick before you install.

dexCode keeps one brain loaded at a time. It loads the brain when you open dexCode and frees that memory when you close it. Wait until the brain has loaded before you start typing.

## Shortcuts

| Keys | Does |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | Open Settings |
| <kbd>Alt</kbd> + <kbd>Q</kbd> | Bring up Yuki's small chat window from anywhere. You can change this key in Settings, under Agent. |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | Close the window |
| <kbd>Ctrl</kbd> + <kbd>Q</kbd> | Quit dexCode |

## Settings

Open Settings with <kbd>Ctrl</kbd> + <kbd>,</kbd>. There's a search box at the top if you know what you're looking for.

| Section | What's there |
|---|---|
| Agent | How replies sound, Yuki's voice, notifications, the summon shortcut, and how much of your PC the model may change |
| Model | The brain, its context size and how it uses your graphics card |
| Tools | The browser dexCode uses for web work |
| Memory | What dexCode remembers about you. You can look at it, edit it, forget things, reset it or export it |
| Accounts & keys | Sign-ins and keys for sites that need them, such as Hugging Face |
| Content | The 18+ and explicit-content choices you made at install |
| Privacy | Error reports to Dex. See [Error reports and privacy](/docs/error-reports/) |

## If something breaks

dexCode sends Dex a short report when something breaks, unless you turn that off. [Error reports and privacy](/docs/error-reports/) says what's in a report and how to send one by hand. If dexCode won't start or its files are damaged, dexClient can repair it: see [Updates, repair and going back](/docs/updates-and-repair/#repair).
