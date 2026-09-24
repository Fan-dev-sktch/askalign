# Privacy and storage

## 0.5.0 preference migration

启动时，如果默认新目录 `~/.config/spellout/` 没有 preferences.json，则只复制旧默认目录中的这一个文件。新文件已存在时不覆盖；自定义 `SPELLOUT_SETTINGS_PATH` 不触发迁移。旧答案、上下文、缓存都不迁移，旧文件不移动、不删除。

旧设置目录：`~/.config/grill-me/`。确认无需旧记录后可手动删除；迁移不会替你删除。

The local server makes no model API calls and includes no telemetry or remote answer service.

## Local record cleanup

`npm run forget` only lists records older than 30 days. `npm run forget -- --older-than 30d --yes` explicitly deletes those records. No cleanup runs on startup. The command only handles recognized question, answer, revision, acknowledgement, context and connection/heartbeat records; it preserves preferences and unrelated files. Recent decision groups and contexts referenced by retained questions are protected. Back up records you want to keep; deleted records cannot be recovered by this command.
Card status polls may create a local per-decision connection marker with the first connection time, in the same answers directory. This records a bridge connection from some card instance, not device identity, proof of visibility, or whether the assistant is active. It is not sent to an analytics service.
Questions, choices and submitted answers are handled by the MCP host and may become part of its conversation history, subject to that host's policies.
Drafts and completed state use optional host widget-state storage. Issued questions and submitted answers are also saved locally in `~/.config/spellout/answers/` (alongside a custom `SPELLOUT_SETTINGS_PATH`, or in `SPELLOUT_ANSWERS_DIR` when specified). This permits recovery if the host receives a selection but gives the model only a placeholder. Each record is keyed by its random decision ID; there is no global latest-answer read tool. Unselected custom drafts are not saved by the server. These files remain until deleted; deleting the answers directory removes the recovery records and invalidates pending cards. It is not cloud synchronization. File modes request owner-only access on supporting systems; Windows access follows the directory's ACLs.

Preferences contain intensity, coverage, depth, frequency, diversity, challenge level and questions per round. They are stored at
`~/.config/spellout/preferences.json`, or `SPELLOUT_SETTINGS_PATH` when explicitly configured.
Preferences are shared by tasks using that file. Legacy temporary tool overrides are not written. Card task settings and editable goal/confirmed/open summaries are stored as versioned context records in the answers directory, keyed by a random context ID. Subsequent cards in the same task reuse that context ID. A task update does not change global defaults; the separate Save as future default action does.
Use the preference tool's reset action to return to balanced defaults; delete the file to remove saved settings.

On storage timeout, the save is unconfirmed. Status reads recover saved answers; retrying the same answer is idempotent. Cards do not automatically send a conversation follow-up, including for corrections, summaries and settings. Saving alone cannot restart an ended assistant turn.
There is no cross-client exactly-once guarantee, and expired cards in older conversations cannot be globally revoked by this plugin.

Answer corrections append numbered revision records; original submitted answers remain until the corresponding files are deleted. Per-revision acknowledgement records store the assistant's stated next step, not proof that execution finished. Summary/context revisions also preserve previous values to prevent silent overwrites from concurrent clients. Drafts stay in the UI until saved. Settings and summary updates are read by the assistant through the task context and answer tools, without appending another user message.
