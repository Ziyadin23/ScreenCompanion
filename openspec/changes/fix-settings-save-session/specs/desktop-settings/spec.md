# Spec Delta

## ADDED Requirements

### Requirement: Settings save session ownership
A successful Settings Save SHALL apply the saved preferences and return its own active Settings session to the retained answer. Completion of a Save from an earlier session SHALL preserve the current surface, its visibility, and any newer draft, edit status and owned dialogs.

#### Scenario: Reopen during a delayed write
- **WHEN** a Settings Save reaches a delayed store write, the global input shortcut opens Question, and the user reopens Settings and edits a new draft before the write finishes
- **THEN** the earlier preferences are saved and applied
- **AND** the newer Settings draft remains open with its edits and its restart guard intact

#### Scenario: Leave Settings while saving
- **WHEN** a Save finishes after the user has left Settings
- **THEN** the current surface retains its visibility and its Question or answer state

#### Scenario: Save or Back in the active session
- **WHEN** Save succeeds or Back discards edits in the session still open in Settings
- **THEN** the session closes and returns to the retained answer while honoring the user's visibility choice

### Requirement: Ordered Settings saves and recovery
SC SHALL admit one Settings Save at a time through shortcut registration, encrypted persistence and any necessary rollback. An overlapping attempt SHALL leave its draft editable and explain when the user can retry. Retried edits SHALL preserve previously saved fields and provider keys that the user did not change.

#### Scenario: Overlapping Save after reopening
- **WHEN** the user tries to save a second draft while an earlier write or its shortcut rollback is pending
- **THEN** the second attempt issues no shortcut registration or vault write
- **AND** after retrying, the second Save applies its edits against the latest saved preferences and keys

#### Scenario: Shortcut registration rejected
- **WHEN** the operating system rejects a shortcut in the proposed settings
- **THEN** SC keeps the previous settings and shortcuts, reports the failure and leaves the active draft available for retry

#### Scenario: Encrypted write rejected
- **WHEN** an encrypted write fails after candidate shortcuts have been registered
- **THEN** SC restores the previously saved shortcuts in the current recording mode before accepting another Save
- **AND** it preserves the saved settings, retained answer and the active draft if present
- **AND** if the previous shortcuts cannot be restored, the Save reports that SC needs to restart
