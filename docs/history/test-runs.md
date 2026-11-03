# Test-run history

Dated material moved without changing its claims from `tests/README.md` at source `74c7ebd` on 2026-11-03. Current commands remain in [tests](../../tests/README.md), and current outcomes in [verification](../VERIFICATION.md).

## Portable suite history

Beta.5 passed **1,167 tests in 25 files** on Linux and Windows, exit 0. After
the initial lab-ledger recovery fix, Linux and Windows verification passed
**1,181 tests in 25 files** and the standalone lab selftest passed **220 tests
in ten files**, exit 0. After further continuity hardening, Linux and Windows
verification passed **1,215 tests in 26 files** and the lab selftest passed
**254 tests in 11 files**, exit 0. See
[current recorded results](../VERIFICATION.md#beta5-implementation-and-verification)
for the separate native, UI, package and live boundaries.

Beta.4 passed **1,065 tests in 21 files** on Linux, exit 0, including **143 lab tests in seven files**. Its dated evidence remains in the verification reference.

Beta.3 passed **865 tests in 14 files**, exit 0, on Linux and Windows. Update
coverage includes explicit download/install, blocked restarts, failed feeds and
downloads, safe metadata/diagnostics, portable isolation and Settings draft retention.
Beta.2 previously passed **846 tests in 12 files**. Coverage
includes delayed/failed vault loads, early activation, overlapping setup writes,
ordered panel-size saves, applied shortcut help and malformed completion status.
The first beta.2 Linux CI attempt failed **845/846** because the input-focus
assertion raced React's passive effect. Waiting for the same strict active-element
condition fixed that test-only race without fixed sleeps or retries.

## Earlier Electron UI runs

Beta.5 passed **37 UI workflows** on
Windows 11, none skipped, exit 0, including every panel resize edge and actual
shortcut contention. An earlier run had one visibility-restoration failure that
was not reproduced in the subsequent run; see the [recorded evidence](../VERIFICATION.md#beta5-implementation-and-verification).
Beta.4 passed **16 UI workflows**, none skipped, exit 0, including real service/key
setup and five early-close relaunches.

All **12 UI workflows** passed for beta.3
on Windows 11, none skipped, exit 0: six synthetic shell workflows and six using
the production bridge. Native cases exercise shortcuts, Settings Save/Back,
protected color-dialog hide/restore/cancel, Alt-drag, corner resizing, selectable
output and hover scrolling while the main JavaScript thread is busy.

## Installed update history

The beta.3 installer has a separately recorded **17-check** Windows scenario:
per-user install and shortcuts, unavailable-feed recovery, real metadata lookup,
corrupt-file rejection, explicit valid download, automatic update/restart,
version, isolated DPAPI retention and uninstall. The older test installer used
beta.2 version metadata with the same updater implementation; the historical
portable beta.2 has no updater. The unchanged final beta.3 installer was the
update payload. A loopback HTTP feed exercised the actual updater without
publishing a GitHub release. The Windows shell restarts into the normal account
profile; a separate isolated relaunch checked the synthetic vault. Check real
vault hashes independently before/after. Keep private feed overrides and runner
paths outside source and release assets.

## Earlier packaged evidence

[Development evidence](../../desktop/REWRITE.md) records beta.1/beta.2 Windows runs,
EXE/ZIP hashes, retained failed automation attempts and their limits. The beta.2
package passed five duplicate-process workflows, direct portable startup/version/
normal exit, and archive CRC/entry/byte checks. Those dated results describe the beta.2 artifact; current beta.4 evidence is
recorded separately in the verification reference.

## Earlier recorder scope

Beta.3 Settings → Updates also has a separately inspected Edge whole-monitor
recording; it does not verify other surfaces or recorders.
