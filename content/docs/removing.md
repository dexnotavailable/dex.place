---
title: Removing dexCode and dexClient
summary: Take dexCode off your PC, with or without its models, then remove dexClient.
group: dexclient
order: 3
placeholder: false
---

Remove dexCode from inside dexClient first, then remove dexClient from Windows. Doing it in that order lets dexClient clean up what it installed.

## Remove dexCode

1. Open dexClient.
2. Open the gear menu next to the big button and choose **Uninstall**.
3. Under **Remove dexCode**, decide about the box **Also delete the models and engines**. It's off by default.
   - **Off:** only the dexCode app goes. The models stay, so putting dexCode back later doesn't download them again.
   - **On:** the models and engines go too. They take the most space.
4. Press **Remove dexCode…** (or **Remove dexCode and its models…**) and confirm.

Your chats, memory and settings aren't kept in the app folder, so removing the app leaves them in place. Afterwards the big button says **Install**, and pressing it puts dexCode back.

> [!NOTE]
> Removing dexCode and putting it back is covered by dexClient's own tests. It is still being checked on an installed PC.

## Remove dexClient

Open Windows Settings, then **Apps**, then **Installed apps**. Find **dexClient** and choose **Uninstall**.

This removes dexClient only. It leaves behind:

- the dexCode folder and anything it downloaded, wherever you put them (see [where things go](/docs/installing-dexclient/#where-things-go)). Delete that folder yourself if you want it gone;
- dexClient's settings in `%APPDATA%\dexClient`.
