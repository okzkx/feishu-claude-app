## ADDED Requirements

### Requirement: Frameless window
The system SHALL use a frameless window (no native title bar) with custom controls.

#### Scenario: No native decorations
- **WHEN** the application window is displayed
- **THEN** no native window border or title bar SHALL be visible
- **AND** custom title bar SHALL be rendered instead

### Requirement: Window drag region
The system SHALL provide a draggable area in the custom title bar.

#### Scenario: Drag window by title bar
- **WHEN** user clicks and drags on the title bar area (excluding buttons)
- **THEN** the window SHALL move with the cursor

#### Scenario: Drag region excludes buttons
- **WHEN** user clicks on window control buttons
- **THEN** the window SHALL NOT be dragged
- **AND** the button action SHALL be triggered instead

### Requirement: Window control buttons
The system SHALL provide minimize, maximize, and close buttons.

#### Scenario: Minimize button
- **WHEN** user clicks the minimize button
- **THEN** the window SHALL be hidden (minimized to tray)

#### Scenario: Maximize/restore button
- **WHEN** user clicks the maximize button
- **AND** the window is not maximized
- **THEN** the window SHALL be maximized

#### Scenario: Restore from maximized
- **WHEN** user clicks the maximize button
- **AND** the window is maximized
- **THEN** the window SHALL be restored to its previous size and position

#### Scenario: Close button
- **WHEN** user clicks the close button
- **THEN** the window SHALL be hidden (minimized to tray, not exit)

### Requirement: Title bar content
The system SHALL display application title and status in the custom title bar.

#### Scenario: Title displayed
- **WHEN** the title bar is rendered
- **THEN** the application name "飞书 Claude 消息轮询" SHALL be displayed

#### Scenario: Status indicator
- **WHEN** polling is active
- **THEN** a visual indicator (e.g., icon color or badge) SHALL show active status

### Requirement: Title bar styling
The system SHALL style the title bar to match the current theme.

#### Scenario: Light theme title bar
- **WHEN** light theme is active
- **THEN** the title bar SHALL have a light background with dark text

#### Scenario: Dark theme title bar
- **WHEN** dark theme is active
- **THEN** the title bar SHALL have a dark background with light text
