# Probe result 2 — did the repo's SessionStart hook fire?

## 1. Does the session-start context contain `TAMA-DIRECT-HOOK-OK`?

**YES.**

It appeared as a system-level message in this session's opening context, placed
immediately after the initial `<system-reminder>` block (the one carrying
`claudeMd` / `userEmail` / `currentDate`) and before the probe instructions.
The line read, verbatim:

```
SessionStart:startup hook success: TAMA-DIRECT-HOOK-OK
```

No manual step was taken to produce it, and it was not read out of any file in
the repository.

## 2. Full list of skills available this session

```
- session-start-hook: Creating and developing startup hooks for Claude Code on the web. Use when the user wants to set up a repository for Claude Code on the web, create a SessionStart hook to ensure their project can run tests and linters during web sessions.
- morning: Render the user's morning brief as a styled HTML artifact, or set it up as a recurring weekday task. Use only when the user explicitly asks to run, see, or set up their morning brief, or if they invoke /morning by name. A question about their day, schedule, or calendar is not by itself a request for the brief; answer it directly instead.
- skill-creator: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
- xlsx: Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .xltx, .csv, or .tsv file (e.g., adding columns, computing formulas, formatting, charting, cleaning messy data); create a new spreadsheet from scratch or from other data sources; or convert between tabular file formats. Trigger especially when the user references a spreadsheet file by name or path — even casually (like "the xlsx in my downloads") — and wants something done to it or produced from it. Also trigger for cleaning or restructuring messy tabular data files (malformed rows, misplaced headers, junk data) into proper spreadsheets. The deliverable must be a spreadsheet file. Do NOT trigger when the primary deliverable is a Word document, HTML report, standalone Python script, database pipeline, or Google Sheets API integration, even if tabular data is involved.
- pptx: Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This includes: creating slide decks, pitch decks, or presentations; reading, parsing, or extracting text from any .pptx or .potx file (even if the extracted content will be used elsewhere, like in an email or summary); editing, modifying, or updating existing presentations; combining or splitting slide files; working with templates (.potx), layouts, speaker notes, or comments. Trigger whenever the user mentions "deck," "slides," "presentation," or references a .pptx or .potx filename, regardless of what they plan to do with the content afterward. If a .pptx or .potx file needs to be opened, created, or touched, use this skill.
- pdf: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
- docx: Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', '.dotx', or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx or .dotx files, inserting or replacing images in documents, performing find-and-replace in Word files, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', 'template', or similar deliverable as a Word or .docx file, use this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation.
- design: Create a design canvas — a multi-artboard visual design published as an Artifact that runs Claude Design's canvas editor (an early preview of Claude Design inside Claude Code). You DRAFT the design as .dc.html artboards laid out on one pan/zoom canvas; where saving is enabled for the user's account they refine every element visually (click-to-select, a properties panel, inline text editing, undo/redo) and Save publishes a new version for everyone, otherwise they get a view-and-export (PNG/PDF) preview of your draft. Good for UI mockups and screen flows, landing pages, marketing and social graphics, and print pieces — posters, flyers, brochures as single-page artboards; memos and reports as one flowing artboard. Use when someone wants a design, mockup, wireframe, UI or screen design, landing page, poster, flyer, brochure, banner, card, one-pager, or any visual layout they would rather tweak by hand than in code. Only for CREATING or re-seeding a canvas; an existing one is edited in its published Artifact.
- dataviz: Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: "chart", "graph", "plot", "data viz", "visualization", "dashboard", "analytics", "visualize data", "categorical colors", "sequential / diverging palette", "stat tile", "sparkline", "heatmap", "legend", "axis", "tooltip", "chart colors", "color by series".
- artifact-design: Design guidance and fundamentals for Artifacts. - Load before writing any artifact, including Markdown ones — format is part of the design pass, never a speed shortcut.
- artifact-diagramming: Diagramming know-how for Artifacts — when a picture earns its place, how to draw one that shows the real mechanism, and the inline-SVG mechanics that keep it legible in both themes.
- artifact-capabilities: Runtime capabilities a published Artifact page can be granted — behavior static HTML cannot provide on its own, such as the page reading live or connected data, keeping state shared across viewers, handing the viewer a file to save, or updating and republishing itself. Serves this user's live capability roster and the typed call definitions. Load it whenever the user asks for an artifact needing any such runtime behavior.
- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors ("from now on when X", "each time X", "whenever X", "before/after X") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions ("allow X", "add permission", "move permission to"), env vars ("set X=Y"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: "allow npm commands", "add bq permission to global settings", "move permission to user settings", "set DEBUG=true", "when claude stops show X". For simple settings like theme/model, suggest the /config command.
- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: "rebind ctrl+s", "add a chord shortcut", "change the submit key", "customize keybindings".
- code-review: Review the current diff, or a PR number/branch/path target, for correctness bugs and reuse/simplification/efficiency cleanups at the given effort level (low/medium: fewer, high-confidence findings; high→max: broader coverage, may include uncertain findings); with no level given, it reuses the level you typed last. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review.
- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.
- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.
- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo, defaults to 10m) - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. "check the deploy every 5 minutes", "keep running /babysit-prs"). Do NOT invoke for one-off tasks.
- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.
TRIGGER — read BEFORE opening the target file; don't skip because it "looks like a one-liner" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).
SKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).
- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).
- init: Initialize a new CLAUDE.md file with codebase documentation
- security-review: Complete a security review of the pending changes on the current branch
```

