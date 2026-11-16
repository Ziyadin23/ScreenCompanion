# Security policy

## Supported versions

Security fixes target SC's current Electron/TypeScript development line and new
prereleases. Report vulnerabilities affecting `main` or the latest published
Electron/TypeScript prerelease. See [release status](README.md#release-status) for
current versions and downloads.

| Version line | Security maintenance |
| --- | --- |
| Current Electron/TypeScript `main` | Maintained development line; fixes land here. |
| Latest published Electron/TypeScript prerelease | Reports accepted; fixes may require upgrading to a newer prerelease. |
| Older Electron/TypeScript prereleases | No separate backports; report issues that also affect the current line. |
| Historical C# releases, including v0.4.14 | Archived; no security maintenance. |

This maintenance scope does not establish stable-release or platform
qualification. The [verification guide](docs/VERIFICATION.md#platform-support)
records supported targets and outstanding checks.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting form](https://github.com/Ziyadin23/ScreenCompanion/security/advisories/new).
Sign in to GitHub to submit a report. You can also find the form under the
repository's **Security → Advisories → Report a vulnerability**. Keep vulnerability
details and exploit material out of public issues, pull requests and discussions.

If the form is unavailable, [open an issue](https://github.com/Ziyadin23/ScreenCompanion/issues/new)
asking only for a private security contact. Do not include the affected component,
reproduction steps, logs or other vulnerability details in that public request.
Ordinary bugs and feature requests follow [CONTRIBUTING.md](CONTRIBUTING.md).

Include what you can safely share:

- SC version or commit, installation type, OS and relevant configuration.
- Affected component, prerequisites and the access an attacker would need.
- Minimal reproduction steps or a small proof of concept using synthetic data.
- Expected protection, actual behavior and concrete impact on users or data.
- Relevant diagnostic codes/report IDs and carefully redacted technical evidence.

A suspected issue is welcome even if you cannot yet provide every detail. Never
attach real API keys, settings vaults, private screen/question/answer content,
recordings or lab account details, including in a private report. Use dummy
credentials and synthetic content. If a real credential has been exposed, revoke
or rotate it through its provider; do not send it to the maintainers.

## Scope and safe testing

Relevant reports include unauthorized access to keys or encrypted settings,
unexpected disclosure or persistence of captured content, renderer/IPC boundary
violations, and flaws in SC's provider transport, update delivery, packaging or
repository tooling. For a dependency finding, explain how SC exposes the affected
behavior and the resulting impact.

Test only systems and accounts you own or have explicit permission to test. Use
isolated local environments and synthetic data; stop at the minimum evidence
needed to show the issue. Do not access other people's data, disrupt shared
services, use social engineering or test API providers and other third-party
systems under this policy.

SC intentionally sends selected input and captured content to the configured API
provider. Provider retention and best-effort recording exclusion have documented
limits. See [privacy](docs/USER_GUIDE.md#privacy), [provider behavior](docs/USER_GUIDE.md#service-and-model-selection)
and [capture-exclusion evidence](docs/VERIFICATION.md#capture-exclusion-checks).
Explain how a suspected issue violates a documented boundary; unexpected behavior
beyond those limits is still worth reporting privately.

## Handling and disclosure

Maintainers review reports and follow up in the private GitHub thread to clarify
impact, reproduce the issue and discuss a fix or mitigation. Please use that
thread for follow-up and coordinate public disclosure with the maintainers so
users can receive a fix or useful mitigation first.

Response and fix timing depend on maintainer availability and the issue; no fixed
response or resolution deadline is guaranteed. This policy does not offer a paid
bug bounty. Discuss attribution preferences in the private thread before public
disclosure.
