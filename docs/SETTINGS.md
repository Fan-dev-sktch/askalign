# Clarification preferences / 提问强度

Say “Set SpellOut to deep exploration by default” or “将 SpellOut 默认设为深入探索”.
The assistant calls `spellout_preferences` with `action: set` and `preferences: {intensity: deep}`.
Available intensity values: `minimal`, `balanced`, `deep` (new-install default). Existing saved preferences, including migrated preferences, remain unchanged.

## First use / 首次使用

下载并完成全局技能和 MCP 安装后，第一次需要澄清需求时，助手先用一张卡让用户选择：**深入探索（推荐）／适度确认／只问关键问题**。三个档位一起设置提问频率、深度、覆盖面等参数；可以自由输入自定义要求，之后也能在卡片设置中分别调整。普通事实问题、需求明确的指令不强制插入引导。已有设置的用户不重复引导。

`get` returns `onboarding.required: true` only when no preferences file exists. Reading or applying a task-only override does not save anything. Only an explicit long-term choice is saved using `set`; skipping leaves the defaults unsaved. After saving, new conversations on the same installation read the saved choice. This is local persistence, not cross-device synchronization. `reset` is also an explicit saved choice and does not restart onboarding.

The onboarding card has its own context. Start the first task card with a new context after saving, so its policy reflects the new settings. Do not reuse the onboarding context's previous policy. Whether the assistant invokes the skill correctly requires real conversation acceptance; global installation cannot force invocation in every turn.

卡片标题右侧的小折叠箭头默认收起，不单独占一行；点击展开后可查看提问设置和需求摘要。悬停或使用屏幕阅读器可读到入口说明。收起不会丢失本次草稿。每轮题数可选 1–5，默认档位仍为少问 1 题、适度确认和深入探索 3 题；不会自动提高已有用户的设置。

Optional controls:

| Field | Values | Meaning |
|---|---|---|
| coverage | focused / broad | Current decision / wider goals and scenarios |
| depth | decision / motivation | Sufficient answer / reasons and trade-offs |
| frequency | blocking / milestones / discovery | Blockers only / batch at milestones / follow new uncertainties |
| diversity | direct / varied / exploratory | Variety of examples and alternatives |
| challenge | accept / probe / challenge | How actively assumptions are questioned |
| questionsPerRound | 1–5 | Maximum questions in one round |

`set` replaces preferences. Omitted controls derive from the selected preset.
`update` changes only the supplied fields and retains all other saved controls. For “以后每轮只问一题，其他不变”, use `action: update`, `preferences: {questionsPerRound: 1}`. Switching presets still uses `set`, so obsolete overrides do not carry into the new preset. Empty updates are rejected; unreadable settings must be repaired or explicitly reset first.
`get` reads saved defaults; `get` with preferences produces temporary instructions without saving.
`reset` saves deep exploration defaults. Invalid files produce a visible error instead of being silently overwritten.

Install the included skill for automatic reads at task start. The MCP tool alone cannot force an assistant to ask good questions. Test model behavior separately from configuration persistence.

## Adaptive questioning / 根据回答追问

The skill and preference policy instruct the assistant to reuse known answers, distinguish assumptions from stated needs, explain how each question affects the work, and ask dependent follow-ups one at a time. Deep mode stops once there is enough information to proceed. These are model instructions, not a deterministic branching engine or a persistent customer profile; actual conversation quality requires live evaluation.

## Explicit requirements interview / 显式多轮需求确认

Say “先和我多轮问答，确认真实需求再行动” to request a task-only interview, regardless of your saved intensity. There is no fixed total round count. The assistant follows your answers, summarizes the requirements, and waits for your confirmation before implementation. A normal card answer continues the interview; it does not authorize implementation. “别问了” stops questions; “按现有理解开始做” explicitly exits into execution. This is a skill and policy instruction, not a technical execution lock; verify compliance in real conversations.

## Scenario checks / 场景检验

