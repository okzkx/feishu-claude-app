use serde::{Deserialize, Serialize};

/// MCP 错误类型
#[derive(Debug, Clone)]
pub enum McpError {
    ConnectionFailed(String),
    RequestFailed(String),
    ProtocolError(String),
    Timeout,
    Disconnected,
    InvalidResponse(String),
}

impl std::fmt::Display for McpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            McpError::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            McpError::RequestFailed(msg) => write!(f, "Request failed: {}", msg),
            McpError::ProtocolError(msg) => write!(f, "Protocol error: {}", msg),
            McpError::Timeout => write!(f, "Request timeout"),
            McpError::Disconnected => write!(f, "Not connected"),
            McpError::InvalidResponse(msg) => write!(f, "Invalid response: {}", msg),
        }
    }
}

impl std::error::Error for McpError {}

/// 连接状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

/// MCP 配置（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub enabled: bool,
    pub working_dir: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            working_dir: ".".to_string(),
        }
    }
}

/// 连接状态信息（用于前端）
#[derive(Debug, Clone, Serialize)]
pub struct McpConnectionInfo {
    pub status: ConnectionStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_info: Option<ServerInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<McpCapabilities>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Default for McpConnectionInfo {
    fn default() -> Self {
        Self {
            status: ConnectionStatus::Disconnected,
            server_info: None,
            capabilities: None,
            error: None,
        }
    }
}

/// 服务器信息（保留用于兼容）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
}

/// MCP 能力（保留用于兼容）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_config_default() {
        let config = McpConfig::default();
        assert!(!config.enabled);
    }

    #[test]
    fn test_mcp_error_display() {
        let error = McpError::ConnectionFailed("test error".to_string());
        assert_eq!(format!("{}", error), "Connection failed: test error");

        let error = McpError::Timeout;
        assert_eq!(format!("{}", error), "Request timeout");

        let error = McpError::Disconnected;
        assert_eq!(format!("{}", error), "Not connected");
    }

    #[test]
    fn test_connection_status_default() {
        let info = McpConnectionInfo::default();
        assert_eq!(info.status, ConnectionStatus::Disconnected);
        assert!(info.server_info.is_none());
        assert!(info.capabilities.is_none());
        assert!(info.error.is_none());
    }

    #[test]
    fn test_mcp_config_serialization() {
        let config = McpConfig { enabled: true };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"enabled\":true"));

        let deserialized: McpConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.enabled, config.enabled);
    }
}
