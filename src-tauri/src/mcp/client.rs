use super::types::{
    ConnectionStatus, JsonRpcRequest, McpCapabilities, McpConfig, McpConnectionInfo,
    McpError, ServerInfo, Tool,
};
use super::transport::HttpTransport;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

/// MCP 客户端
pub struct McpClient {
    config: McpConfig,
    status: Arc<AtomicBool>,
    status_string: Arc<AsyncMutex<ConnectionStatus>>,
    connection_info: Arc<AsyncMutex<McpConnectionInfo>>,
    request_id: Arc<AtomicU64>,
}

impl McpClient {
    /// 创建新的 MCP 客户端
    pub fn new(config: McpConfig) -> Self {
        Self {
            config,
            status: Arc::new(AtomicBool::new(false)),
            status_string: Arc::new(AsyncMutex::new(ConnectionStatus::Disconnected)),
            connection_info: Arc::new(AsyncMutex::new(McpConnectionInfo::default())),
            request_id: Arc::new(AtomicU64::new(0)),
        }
    }

    /// 连接到 MCP 服务器
    pub async fn connect(&self) -> Result<McpConnectionInfo, McpError> {
        *self.status_string.lock().await = ConnectionStatus::Connecting;

        let transport = HttpTransport::new(self.config.http_url.clone());

        // 健康检查
        transport.connect().await?;

        // 发送 initialize 请求
        let request = JsonRpcRequest::new(1, "initialize").with_params(serde_json::json!({
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {
                "name": "feishu-claude-app",
                "version": "0.1.0"
            }
        }));

        let response = transport.send_request(&request).await?;

        if let Some(error) = response.error {
            return Err(McpError::ProtocolError(format!(
                "Initialize failed: {} - {}",
                error.code, error.message
            )));
        }

        // 解析服务器信息
        let server_info = if let Some(result) = response.result {
            serde_json::from_value::<ServerInfo>(result.clone()).ok()
        } else {
            None
        };

        // 发送 initialized 通知
        let initialized_request = JsonRpcRequest::new(2, "notifications/initialized");
        let _ = transport.send_request(&initialized_request).await;

        self.status.store(true, Ordering::SeqCst);
        *self.status_string.lock().await = ConnectionStatus::Connected;

        let info = McpConnectionInfo {
            status: ConnectionStatus::Connected,
            server_info,
            capabilities: None,
            error: None,
        };

        *self.connection_info.lock().await = info.clone();

        Ok(info)
    }

    /// 断开连接
    pub async fn disconnect(&self) {
        self.status.store(false, Ordering::SeqCst);
        *self.status_string.lock().await = ConnectionStatus::Disconnected;
        *self.connection_info.lock().await = McpConnectionInfo::default();
    }

    /// 获取连接状态
    pub async fn status(&self) -> ConnectionStatus {
        *self.status_string.lock().await
    }

    /// 获取连接信息
    pub async fn connection_info(&self) -> McpConnectionInfo {
        self.connection_info.lock().await.clone()
    }

    /// 检查是否已连接
    pub fn is_connected(&self) -> bool {
        self.status.load(Ordering::SeqCst)
    }

    /// 发送消息
    pub async fn send_message(&self, content: &str) -> Result<String, McpError> {
        if !self.is_connected() {
            return Err(McpError::Disconnected);
        }

        let id = self.request_id.fetch_add(1, Ordering::SeqCst) + 1;

        let transport = HttpTransport::new(self.config.http_url.clone());
        let request = JsonRpcRequest::new(id, "message/send").with_params(serde_json::json!({
            "content": content
        }));

        let response = transport.send_request(&request).await?;

        if let Some(error) = response.error {
            return Err(McpError::ProtocolError(format!(
                "Message send failed: {} - {}",
                error.code, error.message
            )));
        }

        Ok(response
            .result
            .and_then(|v| serde_json::to_string(&v).ok())
            .unwrap_or_else(|| "{}".to_string()))
    }