For a material ambiguity, the assistant uses a short, task-grounded scenario, asks about one trade-off, then converts the answer into an observable acceptance condition. It must label assumptions, accept corrections or uncertainty, and avoid asking for answers already given. A scenario answer does not bypass the final confirmation required by interview mode.

Manual conversation checks (not automated model evaluations):

| Input or situation | Expected behavior |
|---|---|
| “让这个界面更专业”，with no further criteria | Use a relevant usage scenario to distinguish readability, information density or presentation needs; do not silently equate professional with decorative. |
| User has already said legibility matters more than decoration | Reuse that requirement; do not ask the same trade-off again. |
| “不对，我用的时候通常没有网络” | Update the connectivity assumption and affected acceptance criteria, preserving unrelated answers. |
| “这个例子不适用 / 我还不确定” | Mark unresolved or revise the scenario; do not count it as agreement. |
| An ordinary interview card answer is submitted | Continue clarification, not implementation. |

Record actual dialogue and observed failures before claiming these checks pass. Package and UI tests do not measure the assistant's understanding.

## Uninstall / 卸载

For a direct MCP install: run `codex mcp list`, then remove the registered name with `codex mcp remove spellout`. Remove the skill folder you installed, preserving any unrelated local edits. For plugin installs use the host's plugin removal UI instead.
After stopping the server, the checkout can be removed. Removing saved preferences is optional; their location is described in PRIVACY.md.
To update a direct install, retain the checkout location, update source, run `npm ci`, `npm run configure`, and `npm test`, then restart the host. Do not register a duplicate server.

## Technical usage and legacy installations

Version 0.5.0 uses only `spellout_*` tools, the `spellout` registration, and `skills/spellout`. It is incompatible with previous registrations and cards. See RELEASE.md for migration.

The agent should send all known independent questions in a single `spellout_ask` call. If the next question depends on an answer, it should wait for that answer. It should not open a second pending card just to ask for feedback on the first.

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

Use 2–3 options; the UI adds Other. Answers are saved locally and retrieved directly with `spellout_read_answer`; cards do not append a follow-up message. Selecting an answer does not approve unrelated publishing, purchases, or destructive actions.

## Answer priority while the assistant is working / 工作中优先接收答案

The card saves its answer once through `spellout_submit_answer`; corrections use versioned `spellout_revise_answer`. Neither path calls `ui/message` or `sendFollowUpMessage`. Settings and requirements updates also save directly without appending a conversation request. A running assistant reads that exact decision with `spellout_read_answer` after each independent tool step. `waitMs` defaults to 0; up to 30000 waits for submission without blocking other tools. A timeout returns `pending`, never an assumed answer. The assistant continues bounded waits while the card is pending, processes each (decisionId, revision) once, and checks for corrections before its final response.

This is cooperative handling at tool boundaries, not host-level interruption. Saving cannot restart an ended turn: if the host stops the assistant, the user must resume the conversation explicitly and the assistant recovers the latest saved answer. There is no automatic message fallback, because that would reintroduce duplicate requests. Cards from previous major naming revisions no longer connect. Reload the plugin and issue a fresh card to use the new route.

## Card invocation acceptance / 发卡行为验收

The renderer and transport tests cannot establish whether a model invokes a card at the right time. Evaluate these cases in real conversations with the installed skill and callable tools; record actual calls, final responses, model and skill revision. Repeat across fresh and long conversations. No invocation pass rate has been measured for this revision.

| Scenario | Expected observation |
|---|---|
| An unresolved design direction: “我们应该选择什么风格？”; multiple viable directions are known | Brief recommendation plus an actual card call in the same turn |
| An unresolved name: “你推荐哪个名字？” | Actual card with distinct names; no assumption that the recommendation is approved |
| “按暖白和蓝色做，直接开始” | Execute the given direction without asking the same choice again |
| “你决定，别问我了” | Use judgment; no optional confirmation card |
| “只解释这几个风格的区别，不要提问” | Explanation without card |
| “为什么刚才没有发卡？” after a missed unresolved choice | Verify the omission and issue the missing card in the same turn |
| The matching card is already pending or its answer was already received | Reuse the pending card or process the answer; no duplicate |
| Tool unavailable or returns an error | Explicit text fallback; no claim that a card was displayed |
| “为什么这里没有发卡，是功能有问题吗？” in a diagnostic task | Diagnose invocation vs delivery; do not create an unrelated choice |

