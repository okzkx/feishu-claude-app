use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::time::{interval, Duration};

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
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            is_running: AtomicBool::new(false),
            processed_ids: Mutex::new(HashSet::new()),
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
fn save_config(state: tauri::State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config;
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

    while state.is_running.load(Ordering::SeqCst) {
        ticker.tick().await;

        // 发送轮询事件，前端负责实际调用飞书 API
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

    // 清理缓存，避免内存过大
    if ids.len() > 100 {
        let to_remove: Vec<String> = ids.iter().take(50).cloned().collect();
        for id in to_remove {
            ids.remove(&id);
        }
    }
}

// 执行 Claude 命令
#[tauri::command]
async fn execute_claude(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    command: String,
) -> Result<TaskResult, String> {
    let project_dir = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.claude_project_dir.clone()
    };

    app.emit("claude-status", "executing").ok();

    // 使用 tauri-plugin-shell 执行 Claude CLI
    #[cfg(target_os = "windows")]
    let output = std::process::Command::new("claude")
        .args(["--dangerously-skip-permissions", &command])
        .current_dir(&project_dir)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = std::process::Command::new("claude")
        .args(["--dangerously-skip-permissions", &command])
        .current_dir(&project_dir)
        .output();

    let result = match output {
        Ok(o) => {
            if o.status.success() {
                let stdout = String::from_utf8_lossy(&o.stdout).to_string();
                let truncated = if stdout.len() > 2000 {
                    format!("{}...\n\n（内容过长，已截断）", &stdout[..2000])
                } else {
                    stdout
                };
                TaskResult {
                    success: true,
                    output: truncated,
                    timestamp: chrono::Utc::now().timestamp(),
                }
            } else {
                let stderr = String::from_utf8_lossy(&o.stderr).to_string();
                TaskResult {
                    success: false,
                    output: stderr,
                    timestamp: chrono::Utc::now().timestamp(),
                }
            }
        }
        Err(e) => TaskResult {
            success: false,
            output: format!("执行失败: {}", e),
            timestamp: chrono::Utc::now().timestamp(),
        },
    };

    app.emit("claude-status", "completed").ok();
    app.emit("claude-result", &result).ok();

    Ok(result)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
