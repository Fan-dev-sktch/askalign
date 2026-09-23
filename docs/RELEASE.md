# 0.4 beta release checks

## Setup improvements, 2026-09-23 (beta.2)

Added a bilingual `npm run setup` wizard and read-only `npm run doctor`. The wizard requires an explicit local confirmation (or --yes), checks Node/CLI, refuses plugin or registration conflicts, installs dependencies, runs tests, registers a missing MCP server, and installs the skill without overwriting edits. It prints a first-card prompt for a new Codex task; it does not automatically create a conversation.

Seven local suites pass, including install conflicts, disabled/moved registrations, idempotent copying and preservation of user changes. Live registration and skill copying were tested twice with the real Codex CLI in an isolated test home: first installation succeeded and the second created no duplicate. These checks do not establish macOS/Linux support or first-card rendering for a new user.


## Publication preparation, 2026-09-22

GitHub rejected the initial push because the current OAuth credential lacks workflow scope. The public snapshot retains the proposed workflow as docs/test-workflow.yml, not an enabled Actions workflow. Local Windows checks pass; remote cross-platform CI has not run.

A current Codex card submitted custom text and the live read-answer tool recovered the same text by its exact decision ID. This verifies that native submission and persisted recovery path; it does not close the full UI acceptance checklist. No user answer or transcript is included in the public package.

The interactive browser demo loads the production card HTML. It uses scripted questions and a simulated host bridge, with in-memory answers only. It is not a recording of Codex or a live model interview.

## Answer recovery update, 2026-09-22

The host recorded selected/custom answers in app-input metadata but some model turns contained only a generic placeholder. New cards save validated answers locally before sending the follow-up; `grill_me_read_answer` retrieves one exact decision ID. Skill instructions recover on placeholder turns instead of assuming the user has not answered. The host's input expansion itself is not patched.

Six local suites passed, including restart recovery of the reported custom input, ordinary choices, independent card IDs, conflicting replay rejection, unselected draft exclusion, and storage-failure UI handling. The updated plugin was installed. The existing live task remained connected to the older process (new probe decision had no persisted question record); native acceptance requires a host restart. Do not count that probe as verification of the new path. Historical cards issued before this change have no local receipt.

## Current verification, 2026-09-21

- User confirmed real Codex card rendering is stable after removing the oversized loading placeholder. Answers reached this conversation through real MCP app follow-up messages.
- Sequential single/multiple choice, Back, draft preservation, rejection, timeout, receipt restore and duplicate prevention pass DOM tests. This is not a claim that every case was exercised in the native client.
- Preferences are tested through real stdio calls, including server restart, temporary overrides, independent controls and corrupt-file recovery.
- New preferences tool requires host reload. Its influence on actual model question quality still needs native task acceptance.
- The completed receipt's expand/collapse motion remains awaiting user verification.
- Source release uses an allowlist. Old local snapshots are retained for recovery but are not shipped.
- Fresh Windows source-archive extraction, dependency install, configuration generation and all four test suites passed on 2026-09-21; dependency audit reported zero known vulnerabilities.
- Remote CI, other OS native rendering, public release and clean-profile Codex registration are not yet verified.

## Scope

One-question-at-a-time inline cards, optional Codex clarification skill, local stdio MCP server. Public repository candidate; not submitted to the official plugin directory.

## Before tagging a stable release

- [x] Extract the source archive into a new folder, install dependencies, generate local configuration and pass tests on Windows. Host registration in a second clean user profile remains unverified.
- [ ] In a fresh Codex task, verify the tool has the new locale input and one-round description.
- [ ] In the actual host, verify a two-question round occupies one card, changes after single choice, and preserves answers on Back.
- [ ] Verify multiple choice, inline Other, keyboard use, light/dark theme, and narrow width.
- [ ] Verify the final answer reaches the conversation once and work continues.
- [ ] Verify a completed card restores disabled state when the host supports persistence.
- [ ] Check the GitHub Actions Windows/macOS/Linux jobs after first push.
- [ ] Obtain maintainer approval for public release.

## Changes prepared

- Removed the final review screen; the final answer submits directly.
- Added Chinese and English UI controls and a concise follow-up message.
- Added portable local configuration generation, bilingual README and a CI matrix.
- Preserved MIT provenance and excluded backups, old previews, dependencies and local paths from Git.
- Other stays collapsed until selected; entering an answer uses the option's existing border.
- Explicit delivery errors permit retry; ambiguous timeouts stop repeat submission.
- Corrupt saved state resets safely; completed cards restore disabled state where supported.

## Local evidence (2026-09-20)

Fresh source-archive extraction: dependency install, configure and full test command succeeded on Windows. Dependency audit reported zero known vulnerabilities at that time. Tests cover both message bridges using a simulated host, not a live Codex window. The updated plugin was installed and enabled locally; existing conversations may retain earlier tool schemas until a new task is started.

Record native host acceptance here with the exact host version and observed result. Passing DOM tests alone does not close the unchecked items.
# UI resource cache

The server snapshots the card HTML at startup and advertises a content-hashed UI resource URI. After changing the card HTML, restart the plugin connection (or Codex) before acceptance testing. Existing cards may retain their previous resource; validate a newly issued card. A successful tool call alone does not prove that the host rendered the new revision.
