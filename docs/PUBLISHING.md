# Publishing SC

## Source and release status

`main` develops the Electron/TypeScript application under `desktop/`. Read its
version from `desktop/package.json` and publication status from the
[README](../README.md#release-status). The current version is 0.5.0-beta.2 and has
not been published as a GitHub release. Existing C# releases, assets and tags stay
unchanged; the full previous application can be built from the
[v0.4.14 tag](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14).

Moving development to `main` does not close unfinished runtime/recorder checks or
promote the beta to a stable release. Source-only documentation or test changes
do not require a different application binary. Preserve the actual README and
verification snapshot associated with every already distributed build.

The public repository retains its `ScreenCompanion` URL. Product/executable names
use SC; historical URLs and asset names retain their actual identifiers.

## Distribution build

1. Read the parent workspace's `AGENTS.md` and `PROJECT_CONTEXT.md` for current
   artifacts, lab state and unfinished checks before release or local delivery work.
2. Use a new version for each changed application binary intended for distribution.
   Update `desktop/package.json` and both root package-version fields in
   `desktop/package-lock.json`, then reconcile README/status and private context.
3. On Windows x64, install Node.js 22.12+, Visual Studio C++ Build Tools and the
   Windows SDK. From `desktop/`, run:

   ```powershell
   npm ci
   npm run verify
   npm run native:build
   npm run test:windows
   npm run test:ui
   npm run package:win
   npm run package:zip
   ```

   The .NET 10 SDK and Windows Desktop runtime are needed only by the test-only
   legacy vault fixture. The application includes its Electron runtime.
4. `package:win` writes the portable EXE under `desktop/dist/`. `package:zip`
   creates its matching ZIP containing exactly that EXE and `README.txt` and
   prints SHA-256 digests. Neither command publishes a GitHub release.
5. Complete the applicable [verification gates](VERIFICATION.md), including
   packaged startup, standalone activation, clean-account/machine and named-recorder
   output checks before making corresponding compatibility claims.

## Local beta handoff

After beta application changes, build a new version and leave its verified EXE,
matching two-file ZIP and README in the local transfer folder configured in the
parent workspace's private instructions. Retain earlier versioned artifacts and
update the local latest-build record with the version, filenames and SHA-256
digests. Verify the copied bytes before reporting completion; source-only changes
to application behavior are not a runnable handoff. Keep the folder path and
private delivery evidence in the parent `PROJECT_CONTEXT.md`, outside this repository.

Test the packaged version with an isolated key-free profile. Local beta delivery
does not publish a GitHub release or change the latest stable download.

## Verify and publish

1. Verify the EXE's platform, embedded version, product name, size and SHA-256.
   Check ZIP integrity and exact entries; compare archived EXE/README bytes with
   the intended source assets. Assets contain only key-free builds/documentation;
   vaults, private bundles, credentials, screenshots and recordings stay outside them.
2. Update the README and release notes with the actual publication state, named
   runtime/recorder checks and remaining limits. Keep mocked assertions, real
   Windows checks and live API results distinct.
3. Commit the intended public source/documents and push the source and matching
   annotated version tag without rewriting published history.
4. Upload assets to a draft release. Compare GitHub-reported sizes and SHA-256
   digests with the verified local files before publishing, then repeat against
   the public release.
5. Record commit/tag, asset hashes, publication status and resulting private lab
   state in the parent workspace's `PROJECT_CONTEXT.md`.

Changes to source-only documentation after a release do not rewrite its packaged
README or binaries. The previous C# publishing procedure remains available in
[the v0.4.14 snapshot](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/docs/PUBLISHING.md).
