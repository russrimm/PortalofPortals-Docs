# Flow Specification — Agent Analyzer

> Handoff document for the design team (Figma) and the engineers who will wire it.
> Companion to:
> - [`agent-analyzer-jtbd.md`](./agent-analyzer-jtbd.md)
> - [`agent-analyzer-journey.md`](./agent-analyzer-journey.md)

---

## Information architecture

One new tab on the existing agent detail page. No new destination in the left nav.

```
Power Platform
  Copilot Studio
    Agents                                (existing)
      HR Helper                           (existing detail page)
        ├ Analytics                       (existing)
        ├ Components                      (existing)
        ├ Transcripts                     (existing)
        ├ App Insights                    (existing)
        ├ Settings & Instructions         (existing)
        └ Analyzer                        (NEW)
```

**Route registry** — no new routes to register. The tab is a query-param on the existing
page: `/power-platform/copilot-studio/[agentId]?tab=analyzer`.

**File additions**:

```
src/app/power-platform/copilot-studio/[agentId]/
  page.tsx                                                    (MODIFY — add tab)
  components/
    AgentAnalyzerPanel.tsx                                    (NEW — client component)
    analyzer/
      FindingsList.tsx                                        (NEW)
      TranscriptChat.tsx                                      (NEW)
      KnowledgeGroundingCard.tsx                              (NEW)
      ToolsUsageTable.tsx                                     (NEW)
      ReasoningTimeline.tsx                                   (NEW)
      CreditEstimateCard.tsx                                  (NEW)
      TranscriptPicker.tsx                                    (NEW)

src/app/api/power-platform/copilot-studio/agents/[botId]/
  analyze/route.ts                                            (NEW — server)

src/lib/copilot-studio/analyzer/
  index.ts                                                    (NEW — public API)
  parse-bot-definition.ts                                     (NEW — port of agent_parser.py)
  parse-transcript.ts                                         (NEW — port of transcript_parser.py)
  analysis/
    findings.ts                                               (NEW — severity engine)
    knowledge.ts                                              (NEW — search/grounding)
    tools.ts                                                  (NEW — usage/hidden failures)
    reasoning.ts                                              (NEW — chain-of-thought)
    credit-estimate.ts                                        (NEW)
    cross-reference.ts                                        (NEW — YAML vs transcript)
  types.ts                                                    (NEW — Zod schemas + types)
  NOTICE                                                      (NEW — MIT attribution)
```

---

## User flow

**Entry point**: Maya clicks the **Analyzer** tab on an agent detail page.

### Screen 1 — Empty state (no transcript selected)

Full-width panel content (matches existing tab layout):

```
┌─────────────────────────────────────────────────────────────────┐
│  Analyzer                                                       │
│  Diagnose a single conversation against this agent's build.    │
│  No AI — deterministic heuristics, runs in your tenant.        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [📄 Pick a recent transcript ▼]                              │
│                                                                 │
│   ─── or ───                                                    │
│                                                                 │
│   ┌─────────────────────────────────────────────────────┐     │
│   │   Drop a conversation-details.json here             │     │
│   │   (exported from the Copilot Studio test pane)      │     │
│   └─────────────────────────────────────────────────────┘     │
│                                                                 │
│   [ ? How do I download a transcript? ]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Dropdown pulls from the same source as [TranscriptsPanel.tsx](../../src/app/power-platform/environments/modals/components/TranscriptsPanel.tsx).
  Sort: most recent first. Search: by user name / conversation ID.
- Drop zone accepts `.json` only. Validates on client with a Zod schema before uploading.
- Help link opens a `<Dialog>` with the 3-step instructions from the upstream README.

### Screen 2 — Analyzing (loading)

Skeleton for each section. Target render time < 2 s for a 20-turn transcript.
Show a small footer: *"Analyzing 24 turns · 12 tool calls · 8 searches"*.

### Screen 3 — Modern-agent-only guard

If the BotDefinition YAML does not match the `cliagent` template (i.e., classic
topic-based bot), show:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔒  This agent uses the classic topic-based template.         │
│                                                                 │
│  Analyzer supports modern agents (cliagent template) only —    │
│  instructions + knowledge + tools, no topics or orchestrator.  │
│                                                                 │
│  Classic-agent analysis is tracked in [issue #N].              │
└─────────────────────────────────────────────────────────────────┘
```

