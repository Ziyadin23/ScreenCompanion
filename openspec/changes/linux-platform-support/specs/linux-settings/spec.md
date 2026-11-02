# Spec Delta

## Purpose

Preserve SC settings securely on Linux and make keyring failures recoverable without weakening encryption or altering Windows vaults.

## ADDED Requirements

### Requirement: Secure keyring required

SC SHALL encrypt Linux settings using a supported secure keyring and refuse plaintext or weak-backend fallback when that keyring is unavailable or locked.

#### Scenario: Secure keyring available

- **WHEN** the user saves settings with an available unlocked secure keyring
- **THEN** the encrypted settings survive application restart with the saved preferences and provider keys intact

#### Scenario: Secure keyring unavailable

- **WHEN** the keyring is locked, missing or offers only an insecure backend
- **THEN** SC refuses the insecure save and provides install/unlock/retry guidance without exposing settings or keys

### Requirement: Preserve existing settings during recovery

SC SHALL retain existing encrypted bytes when settings cannot be opened or saved, provide usable recovery guidance, and permit normal operation after secure storage is restored.

#### Scenario: Existing encrypted settings cannot be opened

- **WHEN** secure storage is temporarily unavailable while existing settings are loaded
- **THEN** SC retains the encrypted file, presents a dismissible recovery message and allows a subsequent restart after the keyring is restored

#### Scenario: Settings save fails

- **WHEN** encryption or atomic settings publication fails
- **THEN** SC retains the prior saved bytes and allows a retry without publishing partial or plaintext settings

### Requirement: Platform storage isolation

Linux settings SHALL use their own encrypted storage identity and SHALL NOT migrate, overwrite or reinterpret Windows DPAPI vault files. Windows settings and migration behavior SHALL retain their existing compatibility contracts.

#### Scenario: Windows vault bytes are present

- **WHEN** Linux SC starts or saves settings where Windows vault files are also accessible
- **THEN** it uses Linux settings independently and leaves the Windows vault bytes unchanged
