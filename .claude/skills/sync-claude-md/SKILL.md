---
name: sync-claude-md
description: "Update CLAUDE.md to reflect the current state of the codebase after code changes or feature additions. Use this after editing any files, adding features, fixing bugs, or changing architecture. It reviews what changed and keeps the CLAUDE.md accurate."
---

# Sync CLAUDE.md

You are updating the project's CLAUDE.md file to accurately reflect the current state of the codebase.

## Your Task

1. **Review recent changes** — look at what files were edited or created in this conversation, and what features/behaviours changed
2. **Read the current CLAUDE.md** at `.claude/CLAUDE.md`
3. **Read the affected source files** to verify the current truth (do not rely on memory alone)
4. **Update CLAUDE.md** — make surgical edits to keep it accurate. Do not rewrite sections that haven't changed.

## What to Update

Update any section where the current CLAUDE.md no longer matches reality:

- **Screens table** — if a screen moved from incomplete to done, or a new screen was added, update its status
- **What's Incomplete** — remove items that are now implemented; add newly known gaps
- **Architecture / file tree** — if new files were added or the module list changed
- **API Endpoints** — if routes were added, removed, or changed
- **Key Behaviours** — if a behaviour was implemented, removed, or modified
- **Code Style** — if a new pattern was introduced that Claude should follow in future

## What NOT to Change

- Do not rewrite sections that are still accurate
- Do not add detail that Claude can already infer from reading the code
- Do not exceed ~150 lines total — prune where you add
- Do not add commentary about the update itself ("Updated X because...") — just keep the content accurate

## Output

After updating, briefly summarise what you changed and why (1–3 bullet points). Do not show a full diff.
