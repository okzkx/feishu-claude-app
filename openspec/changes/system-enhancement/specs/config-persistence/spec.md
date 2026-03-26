## ADDED Requirements

### Requirement: Tauri plugin store integration
The system SHALL use tauri-plugin-store for configuration persistence.

#### Scenario: Store plugin initialized
- **WHEN** the application starts
- **THEN** the tauri-plugin-store SHALL be initialized
- **AND** configuration SHALL be loaded from the store

#### Scenario: Config saved to store
- **WHEN** configuration is changed
- **THEN** the new configuration SHALL be saved to the tauri-plugin-store
- **AND** the save operation SHALL complete before the application exits

### Requirement: Backend config commands
The system SHALL provide Tauri commands for config management.

#### Scenario: Get config command
- **WHEN** frontend calls get_config command
- **THEN** the current configuration SHALL be returned from the store

#### Scenario: Save config command
- **WHEN** frontend calls save_config command with new config
- **THEN** the configuration SHALL be saved to the store
- **AND** the in-memory state SHALL be updated

#### Scenario: Config file location
- **WHEN** configuration is persisted
- **THEN** it SHALL be stored in the application's config directory
- **AND** the file SHALL be named appropriately (e.g., config.json)

### Requirement: Migration from localStorage
The system SHALL migrate existing localStorage configuration to tauri-plugin-store.

#### Scenario: First run with existing localStorage
- **WHEN** application starts for the first time after this feature is deployed
- **AND** configuration exists in localStorage
- **THEN** the configuration SHALL be migrated to tauri-plugin-store
- **AND** the localStorage data MAY be cleared after successful migration

#### Scenario: No migration needed
- **WHEN** application starts
- **AND** configuration already exists in tauri-plugin-store
- **THEN** no migration SHALL occur
- **AND** configuration SHALL be loaded from tauri-plugin-store

### Requirement: Config schema
The system SHALL define a clear schema for configuration data.

#### Scenario: Config structure
- **WHEN** configuration is stored or retrieved
- **THEN** it SHALL conform to the following structure:
  ```typescript
  interface AppConfig {
    feishu: {
      appId: string;
      appSecret: string;
      chatId: string;
    };
    mcp: {
      workingDir: string;
    };
    ui: {
      theme: 'light' | 'dark' | 'system';
      windowEffects: boolean;
      autostart: boolean;
    };
  }
  ```

### Requirement: Config validation
The system SHALL validate configuration before saving.

#### Scenario: Invalid config rejected
- **WHEN** user attempts to save invalid configuration
- **THEN** an error SHALL be returned
- **AND** the invalid configuration SHALL NOT be saved

#### Scenario: Required fields
- **WHEN** configuration is saved
- **THEN** required fields (appId, appSecret, chatId) SHALL be validated
