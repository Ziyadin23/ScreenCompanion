# Design

## Context

See [proposal.md](proposal.md). The README owns publication status and a concise introduction; existing guides own detailed behavior, build prerequisites and verification history. Other documents link to `#release-status` and `#build-and-further-documentation`.

## Goals / Non-Goals

Make first-use information easy to scan while retaining download, privacy and qualification limits. Application changes, support expansion, release publication and new verification campaigns are outside this edit.

## Decisions

- Use this order: introduction/navigation, release status, quick start, shortcuts, panel/settings, models/pipelines, privacy/limits, builds/documentation, license. Put Windows and Linux setup under separate subheadings.
- Keep current published beta, historical stable and unpublished source visibly distinct. Preserve existing release URLs and both linked headings.
- Link detailed release changes and test counts to their existing owners instead of repeating them. Keep one ordinary source-check command block; route packaging/native/preview instructions to contributor and test guides.
- Prefer this focused edit over moving documents or adding new documentation owners; those would broaden a README organization task.

## Risks / Trade-offs

- Shortening content can obscure important limits: compare against the original README and owning guides before completion.
- Heading changes can break navigation: preserve existing inbound anchors and run the repository's Markdown checker.

## Migration Plan

Review the local documentation diff; normal source publication can follow separately. Reverting this documentation edit restores the prior layout without affecting application data.