Count missed required calls and unnecessary calls separately. A correct-looking answer or an explanation of the rule does not count as a successful invocation. Improvements to skill text reduce ambiguity; they do not enforce host-level execution.

## Card resources across updates

Each HTML revision has an immutable URI. On startup the server saves the page atomically under `ui-resources` next to the preferences file (`SPELLOUT_UI_RESOURCES_DIR` overrides this location). Requests for previous revisions resolve to their exact saved bytes, with hash validation. No historical snapshots are bundled. Only revisions saved in the new runtime cache are available. Unknown or corrupted revisions fail explicitly; they are never replaced with different HTML under the same URI. This cache contains UI code, not question or answer records.

Reload the host after server updates. An already-running server from before this mechanism cannot gain the new reader without restarting. Updating while a conversation remains open can temporarily mix cached tool metadata and a different server revision; the upgrade test covers these resource requests. It does not establish native rendering acceptance or migrate a host's old server registration identity.

## Switching to conversation text / 改用文字后撤下旧卡

When the user sends a new ordinary message instead of answering a pending card, the skill instructs the assistant to call `spellout_dismiss` with that task's exact decision ID before processing the text. This is not automatic observation of composer keystrokes. Generic response placeholders and card answer messages follow answer recovery, not dismissal. Never use a global latest ID or dismiss another task's card.

Dismissal and submission share one atomic terminal record: the first write wins, repeated dismissal is safe, saved answers are preserved, and late submissions to dismissed cards are rejected. A waiting read returns `dismissed` immediately on its next check. No default choice or interview approval is implied.

New card pages check the exact decision status after initialization, every 2.5 seconds while visible, and when made visible again. On dismissal they hide the content, persist this state and report 1px height (the existing supported minimum) to the host. A failed read never means dismissal. Historical page snapshots cannot gain this behavior; the plugin cannot delete the host's tool heading or transcript entry. Reload the host after this server/tool update and test with a newly issued card.

Native acceptance still required: issue a fresh card, send ordinary text in the main composer without selecting a card answer, observe the dismiss tool call and check that the card body shrinks without a large blank region. Confirm a second task's pending card remains usable. Automated tests cover terminal-state races, retries, isolation, hidden contents, requested size and restoration; they do not prove native layout or reliable model invocation.

## Keep the turn open while a card is pending / 待答时继续等待

A newly issued card and each pending `spellout_read_answer` response carry a `continuation` with the exact decision ID and a 30000 ms wait. The skill tells the assistant to finish independent authorized work first, then repeat bounded waits without sending a final response while the card is pending. Timeout alone is neither completion nor consent. Partial multi-question drafts do not count as submitted answers.

An answer ends the wait and resumes dependent work. Ordinary new conversation text replaces the pending card via dismissal; an explicit user stop or cancellation stops waiting. Unknown IDs and transport errors require diagnosis, not endless retries. A host-imposed stop, disconnection or run limit can still end the turn: this guidance cannot enforce a host-level final-response lock or promise background execution. Recover the exact decision ID on resumption.

Tests exercise repeated timeouts followed by cross-process submission, and dismissal waking a wait. They verify the continuation data and server behavior, not the model's compliance. Native acceptance: leave a fresh card unanswered beyond one 30-second wait, verify the assistant waits again without a final reply, then answer and verify it continues once. Separately verify that ordinary text and explicit stop exit the wait.

## Answer feedback, corrections and task panels

