# Proposal

## Why

[Issue #11](https://github.com/Ziyadin23/ScreenCompanion/issues/11) originally requested Windows 10 and fresh-account/machine evidence for published Windows beta.6, or an explicitly narrower support matrix. On 2026-11-07 the user selected Windows 11 only and dropped Windows 10; fresh Windows 11 installation/startup and settings without developer tools remain unqualified.

## What Changes

- Limit current Windows support claims to Windows 11 x64. Retain Windows 10 implementation details and historical evidence as history, without a current support or qualification promise.
- Bind remaining Windows 11 qualification to the unchanged published beta.6 installer and portable artifacts, recording the Windows version, account and machine conditions actually exercised.
- Verify first installation, standalone startup, setup and persisted settings without separately installed Node, .NET or build tools as application dependencies.
- Reconcile user-facing support claims with the user's Windows 11 decision and resulting evidence. Keep the fresh-environment gate open until its acceptance passes; dropping Windows 10 does not establish that result.
- Record an actionable checkpoint when the required environment is unavailable, preserving earlier failures and candidate-specific limits.

## Capabilities

No application behavior or spec-level requirements change. This qualification/documentation change declares `skip_specs: true`; no new or modified capability is proposed. A reproduced source defect would require revising this plan before application implementation.

## Impact

This change owns W6 continuation. Support/evidence updates belong in README, `docs/USER_GUIDE.md`, `docs/VERIFICATION.md`, `docs/STATUS.md` and the native evidence map. Reconcile the GitHub repository description with Windows 11 only. Private lab identities, tooling and receipts stay outside Git. The initial planning delivery excluded provisioning; during follow-up #39 on 2026-11-07 the user explicitly authorized creating a suitable Oracle VirtualBox VM because no existing clean environment was available. Provision a separate clean Windows 11 VM and fresh ordinary accounts for this qualification, preserving the existing development lab. No release, paid provider campaign or developer-tool removal is included.