Do not offer the transcript picker at all in this state.

### Screen 4 — Report (transcript loaded)

Six collapsible sections in this order. Findings is open by default; everything else is
collapsed on first render.

```
┌─────────────────────────────────────────────────────────────────┐
│  Conversation · 24 turns · 3 min ago · [Change transcript]    │
│  [ ⬇ Download report (Markdown) ]  [ ⬇ HTML ]  [ 🖨 Print ]   │
├─────────────────────────────────────────────────────────────────┤
│  ▼  🚨  Findings (5)                                           │
│      ┌───────────────────────────────────────────────────────┐│
│      │ 🔴 Critical · Ungrounded answer at turn 4     [Jump]  ││
│      │   Contains factual claim with no citation.             ││
│      ├───────────────────────────────────────────────────────┤│
│      │ 🟡 Warning  · Over-retrieval at turn 6         [Jump] ││
│      │   Retrieved 8 docs, cited 1.                           ││
│      ├───────────────────────────────────────────────────────┤│
│      │ 🟡 Warning  · Skill-gap fallback at turn 9    [Jump]  ││
│      │   Wanted 'creating-pptx', fell back to python.         ││
│      ├───────────────────────────────────────────────────────┤│
│      │ 🟢 Info     · Unused knowledge source                  ││
│      │   'HR Policies 2024' declared, never searched.         ││
│      ├───────────────────────────────────────────────────────┤│
│      │ 🟢 Info     · Undeclared tool call                     ││
│      │   'searchWeb' called, not in BotDefinition.tools.      ││
│      └───────────────────────────────────────────────────────┘│
│                                                                 │
│  ▶  💬  Conversation (24 turns)                                │
│  ▶  🔍  Knowledge & grounding                                  │
│  ▶  🔧  Tools & actions                                        │
│  ▶  🧠  Reasoning                                              │
│  ▶  💳  Copilot Credit estimate · ~12 credits (heuristic)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Interactions**:
- **[Jump]** on a finding row → expands the Conversation section, scrolls to the exact
  turn, highlights it with a 2 s fade.
- **[Change transcript]** → back to Screen 1, keeps analysis in memory for undo.
- **Download** actions run entirely client-side (report is already in memory).
- Every section header shows a count/summary so collapsed state is still informative.

---

## Design principles

1. **Findings first, detail on demand**
   The one thing Maya wants to see is *"what's wrong and where?"*. Everything else is
   evidence backing that up. Collapse everything except Findings.

2. **Every finding jumps to a location**
   Never a finding without a link. The whole time saving is "click → land on the exact
   turn". If we can't link it, don't surface it.

3. **Speak in the maker's vocabulary**
   Use YAML field names as they appear in Copilot Studio (`knowledgeSources`,
   `authenticationMode`, `cliagent`) — don't invent our own terms. Reuse
   [botParsers.ts](../../src/app/power-platform/environments/modals/utils/botParsers.ts)
   translators.

4. **Deterministic, in-tenant, no AI**
   Say so, twice — in the tab intro copy and in the credit estimate footnote. Users
   who need LLM-graded prompt analysis have `InstructionsAnalysisPanel` for that.

5. **Feature-detect, don't guess**
   Classic bots get a clear empty state, not a broken report. Same for transcripts with
   fewer than 2 turns, or transcripts from a different agent (validate `botId`).

6. **Complement, don't duplicate**
   Components, App Insights, and Analytics tabs already exist. Analyzer links out to
   them ("See full component tree" → Components tab) rather than re-rendering them.

---

## Accessibility requirements

### Keyboard navigation
- [ ] Tab strip reachable via arrow keys (already implemented on existing tabs — extend).
- [ ] Section headers are `<button>` with `aria-expanded` — Enter/Space toggle.
- [ ] `[Jump]` on findings is a real link (`<a href="#turn-4">`) so it works with
      keyboard, screen readers, and back-button.
- [ ] File drop zone reachable via keyboard: focusable, Space triggers native file
      picker as an alternative to drag-drop.
- [ ] Escape closes the "How do I download a transcript?" dialog.

### Screen reader support
- [ ] Each finding has an accessible name that includes severity, category, and turn
      number: *"Critical: Ungrounded answer at turn 4"*.
- [ ] Loading skeleton uses `aria-live="polite"` with *"Analyzing 24 turns"* so SR
      users know work is in progress.
- [ ] Chart-like widgets (retrieval depth, credit estimate) have a `<table>` fallback
      or `aria-describedby` narrative.
- [ ] Deep-link jump uses `aria-live="polite"` announcement: *"Jumped to turn 4"*.

### Visual accessibility
- [ ] Severity uses **icon + color + text label** — never color alone.
      🔴 Critical, 🟡 Warning, 🟢 Info.
- [ ] All text passes WCAG AA (4.5:1) against `portal-card` background — verify against
      existing `portal-*` tokens in [globals.css](../../src/app/globals.css).
- [ ] Findings-highlight fade must respect `prefers-reduced-motion`: no fade, just a
      2 s outline.
- [ ] Interactive targets ≥ 24 × 24 CSS px (upstream guidance from
      copilot-instructions).

### Copy accessibility
- [ ] Findings copy uses plain English, not jargon: *"Retrieved 8 docs, cited 1"* not
      *"Over-retrieval ratio 0.125"*.
- [ ] Each finding has a "Learn more" link to the relevant Microsoft Learn doc (reuse
      the reference dataset that upstream ships in `data/`).

---

## Theming

Follow the theming rule from `.github/copilot-instructions.md` — no inline colors.
Use existing `portal-*` tokens:

- `portal-card` for each collapsible section container.
- `portal-pill` for severity badges (add semantic variants: `portal-pill--critical`,
  `portal-pill--warning`, `portal-pill--info` in `globals.css` if not present).
- `portal-tile` for the Copilot Credit estimate.
- Reuse the badge classes already used in [page.tsx](../../src/app/power-platform/copilot-studio/[agentId]/page.tsx)
  for `statusCodeBadgeClass` / `authModeBadgeClass` style — matches the rest of the
  detail page.

---

## Security & BFF alignment

Per `.github/copilot-instructions.md`:

- ✅ All analysis runs **server-side** in `/api/power-platform/copilot-studio/agents/[botId]/analyze/route.ts`.
  Client only receives the report DTO.
- ✅ Route calls `verifyAuth()` as the **first line** of the handler; returns
  `UNAUTHORIZED_RESPONSE` if no session.
- ✅ Request body validated with Zod: `{ transcriptSource: 'stored' | 'upload',
  conversationId?: string, transcriptJson?: unknown }`.
- ✅ Uploaded transcript JSON validated against a strict schema before parsing. Reject
  files > 2 MB (matches `bodySizeLimit`).
- ✅ No tokens exposed to the client. BotDefinition fetched server-side via
  `getDataverseTokenForUser()`.
- ✅ No secrets in logs. Log conversation ID and finding counts only, never transcript
  content.
- ✅ MIT attribution: `NOTICE` file in `src/lib/copilot-studio/analyzer/` credits
  the upstream repo.

---

## Success criteria

The design/build is done when:

1. Maya can go from **agent detail page → root cause of a bad answer in < 5 min**
   without opening App Insights or the raw YAML.
2. A P2 admin can scan the Findings list on someone else's agent and give a
   publish / no-publish call without asking the maker.
3. Every finding has a working `[Jump]` link.
4. Classic agents show the empty-state guard, not a broken or empty report.
5. Report renders in < 2 s for a 20-turn transcript on a typical dev laptop.
6. Report is downloadable as Markdown, HTML, and printable — with no data leaving the
   client.
7. Report is a11y-clean: keyboard-only run through all interactions, SR announces
   findings and jumps.

---

## Handoff notes for engineering

When ready to build, the module-by-module TS port plan (Python → TypeScript file mapping,
route contract, Zod schemas) is a separate `agent-analyzer-implementation.md` — not
included here to keep this UX document focused. Ping when you want that spec.
