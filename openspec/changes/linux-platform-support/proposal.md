# Proposal

## Why

The Fedora/Hyprland Linux port already has substantial implementation. The user selected OpenSpec as the sole workflow for shared and Linux work; carry the accepted Linux requirements, existing progress and unresolved verification into one active change without restarting or rewriting the port.

## What Changes

- Adopt OpenSpec as the Linux port's planning owner and install its Codex, Claude Code and OpenCode integrations.
- Translate the accepted Linux PRD and execution record into behavioral delta specs, a design grounded in the existing source, and tasks with explicit imported evidence.
- Preserve the initial supported matrix: Fedora 44 x86-64, Hyprland Wayland, secure Linux keyring and RPM distribution, with unchanged Windows behavior and request/privacy contracts.
- Keep target qualification open for installed-app capture/cancellation, keyring recovery, compositor actions, RPM upgrade, authenticated proxies, Settings-to-answer sizing and final integration. Link the existing GitHub issues #14–#20.
- Remove superseded workflow skills, commands, outputs and backups; retain the accepted requirements and progress in OpenSpec. Point agent guidance and existing project tracking to this OpenSpec change.

## Capabilities

### New Capabilities

- `linux-desktop`: Portal-selected screen questions, existing request behavior, desktop controls, relaunch and recording-visibility disclosure.
- `linux-settings`: Secure keyring encryption, recoverable storage failures and isolation from Windows settings.
- `linux-networking`: Linux provider transport with the established proxy, TLS, cancellation and deadline contracts.
- `linux-packaging`: Supported Fedora RPM installation, desktop identity, manual upgrades and platform-specific packaging.

These capture the previously accepted feature scope; they do not assert that the unfinished behavior is verified. No main specs exist in this worktree yet.

### Modified Capabilities

None. Existing Windows and pipeline contracts remain owned by their current guides/rules and are preserved by the Linux change.

## Impact

- Workflow migration changes `openspec/`, agent integrations and `AGENTS.md`; public project records receive references to the new owner. Private operational state remains outside Git.
- The feature's existing source spans `desktop/src/contracts`, `main`, `platform`, `storage`, `renderer`, related tests and `desktop/package.json`/RPM scriptlets. Those application, test and build bytes are preserved during this migration.
- Existing checks are imported with their candidate/attempt limits from `docs/VERIFICATION.md`; no new runtime, model-quality or release result is implied.
- Main-branch integration, application fixes, new regression/lab runs, artifact delivery and publication remain subsequent work. The port stays unmerged and unpublished until those steps are actually completed.
