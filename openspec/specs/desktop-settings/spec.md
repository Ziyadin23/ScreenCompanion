# desktop-settings Specification

## Purpose

Provide readable, responsive setup and settings for SC while retaining encrypted preferences, explicit saves and historical appearance compatibility.

## Requirements

### Requirement: Readable responsive settings
Setup and Settings SHALL use a fixed opaque neutral dark palette independent of panel appearance. Settings SHALL retain its five existing categories in sidebar navigation, adapting to horizontal navigation below 600 pixels, with accessible keyboard navigation and persistent Save, Back and edit status.

#### Scenario: Narrow settings window
- **WHEN** Settings is displayed below 600 pixels wide
- **THEN** all categories and footer actions remain reachable without horizontal content overflow
- **AND** category navigation and focus follow the visible orientation

#### Scenario: Appearance preview and navigation
- **WHEN** the user changes panel appearance and switches settings categories
- **THEN** the preview reflects the draft while Settings retains its readable palette
- **AND** Save applies the draft and Back discards it, returning to the retained answer

### Requirement: Progressive expert controls
Settings SHALL initially collapse advanced model settings, shortcut editing and custom appearance controls. Custom instructions SHALL be shown when Custom answer mode is selected. Hidden controls SHALL retain their draft values, and validation SHALL reveal and focus the affected control.

#### Scenario: Invalid collapsed value
- **WHEN** Save finds an invalid field inside a collapsed section
- **THEN** Settings selects the correct category, opens the section and focuses the invalid control with a readable error

#### Scenario: Changing an answer mode
- **WHEN** the user switches from Custom to another answer mode and back
- **THEN** the custom instruction remains in the unsaved draft and is editable in Custom mode

### Requirement: Compatible appearance defaults
Fresh setup and explicit Restore appearance SHALL use a neutral dark panel with 10% background transparency, 100% text visibility and 11-point text. Loading existing or partial legacy settings SHALL retain their saved appearance and historical missing-field fallbacks without rewriting the vault.

#### Scenario: Fresh setup or appearance reset
- **WHEN** a new user saves setup or an existing user chooses Restore appearance and saves
- **THEN** the new panel appearance defaults are applied

#### Scenario: Existing and partial legacy settings
- **WHEN** existing settings contain saved appearance or omit historical appearance fields
- **THEN** saved values and the previous missing-field defaults remain effective
- **AND** loading does not rewrite the encrypted file

### Requirement: Existing setup and update contracts
The refreshed setup, command help and Updates screens SHALL preserve service-specific key handling, notices, retries, shortcut help and explicit update actions. Setup and settings saves SHALL not contact a model, and update installation SHALL retain its existing busy and unsaved-draft guards.

#### Scenario: Setup and update safety
- **WHEN** a user saves setup, changes a provider, or attempts an update with unsaved settings
- **THEN** existing encryption, provider-draft retention and update blocking remain in effect with clear feedback

### Requirement: Settings save session ownership
A successful Settings Save SHALL apply the saved preferences and return its own active Settings session to the retained answer. Completion of a Save from an earlier session SHALL preserve the current surface, its visibility, and any newer draft, edit status and owned dialogs.

#### Scenario: Reopen during a delayed write
- **WHEN** a Settings Save reaches a delayed store write, the global input shortcut opens Question, and the user reopens Settings and edits a new draft before the write finishes
- **THEN** the earlier preferences are saved and applied
- **AND** the newer Settings draft remains open with its edits and its restart guard intact

#### Scenario: Leave Settings while saving
- **WHEN** a Save finishes after the user has left Settings
- **THEN** the current surface retains its visibility and its Question or answer state

#### Scenario: Late Save request from a closed session
- **WHEN** a Save request from a closed Settings session reaches SC after a new session has opened
- **THEN** SC declines the earlier request without writing settings or touching the active draft

#### Scenario: Late Back request from a closed session
- **WHEN** a Back request from a closed Settings session reaches SC after a new session has opened
- **THEN** SC preserves the newer draft, its edit status and its owned dialogs

#### Scenario: Late recording or edit command from a closed session
- **WHEN** a shortcut recording or draft edit command reaches SC from a closed Settings session after a new session has opened
- **THEN** SC preserves the newer session's shortcut registration and edit status

#### Scenario: Save or Back in the active session
- **WHEN** Save succeeds or Back discards edits in the session still open in Settings
- **THEN** the session closes and returns to the retained answer while honoring the user's visibility choice

