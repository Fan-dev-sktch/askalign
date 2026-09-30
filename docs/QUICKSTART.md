# Your first SpellOut card

[简体中文](QUICKSTART.zh-CN.md) · [Back to README](../README.md)

The first milestone is simple: see a card, submit an answer, and have the assistant accurately repeat it. Adjust advanced controls after that round works.

## Try the interface without installing the plugin

With Node.js 22.12+ installed, open a terminal in the source folder containing package.json:

```sh
npm run demo
```

Open the address printed in the terminal. Try single choice, multiple choice and Other; the submitted answer appears below the card. Restart clears answers from this page's memory. Keep the terminal open and press Ctrl+C to stop.

**This entry point is available on main but is not yet included in the published v0.5.0 archive.** If npm reports Missing script: demo, download the main source to try the latest changes. Reinstalling dependencies will not add the command. GitHub displays demo.html as source rather than a working page. The demo needs no account or Codex and runs no AI; it does not verify client compatibility.

## Install and verify in three steps

### 1. Download to a permanent folder

For the latest changes, select **main → Code → Download ZIP** in this repository. This source includes the demo entry point and onboarding improvements but has no new release tag yet.

For the published preview, open **Releases → v0.5.0 → Assets** and download `spellout-source.tgz`. Download `SHA256SUMS` for the [integrity check](AUTHENTICITY.md). That older archive does not contain subsequent main changes, and its checksum does not apply to the main ZIP.

Extract the archive to a permanent folder. Open a terminal in the extracted level containing `package.json`, `server` and `skills`. Do not run inside the archive or move the folder after registration.

You need [Node.js](https://nodejs.org/) 22.12+, [Codex CLI](https://learn.chatgpt.com/docs/cli) and a client supporting MCP Apps. Check with `node --version`, `npm --version` and `codex --version`. For an upgrade, read [migration notes](RELEASE.md) and preserve user records.

### 2. Check, then install

```sh
npm run doctor
npm run setup
```

Doctor is read-only. A missing skill or unknown installed version is expected on a fresh installation; resolve prerequisite or conflict errors before continuing.

Setup describes its actions and asks for confirmation before installing dependencies, running tests, registering the connection and installing the skill. You do not need to run npm install first. Update an existing plugin instead of adding a duplicate registration. Do not delete answer records to bypass a conflict.

### 3. Verify in a real conversation

Restart the client, start a new task and send:

> Use SpellOut to clarify a personal learning plan. Do not create the plan yet. Show a card asking about my learning goal, then accurately repeat my submitted answer.

First use may begin with a questioning-preference card. After saving your choice, continue to the learning-goal question. Existing preferences should not need to be reset.

Success requires all three:

- The actual card is visible and accepts choices or free text.
- It collapses to Awaiting read, then Completed after the assistant acknowledges it.
- The assistant repeats the selected answer and your custom addition correctly. Completed refers to this question, not the whole project.

A successful installation or clickable demo cannot replace these checks. Real Codex desktop and phone Remote compatibility remain separate acceptance items; use conversation text if the phone does not show cards.

## If something stops you

| Symptom | Next step |
|---|---|
| package.json not found | Open the terminal in the extracted project root |
| node, npm or codex not found | Install the missing prerequisite and reopen the terminal; if Windows blocks npm.ps1, try npm.cmd |
| Existing installation or edited-file conflict | Preserve records and edits; follow the wizard and migration notes, without adding duplicates |
| Demo address does not load | Keep its terminal running and use the latest printed address; the port may change |
| No card in the client | Run doctor, restart the client and explicitly request SpellOut; use text choices if it remains unavailable |
| Submitted answer receives no response | Ask the assistant to read the previous card's answer; saving cannot restart an ended turn |
| Save remains unconfirmed | Keep the original card and input, ask for a status check, and avoid creating duplicate cards |

Feedback should identify the client/version, the step reached and the visible error. Redact screenshots; do not share answer files, tokens or full configuration. Versions with a local feedback report let you inspect it before copying and do not upload it automatically.

[Question settings](SETTINGS.md) · [Privacy and storage](PRIVACY.md)
