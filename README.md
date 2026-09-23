# AskAlign for Codex

## Start with an idea. Work out the details together.

You don't need a finished brief to begin. Describe what you want, choose an answer, and add what the options missed. AskAlign helps Codex explore your needs through guided questions before implementation.

[简体中文](README.zh-CN.md) · [Try the card UI](https://fan-dev-sktch.github.io/askalign/docs/demo.html) · [Install](#install-locally) · [Downloads](https://github.com/Fan-dev-sktch/askalign/releases)

**0.4 beta · For Codex with MCP Apps support · Requires Node.js 22.12+ and Codex CLI.** The browser demo shows the card UI with scripted questions, not a live AI interview.

## Less typing, room to think

- **Tap an answer, keep going.** One question at a time; single choices advance immediately. Multi-select when several things matter.
- **Make it your answer.** Write directly in Other, use Enter to continue, or go back before submitting to change an earlier choice.
- **Choose how deeply to explore.** Use minimal, balanced or deep clarification. For a complex project, ask for a multi-round interview and a requirements summary before starting.

The aim is a clearer brief and fewer misunderstandings. Question quality still depends on the model and the host; this is guidance, not an execution lock or a guarantee of results.

## From a rough idea to a clearer request

Start with: “I want a feedback page, but I’m not sure what it needs. Ask me questions before building.”

A conversation might explore who will use it, whether feedback is anonymous, and whether people should log in. You can correct the direction as you go, then review the summary before asking Codex to implement it. This is an illustrative workflow, not a measured user outcome.

No separate model API key or model call is added by the plugin. Your host's normal usage limits still apply. See [privacy](docs/PRIVACY.md).

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

For tool parameters and existing-install compatibility, see [technical usage](docs/SETTINGS.md#technical-usage-and-legacy-installations).

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

MIT. Upstream credit and project-specific contributions are documented in [NOTICE](NOTICE.md) and [LICENSE](LICENSE). Independent project, not affiliated with OpenAI or Anthropic. Maintained by [Fan-dev-sktch](https://github.com/Fan-dev-sktch). Download from this repository's [Releases](https://github.com/Fan-dev-sktch/askalign/releases); see [integrity checks](docs/AUTHENTICITY.md).
