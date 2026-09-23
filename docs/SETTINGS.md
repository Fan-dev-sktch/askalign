# Clarification preferences / 提问强度

Say “Set AskAlign to deep exploration by default” or “将 AskAlign 默认设为深入探索”.
The assistant calls `grill_me_preferences` with `action: set` and `preferences: {intensity: deep}`.
Available intensity values: `minimal`, `balanced` (new-install default), `deep`.

Optional controls:

| Field | Values | Meaning |
|---|---|---|
| coverage | focused / broad | Current decision / wider goals and scenarios |
| depth | decision / motivation | Sufficient answer / reasons and trade-offs |
| frequency | blocking / milestones / discovery | Blockers only / batch at milestones / follow new uncertainties |

`set` replaces preferences. Omitted controls derive from the selected preset.
`get` reads saved defaults; `get` with preferences produces temporary instructions without saving.
`reset` saves balanced defaults. Invalid files produce a visible error instead of being silently overwritten.

Install the included skill for automatic reads at task start. The MCP tool alone cannot force an assistant to ask good questions. Test model behavior separately from configuration persistence.

## Adaptive questioning / 根据回答追问

The skill and preference policy instruct the assistant to reuse known answers, distinguish assumptions from stated needs, explain how each question affects the work, and ask dependent follow-ups one at a time. Deep mode stops once there is enough information to proceed. These are model instructions, not a deterministic branching engine or a persistent customer profile; actual conversation quality requires live evaluation.

## Explicit requirements interview / 显式多轮需求确认

Say “先和我多轮问答，确认真实需求再行动” to request a task-only interview, regardless of your saved intensity. There is no fixed total round count. The assistant follows your answers, summarizes the requirements, and waits for your confirmation before implementation. A normal answer or the card's automatic “请继续” continues the interview. “别问了” stops questions; “按现有理解开始做” explicitly exits into execution. This is a skill and policy instruction, not a technical execution lock; verify compliance in real conversations.

## Scenario checks / 场景检验

For a material ambiguity, the assistant uses a short, task-grounded scenario, asks about one trade-off, then converts the answer into an observable acceptance condition. It must label assumptions, accept corrections or uncertainty, and avoid asking for answers already given. A scenario answer does not bypass the final confirmation required by interview mode.

Manual conversation checks (not automated model evaluations):

| Input or situation | Expected behavior |
|---|---|
| “让这个界面更专业”，with no further criteria | Use a relevant usage scenario to distinguish readability, information density or presentation needs; do not silently equate professional with decorative. |
| User has already said legibility matters more than decoration | Reuse that requirement; do not ask the same trade-off again. |
| “不对，我用的时候通常没有网络” | Update the connectivity assumption and affected acceptance criteria, preserving unrelated answers. |
| “这个例子不适用 / 我还不确定” | Mark unresolved or revise the scenario; do not count it as agreement. |
| An interview card answer ends with “请继续” | Continue clarification, not implementation. |

Record actual dialogue and observed failures before claiming these checks pass. Package and UI tests do not measure the assistant's understanding.

## Uninstall / 卸载

For a direct MCP install: run `codex mcp list`, then remove the registered name with `codex mcp remove askalign` (older installations may use `grill-me-ui`). Remove the skill folder you installed, preserving any unrelated local edits. For plugin installs use the host's plugin removal UI instead.
After stopping the server, the checkout can be removed. Removing saved preferences is optional; their location is described in PRIVACY.md.
To update a direct install, retain the checkout location, update source, run `npm ci`, `npm run configure`, and `npm test`, then restart the host. Do not register a duplicate server.

## Technical usage and legacy installations

The previous display name was Grill Me. The internal plugin ID, `grill_me_*` tools, skill directory and saved settings paths retain their legacy names for compatibility. New MCP registrations use `askalign`, and the server advertises AskAlign. Existing direct registrations named `grill-me-ui` are still recognized and must not be duplicated. Hosts may derive the activity label from the registration name; those older direct installs need a deliberate registration migration to change that label. Restart the host after updating a plugin registration; historical activity entries may retain their old labels. Attribution is in NOTICE and LICENSE.

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