### Requirement: Ordered Settings saves and recovery
SC SHALL admit one Settings Save at a time through shortcut registration, encrypted persistence and any necessary rollback. An overlapping attempt SHALL leave its draft editable and explain when the user can retry. Retried edits SHALL preserve previously saved fields and provider keys that the user did not change.

#### Scenario: Overlapping Save after reopening
- **WHEN** the user tries to save a second draft while an earlier write or its shortcut rollback is pending
- **THEN** the second attempt issues no shortcut registration or vault write
- **AND** SC asks the user to wait and keeps the draft editable, including while an earlier write may save the selected service's key
- **AND** after retrying, the second Save applies its edits against the latest saved preferences and keys
- **AND** a key saved by the first write is available to the second draft without reentry

#### Scenario: Retry after both drafts select the same service
- **WHEN** an earlier Save writes model fields for a service and the newer draft also selects that service
- **THEN** a retry keeps the saved value of each field the newer draft leaves untouched
- **AND** the retry applies each explicit model field edit from the newer draft, including a choice of the default model ID

#### Scenario: Retry with a saved pipeline for the selected model
- **WHEN** an earlier Save changes the pipeline for the service and exact answer model in a newer draft
- **THEN** a retry keeps that saved pipeline when the user leaves Request pipeline untouched
- **AND** a retry applies any explicit choice in the newer draft, including Thorough

#### Scenario: Retry after changed shortcuts
- **WHEN** an earlier Save changes shortcut bindings while a newer draft is open
- **THEN** the newer draft displays, records and validates shortcuts using the current saved bindings and its own edits
- **AND** Restore shortcuts can explicitly apply defaults from the newer draft

#### Scenario: Refresh while the custom instruction editor has focus
- **WHEN** an earlier Save changes Answer mode while the custom instruction editor has focus in a newer draft
- **THEN** the newer draft shows the latest Answer mode unless the user explicitly changed it
- **AND** the focused editor remains available for typing and keeps its edits through Save
- **AND** Escape invokes Back for that draft

#### Scenario: Retry a failed Settings read with the keyboard
- **WHEN** the user activates Try loading again after a Settings read fails
- **THEN** Save stays unavailable until the latest preferences load
- **AND** the Retry control retains focus while waiting and after a failure if the user leaves focus there
- **AND** on success, focus moves to the page heading and its focus outline is visible if Retry still has focus
- **AND** if the user moved focus during the retry, that control keeps focus
- **AND** Escape invokes Back from either control

#### Scenario: Read and correct errors in a compact Settings window

- **WHEN** an error appears or clears while the user navigates the tabs or edits a field at the minimum Settings size
- **THEN** the focused tab, field or page heading stays visible with its keyboard focus indicator
- **AND** the user can read both a Settings error and shortcut recovery by keyboard at larger browser font sizes
- **AND** the page content and the Save and Back controls remain reachable

#### Scenario: Reasoning edit after an overlapping Save
- **WHEN** a newer draft selects an active DeepSeek reasoning level and leaves the budget untouched
- **THEN** the draft displays and saves the current saved budget when one exists
- **AND** the draft displays and saves the suggested 16,000-token budget when there is no saved budget

#### Scenario: Shortcut registration rejected
- **WHEN** the operating system rejects a shortcut in the proposed settings
- **THEN** SC keeps the previous settings and shortcuts, reports the failure and leaves the active draft available for retry
- **AND** if restoring the previous shortcuts fails, the current surface shows restart guidance alongside its existing content

#### Scenario: Encrypted write rejected
- **WHEN** an encrypted write fails after candidate shortcuts have been registered
- **THEN** SC restores the previously saved shortcuts in the current recording mode before accepting another Save
- **AND** it preserves the saved settings, retained answer and the active draft if present
- **AND** if the previous shortcuts cannot be restored, the current surface shows restart guidance alongside its existing content

#### Scenario: Recovery at a compact panel size
- **WHEN** SC shows shortcut recovery in a compact Answer or Question panel
- **THEN** the restart guidance fits alongside the usable panel content and controls at supported minimum sizes
- **AND** the user can read complete retained answer lines at the selected text size using scrolling as needed within the panel dimensions
- **AND** fine-resolution native wheel input can reach every remaining line after a keyboard scroll
- **AND** proportional scrolling retains partial movement from fine native wheel events in either direction
- **AND** the user can reach both Question send controls by keyboard
