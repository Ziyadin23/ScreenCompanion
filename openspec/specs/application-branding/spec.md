# application-branding Specification

## Purpose

Present the approved SC icon consistently across desktop distribution, application identity and the companion website while preserving existing controls and visibility behavior.

## Requirements

### Requirement: Desktop distribution identity
SC SHALL use the approved icon for Windows application, portable and installer executables, installed shortcuts and the Linux desktop package icon. Required image resources SHALL be included in the built application.

#### Scenario: Packaged desktop identity
- **WHEN** a user opens a packaged SC executable, installer or installed shortcut
- **THEN** its supported operating-system icon surfaces use the approved SC artwork
- **AND** existing application identity, install paths and taskbar visibility behavior remain unchanged

### Requirement: Application identity and working state
SC SHALL display the approved artwork in setup, Settings, the application window and tray. The tray SHALL retain a visible working-state distinction and its existing actions. Decorative marks SHALL not duplicate adjacent accessible names.

#### Scenario: Setup and settings headers
- **WHEN** setup or Settings is displayed
- **THEN** the approved icon appears beside the existing title without changing layout or controls

#### Scenario: Active request
- **WHEN** SC begins or completes a request
- **THEN** the tray distinguishes the working and idle states while retaining the approved mark and menu actions

### Requirement: Website identity
The English and Russian website SHALL use the approved artwork for header/footer branding, browser icons, touch shortcuts and link-preview image metadata. Image URLs SHALL honor the deployment base path, and linked logos SHALL retain accessible names.

#### Scenario: Project-subdirectory deployment
- **WHEN** either website language is built below a configured subdirectory
- **THEN** branding images, favicons, touch icons and preview metadata resolve to included assets beneath that base path
