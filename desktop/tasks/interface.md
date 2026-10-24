# Agent C: React interface

Implement the approved SC TypeScript/Electron interface with existing features
and visual behavior. Read root AGENTS.md, CODING_STANDARDS.md shared/UI/lifecycle/
verification rules, docs/USER_GUIDE.md controls/setup and tests/README.md first.
Use src/UI C# code as reference, particularly AnswerOverlay, SettingsDialog,
UiAppearance and native dialog visibility semantics.

## Ownership and integration

Edit only desktop/src/renderer/**, desktop/tests/ui/**,
desktop/tests/renderer/**. Do not edit shared contracts/defaults, manifests,
Electron main/preload, native/storage, pipeline/providers, docs or C# source.
Do not commit or publish, use real keys or run paid APIs. Do not spawn helpers.
The lead installs dependencies and owns playwright.config.ts. Ask for shared
contract/dependency changes through coordinator messages.

Use React/TypeScript and local CSS. Renderer index.html is Vite's entry point.
The only privileged boundary is window.sc: DesktopApi from src/contracts.
Declare its Window type within your renderer. No Node/native imports, network,
remote assets, localStorage, history persistence or raw HTML answer rendering.
Existing saved keys are represented only by presence indicators; replacement
keys are typed temporarily and sent on Save, then cleared from renderer state.

## UI behavior

Recreate answer-only, selectable/copyable plain text with Segoe UI, wrapping,
invisible scrollbars, 7px resize edges, Alt-left drag, independent background
alpha/text opacity and temporary input (4000 characters), Enter/Send, Escape.
Send window commands through the API; native operations belong to main/Agent A.
Use a minimum alpha of 1/255 so text-only background remains interactive.
Keep last answer visible while busy; input is disabled during a request.

Setup asks only for API key, makes no network request and shows legacy-vault
notice when relevant. Settings use fixed readable dark colors independent of
panel appearance. Include Panel, response preferences, Models & API and Commands;
all six providers, editable answer/vision models, pipeline choice and DeepSeek
reasoning/output budgets. Direct only for DeepSeek; Pro only text answering.
Retain default preferences, four appearance presets/custom colors, 8–28pt font,
0–100 background transparency, 15–100 text visibility and a live preview.
Custom instructions are limited to 2000 characters. Preserve draft model/key
switching, saved-key indications, Save/Back/Restore semantics and six shortcut
recording fields, default restore, duplicate/reserved validation and recording
notifications so visibility/exit stay active. Use the protected native color
picker via API, not Chromium's native color/select popups. Build accessible
custom listbox/dropdown controls if popups would escape protection.
Capture test/Commands retain best-effort recording-exclusion notices.

## Acceptance

Write meaningful renderer tests for workflows, Saved/Back drafts, key switching,
independent palettes/opacity, controls and text-safe rendering. Add Playwright
Electron workflow tests under tests/ui if possible; lead supplies configuration
and a key-free --synthetic-ui app mode. Use injected window.sc for renderer-only
tests; do not depend on real vaults/network. Coordinate test selectors and any
API mismatches early. Run focused tests and type checks, check coordinator mail,
and report files, exact results and remaining visual/runtime gaps.
