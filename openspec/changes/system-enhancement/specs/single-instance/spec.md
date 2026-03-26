## ADDED Requirements

### Requirement: Single instance enforcement
The system SHALL ensure only one instance of the application can run at a time.

#### Scenario: Second instance blocked
- **WHEN** user attempts to launch a second instance while one is already running
- **THEN** the second instance SHALL NOT start
- **AND** the existing instance's window SHALL be brought to front and focused

#### Scenario: New instance with file argument
- **WHEN** user launches a second instance with a file path argument
- **THEN** the existing instance SHALL receive the file path via event
- **AND** the existing instance SHALL handle the file appropriately

### Requirement: Window focus on reactivation
The system SHALL restore and focus the main window when a second instance is attempted.

#### Scenario: Minimized window restored
- **WHEN** application is minimized and user tries to start another instance
- **THEN** the window SHALL be unminimized
- **AND** the window SHALL be shown and focused

#### Scenario: Hidden window shown
- **WHEN** application window is hidden (e.g., minimized to tray) and user tries to start another instance
- **THEN** the window SHALL be shown
- **AND** the window SHALL be focused
