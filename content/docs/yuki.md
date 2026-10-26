---
title: YUKI overview
summary: What YUKI is, what it can do on your PC, and where your chats go.
group: yuki
order: 1
placeholder: false
---

YUKI is a Windows app that runs an AI agent on your own PC. You talk to Yuki, its anime companion, in a chat. She can do any task on the PC, even the roundabout ones, and she hands the long jobs to her helper agents so she can keep talking with you while they run.

YUKI replaces dexCode and dexClient. Both are retired, and YUKI installs on its own: there is no launcher to install first.

> [!IMPORTANT]
> YUKI works with full access to your PC: when you ask, it can open apps, read and change your files, use your browser and your logins, and run commands. Models run as they ship: YUKI adds no filters of its own.

## Getting it

YUKI has one setup file. Its first public release isn't out yet. When it is, [Downloads](/downloads/#yuki) and [YUKI's page](/yuki/) have the file, its size and its SHA-256. [Installing YUKI](/docs/installing-yuki/) goes through it step by step.

## What it does

| Part | What it means |
|---|---|
| Any task on your PC | Files, the shell, the browser and your logins, desktop apps, games, and other AI models. |
| Models are tools | Her brain can call an image, video or language model with its own settings, take what it makes, and keep working. |
| A hand of models | Every model YUKI can reach is a card in your deck. The cards in your hand are the ones Yuki and her helpers use. |
| A free radar | YUKI keeps a list of free AI sources and spots new free models, with one tip a day at most. Paste a key and its models join your deck, free ones first. |
| A brain that fits | First run offers the best brain in YUKI's catalogue that fits your PC, down to a small one for a 6 GB NVIDIA card with 16 GB of RAM. Where none fits, the brain runs on a free cloud model. |
| Yuki never goes busy | You talk to Yuki. She hands the work to her helper agents and keeps talking with you while they run. |
| dex inference | Optional: sign in with a dex account to chat on models that run on PCs the community hosts, or to host from yours. Invite-only for now, friends first. |

## Where your chats go

YUKI runs on your PC, and your chats stay there unless you pick a cloud model. A cloud model, free or used with your own API key, runs on its maker's servers, so what you send it goes to them. dex inference sends it through dex.place to the PC hosting the model. Its usage policy applies there only, never to YUKI on your own PC.

## Where things go

| What | Where |
|---|---|
| The YUKI app | `%LOCALAPPDATA%\Programs\YUKI` |
| Your chats, memory and settings | `%LOCALAPPDATA%\YUKI` |
| A note of where that folder is | `%APPDATA%\YUKI` |

Your chats and settings aren't kept in the app's folder, so updating or removing the app leaves them in place. [Uninstalling](/docs/installing-yuki/#uninstalling) says how to remove them too.
