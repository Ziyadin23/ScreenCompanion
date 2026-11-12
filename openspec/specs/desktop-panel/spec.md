# desktop-panel Specification

## Purpose

Present SC's current answer and temporary question input in a compact desktop panel with accessible controls and predictable content sizing.

## Requirements

### Requirement: Discoverable compact controls
The panel SHALL reveal named Capture screen, Question, Settings, Hide and Exit controls on pointer hover or keyboard focus, without shifting or obscuring answer content. The controls SHALL remain reachable without a tray or global shortcut and SHALL prevent duplicate capture/input requests while busy.

#### Scenario: Pointer and keyboard access
- **WHEN** the pointer enters the panel or a user tabs into its controls
- **THEN** the toolbar is visible and each enabled control invokes its named action
- **AND** leaving hover and keyboard focus hides the toolbar without moving the answer

#### Scenario: Request already active
- **WHEN** a request is active
- **THEN** Capture screen, Question and submission cannot start a second request
- **AND** Settings, Hide and Exit remain available according to existing controller behavior

### Requirement: Retained answer and temporary input
The panel SHALL retain selectable plain-text answers while busy or visiting Settings, and SHALL show question input only when requested. Existing Enter, Escape, selection/copy, hover scrolling, Alt-drag, invisible-edge resizing and remembered-size behavior SHALL remain usable.

#### Scenario: Typed question lifecycle
- **WHEN** the user opens Question, enters text and submits with Enter or Send
- **THEN** the existing single-request workflow receives that question once
- **AND** cancellation, failures and Escape retain the existing platform-specific draft and answer behavior

#### Scenario: Untrusted answer content
- **WHEN** an answer contains HTML-like text or a long multiline response
- **THEN** it is rendered as selectable inert text in a scrollable answer region
- **AND** no question, answer or screenshot is added to persistent storage

### Requirement: Usable panel geometry and states
The panel SHALL account for toolbar, input, padding and platform decorations when fitting content. Toolbar reveal SHALL not resize the window, and small windows or large text SHALL retain usable controls and scrolling. Empty, busy and diagnostic-error states SHALL have clear readable feedback.

#### Scenario: Content and size transitions
- **WHEN** a short or long answer arrives, input opens, or the user returns from Settings
- **THEN** automatic sizing includes the rendered panel chrome and respects work-area bounds
- **AND** an explicitly remembered manual size remains authoritative within supported bounds

#### Scenario: Busy or failed answer
- **WHEN** a request is running or fails
- **THEN** the user can identify its state without losing the retained answer
- **AND** diagnostic codes and report IDs remain available on failure
