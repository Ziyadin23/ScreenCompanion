# Design

## Context

See [proposal.md](proposal.md) for the issue and evidence gap. The packaged Windows updater already uses the public GitHub provider with explicit download and restart. The existing private installed-update runner has a public-feed scenario and journaled protection of the normal account's current/legacy encrypted vaults, size files and updater cache. Earlier restoration failures and their recovery evidence must remain intact.

## Goals / Non-Goals

**Goals:** Bind discovery, downloaded bytes, shell restart, target identity, settings and restoration to one fresh public beta.4 → beta.6 attempt. Keep machine-specific paths and evidence private.

**Non-Goals:** Changing application code or release assets, publishing a release, closing historical failed attempts, or qualifying unrelated runtime, recorder or provider behavior.

## Decisions

- Use published beta.4 as the installed predecessor and the existing published beta.6 as target. Verify genuine anonymous GitHub metadata/assets and their hashes independently. Both versions are already distributed; no rebuilt seed or local update feed is needed.
- Adapt the existing private public-update scenario in a new directory. Preserve its transaction journal, process/registry/shortcut checks, cache retention and no-overwrite restoration. Exercise the packaged GitHub configuration without feed overrides or payload edits.
- Use synthetic encrypted settings and zero provider requests. Compare original encrypted bytes and filesystem identities before and after; independently verify the closed journal, retained task cache, and absence of installation, shortcuts, locks and pending recovery.
- Compare settings structurally: IPC validation and storage reload can order object properties differently. Retain a leftover test shortcut only after proving its exact task target, original absence, file identity and settled uninstall; journal a move into the attempt's evidence directory without overwriting or deleting it.
- Record source/build scope and exact counts/exits in public documentation only after inspecting the actual reports. Update private workspace state separately. Task progress remains in this change's task file.

## Risks / Trade-offs

- Public feed/network availability may fail → retain the distinct failed attempt and its actual restoration result; never substitute local-feed evidence.
- Installer shell restart uses the normal account profile → protect the original vaults, size files and cache before installation and verify full restoration independently.
- An interrupted transaction can leave recovery pending → preserve journals, refuse a new attempt while pending, and inspect an exact recovery plan before any recovery action.
- Passing one Windows VM scenario has limited scope → keep signing, other Windows versions and unrelated release gates explicitly separate.
