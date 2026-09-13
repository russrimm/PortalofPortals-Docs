# User Journey — Agent Analyzer

> Journey map for the primary job: **diagnose a misbehaving conversation**.
> Companion to [`agent-analyzer-jtbd.md`](./agent-analyzer-jtbd.md) and
> [`agent-analyzer-flow.md`](./agent-analyzer-flow.md).

---

## Persona in focus

**Maya, Copilot Studio Maker**

- Owns 4 modern agents for her ops team (HR helper, IT triage, onboarding buddy, expenses).
- Uses the Copilot Studio test pane daily; opens App Insights maybe once a week.
- Trigger for this journey: a colleague pings her — *"the HR bot said we have unlimited
  PTO. We don't. What happened?"*
- Success signal: within 5 minutes she can say *"the knowledge source ranks the wrong
  doc first when the query mentions 'PTO', and the answer had no grounded citation —
  I'll re-scope the knowledge source and add an instruction guard."*

---

## Journey stages

### Stage 1 — Trigger: "why did the agent say that?"

- **Doing**: Reads the Teams message from her colleague. Copies the offending answer.
  Opens Portal 360, navigates to Power Platform → Copilot Studio → HR Helper.
- **Thinking**: *"I need the exact conversation, not general stats. App Insights will
  be a rabbit hole."*
- **Feeling**: 😬 Mild dread — last time this took an hour and she never fully proved
  the root cause.
- **Pain points**:
  - The Analytics and App Insights tabs are aggregate — she can't isolate one conversation.
  - Raw transcripts are readable but tedious; no visual link to the agent's declared
    knowledge sources or tools.
- **Opportunity**: A **per-conversation** view that ties transcript events back to the
  build definition, on the same page she's already on.

### Stage 2 — Awareness: notice the Analyzer tab

- **Doing**: Lands on the agent detail page. Sees the tab strip: Analytics · Components ·
  Transcripts · App Insights · Settings & Instructions · **Analyzer** (new).
- **Thinking**: *"Analyzer — what's this? Is this the AI thing or something new?"*
- **Feeling**: 😌 Curious. Tab label is clear enough that she doesn't need to click
  around.
- **Pain points**:
  - Risk: confusion with the existing "Settings & Instructions" LLM-graded prompt
    analyser. Needs a differentiating micro-copy: *"Analyze a single conversation."*
- **Opportunity**: Tab tooltip on hover: *"Diagnose a specific conversation against
  the agent's build definition. No AI — deterministic heuristics."*

### Stage 3 — Exploration: pick a transcript

- **Doing**: Clicks Analyzer. Sees empty state: *"Pick a conversation to analyze"*
  with (a) a dropdown of recent transcripts from the existing Transcripts data source,
  and (b) a drag-drop zone for a `conversation-details.json` from the test pane.
- **Thinking**: *"I have the timestamp from the Teams message — I'll find it in the
  dropdown. Or I could re-run it in the test pane and download."*
- **Feeling**: 🙂 In control — she has two ways in.
- **Pain points**:
  - Transcript list needs to be filterable/searchable — she has hundreds.
  - Timestamps matter here even though modern transcripts don't carry them internally —
    the Dataverse conversation record has a created-on.
- **Opportunity**: Sort by most recent, search by user, one-click "load latest".

### Stage 4 — Action: read the report

- **Doing**: Report renders in < 2 s. Six sections, collapsed by default except
  **Findings**:
  1. **Findings** (severity-tagged: Critical / Warning / Info) — open by default
  2. **Conversation** — chat-style transcript with inline reasoning, citations,
     rendered Markdown
  3. **Knowledge & grounding** — which searches ran, which docs were cited, which
     were retrieved but never cited (over-retrieval), per-document grounding chain
  4. **Tools & actions** — per-tool call/complete/fail counts, hidden-failure detection
     (a `completed` status that actually failed), generated outputs
  5. **Reasoning** — chain-of-thought timeline, sandbox / code-interpreter purpose split,
     skill-gap fallbacks
  6. **Copilot Credit estimate** (small) — heuristic per-conversation credits with a link
     to the billing doc
- **Thinking**: *"Findings say 'Ungrounded answer at turn 4 — no citation, contains
  factual claim'. That's the PTO answer. Knowledge tab shows a search ran but returned
  low-relevance results and the model answered anyway."*
- **Feeling**: 😃 Actual clarity. She has a hypothesis she can test.
- **Pain points**:
  - Report must not overwhelm — six sections × ten sub-widgets = paralysis. Findings
    first, everything else collapsed.
  - Every finding must be **clickable** — jumps to the exact turn in the transcript.
- **Opportunity**: Empty-section states (*"No hidden failures detected"*) so she trusts
  the check ran.

### Stage 5 — Outcome: fix, verify, close the loop

- **Doing**: Clicks a Findings row → transcript scrolls to turn 4, highlights the
  offending answer. Clicks "Open in Copilot Studio" (deep-link) to edit the knowledge
  source. Re-runs in test pane, downloads new transcript, re-analyzes. Finding is gone.
- **Thinking**: *"That took 4 minutes. I can send my colleague a real answer with a
  fix."*
- **Feeling**: 🎉 Competent.
- **Success metrics**:
  - Diagnosis-to-fix loop under 5 min.
  - Finding disappears on re-analysis (visible proof the fix worked).

---

## Emotional arc

| Stage           | Feeling               | Why                                             |
|-----------------|-----------------------|-------------------------------------------------|
| Trigger         | 😬 Dread              | Past pain, no good tools                        |
| Awareness       | 😌 Curiosity          | New tab, clear label                            |
| Exploration     | 🙂 In control          | Two entry paths, familiar data                  |
| Action          | 😃 Clarity            | Findings-first, cross-referenced report         |
| Outcome         | 🎉 Competence         | Fast fix, visible verification                  |

The whole point of the analyser is turning **😬 → 🎉** in five minutes.

---

## Secondary journey (P2 — pre-publish sanity check)

Shorter version, same tab:

1. **Awareness** — admin opens agent detail page for someone else's agent.
2. **Exploration** — picks the most recent test-canvas transcript from the dropdown.
3. **Action** — scans Findings only. Ignores Conversation / Reasoning detail.
4. **Outcome** — either "no critical findings, approved for publish" or "sends a list of
   3 fixes back to the maker with deep-links to the offending turns".

Success signal: admin never has to open the raw YAML or App Insights to make the call.

---

## Anti-patterns to avoid

- ❌ Auto-analyze the "most recent" transcript on tab open — hides the picker, breaks
  Maya's mental model of "I picked *this specific* conversation".
- ❌ Show findings without linking to the exact turn — forces the maker to search the
  transcript manually, killing the time saving.
- ❌ Mix v1 single-conversation analysis with v2 aggregate trends in the same view —
  different jobs, different personas' expectations.
- ❌ Duplicate the Components tab hierarchy — link to it, don't rebuild it.
- ❌ Present the Copilot Credit estimate as authoritative — always show it as
  *"heuristic estimate, based on the [official billing model]"*.
