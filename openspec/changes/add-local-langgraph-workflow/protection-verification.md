# Main protection verification — task 8.2

Status: protection applied and verified on 2026-11-11 at 15:43:15 UTC;
independent read-back completed at 15:43:18 UTC. The user accepted the policy and
bounded experiment, and independent review accepted the narrow personal-repository
encoding correction. [Task 8.2](tasks.md#8-policy-bound-protected-automatic-merge)
is complete. [The proposal](protection-proposal.json) preserves prior observations,
the failed attempt, original accepted hash and current payload with actual results.

## Settings under review

Require pull requests and these five checks: `changes`, `documentation`,
`portable`, `windows-build`, `agent-workflow`. Require an up-to-date branch,
enforce the rules for administrators, allow no bypass actors, force pushes or
branch deletion. Require zero GitHub approving reviews for this solo-maintainer
repository; independent agent review remains a separate runner gate. Preserve
all unrelated settings, including `allow_auto_merge=false` and squash support.

The canonical JSON payload SHA-256 is
`f36c41238043c4efa52ea205e19ce27ef21737e884481797b64ae71dd995e7b7`.
Its seven-field protection policy is unchanged. GitHub rejected the original
payload with HTTP 422 because this personal repository cannot accept explicit
empty user/team bypass allowances. Only that unsupported empty object is now
omitted; no bypass actors must still be verified on read-back. This is an API
encoding correction to the accepted policy, not new user approval of this hash.
Fresh read-back before the attempt found unprotected main `14cfae18`, no
rulesets, and all five checks supplied by `github-actions`, app ID `15368`.

GitHub accepts successful, neutral or skipped required checks. SC's stricter
documented route permits deliberate `portable`/`windows-build` skips for a
documentation-only diff; the other three gates must succeed. Missing, pending,
cancelled and failed checks do not pass. The existing contexts payload lets
GitHub select the recent check provider; verify all five app bindings on read-back.
See [GitHub's protection API](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)
and [required checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).

## Bounded isolated experiment

Use exactly three new branches, two PRs targeting the temporary base, and one
successful merge into that temporary base. Probe content is synthetic Markdown;
no application, workflow, settings, credentials or private data change. No probe
PR targets main. No required statuses are forged and no administrator bypass is
used. Use the existing workflow unchanged. New-ref push events may select its
conservative full route; do not weaken or skip those jobs to save time.

Owned names, checked for absence before creation:

- `sc-protection-8-2-20261111-base`
- `sc-protection-8-2-20261111-candidate`
- `sc-protection-8-2-20261111-advance`

Tag both PR bodies with `<!-- sc-protection-probe:8.2:20261111 -->` and record
their returned numbers, refs, source SHAs and API outcomes before the next effect.
Existing names or an ambiguous create response require read-back, not a fresh
create attempt. Do not reclaim resources merely because their names match.
Limit cumulative CI observation to 30 minutes and poll at most every 30 seconds.
Do not rerun a failed acceptance job. A timeout or unexpected result stops the
experiment and keeps 8.2 open, followed by ownership-checked cleanup.

1. Freshly read main protection, complete rulesets, repository merge settings,
   main SHA and check providers. Compare them with the accepted proposal. An
   intervening stricter rule or settings drift requires reconciliation before
   any overwrite. Record concurrent main advancement separately.
2. Create the temporary base from that main SHA and install the exact accepted
   protection payload on this base only. Independently read back every rule,
   zero bypass actors and the five app bindings. Do not continue on a mismatch.
3. Create the candidate branch with one synthetic Markdown file containing an
   intentionally missing local link, then open PR A against the temporary base.
   Observe actual CI failure of `documentation` for that link. Confirm PR A is
   ready, nonconflicting, and bound to the observed failing head. Attempt its
   normal squash merge through `PUT /repos/Ziyadin23/ScreenCompanion/pulls/N/merge`
   with that exact head `sha`. Require server rejection attributable to the
   failed checks, `merged=false`, and unchanged temporary-base SHA. Wrong-head,
   draft, conflict or transport errors are not passing rejection evidence;
   record the exact HTTP status and response reason, not just nonzero exit.
   Authentication, missing-resource or malformed-request failures do not pass.
4. Correct only the synthetic link on the same candidate branch. Observe the
   new head's successful documented check route, normal merge eligibility and
   current independent read-back. Retain the failed first head and its run.
5. Create the advance branch from the unchanged temporary base, with a different
   harmless Markdown file, then open PR B against that base. Require its actual
   successful checks and exact-head squash merge. Read back its merged result
   and new temporary-base SHA. The files must be disjoint so PR A remains
   nonconflicting. This positive control also establishes that these credentials
   can merge an eligible PR under the rule.
6. PR A now has a formerly green head behind the protected base. Require
   `mergeStateStatus=BEHIND` or equivalent explicit strict-base rejection, with
   its successful checks still attributable to the tested head. Attempt its
   exact-head squash merge normally after confirming the PR head is unchanged
   and the advanced base is not an ancestor of that head. Require server
   rejection for the stale base, `merged=false`, and unchanged advanced-base SHA.
   An unrelated missing or pending head check, failure, head mismatch, draft or
   conflict is not this result. Strict-base invalidation can require fresh
   integration checks even while the unchanged head checks remain green;
   preserve that literal response and distinguish the controlled causal
   inference from explicit server wording.
7. Close PR A without merge. Remove only the owned temporary-base protection,
   then delete only the three recorded owned refs after verifying their current
   SHAs. Read back closed/merged PR states and absence of the owned rule/refs.
   Cancel only still-running experiment-owned CI runs if cleanup requires it.
   If any identity drifted, preserve it and report the cleanup outstanding.

## Main activation and rollback

Only after accepted settings, reviewed source, both valid rejection results and
complete probe cleanup, freshly read main and repository settings again. Apply
the accepted `operation.body` once with the proposal's `PUT` endpoint; do not
PATCH repository-wide merge options. An acknowledgement loss means unknown:
read current state before retrying. Read back exact rules, `protected=true`,
strict checks/app bindings, PR requirement, enforced administrators, no bypasses,
no force pushes/deletion, and unchanged repository merge options/rulesets.

Observe the current main's named checks and record the source and its route;
this does not claim a new application, platform or automatic-delivery pass.
If main advanced concurrently, reconcile its identity and evidence before
activation instead of presenting the older SHA as current.

The recorded pre-change protection is absent. Rollback is therefore deletion of
only the newly installed main protection. It is not automatic: main rollback
requires separate recorded acceptance or manual action, after proving the
current rule still matches this operation's read-back.
Never remove an intervening rule or overwrite another actor's change. Read back
restoration to unprotected main and unchanged merge options; otherwise retain
the exact unknown/partial state and escalate. Routine successful execution keeps
main protected. Temporary-rule removal is cleanup, not removal of main protection.

Record all receipts and limitations in the existing task owner. Mark 8.2 complete
only after main activation/read-back and controlled rejection evidence exist.
Issue #28 and other unfinished workflow tasks remain open. This experiment is
not the genuine documentation-delivery pilot in 8.5 and does not enable parser
automerge, change `allow_auto_merge`, or qualify the Windows beta capability.

## Initial setup attempt

The isolated base ref was created from main `14cfae18`. The original protection
PUT returned HTTP 422 with `Only organization repositories can have users and
team restrictions`. No temporary rule or PR was created. The owned base ref was
deleted and absence independently read back. No main setting or ref changed.
The original accepted payload hash and reported rejection are preserved in the
proposal; its original temporary raw files later became unavailable. The
coordinator authorized review of the narrow serialization correction above.

## Observed results

Main stayed at `14cfae18b4dfd3e0a56d2b28fcdaedcdeceea804` throughout the
experiment and activation. No probe merged into main. The two probe PRs are
[PR #44](https://github.com/Ziyadin23/ScreenCompanion/pull/44) and
[PR #45](https://github.com/Ziyadin23/ScreenCompanion/pull/45).

| Stage | Observed source and outcome |
| --- | --- |
| Fresh failed-check proof | PR #44 head `bece31a974aac40f7f0e3c32091e335362144b8d`; [run 43049444182](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/43049444182) failed on the intentional missing Markdown target. One exact-head merge returned HTTP 405: `4 of 5 required status checks are failing.` Head/base were unchanged and REST reported `merged=false`. |
| Repair | Normal commit `f3472d9f6b7f7fd5f1b190f34c2858a96db78180` passed the documented route: three successful gates and two deliberate application skips. PR #44 was clean/mergeable before base advancement. |
| Positive control | PR #45 head `1f585761240c5f0d7c4826b45a78cb858b851424` had five successful gates. Its exact-head squash merge returned HTTP 200 and advanced only the isolated base to `1e8a68f5c4c684856e260886f11ed17fd5fe245d`. |
| Stale-base proof | The unchanged repaired PR #44 head remained green but became `BEHIND`/mergeable; target/head divergence was 1/4 commits. One exact-head merge returned HTTP 405: `5 of 5 required status checks are expected.` The actual target/head stayed unchanged and REST reported `merged=false`. |
| Cleanup | At 15:42:33 UTC, PR #44 was closed unmerged, PR #45 retained its isolated-base merge, all three owned refs and the temporary rule were absent, and all owned CI runs were terminal. |
| Main activation | One corrected-payload PUT returned HTTP 200 at 15:43:15 UTC. Independent read-back at 15:43:18 UTC confirmed the exact approved rules and unchanged main source, repository merge options and empty rulesets. |

The strict-base cause is an inference from the controlled change: only the target
advanced after the same head passed, and its policy/app bindings stayed unchanged.
The server literal above does not mention base. REST pull `base.sha` retained its
earlier snapshot; actual target identity came from branch/git-ref read-backs.
Independent review accepted that combined evidence without another merge attempt
or a CI rerun.

An interruption removed the original temporary raw receipts. Earlier agent
tool output/handoff still reports the first `72d55ff6` failed-check rejection,
with [its original failed CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/43024682133),
but no original raw file is claimed retained. The coordinator authorized the
fresh failure/repair above on the existing PR #44, without new PRs/refs or
workflow reruns. New exact requests/responses, source/check observations and
cleanup/activation receipts are retained persistently outside Git.

Main now requires PRs, the five strict checks from `github-actions` app ID
`15368`, zero GitHub approving reviews and enforcement for administrators, with
no bypass actors, force pushes or branch deletion. `allow_auto_merge=false`,
squash support and unrelated settings remain unchanged. No main rollback was
invoked. Other workflow gates remain open; this is no automatic-delivery or
application/platform qualification claim.
