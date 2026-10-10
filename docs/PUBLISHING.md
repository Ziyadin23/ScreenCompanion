# Publishing SC

## Source and documentation updates

Keep the project version in `SC.csproj`, the root/workspace agent guidance, and the README's release status consistent. Source organization and documentation changes can be committed without creating a new downloadable release; preserve existing tags and release assets.

The public repository retains its `ScreenCompanion` URL. New product/executable names use SC; historical URLs and release asset names retain their actual identifiers.

## Distribution build

1. Read the parent workspace's `AGENTS.md` and `PROJECT_CONTEXT.md` for current artifacts, test evidence, and unfinished checks before release work there.
2. Use a new version for each changed binary intended for distribution. Set it in `SC.csproj` and synchronize agent guidance, README commands/status, and the private context.
3. From the repository root on Windows with the .NET 10 SDK, run `./publish.ps1`. It creates the self-contained x64 `publish/win-x64/SC-v<version>.exe` and copies the current README to `README.txt`.
4. A ZIP must use the matching versioned name and contain exactly that EXE and `README.txt`. Public assets contain only key-free builds/documentation; vaults, private bundles, credentials, screenshots, and recordings stay outside them.

## Verify and publish

1. Verify the EXE's platform, embedded version, product name, size, and SHA-256. Check ZIP integrity and exact entries; compare the archived EXE and README bytes with the intended source assets.
2. Update the README and release notes with the actual publication state, verified behavior, named runtime/recorder paths, and remaining limits. Keep mocked assertions, real Windows checks, and live API results distinct.
3. Commit the intended public source/documents and push the source and matching annotated version tag without rewriting published history.
4. Upload assets to a draft release. Compare GitHub-reported sizes and SHA-256 digests with the verified local files before publishing, then repeat against the public release.
5. Record commit/tag, asset hashes, publication status, and resulting private lab state in the parent workspace's `PROJECT_CONTEXT.md`, outside this public repository.

Changes to source-only documentation after a release do not rewrite its packaged README or binaries. Record the release snapshot separately from the current source documentation.
