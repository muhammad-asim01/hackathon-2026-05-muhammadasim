# Reflection — Muhammad Asim

> Due: EOD May 9, 2026 (before demo on May 11).

## Before the hackathon, my honest take on Claude Code was:
A fast autocomplete tool — useful for boilerplate and obvious code, but unreliable for anything touching real architecture. I expected to spend more time correcting it than I saved using it.

## Now, my take is:
It's an infrastructure problem, not a capability problem. With well-structured CLAUDE.md files at every layer, Claude Code can navigate a real Clean Architecture codebase accurately. The tool is only as good as the context you give it. The bottleneck is me, not the model.

## The 3 patterns I'll bring to my real work
1. **Sub-module CLAUDE.md files.** One per meaningful directory. Written before touching that layer. Documents the why-it's-weird, not just what-it-does. Every hour spent writing CLAUDE.md saves 3 hours of context re-establishment in future sessions.
2. **Explicit layer constraints in every fix prompt.** "Fix at the CI/CD layer only. Do not touch application code." Without this, Claude finds the nearest code touchpoint — which is rarely the right architectural layer.
3. **Plan mode for any change touching > 3 files.** Makes Claude declare what it's going to change before it touches anything. The planning step alone surfaces 80% of wrong assumptions.

## The 2 patterns I'll NOT bring (and why)
1. **Letting Claude diagnose AND fix in the same prompt.** It will fix at the wrong layer. Separate "diagnose and list" from "now fix" — confirm the approach before any code is written.
2. **Parallel agents > 3 at a time.** Beyond 3 concurrent Explore agents, context bloat cost exceeds the time savings. The combined output fills the window faster than it can be processed usefully.

## What I'd want to change in our team's workflow
Before any engineer starts a feature, they should spend 20 minutes writing a CLAUDE.md for the directories they'll touch. It feels like overhead but it's actually the highest-leverage 20 minutes of the sprint. We should also enforce "plan mode first" as a team norm — not optional, not "when you feel like it." The plan output also doubles as a lightweight architecture review artifact.

## My answer to: "would I want to keep using this on real tickets?"
[ ] Yes, default to it
[x] Yes, for some kinds of work
[ ] No, prefer manual

**Why:** High-leverage for: scaffolding new use-cases, writing documentation/CLAUDE.md files, diagnosing unfamiliar errors (especially infra/CI issues), generating test stubs. Low-leverage for: subtle bug fixes in shared infrastructure (risk of layer violations), anything requiring deep domain judgment that isn't encoded in CLAUDE.md yet. The pattern is: use it when the task has clear acceptance criteria and bounded scope. Avoid it for open-ended refactors until the codebase has better CLAUDE.md coverage.
