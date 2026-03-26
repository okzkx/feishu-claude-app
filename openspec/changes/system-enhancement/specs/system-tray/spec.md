## ADDED Requirements

### Requirement: System tray icon
The system SHALL display an icon in the system tray while the application is running.

#### Scenario: Tray icon visible
- **WHEN** application starts
- **THEN** a tray icon SHALL appear in the Windows system tray area

#### Scenario: Tray icon tooltip
- **WHEN** user hovers over the tray icon
- **THEN** a tooltip SHALL display "飞书 Claude 消息轮询"

### Requirement: Tray menu
The system SHALL provide a context menu when the tray icon is right-clicked.

#### Scenario: Menu items displayed
- **WHEN** user right-clicks the tray icon
- **THEN** a menu SHALL appear with the following items:
  - "启动轮询" / "停止轮询" (toggle based on current state)
  - Separator
  - "显示窗口"
  - Separator
  - "退出"

#### Scenario: Toggle polling from tray
- **WHEN** user clicks "启动轮絮" or "停止轮询" in the tray menu
- **THEN** the polling state SHALL toggle accordingly
- **AND** the menu item text SHALL update to reflect the new state

#### Scenario: Show window from tray
- **WHEN** user clicks "显示窗口" in the tray menu
- **THEN** the main window SHALL be shown and focused

#### Scenario: Exit from tray
- **WHEN** user clicks "退出" in the tray menu
- **THEN** the application SHALL exit completely (not minimize to tray)

### Requirement: Minimize to tray
The system SHALL minimize to tray instead of closing when the window close button is clicked.

#### Scenario: Close button minimizes to tray
- **WHEN** user clicks the window close button (X)
- **THEN** the window SHALL be hidden
- **AND** the application SHALL continue running in the tray

#### Scenario: Left-click tray icon shows window
- **WHEN** user left-clicks the tray icon
- **THEN** the main window SHALL be shown and focused

### Requirement: Tray notifications
The system MAY show notifications from the tray for important events.

#### Scenario: Polling started notification
- **WHEN** polling is started
- **THEN** a notification MAY be shown indicating polling has started

#### Scenario: Error notification
- **WHEN** a critical error occurs during polling or MCP execution
- **THEN** a notification SHALL be shown describing the error
