# Privacy and storage

The local server makes no model API calls and includes no telemetry or remote answer service.
Questions, choices and submitted answers are handled by the MCP host and may become part of its conversation history, subject to that host's policies.
Drafts and completed state use optional host widget-state storage. Issued questions and submitted answers are also saved locally in `~/.config/grill-me/answers/` (alongside a custom `GRILL_ME_SETTINGS_PATH`, or in `ASKALIGN_ANSWERS_DIR` when specified). This permits recovery if the host receives a selection but gives the model only a placeholder. Each record is keyed by its random decision ID; there is no global latest-answer read tool. Unselected custom drafts are not saved by the server. These files remain until deleted; deleting the answers directory removes the recovery records and invalidates pending cards. It is not cloud synchronization. File modes request owner-only access on supporting systems; Windows access follows the directory's ACLs.

Preferences contain only intensity, coverage, depth and frequency. They are stored at
`~/.config/grill-me/preferences.json`, or `GRILL_ME_SETTINGS_PATH` when explicitly configured.
Preferences are shared by tasks using that file. Temporary task overrides are not written.
Use the preference tool's reset action to return to balanced defaults; delete the file to remove saved settings.

On submission timeout, delivery is unknown. Do not resend until checking the conversation.
There is no cross-client exactly-once guarantee, and expired cards in older conversations cannot be globally revoked by this plugin.
