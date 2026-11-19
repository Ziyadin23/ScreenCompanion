# Spec Delta

## Purpose

Provide readable, responsive setup and settings for SC while retaining encrypted preferences, explicit saves and historical appearance compatibility.

## ADDED Requirements

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
