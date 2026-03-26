## ADDED Requirements

### Requirement: Zustand state management
The system SHALL use Zustand for global state management.

#### Scenario: Store initialization
- **WHEN** application starts
- **THEN** all Zustand stores SHALL be initialized with default or persisted values

#### Scenario: State access across components
- **WHEN** any component needs to access application state
- **THEN** it SHALL be able to read state from the appropriate Zustand store
- **AND** the component SHALL re-render when the accessed state changes

### Requirement: Config store
The system SHALL maintain a store for application configuration.

#### Scenario: Config state structure
- **WHEN** the config store is accessed
- **THEN** it SHALL contain:
  - Feishu configuration (appId, appSecret, chatId)
  - MCP configuration (workingDir)
  - UI preferences (theme, window effects)

#### Scenario: Config update
- **WHEN** user updates configuration
- **THEN** the config store SHALL be updated
- **AND** the change SHALL be persisted to storage

### Requirement: Polling store
The system SHALL maintain a store for polling state.

#### Scenario: Polling state structure
- **WHEN** the polling store is accessed
- **THEN** it SHALL contain:
  - isRunning (boolean)
  - lastPollTime (timestamp or null)
  - pollInterval (number in seconds)

#### Scenario: Polling state sync with backend
- **WHEN** polling starts or stops
- **THEN** the polling store state SHALL be updated
- **AND** the UI SHALL reflect the current state

### Requirement: Message store
The system SHALL maintain a store for message data.

#### Scenario: Message state structure
- **WHEN** the message store is accessed
- **THEN** it SHALL contain:
  - messages (array of Message objects)
  - recentMessages (array of recent Message objects)
  - processedMessageIds (Set of string IDs)

#### Scenario: Message added
- **WHEN** a new message is received
- **THEN** the message SHALL be added to the messages array
- **AND** the message ID SHALL be added to processedMessageIds

### Requirement: MCP store
The system SHALL maintain a store for MCP connection state.

#### Scenario: MCP state structure
- **WHEN** the MCP store is accessed
- **THEN** it SHALL contain:
  - isConnected (boolean)
  - status (string: 'disconnected' | 'connecting' | 'connected')
  - lastResult (string or null)

#### Scenario: MCP status update
- **WHEN** MCP connection status changes
- **THEN** the MCP store SHALL be updated
- **AND** the UI SHALL reflect the new status

### Requirement: Theme store
The system SHALL maintain a store for theme state.

#### Scenario: Theme state structure
- **WHEN** the theme store is accessed
- **THEN** it SHALL contain:
  - theme ('light' | 'dark' | 'system')
  - effectiveTheme ('light' | 'dark' - computed from theme + OS)

### Requirement: Store persistence
The system SHALL persist relevant store state across application restarts.

#### Scenario: Persisted stores
- **WHEN** the application is closed and reopened
- **THEN** the following stores SHALL restore their previous state:
  - config store
  - theme store
