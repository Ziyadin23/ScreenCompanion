# Design

## Context

The controller owns committed settings, shortcuts and surface selection. The renderer keeps each opening's draft in memory and remounts it even when surface transitions arrive in one React batch. A Save currently applies shortcuts, awaits the encrypted store, then closes whichever Settings surface happens to be selected. The renderer can also send a late dirty reset after the draft that initiated it has unmounted.

## Goals

Keep navigation owned by the active Settings session, and keep the vault, effective preferences and shortcut registration consistent across successful and failed edits. Exercise the ordering through the existing injected production controller without timers or changes to encrypted data or native APIs.

## Decisions

- Create a controller session on entry to Settings from another surface. Include its identifier in the renderer state and draft so Save can check ownership before registration and after persistence. A successful write always updates applied preferences. Only an active owner may close Settings, clear its dirty flag or close its dialogs. The renderer reports edits and leaves exit cleanup to the controller, including clearing dirty state.
- Give the first Save exclusive access until validation, shortcut application, persistence and any rollback finish. A typed busy result lets a newer form stay editable and retry explicitly. This also keeps a queued snapshot from committing after the user has moved on.
- Keep the key-free starting values of an open draft. If a prior write changes the committed settings while the draft is open, retry applies changed fields over the latest committed values. Compare individual appearance and same-service model fields, keep provider changes with their service-specific model fields, and merge pipeline modes by service and answer model. Explicit key replacements merge against the latest saved keys. Publish updated key-presence flags after a successful write so an open draft can use newly saved keys.
- Sequence shortcut changes through the controller, with the provisionally registered bindings available during the write. Recording uses those bindings until the write settles. Rollback reapplies the last committed bindings in the current recording mode. Settings storage failures are logged separately from the retained answer's request status. Failed rollback adds restart guidance to the active surface and retains its draft, Question or answer.

## Risks and Trade-offs

A Windows shortcut can become occupied after it is released during Save. A failed restoration leaves the encrypted vault at the last committed settings and provides explicit recovery feedback. The deterministic store and platform tests cover ordering and error isolation. Native contention, DPAPI and package startup require the target candidate in an isolated Windows session.

## Migration Plan

Existing encrypted vaults and settings identifiers carry forward with the same format. Integrate source under [#59](https://github.com/Ziyadin23/ScreenCompanion/issues/59). Qualify a separately reserved version for Windows and the [local beta handoff](../../../docs/PUBLISHING.md#local-beta-handoff).
