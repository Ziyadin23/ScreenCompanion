# Windows setup qualification design

## Candidate

The coordinated issue worktree starts at main `4667e43365dd4690d111057f23d85bbd87212372`. This includes setup through PRs #109 and #110, panel persistence through #119 and Responses validation through #111. The open Settings save and Hyprland resize source changes (#59 and #19) have their own PRs. Beta.14 stays reserved for #84. Record the new version, commit, tree, source manifest, artifact hashes and environment for this run.

## Verification

- Use the Windows development lab after recorded release, exclusive claim and fresh readiness. Compare the protected files and installed application before and after the run.
- Use isolated synthetic profiles. Exercise the real Windows setup view and record which storage cases use DPAPI, Windows file errors or an injected response. Exercise the Linux keyring guidance with the renderer fixture. Record the scope of Windows contrast settings and preference overrides.
- Run the full Windows UI suite, native and vault suites, and focused Responses pipeline tests. Keep the two same-profile resize restarts visible in the report.
- Launch the exact portable EXE and the application installed by the exact installer with isolated key-free profiles. Verify the application payload, local visibility and saved output in the named recorder path. Inspect archive contents, binary versions and hashes before delivery.
- Preserve earlier candidate records and failures. Record the Windows lab release or the recovery hold in the private workspace.

## Delivery

Use [Publishing](../../../docs/PUBLISHING.md#local-beta-handoff) for local files. Independent review covers the final diff, issue evidence and the copied bytes. Keep raw lab evidence in the private workspace.
