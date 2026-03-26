## ADDED Requirements

### Requirement: Autostart configuration
The system SHALL allow users to configure whether the application starts automatically on system boot.

#### Scenario: Enable autostart
- **WHEN** user enables the autostart option in settings
- **THEN** the application SHALL be registered to start on system boot
- **AND** the setting SHALL be persisted

#### Scenario: Disable autostart
- **WHEN** user disables the autostart option in settings
- **THEN** the application SHALL be removed from system boot startup items
- **AND** the setting SHALL be persisted

#### Scenario: Autostart setting persisted
- **WHEN** user changes the autostart setting
- **THEN** the new setting SHALL be saved to persistent storage
- **AND** the setting SHALL be restored on next application launch

### Requirement: Autostart setting UI
The system SHALL provide a toggle switch in the configuration page for autostart control.

#### Scenario: Toggle shows current state
- **WHEN** configuration page is displayed
- **THEN** the autostart toggle SHALL reflect the current autostart status

#### Scenario: Toggle synced with system state
- **WHEN** the autostart toggle is displayed
- **THEN** it SHALL show the actual system autostart status (not just the stored preference)
