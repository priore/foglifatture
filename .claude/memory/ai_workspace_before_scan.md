---
name: ai-workspace-before-scan
description: before investigating code structure/architecture, check AI-Workspace/ docs first instead of a full-project scan
metadata:
  type: feedback
---

Before investigating code structure/architecture, consult `AI-Workspace/WORKSPACE_MANIFEST.md` and the already-generated docs (`ARCHITECTURE.md`, `UI_ANALYSIS.md`, `PROJECT_ANALYSIS.md`, `COMPONENT_LIBRARY.md`, etc.) instead of launching an Explore subagent that scans the whole project from scratch.

**Why:** the AI-Workspace docs are already maintained as the source of truth for stack, structure, and patterns. Redoing the scan every time wastes tokens and ignores work already done.

**How to apply:** for "where does X live", "how does Y work", "what pattern does Z use" — read the relevant AI-Workspace docs first. Only if the information is missing or stale, use a targeted grep or a minimal investigative agent (never a full scan).
