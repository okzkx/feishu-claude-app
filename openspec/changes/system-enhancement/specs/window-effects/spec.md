## ADDED Requirements

### Requirement: Window transparency
The system SHALL support transparent window effects on Windows.

#### Scenario: Transparent background
- **WHEN** the application starts on Windows
- **THEN** the window background SHALL be transparent
- **AND** the content SHALL be rendered on a transparent surface

### Requirement: Blur effect (Mica/Acrylic)
The system SHALL apply a blur effect to the window background on Windows 11.

#### Scenario: Mica effect on Windows 11
- **WHEN** application runs on Windows 11
- **THEN** the Mica effect SHALL be applied to the window background

#### Scenario: Acrylic fallback on Windows 10
- **WHEN** application runs on Windows 10
- **AND** Mica effect is not available
- **THEN** the Acrylic blur effect SHALL be applied as fallback

#### Scenario: Effect disabled gracefully
- **WHEN** blur effects fail to apply
- **THEN** the application SHALL continue to function with standard window appearance

### Requirement: Effect toggle
The system MAY provide an option to disable window effects for performance reasons.

#### Scenario: Disable effects in settings
- **WHEN** user disables window effects in settings
- **THEN** the blur effect SHALL be turned off
- **AND** the window SHALL use standard appearance

### Requirement: Window shadow
The system SHALL maintain window shadow for visual depth.

#### Scenario: Shadow visible
- **WHEN** window effects are enabled
- **THEN** the window SHALL have a visible drop shadow
