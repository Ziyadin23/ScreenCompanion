# Design

## Context

See [proposal](proposal.md). The user's Windows 11-only decision removes Windows 10 from W6's target matrix. The current source is unpublished beta.7 at `6449e21`; the issue's application candidate remains published beta.6. Existing beta.6 packaged activation and public-update results are scoped to a Windows 11 development VM. The available VM and its retained snapshot are not established clean Windows installations; neither a new synthetic app profile nor a system-only PATH establishes missing developer tools.

## Goals / Non-Goals

Make the Windows 11-only support boundary explicit and obtain candidate-specific fresh-environment evidence. Preserve published assets, failed attempts and dated historical observations. Do not change native compatibility code, qualify Windows 10, run a live model campaign or change the application version for documentation alone.

## Decisions

### Support boundary

After applying this plan, README and setup guidance will say **Windows 11 x64**. `docs/VERIFICATION.md` will own a dated support matrix separating existing development-VM results from pending fresh-account/machine qualification. Update the current W6 row and current native gate summary; preserve dated Windows 10 observations and historical release documents. Label retained Windows 10 affinity fallback details as implementation history, not supported deployment guidance. Change the repository description from Windows 10/11 to Windows 11 and read it back. Source, release tags, binaries and packaged README snapshots remain unchanged.

### Candidate identity

Use unchanged [published beta.6](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.6) artifacts. The 2026-11-07 GitHub readback reported:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-Setup-v0.5.0-beta.6.exe` | 123112251 | `4c473e9dbaf41d736655841923b550b88c9cdc00da2ca365691b9950a708d23a` |
| `SC-v0.5.0-beta.6.exe` | 111663196 | `9f2e1b70deeb23fb6465248c6af692685d9fc77d4e6ff84590e9ef7eafe7b3ef` |
| `SC-v0.5.0-beta.6.zip` | 111672562 | `34f195df175fabf68f9fb57c6dbeede7c939199b1cb174584fc9f9184041f508` |

Rehash actual transferred bytes before execution and compare ZIP contents with the portable EXE. Metadata readback alone is not a new download or runtime pass. Do not substitute a beta.7 build for beta.6 evidence.

### Required environment and procedure

Use an available isolated Windows 11 x64 clean machine/VM with a fresh Windows account and no separately installed Node/npm, .NET SDK/runtime, Visual Studio/C++ Build Tools or Windows SDK. Record edition, version/build, architecture, account privilege level, whether the account and OS installation are new, installed-software/tool-location inventory, prior SC presence and any runtime redistributables already present. A fresh account on a development machine may provide account evidence only; it cannot pass the clean-machine condition. Do not remove tools from the shared development lab to manufacture this result.

Run qualification through Windows shell/OS facilities without installing a Node, .NET or compiler-based test runner in that environment. Any private PowerShell/OS observer must be reviewed before use and must not supply missing application dependencies. All Windows GUI windows stay inside a headless VM, following repository verification rules. Recover shared-lab ownership and independent prior-owner postflight before any guest session; a powered-off VM alone is insufficient.

| Phase | Required observation |
| --- | --- |
| Baseline | Fresh-account/machine conditions above; no installed SC, legacy/current SC vault or SC process. Use synthetic data only. |
| Install | Launch the pinned per-user installer as an ordinary user. Confirm no required elevation or runtime/tool installation, successful exit, expected installed version and shortcuts. Retain any Windows warning separately from application failure. |
| First startup | Start the installed copy through its shortcut. Confirm usable first-run service/key setup, no missing-runtime/native-load failure, and normal exit. |
| Settings | Enter a synthetic key, save nondefault appearance/response preferences, exit normally and relaunch. Confirm encrypted settings creation and values restored, Settings Save applies changes and Back discards drafts. Never submit a question or contact a provider. |
| Portable | Start the pinned portable EXE independently, with the installed process closed. Exercise first-run setup in a separate fresh account/profile as appropriate, then Save/relaunch/settings retention and normal exit. State which isolation is actual Windows-account isolation versus app-profile isolation. |
| Postflight | Independently inspect process/input cleanup and byte preservation of any pre-existing protected objects. Record exact commands, exits, versions and private receipts; retain test-created synthetic settings as owned evidence or remove only reviewed, precisely owned resources. Restore the initial lab state. |

Publish only content-free results and the exact tested matrix. These observations establish packaged dependencies/setup/settings, not live answer quality, recorder exclusion, mixed-DPI support or foreign-account DPAPI rejection.

### Missing environment

Host inventory on 2026-11-07 found only a Windows 11 development VM among registered Windows VMs. Its retained snapshot is described as a lab after recorder checks, not a clean baseline. No clean machine was provided or booted in this session. The next runtime step requires an identified clean Windows 11 environment and its private access/ownership record. Preserve this blocker; no environment or account is to be provisioned as an unrecorded workaround. The Windows 11 support documentation can proceed independently during apply.

## Risks / Trade-offs

- Bundled runtime mistaken for proved dependency independence → separate package inspection/PATH checks from actual tool-free machine results.
- New profile mistaken for a new account or clean OS → record all three conditions separately and leave unsupported cells pending.
- Windows 10 removed from targets but still advertised elsewhere → inspect README, user/support guidance, current native summary and repository description; retain dated history with explicit scope.
- Later source or package changes invalidate evidence → bind every run to artifact hashes and revalidate affected checks for changed bytes. Follow versioning and beta handoff rules if a source defect requires a new application binary.
