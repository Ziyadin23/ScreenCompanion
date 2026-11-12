---
name: SC
description: A compact answer panel with calm, readable desktop settings.
colors:
  ui-bg: "#1c1d20"
  ui-rail: "#18191c"
  ui-input: "#25262b"
  ui-hover: "#303239"
  ui-text: "#f2f3f5"
  ui-muted: "#a9acb5"
  ui-border: "#36383f"
  ui-accent: "#9ab9ed"
  ui-primary: "#385785"
  ui-primary-hover: "#42679b"
  ui-interactive-border: "#51545f"
  ui-primary-border: "#5d7fae"
  ui-primary-border-hover: "#7897c3"
  ui-selected-bg: "#2b303b"
  ui-selected-text: "#d9e6fb"
  ui-white: "#fff"
  ui-error-text: "#f6c1b4"
  ui-error-bg: "#352725"
  ui-invalid-border: "#efb5a7"
  selection: "#668ac966"
  panel-default-bg: "rgba(28, 29, 32, 0.9019607843137255)"
  panel-default-input: "rgb(37, 38, 41)"
typography:
  headline:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.02em"
  title:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  section:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  hint:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  button-primary:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  panel-answer:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "11pt"
    fontWeight: 400
    lineHeight: 1.5
  panel-composer:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "14px"
    fontWeight: 400
  disclosure:
    fontFamily: '"Segoe UI", "Noto Sans", sans-serif'
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.5
rounded:
  control: "8px"
  panel: "12px"
  compact: "6px"
  option: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ui-primary}"
    textColor: "{colors.ui-white}"
    typography: "{typography.button-primary}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-primary-hover:
    backgroundColor: "{colors.ui-primary-hover}"
  button-secondary:
    backgroundColor: "{colors.ui-input}"
    textColor: "{colors.ui-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.ui-hover}"
  field:
    backgroundColor: "{colors.ui-input}"
    textColor: "{colors.ui-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  navigation-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ui-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  navigation-tab-selected:
    backgroundColor: "{colors.ui-selected-bg}"
    textColor: "{colors.ui-selected-text}"
  choice:
    backgroundColor: "{colors.ui-input}"
    textColor: "{colors.ui-text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "7px 34px 7px 12px"
  answer-panel-default:
    backgroundColor: "{colors.panel-default-bg}"
    textColor: "{colors.ui-text}"
    typography: "{typography.panel-answer}"
    rounded: "{rounded.panel}"
  panel-tool:
    backgroundColor: "{colors.panel-default-input}"
    textColor: "{colors.ui-text}"
    rounded: "{rounded.compact}"
    padding: "0"
    width: "28px"
    height: "28px"
  composer-field-default:
    backgroundColor: "{colors.panel-default-input}"
    textColor: "{colors.ui-text}"
    typography: "{typography.panel-composer}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "40px"
  composer-send-default:
    backgroundColor: "{colors.ui-primary}"
    textColor: "{colors.ui-white}"
    rounded: "{rounded.control}"
    padding: "0"
    width: "40px"
    height: "40px"
  advanced-disclosure:
    textColor: "{colors.ui-text}"
    typography: "{typography.disclosure}"
    padding: "14px 2px"
---

# Design System: SC

## Overview

**Creative North Star: "Raycast compact panel + Linear settings"**

SC uses the user-approved compact panel and restrained settings direction: neutral charcoal layers, readable off-white system text, subtle rounded corners, fine borders and quiet blue interaction states. Density supports reading an answer alongside another application. Controls reveal on approach, while settings present one category at a time.

The shared renderer uses authored CSS and a consistent outline SVG vocabulary. The fixed, opaque setup and settings palette stays readable while users change panel colors, background transparency and text visibility independently. This document records the implemented system in [styles](desktop/src/renderer/styles.css), [panel appearance](desktop/src/renderer/appearance.ts), [defaults](desktop/src/contracts/defaults.ts), [panel/setup](desktop/src/renderer/App.tsx), [settings](desktop/src/renderer/Settings.tsx), [choices](desktop/src/renderer/Choice.tsx) and [icons](desktop/src/renderer/Icon.tsx). The [surface contract](.impeccable/surfaces/desktop-src-renderer-app-tsx.md) owns the selected surface direction; [OpenSpec tasks](openspec/changes/archive/2026-11-12-redesign-desktop-interface/tasks.md) own progress.

**Key Characteristics:**

- Charcoal tonal layers with off-white primary text and muted supporting text.
- Compact controls, restrained blue selection and visible keyboard focus.
- Reserved panel chrome that reveals without moving the answer.
- Advanced settings disclosed only when requested or needed for validation.
- Configurable panel appearance with a fixed readable settings palette.

## Colors

