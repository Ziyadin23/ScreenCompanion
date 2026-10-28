# Publishing SC

## Source and release status

`main` develops the Electron/TypeScript application under `desktop/`. Read its
version from `desktop/package.json` and publication status from the
[README](../README.md#release-status). The source version is 0.5.0-beta.5; it has
not been published. Version 0.5.0-beta.4 was published as a
[GitHub prerelease](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.4)
on 2026-10-26. Existing C# releases, assets and tags stay
unchanged; the full previous application can be built from the
[v0.4.14 tag](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14).

Moving development to `main` does not close unfinished runtime/recorder checks or
promote the beta to a stable release. Source-only documentation or test changes
do not require a different application binary. Preserve the actual README and
verification snapshot associated with every already distributed build.

The public repository retains its `ScreenCompanion` URL. Product/executable names
use SC; historical URLs and asset names retain their actual identifiers.

## Distribution build

1. Read the parent workspace's `AGENTS.md` and follow its private-operations route
   to current artifacts, lab state and unfinished checks before release or local
   delivery work.
2. Use a new version for each changed application binary intended for distribution.
   Update `desktop/package.json` and both root package-version fields in
   `desktop/package-lock.json`, then reconcile README/status and private context.
   Search `README.md`, `docs/` and `desktop/REWRITE.md` for the previous current
   version; update operational instructions and current-status text against the
   package version and README release status, preserving dated evidence for
   earlier builds.
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
4. `package:win` writes both `SC-Setup-v<version>.exe` (NSIS per-user installer)
   and `SC-v<version>.exe` (portable) under `desktop/dist/`. `package:installer`
   builds only the installer. `package:zip` creates the portable ZIP containing
   exactly its EXE and `README.txt`, and prints SHA-256 digests. All packaging
   commands use `--publish never`; none publishes a GitHub release.
5. Complete the applicable [verification gates](VERIFICATION.md), including
   packaged startup, standalone activation, clean-account/machine and named-recorder
   output checks before making corresponding compatibility claims.

## Local beta handoff

After beta application changes, build a new version and leave its verified EXE,
matching portable two-file ZIP, installer and README in the local transfer folder configured in the
parent workspace's private instructions. Retain earlier versioned artifacts and
update the local latest-build record with the version, filenames and SHA-256
digests. Verify the copied bytes before reporting completion; source-only changes
to application behavior are not a runnable handoff. Keep the folder path and
private delivery evidence in the parent `PROJECT_CONTEXT.md`, outside this repository.

Test the packaged version with an isolated key-free profile. Local beta delivery
does not publish a GitHub release or change the latest stable download.

## Installer update feed

`electron-updater` reads the packaged GitHub feed for
`Ziyadin23/ScreenCompanion`. Installed builds check at startup; downloading and
installation are explicit actions in Settings. Portable and preview builds have
no updater. The installer is per-user, never requests elevation, creates Desktop
and Start menu shortcuts and preserves existing local vault files on uninstall.
No GitHub token or user API key is shipped to the update feed.

For every installer release, upload the matching `SC-Setup-v<version>.exe`,
its `.blockmap` and the generated `latest.yml` metadata to the same GitHub
release. With this GitHub provider, beta releases also use `latest.yml`; the
release prerelease flag and application version control beta eligibility. Preserve generated
SHA-512 values and sizes; verify them against the actual installer. Mark beta
releases as prereleases and stable releases as stable. Do not repoint a stable
channel to a beta. Published C# assets cannot serve as Electron update packages.
The feed does not offer draft releases.

Keep `appId` and install identity stable. Test a real per-user installation and a
local HTTP update from an older installed version with isolated profiles before
claiming update delivery. Verify restart, version, stored settings, failed
checks/downloads and explicit installation. Keep local feed overrides and lab
paths outside public source. Unsigned builds retain HTTPS and file-digest checks;
when signing credentials become available, configure Windows signing so updater
publisher verification can additionally apply. Do not embed signing credentials
or disable signature verification.

## Verify and publish

1. Verify the EXE's platform, embedded version, product name, size and SHA-256.
   Check ZIP integrity and exact entries; compare archived EXE/README bytes with
   the intended source assets. Also check installer/update metadata and blockmap
   consistency. Assets contain only key-free builds/documentation;
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

## Licensing and beta.4 release materials

SC project code uses the root [MIT license](../LICENSE). Keep `license: "MIT"`
synchronized in `desktop/package.json` and the root package entry of its lockfile.
The copyright attribution uses the maintainer's public handle, Ziyadin23.
[Third-party notices](../THIRD_PARTY_NOTICES.txt) cover the pinned production npm
dependencies, native headers, Electron and installer components. Review them
when dependencies or packaging change. Retain Electron's `LICENSE.electron.txt`
and `LICENSES.chromium.html` inside both application payloads.
Beta.5 also includes byte-identical copies of the root MIT license and current
third-party notices under `resources/LICENSE.txt` and
`resources/THIRD_PARTY_NOTICES.txt` in both installer and portable payloads.

The beta.4 release reuses the already verified executables and two-file ZIP.
Publish their original README snapshot alongside the
[current release notes](releases/v0.5.0-beta.4.md); later evidence must not be
presented as if it were in the original packaged README. Licensing was selected
after the build, so its embedded package metadata retains `UNLICENSED`; the
separate MIT license grants the current rights for SC-owned code. A changed
executable, including a rebuild to embed new licensing files, needs a new version
and the applicable Windows verification/local delivery checks.

Upload these additional assets with the binaries/update files:

- `LICENSE.txt`, byte-identical to the root license.
- `THIRD_PARTY_NOTICES.txt`, byte-identical to the source notice.
- `ThirdPartySources-v0.5.0-beta.4.zip`, with upstream StdUtils 1.14 source,
  Nsis7z 19.00 overlay/distribution, matching 7-Zip 19.00 source and SpiderBanner
  source. Include original licenses, origin URLs and archive checksums. Verify
  the bundled StdUtils/Nsis7z DLLs against the upstream distributions.
- `SHA256SUMS.txt`, covering every uploaded asset except itself.

Create the GitHub release as a **draft prerelease** with `make_latest: false`.
Check successful CI for its exact source commit, remote annotated tag identity,
all uploaded sizes/digests, local archive integrity and update metadata before
publishing the draft. Draft assets do not activate public updates. Retain the
stable v0.4.14 release and historical tags/assets. Record the draft URL, source
commit and remaining checks in the private workspace context.

The beta.4 draft was published on **2026-10-26 at 12:53:02 UTC**, retaining its
prerelease flag and `make_latest: false`. All ten published asset sizes/SHA-256
digests match the verified local files. Its annotated tag still points to
`035ba31d9da59cb8b965358dfa22a60f97e79ab4`; later test/documentation changes do not
rewrite that tag or the packaged README. The GitHub latest-stable endpoint remains
v0.4.14. Public asset availability does not establish an installed-client update
result; the documented local HTTP update checks retain their separate scope.

Changes to source-only documentation after a release do not rewrite its packaged
README or binaries. The previous C# publishing procedure remains available in
[the v0.4.14 snapshot](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/docs/PUBLISHING.md).
