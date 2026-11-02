# Spec Delta

## Purpose

Define how SC users capture and ask questions on the supported Linux desktop while retaining established request, control and privacy behavior.

## ADDED Requirements

### Requirement: User-selected monitor capture

SC SHALL obtain one fresh selected-monitor frame per screen or typed request through desktop consent, hide its own surfaces during capture, and release the capture stream after acquiring the frame or failing.

#### Scenario: Successful selected-monitor request

- **WHEN** the user starts a screen or typed request and consents to a monitor
- **THEN** SC uses one fresh frame at that monitor's captured pixel dimensions and releases the stream
- **AND** unrelated windows cannot initiate or consume the application's capture request

#### Scenario: Capture is canceled or unavailable

- **WHEN** the user cancels consent or the selected monitor cannot provide a frame
- **THEN** SC sends no provider request, retains the previous answer and typed question, and offers recovery guidance
- **AND** any partially opened stream is released

### Requirement: Existing question and response contracts

Linux requests SHALL retain typed-question priority, provider/model selection, pipeline budgets and retry boundaries, response preferences, local validation and selectable answers as documented in the pipeline reference. Captured images, questions and answers SHALL remain transient and absent from diagnostics.

#### Scenario: Typed task and selected pipeline

- **WHEN** a typed task is submitted with a saved pipeline and compatible provider/model
- **THEN** that task takes priority over unrelated screen questions and follows the existing pipeline's call budget, validation and retry rules
- **AND** the displayed result remains selectable and copyable without storing a screenshot or answer history

#### Scenario: Request fails validation

- **WHEN** capture succeeds but the request or provider output fails existing validation
- **THEN** SC shows a readable failure with content-free diagnostics rather than silently switching provider, model or pipeline

### Requirement: Desktop controls and compositor actions

SC SHALL expose capture, typed input, Settings, visibility and exit through usable Linux window controls, support documented compositor action bindings, and use compositor window movement and resizing. Settings Save and Back SHALL retain their apply/discard behavior.

#### Scenario: Tray or global shortcut unavailable

- **WHEN** the desktop has no usable tray or global shortcut integration
- **THEN** the user can operate SC through window controls and documented compositor actions
- **AND** opening and leaving Settings retains usable answer/input content and resize controls

### Requirement: Single instance and relaunch recovery

SC SHALL route relaunches and supported compositor actions to its existing instance, preserve the selected surface and draft/input state, and handle actions received before initialization completes.

#### Scenario: Restore hidden application

- **WHEN** the user reopens SC while its existing instance is hidden
- **THEN** the existing instance becomes usable without starting a competing instance or discarding a Settings draft or typed question

#### Scenario: Early compositor action

- **WHEN** a supported action arrives before the first instance finishes initialization
- **THEN** that instance handles the action after it is ready without losing it

### Requirement: Recording visibility disclosure

SC SHALL disclose that Linux windows can appear in recordings and screen shares. Linux desktop support SHALL NOT imply Windows-style recording exclusion.

#### Scenario: User reviews Linux controls

- **WHEN** a user opens Linux setup or control guidance
- **THEN** the guidance states that SC can be visible in recordings and screen shares
