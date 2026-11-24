# Spec Delta

## MODIFIED Requirements

### Requirement: Usable panel geometry and states
The panel SHALL account for toolbar, input, padding and platform decorations when fitting content. Toolbar reveal SHALL not resize the window, and small windows or large text SHALL retain usable controls and scrolling. Empty, busy and diagnostic-error states SHALL have clear readable feedback. SC SHALL save the latest manual panel size atomically in physical pixels and restore it within the current panel limits on a later launch.

#### Scenario: Content and size transitions
- **WHEN** a short or long answer arrives, input opens, or the user returns from Settings
- **THEN** automatic sizing includes the rendered panel chrome and respects work-area bounds
- **AND** an explicitly remembered manual size remains authoritative within supported bounds

#### Scenario: User returns to an earlier programmatic size
- **GIVEN** the app applies panel size A
- **WHEN** the user resizes the panel to B and then manually returns it to A
- **THEN** the saved panel dimensions eventually become A
- **AND** a later launch with the same profile restores A, adjusted for display scaling and current panel bounds

#### Scenario: Resizing during a surface change
- **WHEN** SC changes the panel size to fit its content, restores it on a surface transition, or enforces the input minimum height
- **THEN** the change leaves the last manually saved dimensions intact

#### Scenario: Busy or failed answer
- **WHEN** a request is running or fails
- **THEN** the user can identify its state without losing the retained answer
- **AND** diagnostic codes and report IDs remain available on failure
