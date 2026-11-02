# Spec Delta

## Purpose

Define the initial Linux distribution contract for SC while keeping support claims bounded to the verified desktop and package matrix.

## ADDED Requirements

### Requirement: Supported Fedora RPM installation

SC SHALL provide an RPM for Fedora 44 x86-64 with Hyprland Wayland, document its portal/keyring dependencies, and install a consistent desktop identity and launcher without requiring the Windows native addon. Other desktops and package formats SHALL remain unqualified until separately verified.

#### Scenario: Install on the supported desktop

- **WHEN** the RPM is installed on the supported desktop with the documented dependencies
- **THEN** the user can launch SC through its installed desktop entry and executable
- **AND** the Linux package does not require the Windows native module

#### Scenario: Required desktop component unavailable

- **WHEN** the supported portal or secure keyring is missing
- **THEN** setup guidance describes the required dependency and recovery rather than claiming unsupported desktop behavior or weakening security

### Requirement: Manual Linux upgrade and owned launcher cleanup

Linux SC SHALL use manual RPM upgrades instead of the Windows update feed, retain encrypted settings across a full version upgrade, and preserve unrelated commands/files during package upgrade or removal.

#### Scenario: Upgrade full installed application

- **WHEN** the user manually installs a newer supported SC RPM
- **THEN** the updated application launches with its existing encrypted settings and a working desktop entry/launcher
- **AND** the Linux application does not invoke the Windows automatic updater

#### Scenario: Remove the package

- **WHEN** SC is removed
- **THEN** cleanup removes only package-owned launcher integration and leaves unrelated commands/files intact

### Requirement: Preserve Windows distribution behavior

Adding Linux distribution SHALL retain Windows installer/portable packaging, native module inclusion, encrypted-settings compatibility and existing Windows request/control behavior.

#### Scenario: Build and verify the Windows candidate

- **WHEN** the final Linux integration source is packaged and verified for Windows
- **THEN** the Windows artifacts contain their required native module and retain the established installer, vault and desktop contracts
