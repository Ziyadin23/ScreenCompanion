# Publishing SC

## Electron rewrite status

The unpublished replacement has its own version in `desktop/package.json`; the
existing C# release assets stay unchanged. On a Windows x64 desktop with Node.js
22.12+, Visual Studio C++ Build Tools, and the Windows SDK, run `npm ci`,
`npm run verify`, `npm run native:build`, `npm run test:windows`, and
`npm run test:ui` from `desktop/`. Complete interactive native, vault, activation
and recorder gates before making compatibility claims.

`npm run package:win` bundles the runtime/native module into a portable EXE in
`desktop/dist/`. `npm run package:zip` creates a matching ZIP containing exactly
that EXE and `README.txt` and prints SHA-256 digests. Check archive entries and
compare extracted bytes before publication, following the parent workspace
guidance and the verification/publishing steps below. No rewrite asset is
published automatically by these commands or CI.

## Source and documentation updates

Read the source version from `SC.csproj` and publication status from the README's release status. Update those records for their respective states; agent instructions point to them rather than caching version numbers. Source organization and documentation changes can be committed without creating a new downloadable release; preserve existing tags and release assets.

The public repository retains its `ScreenCompanion` URL. New product/executable names use SC; historical URLs and release asset names retain their actual identifiers.

## Distribution build

1. Read the parent workspace's `AGENTS.md` and `PROJECT_CONTEXT.md` for current artifacts, test evidence, and unfinished checks before release work there.
2. Use a new version for each changed binary intended for distribution. Set it in `SC.csproj` and update README commands/status and the private context.
3. From the repository root on Windows with the .NET 10 SDK, run `./publish.ps1`. It creates the self-contained x64 `publish/win-x64/SC-v<version>.exe` and copies the current README to `README.txt`.
4. A ZIP must use the matching versioned name and contain exactly that EXE and `README.txt`. Public assets contain only key-free builds/documentation; vaults, private bundles, credentials, screenshots, and recordings stay outside them.

## Verify and publish

1. Verify the EXE's platform, embedded version, product name, size, and SHA-256. Check ZIP integrity and exact entries; compare the archived EXE and README bytes with the intended source assets.
2. Update the README and release notes with the actual publication state, verified behavior, named runtime/recorder paths, and remaining limits. Keep mocked assertions, real Windows checks, and live API results distinct.
3. Commit the intended public source/documents and push the source and matching annotated version tag without rewriting published history.
4. Upload assets to a draft release. Compare GitHub-reported sizes and SHA-256 digests with the verified local files before publishing, then repeat against the public release.
5. Record commit/tag, asset hashes, publication status, and resulting private lab state in the parent workspace's `PROJECT_CONTEXT.md`, outside this public repository.

Changes to source-only documentation after a release do not rewrite its packaged README or binaries. Record the release snapshot separately from the current source documentation.
