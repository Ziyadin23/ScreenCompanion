# Qualify first-run setup on Windows

## Why

The ten first-run setup fixes merged through [PR #109](https://github.com/Ziyadin23/ScreenCompanion/pull/109). [PR #110](https://github.com/Ziyadin23/ScreenCompanion/pull/110) records their source and browser results. The issues also require Windows verification and a versioned local beta.

## What Changes

- Verify each setup issue in the protected Windows application on a numbered candidate.
- Verify Windows settings encryption and recovery, native controls, packaged startup and saved recorder output.
- Run the Windows resize restart checks for #61 and the Responses pipeline tests for #62 on the source included in the same candidate.
- Record the exact candidate, earlier results and any remaining checks. Deliver the four versioned Windows files after verification and independent review.

## Impact

The qualification and delivery record is in [tasks.md](tasks.md).
