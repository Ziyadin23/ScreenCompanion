# Request pipelines delta

## Purpose

Define how SC processes screenshots and typed questions through configurable models while keeping capture inclusion explicit and preserving request, answer and privacy contracts.

## ADDED Requirements

### Requirement: Two screenshot pipelines
SC SHALL offer Thorough and Direct screenshot as its only screenshot pipelines. Thorough SHALL be the default. Pipeline selection SHALL be independent of provider identity, subject to the selected models supporting the required images and structured responses.

#### Scenario: Default screenshot request
- **WHEN** a screenshot request starts without an explicit pipeline preference or compatible trusted process override
- **THEN** it uses Thorough
- **AND** Balanced is not exposed as a third choice

#### Scenario: Provider-independent Direct
- **WHEN** the user selects Direct with a compatible answer model on any supported provider
- **THEN** SC routes the request through that provider without a DeepSeek-only restriction

### Requirement: Thorough screen isolation
Thorough SHALL locate relevant content, extract it and answer using the existing local validation and visual-crop contracts. An automatically located request SHALL use three ordinary model calls; existing fixed-region and no-relevant-content exceptions SHALL retain their documented budgets. Answering SHALL exclude the original monitor image.

#### Scenario: Typed question guides extraction
- **WHEN** a user sends a typed question with a screenshot through Thorough
- **THEN** the typed task guides location, extraction and answering ahead of unrelated visible questions
- **AND** answering receives structured content and necessary isolated visuals

#### Scenario: Invalid extraction
- **WHEN** location or extraction produces unusable or incomplete required content
- **THEN** SC shows the existing readable failure without an automatic repair call or pipeline fallback

### Requirement: Direct screen answering
Direct SHALL send one fresh full-monitor image and any typed question to the selected answer model in one model call. It SHALL skip location, extraction and cropping, retain a fresh screen-level answer target and canonical validation, and perform no automatic retry or pipeline/model fallback.

#### Scenario: Direct with typed intent
- **WHEN** a user sends a screenshot with a typed question through Direct
- **THEN** one answering request contains that image and typed question with the existing response operation and trusted metadata
- **AND** the typed question takes priority over unrelated visible content

#### Scenario: Refusal or malformed Direct response
- **WHEN** Direct receives a refusal or unusable structured answer
- **THEN** SC displays the refusal or readable validation error without another model call

#### Scenario: Incompatible image model
- **WHEN** a selected model is known to reject image inputs
- **THEN** SC rejects the screenshot operation locally with actionable compatibility feedback before sending its image
- **AND** it does not remove the image or choose another model

### Requirement: Text-only answering
A text-only submission SHALL send the typed question to the selected answer model without capturing, opening a screen-selection portal, extracting screen content or including images. It SHALL use one model call, canonical answer validation and the current response operation; screenshot-pipeline preference SHALL not add screen processing.

#### Scenario: Text-only with either screenshot preference
- **WHEN** a user sends text without a screenshot while Thorough or Direct is selected
- **THEN** one answering request contains the typed task and no image or extraction content
- **AND** no monitor lookup, capture or screen-consent prompt occurs

#### Scenario: Text-only refusal
- **WHEN** the answer model refuses a text-only typed task
- **THEN** SC displays the refusal without an automatic screenshot capture or retry

### Requirement: Compatible pipeline preference migration
SC SHALL accept historical string and numeric pipeline settings without losing keys or preferences. Historical Balanced selections and a trusted balanced process default SHALL resolve to Thorough. Existing Thorough and Direct selections SHALL retain their meaning; loading SHALL not rewrite encrypted settings.

#### Scenario: Historical Balanced vault
- **WHEN** an existing encrypted vault contains Balanced or its historical numeric representation
- **THEN** its effective screenshot pipeline is Thorough
- **AND** its encrypted bytes remain unchanged until an explicit successful Save

#### Scenario: Historical numeric Direct
- **WHEN** an existing encrypted vault contains the historical numeric representation for Direct
- **THEN** it resolves to Direct rather than being reinterpreted after Balanced is removed

#### Scenario: Invalid saved settings
- **WHEN** an encrypted vault contains malformed pipeline preferences or unsupported values
- **THEN** SC reports a readable settings failure and preserves the original bytes

### Requirement: Transient request data
All submission paths SHALL retain one active request, stateless provider calls, existing bounded content-free diagnostics and deterministic cleanup. Captures, typed questions, answers and history SHALL remain outside persistent application storage, and OpenAI requests SHALL retain store false.

#### Scenario: Request completion or failure
- **WHEN** a text-only or screenshot request succeeds, fails, is cancelled or the app exits
- **THEN** owned image buffers and request resources are released or cleared
- **AND** no question, image, answer or raw provider body is written to settings or diagnostic logs