    /// 列出可用工具
    pub async fn list_tools(&self) -> Result<Vec<Tool>, McpError> {
        if !self.is_connected() {
            return Err(McpError::Disconnected);
        }

        let id = self.request_id.fetch_add(1, Ordering::SeqCst) + 1;
        let transport = HttpTransport::new(self.config.http_url.clone());
        let request = JsonRpcRequest::new(id, "tools/list");

        let response = transport.send_request(&request).await?;

        if let Some(error) = response.error {
            return Err(McpError::ProtocolError(format!(
                "List tools failed: {} - {}",
                error.code, error.message
            )));
        }

        response
            .result
            .and_then(|v| serde_json::from_value::<Vec<Tool>>(v).ok())
            .ok_or_else(|| McpError::InvalidResponse("Invalid tools list".to_string()))
    }

    /// 调用工具
    pub async fn call_tool(
        &self,
        name: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, McpError> {
        if !self.is_connected() {
            return Err(McpError::Disconnected);
        }

        let id = self.request_id.fetch_add(1, Ordering::SeqCst) + 1;
        let transport = HttpTransport::new(self.config.http_url.clone());
        let request = JsonRpcRequest::new(id, "tools/call").with_params(serde_json::json!({
            "name": name,
            "arguments": args
        }));

        let response = transport.send_request(&request).await?;

        if let Some(error) = response.error {
            return Err(McpError::ProtocolError(format!(
                "Tool call failed: {} - {}",
                error.code, error.message
            )));
        }

        response.result.ok_or_else(|| {
            McpError::InvalidResponse("No result returned from tool call".to_string())
        })
    }

    /// 获取服务器能力
    #[allow(dead_code)]
    async fn get_capabilities(&self) -> Result<McpCapabilities, McpError> {
        let id = self.request_id.fetch_add(1, Ordering::SeqCst) + 1;
        let transport = HttpTransport::new(self.config.http_url.clone());
        let request = JsonRpcRequest::new(id, "server/get_capabilities");

        match transport.send_request(&request).await {
            Ok(response) => {
                if let Some(result) = response.result {
                    serde_json::from_value(result)
                        .map_err(|e| McpError::InvalidResponse(e.to_string()))
                } else {
                    Ok(McpCapabilities::default())
                }
            }
            Err(_) => Ok(McpCapabilities::default()),
        }
    }

    /// 更新配置
    pub async fn update_config(&mut self, config: McpConfig) {
        let enabled = config.enabled;
        self.config = config;

        // 如果之前已连接但新配置禁用了 MCP，断开连接
        if !enabled && self.is_connected() {
            self.disconnect().await;
        }
    }

    /// 获取当前配置
    pub fn config(&self) -> &McpConfig {
        &self.config
    }
}

impl Default for McpClient {
    fn default() -> Self {
        Self::new(McpConfig::default())
    }
}

/// 全局 MCP 客户端管理器
pub struct McpClientManager {
    client: Arc<AsyncMutex<McpClient>>,
}

impl McpClientManager {
    pub fn new(client: McpClient) -> Self {
        Self {
            client: Arc::new(AsyncMutex::new(client)),
        }
    }

    pub async fn connect(&self) -> Result<McpConnectionInfo, McpError> {
        let client = self.client.lock().await;
        client.connect().await
    }

    pub async fn disconnect(&self) {
        let client = self.client.lock().await;
        client.disconnect().await;
    }

    pub async fn status(&self) -> ConnectionStatus {
        let client = self.client.lock().await;
        client.status().await
    }

    pub async fn connection_info(&self) -> McpConnectionInfo {
        let client = self.client.lock().await;
        client.connection_info().await
    }

    pub fn is_connected(&self) -> bool {
        // 使用 try_lock 避免阻塞，如果无法获取锁则返回 false
        match self.client.try_lock() {
            Ok(guard) => guard.is_connected(),
            Err(_) => false,
        }
    }

    pub async fn send_message(&self, content: &str) -> Result<String, McpError> {
        let client = self.client.lock().await;
        client.send_message(content).await
    }

    pub async fn list_tools(&self) -> Result<Vec<Tool>, McpError> {
        let client = self.client.lock().await;
        client.list_tools().await
    }

    pub async fn call_tool(
        &self,
        name: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, McpError> {
        let client = self.client.lock().await;
        client.call_tool(name, args).await
    }

    pub async fn update_config(&self, config: McpConfig) {
        let mut client = self.client.lock().await;
        client.update_config(config).await;
    }

    pub async fn config(&self) -> McpConfig {
        let client = self.client.lock().await;
        client.config().clone()
    }
}

impl Default for McpClientManager {
    fn default() -> Self {
        Self::new(McpClient::default())
    }
}
