# Desktop panel delta

## MODIFIED Requirements

### Requirement: Retained answer and temporary input
The panel SHALL retain selectable plain-text answers while busy or visiting Settings, and SHALL show question input only when requested. Enter or Send SHALL submit text only; Ctrl+Enter or Send with screenshot SHALL submit text with one fresh screen capture. Existing Escape, selection/copy, hover scrolling, Alt-drag, invisible-edge resizing and remembered-size behavior SHALL remain usable.

#### Scenario: Typed question lifecycle
- **WHEN** the user opens Question, enters text and submits with Enter or Send
- **THEN** one text-only request receives that question without capturing the screen
- **AND** cancellation, failures and Escape retain the existing platform-specific draft and answer behavior

#### Scenario: Typed question with current screen
- **WHEN** the user enters a question and invokes Ctrl+Enter from question input or activates Send with screenshot
- **THEN** SC captures the selected monitor once at submission time and sends the question through the selected screenshot pipeline
- **AND** the typed question determines what the model should do with the screen

#### Scenario: Untrusted answer content
- **WHEN** an answer contains HTML-like text or a long multiline response
- **THEN** it is rendered as selectable inert text in a scrollable answer region
- **AND** no question, answer or screenshot is added to persistent storage

## ADDED Requirements

### Requirement: Discoverable submission actions
Temporary input SHALL provide separately named Send and Send with screenshot actions, with visible Ctrl+Enter guidance for screenshot sending. Both actions SHALL remain keyboard accessible, fit supported panel sizes and follow current appearance settings. Empty questions and active requests SHALL disable submission.

#### Scenario: Pointer or keyboard use
- **WHEN** the user opens Question in a normal or compact panel
- **THEN** text-only and screenshot sending are identifiable and operable without knowing a shortcut
- **AND** neither action obscures the question or answer

#### Scenario: Duplicate or empty submission
- **WHEN** input is empty, or submission is pending or already active
- **THEN** keyboard, button and global-shortcut paths cannot start an additional request

### Requirement: Context-aware screenshot shortcut
Ctrl+Enter SHALL open or restore question input when used outside it and submit text with a screenshot when question input has focus. Global and local handling SHALL coordinate without losing the draft or sending twice. Existing custom input-opening shortcuts SHALL remain supported.

#### Scenario: Open input from another application
- **WHEN** the configured input-opening shortcut is invoked while another application has focus
- **THEN** SC opens or restores its question input without submitting an existing draft

#### Scenario: Send from focused input
- **WHEN** Ctrl+Enter is invoked while question input has focus
- **THEN** the current draft is submitted exactly once with a screenshot even if Ctrl+Enter is also globally registered

#### Scenario: Global action with another SC control focused
- **WHEN** the input-opening shortcut is invoked while a different SC control has focus
- **THEN** SC focuses or restores question input without submitting its draft

#### Scenario: Composition and modified keys
- **WHEN** text composition is active, a repeated key event arrives, or additional Alt, Shift or Meta modifiers accompany Enter
- **THEN** the event does not trigger an unintended text or screenshot submission
- **AND** Enter on a focused button retains that button's ordinary action

#### Scenario: Cancel screen selection
- **WHEN** a user cancels or fails the Linux monitor-selection prompt for text-plus-screen sending
- **THEN** no provider request occurs and the draft and prior answer remain available for another send
