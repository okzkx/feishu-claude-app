use serde::{Deserialize, Serialize};

/// JSON-RPC 2.0 请求
#[derive(Debug, Clone, Serialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

impl JsonRpcRequest {
    pub fn new(id: u64, method: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.into(),
            params: None,
        }
    }

    pub fn with_params(mut self, params: serde_json::Value) -> Self {
        self.params = Some(params);
        self
    }
}

/// JSON-RPC 2.0 响应
#[derive(Debug, Clone, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC 错误
#[derive(Debug, Clone, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

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

/// MCP 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    pub enabled: bool,
    pub transport: McpTransport,
    pub http_url: String,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            transport: McpTransport::Http,
            http_url: "http://localhost:8081".to_string(),
        }
    }
}

/// 传输方式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpTransport {
    Http,
    Stdio,
}

/// 服务器信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol_version: Option<String>,
}

/// MCP 能力
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpCapabilities {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resources: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompts: Option<bool>,
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

/// 工具定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_rpc_request_new() {
        let request = JsonRpcRequest::new(1, "initialize");
        assert_eq!(request.jsonrpc, "2.0");
        assert_eq!(request.id, 1);
        assert_eq!(request.method, "initialize");
        assert!(request.params.is_none());
    }

    #[test]
    fn test_json_rpc_request_with_params() {
        let params = serde_json::json!({"key": "value"});
        let request = JsonRpcRequest::new(1, "test").with_params(params.clone());
        assert_eq!(request.params, Some(params));
    }

    #[test]
    fn test_mcp_config_default() {
        let config = McpConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.transport, McpTransport::Http);
        assert_eq!(config.http_url, "http://localhost:8081");
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
        let config = McpConfig {
            enabled: true,
            transport: McpTransport::Http,
            http_url: "http://localhost:9000".to_string(),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"enabled\":true"));
        assert!(json.contains("\"transport\":\"http\""));
        assert!(json.contains("\"http_url\":\"http://localhost:9000\""));

        let deserialized: McpConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.enabled, config.enabled);
        assert_eq!(deserialized.transport, config.transport);
        assert_eq!(deserialized.http_url, config.http_url);
    }

    #[test]
    fn test_json_rpc_request_serialization() {
        let request = JsonRpcRequest::new(1, "initialize")
            .with_params(serde_json::json!({"protocolVersion": "2025-03-26"}));

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"method\":\"initialize\""));
        assert!(json.contains("\"protocolVersion\":\"2025-03-26\""));
    }
}
