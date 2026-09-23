# AskAlign for Codex

**AskAlign / 问齐** means aligning requirements through questions. Formerly titled Grill Me, this adaptation now focuses on multi-round requirements interviews and scenario checks. Legacy plugin IDs, `grill_me_*` tool names, skill directories and saved preference paths remain compatible; use the existing registration rather than adding a duplicate server. Upstream attribution remains in NOTICE and LICENSE.

[简体中文](README.zh-CN.md) · [Try the card UI](https://fan-dev-sktch.github.io/askalign/docs/demo.html) · [Downloads](https://github.com/Fan-dev-sktch/askalign/releases)

Maintainer identity: **Fan-dev-sktch**. See [attribution](NOTICE.md) and [download verification](docs/AUTHENTICITY.md). Canonical source: https://github.com/Fan-dev-sktch/askalign. Download tagged beta assets from its Releases page. Release hashes verify integrity against a trusted reference; they are not signatures.

Clarify the decision that matters, one question at a time, inside the conversation.

AskAlign combines a local MCP server with a Codex skill. In a host that supports MCP Apps, it shows a single inline card: single-choice answers advance immediately, multiple-choice answers wait for Next, and Back restores earlier selections. An Other option accepts your own answer inside the option. The last answer is sent to the conversation automatically, without another confirmation screen.

**Status: 0.4 beta.** Protocol and DOM interaction tests pass locally on Windows. A proposed Windows/macOS/Linux CI matrix is provided in docs/test-workflow.yml. It is not active: the publishing credential cannot upload Actions workflows. Those platforms have not been tested by remote CI. Rendering and follow-up behavior depend on the host. Real desktop submissions and exact-ID answer recovery have been observed; a complete desktop acceptance pass is still required before calling this stable. The browser demo uses the production card UI with a simulated host bridge and scripted questions, not a live AI interview.

## What this adds

- Saved clarification intensity: minimal, balanced or deep, with independent coverage/depth/frequency controls. See [settings](docs/SETTINGS.md).
- A compact submitted-answer receipt that expands inline without requesting host closure.

- A short recommended option with concrete alternatives, rather than a wall of questions.
- One active question in a card, light/dark appearance and blue hover/selection states.
- English and Simplified Chinese controls.
- A skill that checks goals for moderately complex work, but shows a card only when your answer would change the result.
- No API key, separate model call, telemetry, remote server or paid service in the plugin itself. Your host's usual usage limits still apply.

The skill guides the agent; it cannot guarantee perfect questions or globally prevent a host from displaying several separate tool calls. The UI enforces one visible question **within each round**. Previous tool calls remain part of the host's conversation history.

## Install locally

Requires Node.js 22.12+ and a Codex CLI with `codex mcp add`. Inline UI additionally requires an MCP Apps-capable host; a text-only CLI will not turn into a graphical client.

Download or clone this repository to a permanent folder, open a terminal there and run:

```sh
npm run setup
```

The bilingual wizard checks Node and the Codex CLI, reads existing MCP/plugin registrations, and shows its plan before you confirm. It installs dependencies, runs tests, registers the server only when missing, and copies the skill only when it does not conflict with an existing copy. It verifies both registration and skill files, then prints a first-card prompt for a new Codex task. It does not send chat messages or prove host rendering.

For a read-only check: `npm run doctor`. For a deliberate unattended installation: `npm run setup -- --yes`. Existing plugins, moved/disabled registrations and edited skill files stop automatic installation with guidance. If the CLI cannot list plugins, use the manual route below rather than guessing whether an installation exists.

<details><summary>Manual installation / recovery</summary>

Run `npm ci`, `npm run configure`, and `npm test`. Configuration prints a registration command using your local paths; run it only after checking for an existing installation. Copy `skills/grill-me` into `~/.agents/skills/` without overwriting local edits, then restart Codex and start a new task. If setup stops after registration, rerunning from the same folder skips the existing registration; fix any reported skill conflict first. Keep the folder in place.

</details>

If AskAlign is already installed as a Codex plugin, update that installation instead of adding a duplicate MCP server. The `.codex-plugin/plugin.json` compatibility manifest is included for local plugin packaging; generate `.mcp.json` and install dependencies before packaging it. Publishing the repository on GitHub does not list it in the official plugin directory.

## Try it

Ask: “Use AskAlign to clarify the next meaningful decision for this project. Ask one round and keep working on anything that does not depend on my answer.”

The agent should send all known independent questions in a single `grill_me_ask` call. If the next question depends on an answer, it should wait for that answer. It should not open a second pending card just to ask for feedback on the first.

```json
{
  "locale": "en",
  "questions": [
    {
      "question": "What should the first release prioritize?",
      "options": [
        {"label": "Reliable core", "description": "Recommended: make the main workflow dependable."},
        {"label": "More integrations", "description": "Reach more tools, with a wider test surface."}
      ],
      "recommendedIndex": 0,
      "multiple": false
    }
  ]
}
```

Use 2–3 options; the UI adds Other. Answers arrive through the host as a follow-up message. Selecting an answer does not approve unrelated publishing, purchases, or destructive actions.

## Compatibility and limitations

- Tool results include a text fallback for clients that do not render MCP Apps. Exact layout and conversation width are host-controlled.
- Answers use the standard `ui/message` bridge. A host must accept a follow-up for the agent to continue. Optional host widget-state support restores drafts and completed state.
- Completed cards are disabled in the current widget. Restoring completed status across reloads requires host widget-state support; globally exactly-once delivery is not guaranteed by this plugin.
- A delivery timeout is ambiguous. The card asks you to check the conversation before sending again rather than silently retrying.
- This does not patch Codex, replace its built-in questions, or grant additional model quota.

## Development

`npm run release` creates `dist/askalign-source.tgz` from an explicit file allowlist, excluding machine configuration, dependencies, backups and historical card versions. `server/decision-v8.html` is the sole shipped UI entry. Review the archive before publication. See [privacy](docs/PRIVACY.md) and [settings/uninstall](docs/SETTINGS.md).

`npm test` runs a fresh stdio client against the server and exercises the card's DOM interactions. DOM tests are not a substitute for native host testing. See [release checks](docs/RELEASE.md) for the remaining acceptance steps.

Keep changes small and include the failure case when fixing a bug. In issues, include host/version, OS, reproduction steps, and expected/actual behavior. Redact private conversation content before sharing screenshots or logs.

## License and provenance

MIT. The clarification skill is adapted from [Matt Pocock's grill-me/grilling workflow](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity). The inline UI, local MCP integration and tests are additions maintained here. Upstream copyright is retained in [LICENSE](LICENSE). This is an independent community project, not an official OpenAI or Anthropic product.

Interaction research also compared Ask User MCP App (ergunsh/ask-user-mcp-app), AUQ (paulp-o/ask-user-questions-mcp), and the OpenAI Apps SDK examples. This is not the first clarification-card project.