The palette is neutral and low-chroma; blue identifies actions, focus and selection.

### Primary

- **Muted action blue** (`ui-primary`, `ui-primary-hover`): Save and the default panel's Send action; hover brightens the settings action.
- **Pale focus blue** (`ui-accent`): keyboard outlines, carets, range/checkbox accents and progress.
- **Selection blue** (`ui-selected-bg`, `ui-selected-text`): the active settings category; the light text also identifies selected choice options.
- **Action borders** (`ui-primary-border`, `ui-primary-border-hover`): fine edges around the primary settings action.
- **Text selection** (`selection`): translucent blue behind selected text.

### Neutral

- **Charcoal canvas** (`ui-bg`): opaque setup and settings background.
- **Deep rail** (`ui-rail`): sidebar separation without a card or shadow.
- **Raised control charcoal** (`ui-input`): fields and ordinary settings buttons.
- **Hover charcoal** (`ui-hover`): interactive emphasis and the active choice row.
- **Off-white** (`ui-text`) and **muted gray** (`ui-muted`): primary content and supporting copy. White (`ui-white`) is reserved for blue primary actions.
- **Fine border** (`ui-border`) and **interactive border** (`ui-interactive-border`): section/control separation and hovered controls or popup edges.
- **Default panel surface** (`panel-default-bg`) and **default panel control** (`panel-default-input`): resolved fresh appearance, including quantized background alpha and the input color mixed toward the foreground.

Validation uses warm, readable error text (`ui-error-text`) on a dark warm surface (`ui-error-bg`), with a separate invalid-field border (`ui-invalid-border`). Keep the written error and field association alongside the color.

**The Independent Appearance Rule.** Panel preferences change the panel and its preview. Setup and Settings retain the fixed opaque palette. Fresh setup and explicit Restore appearance use 10% background transparency, 100% text visibility and the default panel type role. Existing saved appearance and frozen historical missing-field fallbacks remain authoritative; loading does not rewrite them.

## Typography

**Body and UI font:** the system stack recorded in the frontmatter, with Segoe UI first, Noto Sans second and a sans-serif fallback. There is no separate display or monospace face. Command help retains the UI family even though its text preserves whitespace.

**Character:** restrained desktop typography. Size, weight and spacing establish hierarchy; decorative type and uppercase labels are unnecessary.

### Hierarchy

- **Headline:** the selected settings page heading, with a compact line height and slight negative tracking.
- **Title:** the application/settings header.
- **Section:** headings inside a settings category.
- **Body:** form content, labels, ordinary buttons and explanatory text.
- **Hint:** supporting guidance with more line spacing; small status/navigation labels use the denser label role.
- **Panel answer:** the fresh default only. Answer size remains user-adjustable from 8–28 points; preserve line height, selection, whitespace and wrapping.
- **Panel composer:** readable question entry independent of the answer's chosen size. Panel status is smaller (11px) and truncates rather than pushing controls out.

## Layout

The panel is a full-window vertical flex surface. Reserve the toolbar row (36px) at all times: status fills the available width and five compact tools align at the end. The answer consumes remaining space, scrolls vertically, wraps long strings and keeps outer margins (8px). Reveal changes opacity and pointer access, never layout.

Question input is temporary. Its normal bottom composer occupies 52px: controls (40px) plus bottom margin (12px), with an inter-control gap (8px) and side margins (12px). At window heights of 120px or less, the composer occupies 44px: controls (36px) plus bottom margin (8px), with side margins (8px); answer content is hidden while the composer is present. The reserved toolbar remains available. Invisible resize edges are narrow (7px).

Settings uses a left rail (176px) beside a flexible, independently scrolling form. The header and footer sit outside that scroll area; both normally have a minimum height (64px). Form padding is generous relative to controls (24px), with section spacing and fine dividers. Save, Back and edit status remain in the footer.

Below 600px wide, the rail becomes wrapping horizontal navigation, tab icons disappear, form padding reduces to 20px vertically and 16px horizontally, and shortcut/model-budget grids become one column. Keyboard arrows follow the visible orientation. At heights of 420px or less, header/footer minimum heights reduce to 44px/48px and their vertical padding reduces to 8px.

The recurring spacing steps are in frontmatter; component-specific padding remains local. Use one clear form column rather than nested decorative containers. Setup uses the same fixed theme, a scrolling form and a sticky footer within that form.

## Elevation & Depth

Depth comes from charcoal tonal layers and fine borders. Panel and settings sections have no decorative shadows. The only shadow vocabulary is the choice popup (`0 8px 24px #0005`): a local overlay above its field. The popup sits 4px below its control, can open upward near the window bottom, and scrolls at a maximum height (200px).

