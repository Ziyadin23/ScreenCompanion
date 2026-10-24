# Legacy vault interoperability fixture

This test-only .NET executable checks the TypeScript store against the original
C# SSK3 serializer, Windows CurrentUser DPAPI and migration rules. It uses isolated
temporary profiles and synthetic keys; it is never included in the application.

`legacy/` contains the fourteen required source files copied byte-for-byte from
[v0.4.14](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14/src), including
their transitive type dependencies. `legacy/SOURCE.json` records the release
commit, original paths relative to `src/`, and SHA-256 digests. Keep those files
frozen so changes to the current implementation cannot silently change the oracle.
The complete historical C# application and its suites remain in that release tag.

With the .NET 10 SDK and Windows Desktop runtime available, run the eight cases
from `desktop/` after `npm run native:build`:

```powershell
npx vitest run --config vitest.windows.config.ts
```

`npm run test:windows` also runs these cases after the separate native harness.
The application and its Windows package do not require .NET.
