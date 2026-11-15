# Desktop settings delta

## ADDED Requirements

### Requirement: Model-specific screenshot pipeline preferences
Models & API SHALL offer Thorough and Direct screenshot for compatible models across supported services and remember the selected screenshot pipeline by service and answer-model ID. Thorough SHALL be the default for a model without a saved preference. Thorough SHALL retain a configurable screen-reading model; Direct SHALL identify that this model is unused.

#### Scenario: Configure models independently
- **WHEN** the user selects Direct for one answer model and Thorough for another, then saves
- **THEN** returning to each service/model restores its own selected pipeline, including after restarting SC
- **AND** identical model IDs under different services do not share preferences

#### Scenario: New model selection
- **WHEN** the user selects an answer model with no saved pipeline preference
- **THEN** the pipeline is Thorough rather than an unrelated model's remembered Direct choice

#### Scenario: Compatible Direct on another service
- **WHEN** the user selects a supported service other than DeepSeek and a compatible image-capable answer model
- **THEN** Direct screenshot is available with the same full-monitor disclosure and unused screen-reading-model state

#### Scenario: Incompatible Direct model
- **WHEN** the selected answer model is known to lack image support
- **THEN** Settings provides a clear explanation that Direct requires image input and prevents saving that incompatible screenshot combination
- **AND** SC does not silently change the selected model or discard necessary visuals

### Requirement: Explicit pipeline draft saves
Model-specific pipeline edits SHALL remain in the Settings draft until Save succeeds. Save SHALL validate and encrypt the preferences without making a model request; Back SHALL discard all unsaved preference edits. Loading historical settings SHALL retain keys, response preferences, shortcuts and appearance without rewriting the vault.

#### Scenario: Save model-specific preferences
- **WHEN** a valid draft contains pipeline edits for multiple service/model pairs and the user saves
- **THEN** the edited preferences persist together and the active combination applies to subsequent screenshot requests
- **AND** no provider contact or screen capture is used to test the Save

#### Scenario: Discard multi-model edits
- **WHEN** the user edits pipelines for multiple models, switches services and chooses Back
- **THEN** none of those unsaved pipeline edits becomes active or persistent
- **AND** the retained answer remains available

#### Scenario: Failed save
- **WHEN** encryption, persistence or shortcut registration prevents Save from completing
- **THEN** existing saved preferences and keys remain authoritative and usable
- **AND** the draft reports a readable error under the existing Save/rollback contract

#### Scenario: Legacy active selection
- **WHEN** an older vault has one saved model and pipeline but no per-model preference collection
- **THEN** the current model keeps its effective Thorough or Direct selection, with Balanced normalized to Thorough
- **AND** an explicit Save records that preference without replacing other settings
