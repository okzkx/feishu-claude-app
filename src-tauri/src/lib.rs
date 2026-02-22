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
pub struct AppConfig {
    pub feishu_app_id: String,
    pub feishu_app_secret: String,
    pub feishu_chat_id: String,
    pub feishu_user_id: Option<String>,
    pub claude_project_dir: String,
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
            claude_project_dir: ".".to_string(),
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
    pub mcp_last_notified: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            is_running: AtomicBool::new(false),
            processed_ids: Mutex::new(HashSet::new()),
            mcp_client: Arc::new(McpClientManager::default()),
            mcp_last_notified: Arc::new(AtomicBool::new(false)),
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
    // 先保存配置，确保锁在 await 之前释放
    let mcp_config = config.mcp.clone();
    {
        let mut current = state.config.lock().map_err(|e| e.to_string())?;
        *current = config;
    } // 作用域结束，锁自动释放

    // 更新 MCP 客户端配置
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

    // 发送启动事件
    app.emit("polling-status", "started").ok();

    let poll_interval = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.poll_interval
    };

    let mut ticker = interval(Duration::from_secs(poll_interval));
    let mut status_check_ticker = interval(Duration::from_secs(10)); // 每10秒检查一次MCP状态

    // MCP 断开通知防抖（避免重复通知）
    let mcp_client = state.mcp_client.clone();
    let mcp_last_notified = state.mcp_last_notified.clone();

    while state.is_running.load(Ordering::SeqCst) {
        tokio::select! {
            _ = ticker.tick() => {
                // 发送轮询事件，前端负责实际调用飞书 API
                app.emit("poll-tick", ()).ok();
            }
            _ = status_check_ticker.tick() => {
                // 定期检查 MCP 连接状态
                let current_status = mcp_client.connection_info().await.status;
                let is_connected = current_status == ConnectionStatus::Connected;
                let is_error = current_status == ConnectionStatus::Error;
                let is_disconnected = current_status == ConnectionStatus::Disconnected;

                // 检查 MCP 是否启用
                let mcp_enabled = {
                    let config = state.config.lock().map_err(|e| e.to_string())?;
                    config.mcp.enabled
                };

                if mcp_enabled {
                    if !is_connected && !mcp_last_notified.load(Ordering::SeqCst) {
                        // MCP 断开，发送通知
                        mcp_last_notified.store(true, Ordering::SeqCst);
                        app.emit("mcp-status", "disconnected").ok();
                    }

                    // 检查是否需要自动重连（只在错误或断开状态下尝试）
                    if (is_error || is_disconnected) && mcp_enabled {
                        // 尝试重连
                        match mcp_client.connect().await {
                            Ok(_) => {
                                mcp_last_notified.store(false, Ordering::SeqCst);
                                app.emit("mcp-status", "connected").ok();
                                app.emit("mcp-reconnected", ()).ok();
                            }
                            Err(_) => {
                                // 重连失败，保持当前状态
                            }
                        }
                    }
                }
            }
        }
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

    // 清理缓存，避免内存过大
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

// 连接到 MCP 服务器
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

// 断开 MCP 连接
#[tauri::command]
async fn mcp_disconnect(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    state.mcp_client.disconnect().await;
    app.emit("mcp-status", "disconnected").ok();
    Ok(())
}

// 对话消息（用于多轮对话上下文）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// 执行 Claude 命令
#[tauri::command]
async fn execute_claude(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    command: String,
    context: Option<Vec<ChatMessage>>,
) -> Result<TaskResult, String> {
    app.emit("claude-status", "executing").ok();

    // 首先尝试使用 MCP 客户端
    let connection_info = state.mcp_client.connection_info().await;
    let is_connected = connection_info.status == mcp::ConnectionStatus::Connected;

    if is_connected {
        // 构建带上下文的请求
        let request_content = if let Some(ctx) = context {
            // 如果有上下文，构建包含历史的请求
            let mut history = String::new();
            for msg in ctx {
                history.push_str(&format!("{}: {}\n", msg.role, msg.content));
            }
            history.push_str(&format!("user: {}", command));
            history
        } else {
            // 没有上下文，直接使用命令
            command
        };

        match state.mcp_client.send_message(&request_content).await {
            Ok(response) => {
                let result = TaskResult {
                    success: true,
                    output: response,
                    timestamp: chrono::Utc::now().timestamp(),
                };
                app.emit("claude-status", "completed").ok();
                app.emit("claude-result", &result).ok();
                return Ok(result);
            }
            Err(e) => {
                // MCP 调用失败，记录但继续尝试 CLI
                eprintln!("MCP call failed: {}, falling back to CLI", e);
            }
        }
    }

    // MCP 不可用，返回服务不可用
    let result = TaskResult {
        success: false,
        output: "服务不可用：MCP 连接未建立或已断开".to_string(),
        timestamp: chrono::Utc::now().timestamp(),
    };

    app.emit("claude-status", "completed").ok();
    app.emit("claude-result", &result).ok();

    Ok(result)
}

// 调用工具（完整工具调用能力）
#[tauri::command]
async fn call_tool(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<TaskResult, String> {
    app.emit("tool-status", "calling").ok();

    let connection_info = state.mcp_client.connection_info().await;
    let is_connected = connection_info.status == mcp::ConnectionStatus::Connected;

    if !is_connected {
        let result = TaskResult {
            success: false,
            output: "MCP 未连接，无法调用工具".to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        };
        app.emit("tool-status", "failed").ok();
        app.emit("tool-result", &result).ok();
        return Ok(result);
    }

    match state.mcp_client.call_tool(&tool_name, arguments).await {
        Ok(result) => {
            let task_result = TaskResult {
                success: true,
                output: serde_json::to_string_pretty(&result).unwrap_or_else(|_| "Invalid result".to_string()),
                timestamp: chrono::Utc::now().timestamp(),
            };
            app.emit("tool-status", "completed").ok();
            app.emit("tool-result", &task_result).ok();
            Ok(task_result)
        }
        Err(e) => {
            let result = TaskResult {
                success: false,
                output: format!("工具调用失败: {}", e),
                timestamp: chrono::Utc::now().timestamp(),
            };
            app.emit("tool-status", "failed").ok();
            app.emit("tool-result", &result).ok();
            Ok(result)
        }
    }
}

// 列出可用工具
#[tauri::command]
async fn list_tools(
    _app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<mcp::Tool>, String> {
    let connection_info = state.mcp_client.connection_info().await;
    let is_connected = connection_info.status == mcp::ConnectionStatus::Connected;

    if !is_connected {
        return Err("MCP 未连接".to_string());
    }

    state.mcp_client.list_tools().await.map_err(|e| e.to_string())
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
            call_tool,
            list_tools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
