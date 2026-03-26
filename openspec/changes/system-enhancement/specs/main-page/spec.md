## MODIFIED Requirements

### Requirement: MainPage component refactored
The MainPage component SHALL be refactored into smaller, focused sub-components.

**Previous state**: Single MainPage.tsx file (~1000 lines) containing all UI and logic.

**New state**: MainPage composed of multiple sub-components, each with single responsibility.

#### Scenario: Component structure
- **WHEN** MainPage is rendered
- **THEN** it SHALL be composed of the following sub-components:
  - TitleBar (window controls and title)
  - PollingControl (start/stop polling buttons)
  - StatusIndicator (polling and MCP status display)
  - MessageList (message history display)
  - RecentMessages (recently received messages)
  - TestPanel (testing and debug controls)

#### Scenario: State from stores
- **WHEN** MainPage sub-components need state
- **THEN** they SHALL read state from Zustand stores
- **AND** NOT receive state via props from MainPage parent

#### Scenario: Events handled in sub-components
- **WHEN** user interacts with a sub-component
- **THEN** the event handler SHALL be defined within that sub-component
- **AND** use Zustand actions to update state

### Requirement: PollingControl component
The system SHALL have a dedicated component for polling controls.

#### Scenario: PollingControl rendering
- **WHEN** PollingControl is rendered
- **THEN** it SHALL display:
  - Start/Stop button (text changes based on state)
  - Current polling interval display
  - Last poll time (if available)

#### Scenario: PollingControl uses store
- **WHEN** user clicks start/stop button in PollingControl
- **THEN** it SHALL call the polling store action
- **AND** the backend polling SHALL start/stop accordingly

### Requirement: MessageList component
The system SHALL have a dedicated component for displaying messages.

#### Scenario: MessageList rendering
- **WHEN** MessageList is rendered
- **THEN** it SHALL display a scrollable list of messages
- **AND** each message SHALL show sender, content, and timestamp

#### Scenario: MessageList loading state
- **WHEN** messages are being loaded
- **THEN** a loading indicator SHALL be displayed

### Requirement: StatusIndicator component
The system SHALL have a component showing polling and MCP status.

#### Scenario: StatusIndicator rendering
- **WHEN** StatusIndicator is rendered
- **THEN** it SHALL display:
  - Polling status (running/stopped with visual indicator)
  - MCP connection status (connected/disconnected/connecting)

#### Scenario: Real-time status updates
- **WHEN** polling or MCP status changes
- **THEN** StatusIndicator SHALL update immediately
- **AND** reflect the current state visually

### Requirement: TestPanel component
The system SHALL have a component for testing and debugging.

#### Scenario: TestPanel rendering
- **WHEN** TestPanel is rendered
- **THEN** it SHALL display:
  - Test command input field
  - Execute button
  - Result display area
  - Image send test controls

### Requirement: No breaking changes to functionality
The refactoring SHALL NOT change any existing user-facing functionality.

#### Scenario: All features preserved
- **WHEN** MainPage refactoring is complete
- **THEN** all previously available features SHALL work identically:
  - Polling start/stop
  - Message display and refresh
  - MCP connection and execution
  - Test commands
  - Image sending
