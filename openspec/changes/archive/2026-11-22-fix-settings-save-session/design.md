# Design

## Context

The controller owns committed settings, shortcuts and surface selection. The renderer keeps each opening's draft in memory and remounts it even when surface transitions arrive in one React batch. A Save currently applies shortcuts, awaits the encrypted store, then closes whichever Settings surface happens to be selected. The renderer can also send a late dirty reset after the draft that initiated it has unmounted.

## Goals

Keep navigation owned by the active Settings session, and keep the vault, effective preferences and shortcut registration consistent across successful and failed edits. Exercise the ordering through the existing injected production controller without timers or changes to encrypted data or native APIs.

## Decisions

- Create a controller session on entry to Settings from another surface. Include its identifier in the renderer state and draft so Save can check ownership before registration and after persistence. Back, recording and edit commands send their originating session. Main checks ownership before applying them, and rechecks it when queued shortcut work starts. A successful write always updates applied preferences. Only an active owner may close Settings, change its dirty flag or close its dialogs. The renderer leaves exit cleanup to the controller.
- Give the first Save exclusive access until validation, shortcut application, persistence and any rollback finish. Publish the in-progress state so a newer form can explain when to retry before validating a missing key. A typed busy result covers a competing request that reaches the controller. The newer draft stays editable.
- Keep the key-free starting values of an open draft. If a prior write changes the committed settings while the draft is open, retry applies edits over the latest committed values. Compare individual appearance fields. Track explicit model field edits for each service visited in the draft. If both saves select the same service, use its latest saved model fields and apply the newer edits. Apply explicit pipeline choices by service and exact answer model, including explicit choices of Thorough. Publish saved model values, pipeline preferences and key-presence flags after a successful write so an open draft can use them.
- Compare the original and edited custom instruction before trimming on Save. Display and validate the current saved shortcut bindings with the draft's recorded edits applied. Restore shortcuts edits the whole set when a reset changes bindings or an earlier Save is pending. A DeepSeek reasoning edit suggests a budget when the effective saved budget is empty and the draft has no explicit budget edit.
- Apply the current Answer mode and custom instruction together on refresh, with explicit edits applied to each field. Keep the instruction editor mounted until focus leaves it. If a draft read fails, keep Retry focusable while it loads. On success, transfer focus from Retry to the page heading and let the browser bring the heading into view if Retry still has focus.
- Sequence shortcut changes through the controller, with the provisionally registered bindings available during the write. Recording uses those bindings until the write settles. Rollback reapplies the last committed bindings in the current recording mode. Settings storage failures are logged separately from the retained answer's request status. Failed rollback shows restart guidance on the active surface and retains its draft, Question or answer. Keep the message in the measured header. In a short Answer panel, let the header and answer scroll together when the fixed header would leave less than one line. Settings shows the full diagnostic code and report ID.
- When the fixed recovery header leaves room for one complete answer line, accumulate signed native wheel input into whole notches. Align each step to a readable line and keep the last line in view at the end of scrolling.
- For proportional wheel scrolling, retain fractional movement between events in the same scroll region. Clamp the intended position at both scroll limits so further input at either end allows immediate reversal.

## Risks and Trade-offs

A Windows shortcut can become occupied after it is released during Save. A failed restoration leaves the encrypted vault at the last committed settings and provides explicit recovery feedback. The deterministic store and platform tests cover ordering and error isolation. Native contention, DPAPI and package startup require the target candidate in an isolated Windows session.

## Migration Plan

Existing encrypted vaults and settings identifiers carry forward with the same format. Integrate source under [#59](https://github.com/Ziyadin23/ScreenCompanion/issues/59). Qualify a separately reserved version for Windows and the [local beta handoff](../../../../docs/PUBLISHING.md#local-beta-handoff).
