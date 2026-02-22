use super::types::{JsonRpcRequest, JsonRpcResponse, McpError};
use reqwest::Client;
use std::time::Duration;

/// HTTP 传输层
pub struct HttpTransport {
    client: Client,
    base_url: String,
}

impl HttpTransport {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            base_url,
        }
    }

    /// 发送 JSON-RPC 请求
    pub async fn send_request(&self, request: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let url = format!("{}/message", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(request)
            .send()
            .await
            .map_err(|e| McpError::ConnectionFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(McpError::RequestFailed(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let text = response
            .text()
            .await
            .map_err(|e| McpError::RequestFailed(e.to_string()))?;

        // 尝试解析 JSON-RPC 响应
        serde_json::from_str(&text)
            .map_err(|e| McpError::InvalidResponse(format!("JSON parse error: {}", e)))
    }

    /// 建立连接（健康检查）
    pub async fn connect(&self) -> Result<(), McpError> {
        let url = format!("{}/message", self.base_url);

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| McpError::ConnectionFailed(e.to_string()))?;

        if response.status().is_success() || response.status().as_u16() == 405 {
            // 405 Method Not Allowed 可能表示端点存在但不支持 GET
            Ok(())
        } else {
            Err(McpError::ConnectionFailed(format!(
                "Health check failed: {}",
                response.status()
            )))
        }
    }
}

impl Default for HttpTransport {
    fn default() -> Self {
        Self::new("http://localhost:8081".to_string())
    }
}
