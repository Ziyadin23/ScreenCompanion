# Regression tests

Before portable or Windows test changes/runs, read the corresponding `Portable/AGENTS.md` or `Windows/AGENTS.md` and [README.md](README.md) for commands/fixtures.

- The production project compiles only `src`; tests link production code rather than duplicating implementations. Keep links current when source files move.
- Fixtures contain no real credentials or assessment material.
- Grade the structured primary answer and displayed first line independently. Preserve failed attempts and avoid substring-only answer oracles that accept an expected number in an unrelated explanation.
- Keep mocked results distinct from real capture, Windows UI/DPAPI, recorder output, and live model quality. Passing portable assertions does not resolve historical live extraction/crop/answer failures.
- Keep live-run captured content in memory.
- Record counts and actual exit status for the suites run. Source moves need compile/link validation and the existing relevant suites, rather than new tests that merely restate file locations.

For VM or physical USB checks, first read the parent workspace's `PROJECT_CONTEXT.md` and record resulting private state there. Keep that evidence out of public test fixtures and release assets.
