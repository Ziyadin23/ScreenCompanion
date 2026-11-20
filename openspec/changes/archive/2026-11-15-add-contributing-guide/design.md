# Design

## Context

See [proposal](proposal.md). README is the user introduction; `docs/DEVELOPMENT.md` owns the full workflow and private-workspace discovery permits public/portable work when private context is unavailable. The missing public entry point should explain that distinction without creating a second policy handbook.

## Goals / Non-Goals

**Goals:** a contributor can choose an issue, prepare a public checkout, reach the accepted OpenSpec plan and run the appropriate checks, then describe a reviewable PR.

**Non-Goals:** making Orca/private lab access a prerequisite for public contributions, changing engineering or release policy, adding governance/CLA requirements, or changing CI routing.

## Decisions

- Place the guide at root `CONTRIBUTING.md` for GitHub discovery; link it near README's navigation and from the detailed development guide.
- Keep issues, public fork/branch setup, planning, checks and PR advice in a short linear path. Link detailed standards, test prerequisites and maintainer operations rather than copying them.
- Show the existing Node/package commands and the exact OpenSpec version pinned by CI. Explain that portable/documentation checks need no real API key and private qualification is coordinated with maintainers.
- Preserve platform evidence boundaries and all existing headings/policies. Walk through a documentation correction and a code change as static navigation checks.

## Risks / Trade-offs

- Contributor instructions drifting from the full workflow → retain explicit owner links and compare commands with the manifest/CI.
- Public contributors assuming access to private resources → state the public path, report unrun checks and direct lab coordination to maintainers.
- Simplification weakening evidence/privacy requirements → retain synthetic-data guidance and explicit platform/recorder/live-result limits.