**The Local Depth Rule.** Keep ordinary surfaces flat. Reserve the existing shadow for the choice overlay; use tonal changes and borders for navigation and control states.

## Shapes

The main panel has softly rounded corners using the panel radius. Most controls, fields, choice popups and the appearance preview share the control radius. Toolbar buttons and compact error surfaces use the compact radius; choice options use the smaller option radius. Borders are thin (1px). The approved SC mark is a pale-blue screen/chat outline with two off-white answer strokes on a charcoal tile, sourced from `assets/brand/`. Setup and Settings use it as a decorative 28px image beside the title. Application, tray and distribution icons derive from the same master; the tray adds a small badge while working.

Icons are inline outline SVGs: current text color, rounded caps and joins, a consistent stroke (1.7) and a standard size (18px). Sidebar icons reduce to 16px. Icon-only actions retain accessible names and tooltips.

## Components

### Buttons

Compact, quiet controls use the control radius, fine borders and a minimum height (36px). Ordinary buttons use the raised control surface; hover changes the surface and border. Save uses the primary action color and stronger text weight. Footer actions have a minimum width (78px). Disabled buttons and inputs halve opacity and use the default cursor.

Global keyboard focus uses an accent outline (2px) with an offset (2px), including buttons, fields, disclosures and focusable content. Settings button background/border transitions take 120ms with ease-out. Reduced-motion preference disables all transitions and animations.

### Inputs / Fields

Fields share the control surface, border and radius, with distinct muted placeholders and an accent caret. Textareas grow vertically up to 180px. Labels remain visible above fields; hint and error associations remain programmatic. Read-only fields use muted text, and invalid fields receive the warm border alongside a readable error. Range and checkbox controls reuse the pale focus blue.

### Choices

Choices are full-width controls with a small chevron and a bordered local popup. Editable choices keep suggestions behind a separate chevron button. The active option receives the hover surface; the saved option receives selected text and stronger weight. Arrow keys, Home/End, Enter/Space, Escape and Tab retain the component's existing navigation and dismissal behavior.

### Navigation

Five settings categories use muted icon-and-label tabs. The selected category receives the blue-toned surface and lighter text; hover brightens the label. Only the selected tab joins the normal tab sequence. Up/Down navigate the rail; Left/Right navigate the narrow layout; Home/End work in both orientations.

### Answer panel and toolbar

The answer is selectable, inert plain text. The toolbar reveals on panel hover, visible keyboard focus or focus within its controls, using an opacity transition (150ms, ease-out). Tools stay keyboard-reachable while visually hidden. Each button is a compact square; hover adopts the user's panel button colors, and activation moves it down slightly (1px). Capture screen and Question disable while a request is busy; the remaining actions retain their existing availability.

The panel's background alpha and answer text alpha are independent. Inputs stay opaque using a background mixed 4% toward the chosen text color; panel buttons use the chosen accent and contrasting text. The default tokens describe fresh appearance, not a forced recoloring of existing profiles. Dark, Light, Midnight, Forest and Custom remain panel choices.

### Temporary composer

The question field and square Send action sit below the answer with no overlay. Enter submits from question input; Enter on a focused toolbar button invokes that button. Empty or busy input disables Send. Errors sit above the composer in a compact readable surface. Keep the normal and compact geometry described in Layout aligned with native input exclusion and window sizing.

### Advanced disclosures and feedback

Shortcut editing, advanced appearance and advanced model settings begin collapsed. Disclosures have a fine top border and a text summary; opening them adds content within the current form. Validation selects the category, opens the owning section and focuses the invalid field. Hidden values remain in the draft. Custom instructions appear when the Custom answer mode requires them.

Loading, saving, busy, empty and failure states use concise text in their owning region. Footer status accompanies Save/Back. Update actions wrap as space narrows, and progress uses a thin rounded bar. Appearance preview uses a checkerboard to show transparency while retaining the draft's actual panel style.

## Do's and Don'ts

### Do:

- **Do** preserve the compact Raycast panel and calm Linear settings direction.
- **Do** keep the toolbar's space reserved during hover and keyboard reveal.
- **Do** retain visible keyboard focus and honor reduced motion.
- **Do** keep the settings palette fixed while previewing configurable panel appearance.
- **Do** use labeled fields, restrained SVG icons and explicit Save/Back actions.
- **Do** reveal advanced controls when requested or required to correct validation.

### Don't:

- **Don't** recolor existing saved or partial legacy appearance when introducing fresh defaults.
- **Don't** let panel transparency reduce setup or settings readability.
- **Don't** obscure the answer with toolbar or composer overlays.
- **Don't** replace the confirmed charcoal system with unrelated decorative styling or a new branding metaphor.
- **Don't** hide essential commands behind advanced disclosures or pointer-only access.