New cards include collapsed requirements and question-settings panels, using host theme and font tokens. Requirements separate goal, confirmed requirements and open questions; users can edit them. The initial summary comes from the caller's brief, never invented by the UI. `spellout_ask` creates a context when contextId is omitted; callers reuse the returned contextId throughout the task. `spellout_read_answer` includes the latest task context and its executable policy.

Question settings expose a preset plus coverage, depth, frequency, diversity, challenge level and one to three questions per round. Changing the preset resets the finer controls. A live static wording example explains their effect; it is not an AI-generated response. Apply saves only the task; Save as future default is a separate explicit action. The model must read and follow the policy; sliders do not enforce model behavior. Context updates use expectedVersion and a stable requestId for safe retries and explicit conflicts; failed saves retain the visible draft. Reload explicitly discards a draft.

The receipt distinguishes a durably saved answer awaiting the assistant from `spellout_acknowledge`, which confirms that the assistant read and interpreted a specific answer revision. It does not assert execution completion. Corrections use `spellout_revise_answer`, preserve old records, require explicit Save correction, and are read directly without another conversation request. The assistant deduplicates by decisionId plus revision, checks the latest version before continuing, and explains the impact on work already started. Only a matching revision acknowledgement changes the receipt label; older confirmations cannot apply to later corrections. A storage timeout is not shown as confirmed; status reads can recover saved answers, and identical retries are idempotent.

Validation: `test/experience.mjs` exercises real MCP tools, isolated task contexts, default-setting boundaries, context conflicts, correction history, acknowledgements, retries and concurrent processes. `test/card-ui.mjs` covers the panels, draft retention, correction send/cancel and status labels. Browser preview uses the real local server with isolated test data and a simulated host. Codex-native tool loading, direct answer resumption, model compliance and mobile Remote still need their own acceptance.

## Phone Remote display failure / 手机看不到卡片

The September 23 phone test returned a valid decision from the MCP tool, but the user reported no card in the phone Remote interface. That decision was dismissed, not treated as consent or left polling indefinitely. Responsive CSS and desktop render tests do not establish Remote support. The user confirmed ChatGPT App Remote (not a mobile browser); the phone OS, app version and rendering/bridge capabilities remain unverified; this observation does not establish a universal platform limitation.

When the user reports a missing card, the skill stops waiting for that invisible decision, preserves any answer that won a concurrent submit, and switches to a supported question route. A built-in user-input request may be tried once for a real unresolved question if exposed by the host; acceptance of that request is not evidence of display. Until confirmed, the assistant prints the question and numbered options in ordinary conversation, including free text, instead of relying on possibly hidden tool-result text. This fallback is conversational guidance, not an automatic mobile UI or a cross-device renderer.

Native acceptance requires observing the card on the actual phone, submitting a choice there, reading the matching decision/answer in this task, and confirming no duplicate conversation request. Do not mark this passed from a narrow desktop viewport, server success, or an unobserved native request.

### Standard MCP form diagnostic

The official [ChatGPT changelog](https://learn.chatgpt.com/docs/changelog) lists standard MCP form support for iOS 1.2026.223 on August 18, 2026. This is distinct from an MCP Apps HTML card and does not establish Android support. A live `spellout_native` attempt in the current Remote conversation returned `decline` immediately, without a collected answer. The current task has approval policy `never`; the [configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) documents policy-controlled surfacing or automatic rejection of MCP elicitation prompts. This is a relevant possible blocker, not proof of a phone rendering failure or a deliberate user rejection. The plugin does not change host approval policy.

Native tool results now distinguish `answered`, `unanswered` and `unavailable`. Decline/cancel retains the client's action but never claims the user clicked it or that the form appeared. Missing form capability returns `form_not_advertised`. Unanswered/unavailable results advise numbered conversation text rather than repeated invisible requests. Successful native forms return their answer directly in the tool call and never append a follow-up message. Automated tests cover accept, custom input, decline, cancel and unadvertised capability; actual phone display and return still require native acceptance.
