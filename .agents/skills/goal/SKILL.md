---
name: goal
description: Drive long-running engineering work against explicit acceptance criteria, retaining evidence and continuation state across sessions.
---

# Goal-driven engineering

Use this skill for the 6.1Terra completion goal. The user’s instructions take precedence over this skill.

1. Read `GOAL.md`, `AGENTS.md`, and the relevant source and tests before changing the project. Preserve the original acceptance criteria; do not replace them with weaker proxies.
2. Select the next unfinished action by impact, dependencies, correctness, and verification risk. Implement it, run the relevant checks, investigate failures, fix them, and rerun the affected checks. Continue to the next action without waiting for routine approval.
3. Keep `GOAL.md` concise and current at meaningful checkpoints. For every criterion, distinguish implemented, verified, incomplete, and externally unverified work. Record actual commands, results, important defects, and the next executable action. Never infer a successful test or mark uncertain work complete.
4. When a tool, test, or environment fails, record the failure and attempt a materially different justified approach. Continue independent work while external blockers remain. Record exact constraints and distinguish them from implementation defects.
5. Before context compaction, interruption, commit, or handoff, update the ledger with the current state and next action. On a new session, resume from that state and inspect the working tree rather than repeating finished work.
6. Before any requested commit or push, review the diff, exclude secrets and generated clutter, run the applicable checks, and accurately retain unresolved criteria in the ledger. Follow the user’s actual push authorization. Never declare completion while acceptance criteria remain unmet or unverified.
