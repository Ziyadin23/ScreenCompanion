# Design

## Context

See [proposal](proposal.md). README owns release/source status; the user guide owns privacy and recording limits. At intake, GitHub reported a public repository with private vulnerability reporting disabled; the authenticated user was its administrator `Ziyadin23`.

## Goals / Non-Goals

Make private reporting usable and discoverable without duplicating application behavior documentation. This does not establish security certification, platform qualification, a paid bounty, response guarantees or permission to test third-party services.

## Decisions

- Put the policy in root `SECURITY.md` so GitHub can discover it; link it from contributor and user entry points.
- Use GitHub's private reporting form and enable that repository setting. A new mailbox would require an actual owner and monitored delivery, neither of which exists in the task context. If the form is unavailable, a public contact request must contain no vulnerability details.
- Describe maintenance by development line/latest prerelease rather than hard-coded versions; README remains the version owner. Fixes target current Electron source and future prereleases, with no separate backport promise for older builds or archived C# releases.
- Ask for a concrete boundary violation and a minimal synthetic reproduction. Link existing privacy/verification limits without dismissing unexpected disclosures as intended behavior.
- Keep handling qualitative: private follow-up, reproduction, mitigation/fix and coordinated disclosure. Do not create deadlines or legal assurances on the maintainer's behalf.

## Risks / Trade-offs

- The private report form requires GitHub sign-in and depends on repository configuration → verify the enabled flag and document a non-sensitive fallback.
- Security maintenance wording can be confused with stable-release or platform guarantees → explicitly separate maintenance scope from the existing verification matrix.
- Root policy/contribution filenames trigger conservative full hosted CI under the existing router → leave CI unchanged; local work uses documentation checks and claims no application regression result.
