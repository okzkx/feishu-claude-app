use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
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
    #[serde(default)]
    pub is_autostart: bool,
    #[serde(default)]
    pub enable_window_effects: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            feishu_app_id: String::new(),
            feishu_app_secret: String::new(),
            feishu_chat_id: String::new(),
            feishu_user_id: None,
            cmd_prefix: "claude:".to_string(),
            poll_interval: 2,
            mcp: McpConfig::default(),
            is_autostart: false,
            enable_window_effects: true,
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

// 清除 Claude 记忆
// 简化方案：设置标志，下次执行时不使用 --continue，开启全新会话
#[tauri::command]
fn clear_claude_memory(
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    state.mcp_client.clear_memory();
    Ok("已设置清除记忆标志，下次对话将开启全新会话".to_string())
}

// 设置工作目录
#[tauri::command]
async fn set_working_dir(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<String, String> {
    // 验证路径是否存在
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("目录不存在: {}", path));
    }
    if !path_buf.is_dir() {
        return Err(format!("路径不是目录: {}", path));
    }

    state.mcp_client.set_working_dir(path.clone()).await;
    Ok(format!("工作目录已切换到: {}", path))
}

// 飞书 Token 响应结构
#[derive(Debug, Deserialize)]
struct FeishuTokenResponse {
    code: i32,
    tenant_access_token: Option<String>,
}

// 获取飞书 tenant_access_token（辅助函数，避免 async 中的锁问题）
async fn get_tenant_access_token_helper(app_id: &str, app_secret: &str) -> Result<String, String> {
    let url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
    let body = serde_json::json!({
        "app_id": app_id,
        "app_secret": app_secret
    });

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求飞书 API 失败: {}", e))?;

    let token_response: FeishuTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    if token_response.code != 0 {
        return Err(format!("获取 token 失败: code={}", token_response.code));
    }

    token_response
        .tenant_access_token
        .ok_or_else(|| "token 字段缺失".to_string())
}

// 获取飞书图片
#[tauri::command]
async fn get_feishu_image(
    state: tauri::State<'_, AppState>,
    image_key: String,
) -> Result<std::collections::HashMap<String, serde_json::Value>, String> {
    // 提取需要的数据，避免在 async 中持有锁
    let (app_id, app_secret) = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        (config.feishu_app_id.clone(), config.feishu_app_secret.clone())
    };

    let token = get_tenant_access_token_helper(&app_id, &app_secret).await?;

    let url = format!(
        "https://open.feishu.cn/open-apis/im/v1/images/{}/read",
        image_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("请求图片失败: {}", e))?;

    if !response.status().is_success() {
        let status_code = response.status().as_u16();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "图片请求失败: HTTP {} - {}",
            status_code,
            error_text
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取图片失败: {}", e))?;

    // 返回成功响应
    let mut result = std::collections::HashMap::new();
    result.insert("success".to_string(), serde_json::json!(true));
    result.insert("data".to_string(), serde_json::json!(bytes.to_vec()));

    Ok(result)
}

// 执行 Claude 命令
#[tauri::command]
async fn execute_claude(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    command: String,
    chat_id: Option<String>,
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

    // 通过 MCP 发送消息（将 chat_id 作为 session_key）
    match state.mcp_client.send_message(&command, chat_id.as_deref()).await {
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

// 退出应用
#[tauri::command]
fn exit_app(app_handle: AppHandle) {
    app_handle.exit(0);
}

// 显示主窗口
#[tauri::command]
fn show_main_window(app_handle: AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.unminimize().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 当第二个实例启动时，聚焦已有窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
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
            clear_claude_memory,
            set_working_dir,
            get_feishu_image,
            exit_app,
            show_main_window,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // 根据启动参数控制窗口显示
            let args: Vec<String> = std::env::args().collect();
            if !args.contains(&"--minimized".to_string()) {
                let _ = window.show();
                let _ = window.set_focus();
            }

            // Windows 平台应用毛玻璃效果
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::{apply_blur, apply_mica};
                if let Err(_) = apply_mica(&window, None) {
                    let _ = apply_blur(&window, Some((0, 0, 0, 0)));
                }
            }

            // 创建托盘菜单
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{TrayIconBuilder, TrayIconEvent};

            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let start_polling_i = MenuItem::with_id(app, "start_polling", "启动轮询", true, None::<&str>)?;
            let stop_polling_i = MenuItem::with_id(app, "stop_polling", "停止轮询", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&start_polling_i, &stop_polling_i, &show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("飞书 Claude 消息轮询")
                .menu(&menu)
                .on_menu_event(|app: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "start_polling" => {
                            let state = app.state::<AppState>();
                            state.is_running.store(true, Ordering::SeqCst);
                            let _ = app.emit("polling-status", "started");
                            let _ = app.emit("tray-start-polling", ());
                        }
                        "stop_polling" => {
                            let state = app.state::<AppState>();
                            state.is_running.store(false, Ordering::SeqCst);
                            let _ = app.emit("polling-status", "stopped");
                            let _ = app.emit("tray-stop-polling", ());
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // 左键单击显示窗口
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let win = tray.app_handle().get_webview_window("main").unwrap();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 关闭到托盘行为
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
