## ADDED Requirements

### Requirement: Theme modes
The system SHALL support light and dark theme modes.

#### Scenario: Light theme
- **WHEN** light theme is selected
- **THEN** the UI SHALL display with a light color scheme
- **AND** Ant Design components SHALL use light theme tokens

#### Scenario: Dark theme
- **WHEN** dark theme is selected
- **THEN** the UI SHALL display with a dark color scheme
- **AND** Ant Design components SHALL use dark theme tokens

### Requirement: System theme following
The system SHALL support automatically following the operating system theme.

#### Scenario: System theme mode
- **WHEN** user selects "system" theme mode
- **THEN** the application theme SHALL match the OS theme

#### Scenario: OS theme changes
- **WHEN** the OS theme changes (light to dark or vice versa)
- **AND** system theme mode is selected
- **THEN** the application theme SHALL update to match

### Requirement: Theme persistence
The system SHALL persist the user's theme preference.

#### Scenario: Theme saved
- **WHEN** user changes the theme
- **THEN** the preference SHALL be saved to persistent storage

#### Scenario: Theme restored on startup
- **WHEN** application starts
- **THEN** the saved theme preference SHALL be applied
- **AND** if no preference is saved, system theme SHALL be used as default

### Requirement: Theme toggle UI
The system SHALL provide a UI control to switch themes.

#### Scenario: Theme toggle in settings
- **WHEN** user accesses the settings/configuration page
- **THEN** a theme selector SHALL be available
- **AND** options SHALL include: Light, Dark, Follow System

#### Scenario: Theme toggle immediate effect
- **WHEN** user selects a new theme
- **THEN** the theme SHALL change immediately without restart

### Requirement: CSS variables for theming
The system SHALL use CSS custom properties (variables) for theme colors.

#### Scenario: CSS variables applied
- **WHEN** theme changes
- **THEN** CSS custom properties SHALL be updated on the root element
- **AND** all styled components SHALL use these variables
