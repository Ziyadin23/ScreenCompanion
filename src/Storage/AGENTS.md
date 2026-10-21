# Settings storage and migration

- On first SC launch, copy the existing encrypted `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key` only when the SC vault does not exist. Copy atomically, retain the original, and let an already-created SC vault win a migration race.
- Existing SC settings take priority. Preserve older password-protected SSK1/SSK2 `screencompanion.key` files in place; the current setup asks for only the API key.
- Keep keys, custom instructions, appearance, shortcuts, and provider settings encrypted with Windows DPAPI CurrentUser. Preserve serialized names/format compatibility when source files move.
- A damaged vault or one belonging to another Windows account is an error; retain its bytes instead of replacing it during startup.
- `WindowSizeStore.cs` persists width/height atomically with bounded validation. Read the legacy size path until an SC size has been saved; malformed size data falls back to default sizing.

Use isolated synthetic encrypted vaults in Windows appearance tests for migration, existing-vault priority, byte preservation, and Save/Back. Portable tests cannot verify Windows DPAPI behavior. Keep real credential files outside public source and distribution assets.
