# SpellOut

**Spell out your idea before AI builds it.**

[简体中文](README.zh-CN.md) · [Demo source](docs/demo.html) · [Settings](docs/SETTINGS.md)

SpellOut / 说透 helps clarify a rough idea through question cards, free-text answers and guided follow-ups. A round contains 1 to 5 questions, shown one at a time. Balanced and deep presets default to a maximum of 3; users can raise the limit to 5. Choose minimal, balanced or deep questioning, or request a requirements interview before implementation.

New installations default to deep exploration. At first meaningful use, a setup card lets you choose how often and how deeply to ask; an explicit saved choice applies to later conversations on the same installation. Existing preferences are preserved. Trivial questions and fully specified instructions do not need a card. Global skill installation enables discovery across conversations, but invocation remains controlled by the host and assistant. See [preferences](docs/SETTINGS.md).

Interaction is inspired by Claude Code's question cards. This independent project is not affiliated with OpenAI or Anthropic. Question quality depends on the model; a skill cannot lock host execution or guarantee understanding.

## Install locally

**0.5.0 is an incompatible update.** Read [migration and release notes](docs/RELEASE.md) first. Verify that the extracted package reports version 0.5.0 before installation.

Requires Node.js 22.12+, Codex CLI and an MCP Apps host. Extract source into a permanent folder, then run `npm run setup`.

After inspection and confirmation, the wizard installs dependencies, runs tests, registers a missing MCP server and installs `skills/spellout`. A managed, unmodified skill can upgrade with a versioned sibling backup. Edited or unrecognized differing files stop installation. The `.spellout-install.json` record contains the installed version and file hashes.

`npm run doctor` only checks and compares installed and repository versions. Old installations must be removed manually first; the wizard never deletes them. Use `npm run setup -- --yes` only for an intended unattended installation.

For manual setup, run `npm ci`, `npm run configure`, and `npm test`. Configuration prints a local registration command; inspect existing installations before running it. Use the wizard to install the managed skill. Update an existing plugin instead of adding duplicate MCP registrations.

Restart the host, start a task and ask: “Use SpellOut to clarify my requirements before implementation.” Verify the card appears, submit an answer and check the assistant reads it correctly.

## Interaction and limits

- Select, multi-select or write in Other. Compatible needs use multi-select; single choice is reserved for mutually exclusive decisions or a required single priority. Use Back before submission.
- A small chevron opens settings and the requirements summary. Submitted cards collapse to Awaiting read, then Completed after the answer is acknowledged; this describes the question, not completion of the project.
- Adjust coverage, depth, frequency, diversity, challenge and round size; task settings and future defaults are separate.
- Answers save locally without an automatic follow-up message. Saving cannot restart an ended turn.
- The latest acknowledged answer returns `processed: true` to prevent repeated work after context compaction. This is not a transaction guaranteeing exactly-once external effects.
- A save timeout triggers a status check. Matching retries are idempotent.
- The demo uses scripted questions and in-memory answers; it does not run AI.
- **Real Codex UI and phone Remote: not accepted for 0.5.0.** DOM tests and responsive CSS do not prove mobile visibility. Use numbered conversation choices when cards are unavailable.

## Privacy and development

No separate model API call or telemetry is added. Preferences and records stay local, subject to the host's conversation policies. `npm run forget` previews old records; deletion requires an explicit age cutoff and `--yes`. See [privacy](docs/PRIVACY.md).

`npm test` covers the MCP server, card DOM, actual demo bridge, persistence, installation, cleanup and naming. `npm run release` builds a local `dist/spellout-source.tgz` from `scripts/release-files.mjs`. Machine configuration, dependencies, backups and bundled historical HTML snapshots are excluded. `server/card.html` is the shipped UI; runtime pages are cached by content hash. The script does not publish to GitHub.

See [release checks](docs/RELEASE.md) and [integrity checks](docs/AUTHENTICITY.md). MIT; preserve [LICENSE](LICENSE) and [NOTICE](NOTICE.md). Maintainer: [Fan-dev-sktch](https://github.com/Fan-dev-sktch).
