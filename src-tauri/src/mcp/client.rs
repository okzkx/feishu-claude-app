use super::transport::StdioTransport;
use super::types::{ConnectionStatus, McpConfig, McpConnectionInfo, McpError};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

/// MCP 客户端（每次调用模式）
pub struct McpClient {
    config: McpConfig,
    connected: Arc<AtomicBool>,
    status: Arc<AsyncMutex<ConnectionStatus>>,
    transport: Arc<AsyncMutex<StdioTransport>>,
}

impl McpClient {
    /// 创建新的 MCP 客户端
    pub fn new(config: McpConfig) -> Self {
        let working_dir = config.working_dir.clone();
        Self {
            config,
            connected: Arc::new(AtomicBool::new(false)),
            status: Arc::new(AsyncMutex::new(ConnectionStatus::Disconnected)),
            transport: Arc::new(AsyncMutex::new(StdioTransport::new(working_dir))),
        }
    }

    /// 测试连接（验证 claude 命令可用）
    pub async fn connect(&self) -> Result<McpConnectionInfo, McpError> {
        *self.status.lock().await = ConnectionStatus::Connecting;

        let mut transport = self.transport.lock().await;
        match transport.test_connection().await {
            Ok(()) => {
                self.connected.store(true, Ordering::SeqCst);
                *self.status.lock().await = ConnectionStatus::Connected;

                Ok(McpConnectionInfo {
                    status: ConnectionStatus::Connected,
                    server_info: None,
                    capabilities: None,
                    error: None,
                })
            }
            Err(e) => {
                *self.status.lock().await = ConnectionStatus::Error;
                Err(e)
            }
        }
    }

    /// 断开连接
    pub async fn disconnect(&self) {
        let mut transport = self.transport.lock().await;
        transport.stop().await;
        self.connected.store(false, Ordering::SeqCst);
        *self.status.lock().await = ConnectionStatus::Disconnected;
    }

    /// 获取连接状态
    pub async fn status(&self) -> ConnectionStatus {
        *self.status.lock().await
    }

    /// 获取连接信息
    pub async fn connection_info(&self) -> McpConnectionInfo {
        McpConnectionInfo {
            status: self.status().await,
            server_info: None,
            capabilities: None,
            error: None,
        }
    }

    /// 检查是否已连接
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    /// 执行命令
    pub async fn send_message(&self, content: &str, session_key: Option<&str>) -> Result<String, McpError> {
        let mut transport = self.transport.lock().await;
        transport.execute(content, session_key).await
    }

    /// 更新配置
    pub async fn update_config(&mut self, config: McpConfig) {
        let working_dir = config.working_dir.clone();
        self.config = config;
        // 重新创建 transport 以使用新的工作目录
        self.transport = Arc::new(AsyncMutex::new(StdioTransport::new(working_dir)));
    }

    /// 获取当前配置
    pub fn config(&self) -> &McpConfig {
        &self.config
    }

    /// 设置清除记忆标志
    /// 下次执行时不使用 --continue，开启全新会话
    pub fn clear_memory(&self) {
        StdioTransport::set_clear_memory();
    }

    /// 设置工作目录
    pub async fn set_working_dir(&mut self, path: String) {
        let mut transport = self.transport.lock().await;
        transport.set_working_dir(path);
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
        match self.client.try_lock() {
            Ok(guard) => guard.is_connected(),
            Err(_) => false,
        }
    }

    pub async fn send_message(&self, content: &str, session_key: Option<&str>) -> Result<String, McpError> {
        let client = self.client.lock().await;
        client.send_message(content, session_key).await
    }

    pub async fn update_config(&self, config: McpConfig) {
        let mut client = self.client.lock().await;
        client.update_config(config).await;
    }

    pub async fn config(&self) -> McpConfig {
        let client = self.client.lock().await;
        client.config().clone()
    }

    /// 设置清除记忆标志
    /// 下次执行时不使用 --continue，开启全新会话
    pub fn clear_memory(&self) {
        // 直接调用静态方法，不需要锁
        StdioTransport::set_clear_memory();
    }

    /// 设置工作目录
    pub async fn set_working_dir(&self, path: String) {
        let mut client = self.client.lock().await;
        client.set_working_dir(path).await;
    }
}

impl Default for McpClientManager {
    fn default() -> Self {
        Self::new(McpClient::default())
    }
}
