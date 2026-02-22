use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

mod mcp;
use mcp::{ConnectionStatus, McpClientManager, McpConfig, McpConnectionInfo};

// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub feishu_app_id: String,
    pub feishu_app_secret: String,
    pub feishu_chat_id: String,
    pub feishu_user_id: Option<String>,
    pub cmd_prefix: String,
    pub poll_interval: u64,
    #[serde(default)]
    pub mcp: McpConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            feishu_app_id: String::new(),
            feishu_app_secret: String::new(),
            feishu_chat_id: String::new(),
            feishu_user_id: None,
            cmd_prefix: "claude:".to_string(),
            poll_interval: 5,
            mcp: McpConfig::default(),
        }
    }
}

// 消息状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

// 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub message_id: String,
    pub chat_id: String,
    pub sender_id: String,
    pub content: String,
    pub msg_type: String,
    pub create_time: i64,
    pub status: MessageStatus,
}

// 任务结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub success: bool,
    pub output: String,
    pub timestamp: i64,
}

// 全局状态
pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub is_running: AtomicBool,
    pub processed_ids: Mutex<HashSet<String>>,
    pub mcp_client: Arc<McpClientManager>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            is_running: AtomicBool::new(false),
            processed_ids: Mutex::new(HashSet::new()),
            mcp_client: Arc::new(McpClientManager::default()),
        }
    }
}

// 获取配置
#[tauri::command]
fn get_config(state: tauri::State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

// 保存配置
#[tauri::command]
async fn save_config(state: tauri::State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    let mcp_config = config.mcp.clone();
    {
        let mut current = state.config.lock().map_err(|e| e.to_string())?;
        *current = config;
    }

    state.mcp_client.update_config(mcp_config).await;

    Ok(())
}

// 检查是否正在运行
#[tauri::command]
fn is_polling_running(state: tauri::State<'_, AppState>) -> bool {
    state.is_running.load(Ordering::SeqCst)
}

// 启动轮询
#[tauri::command]
async fn start_polling(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    if state.is_running.load(Ordering::SeqCst) {
        return Err("轮询已在运行中".to_string());
    }

    state.is_running.store(true, Ordering::SeqCst);
    app.emit("polling-status", "started").ok();

    let poll_interval = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.poll_interval
    };

    let mut ticker = interval(Duration::from_secs(poll_interval));

    while state.is_running.load(Ordering::SeqCst) {
        ticker.tick().await;
        app.emit("poll-tick", ()).ok();
    }

    app.emit("polling-status", "stopped").ok();
    Ok(())
}

// 停止轮询
#[tauri::command]
fn stop_polling(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.is_running.store(false, Ordering::SeqCst);
    Ok(())
}

// 检查消息是否已处理
#[tauri::command]
fn is_message_processed(state: tauri::State<'_, AppState>, message_id: String) -> bool {
    let ids = state.processed_ids.lock().unwrap();
    ids.contains(&message_id)
}

// 标记消息已处理
#[tauri::command]
fn mark_message_processed(state: tauri::State<'_, AppState>, message_id: String) {
    let mut ids = state.processed_ids.lock().unwrap();
    ids.insert(message_id);

    if ids.len() > 100 {
        let to_remove: Vec<String> = ids.iter().take(50).cloned().collect();
        for id in to_remove {
            ids.remove(&id);
        }
    }
}

// 获取 MCP 连接状态
#[tauri::command]
async fn mcp_status(state: tauri::State<'_, AppState>) -> Result<McpConnectionInfo, String> {
    let info = state.mcp_client.connection_info().await;
    Ok(info)
}

// 连接 MCP（启动 Claude 子进程）
#[tauri::command]
async fn mcp_connect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<McpConnectionInfo, String> {
    app.emit("mcp-status", "connecting").ok();

    match state.mcp_client.connect().await {
        Ok(info) => {
            app.emit("mcp-status", "connected").ok();
            Ok(info)
        }
        Err(e) => {
            app.emit("mcp-status", "error").ok();
            Err(e.to_string())
        }
    }
}

// 断开 MCP（停止 Claude 子进程）
#[tauri::command]
async fn mcp_disconnect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.mcp_client.disconnect().await;
    app.emit("mcp-status", "disconnected").ok();
    Ok(())
}

// 执行 Claude 命令
#[tauri::command]
async fn execute_claude(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    command: String,
) -> Result<TaskResult, String> {
    app.emit("claude-status", "executing").ok();

    // 检查 MCP 是否已连接
    let connection_info = state.mcp_client.connection_info().await;
    let is_connected = connection_info.status == ConnectionStatus::Connected;

    // 获取 MCP 是否启用
    let mcp_enabled = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.mcp.enabled
    };

    // 如果 MCP 启用但未连接，尝试自动连接
    if mcp_enabled && !is_connected {
        app.emit("mcp-status", "connecting").ok();
        match state.mcp_client.connect().await {
            Ok(_) => {
                app.emit("mcp-status", "connected").ok();
            }
            Err(e) => {
                app.emit("mcp-status", "error").ok();
                let result = TaskResult {
                    success: false,
                    output: format!("MCP 连接失败: {}", e),
                    timestamp: chrono::Utc::now().timestamp(),
                };
                app.emit("claude-status", "completed").ok();
                return Ok(result);
            }
        }
    }

    // 通过 MCP 发送消息
    match state.mcp_client.send_message(&command).await {
        Ok(response) => {
            let result = TaskResult {
                success: true,
                output: response,
                timestamp: chrono::Utc::now().timestamp(),
            };
            app.emit("claude-status", "completed").ok();
            app.emit("claude-result", &result).ok();
            Ok(result)
        }
        Err(e) => {
            let result = TaskResult {
                success: false,
                output: format!("执行失败: {}", e),
                timestamp: chrono::Utc::now().timestamp(),
            };
            app.emit("claude-status", "completed").ok();
            app.emit("claude-result", &result).ok();
            Ok(result)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            is_polling_running,
            start_polling,
            stop_polling,
            is_message_processed,
            mark_message_processed,
            execute_claude,
            mcp_status,
            mcp_connect,
            mcp_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