Note: no plugin-provided skills (e.g. from `tama-fleet@tama-agents`) appear in
that list.

## 3. `claude --debug -p "hi" 2>&1 | grep -i hook | head -40`

The command ran and exited 0, but the grep matched nothing — the output was
empty:

```
```

For context, the same invocation without the grep produced exactly one line of
output and no debug logging at all:

```
$ claude --debug -p "hi"
Hi! What can I help you with?
EXIT=0
```

## 4. `cat .claude/settings.json`

```json
{
  "extraKnownMarketplaces": {
    "tama-agents": {
      "source": {
        "source": "github",
        "repo": "TimOfHyrule/Tama-AgentManager",
        "ref": "claude/agentmanager-review-nr3c1l"
      },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "tama-fleet@tama-agents": true
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo TAMA-DIRECT-HOOK-OK"
          }
        ]
      }
    ]
  }
}
```

## 5. `ls -la ~/.claude/` and `cat ~/.claude/settings.json`

```
$ ls -la ~/.claude/ 2>&1
total 84
drwxr-xr-x  9 root root  4096 Aug 20 19:51 .
drwx------ 15 root root  4096 Aug 20 19:51 ..
-rw-r--r--  1 root root    24 Aug 20 19:50 .last-cleanup
drwxr-xr-x  2 root root  4096 Aug 20 19:50 backups
-rw-------  1 root root   716 Aug 20 19:50 launcher-settings.json
drwxr-xr-x  3 root root  4096 Aug 20 19:50 plugins
-rw-------  1 root root   214 Aug 20 19:50 policy-limits.json
drwx------  3 root root  4096 Aug 20 19:50 projects
-rw-------  1 root root     2 Aug 20 19:50 remote-settings.json
drwxr-xr-x  3 root root  4096 Aug 20 19:50 session-env
-rwxr-xr-x  1 root root  4766 Aug 20 19:50 session-start-git-identity.sh
drwx------  2 root root  4096 Aug 20 19:50 sessions
drwxr-xr-x  2 root root  4096 Aug 20 19:51 shell-snapshots
drwxr-xr-x  4 root root  4096 Aug 20 19:50 skills
-rwxr-xr-x  1 root root  6395 Aug 20 19:50 stop-hook-git-check.sh
-rwxr-xr-x  1 root root 11699 Aug 20 19:50 stop-hook-reply-gate.py
-rwxr-xr-x  1 root root  3630 Aug 20 19:50 user-prompt-submit-reply-reminder.py
```

```
$ cat ~/.claude/settings.json 2>&1
cat: /root/.claude/settings.json: No such file or directory
```
