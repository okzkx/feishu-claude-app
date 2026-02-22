# 飞书 Claude 应用 - 后端技术难点

本文档记录飞书消息轮询应用后端（Rust + Tauri）开发中的技术难点和解决方案。

## 难点 1: Tauri 命令定义

### 问题描述
需要在 Rust 中定义可被前端调用的命令。

### 解决方案
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub feishu_app_id: String,
    pub feishu_app_secret: String,
    // ...
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

// 注册命令
.invoke_handler(tauri::generate_handler![
    get_config,
    save_config,
    start_polling,
    // ...
])
```

## 难点 2: 异步轮询

### 问题描述
轮询需要在后台持续运行，不阻塞 UI。

### 解决方案
```rust
use tokio::time::{interval, Duration};

#[tauri::command]
async fn start_polling(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    if state.is_running.load(Ordering::SeqCst) {
        return Err("轮询已在运行中".to_string());
    }

    state.is_running.store(true, Ordering::SeqCst);

    let poll_interval = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.poll_interval
    };

    let mut ticker = interval(Duration::from_secs(poll_interval));

    while state.is_running.load(Ordering::SeqCst) {
        ticker.tick().await;
        app.emit("poll-tick", ()).ok();
    }

    Ok(())
}
```

## 难点 3: 全局状态管理

### 问题描述
需要在多个命令间共享状态。

### 解决方案
```rust
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

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

// 注册状态
.manage(AppState::default())
```

## 难点 4: Claude CLI 调用

### 问题描述
需要从 Rust 调用外部 Claude CLI 程序。

### 解决方案
```rust
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

    let output = std::process::Command::new("claude")
        .args(["--dangerously-skip-permissions", &command])
        .current_dir(&project_dir)
        .output()
        .map_err(|e| format!("执行失败: {}", e))?;

    // 处理结果...
}
```

### Windows 特殊处理
```rust
#[cfg(target_os = "windows")]
let output = std::process::Command::new("claude")
    .args(["--dangerously-skip-permissions", &command])
    .current_dir(&project_dir)
    .creationflags(0x08000000) // CREATE_NO_WINDOW
    .output();
```

## 难点 5: 消息去重

### 问题描述
避免重复处理同一条消息。

### 解决方案
```rust
#[tauri::command]
fn is_message_processed(state: tauri::State<AppState>, message_id: String) -> bool {
    let ids = state.processed_ids.lock().unwrap();
    ids.contains(&message_id)
}

#[tauri::command]
fn mark_message_processed(state: tauri::State<AppState>, message_id: String) {
    let mut ids = state.processed_ids.lock().unwrap();
    ids.insert(message_id);

    // 清理缓存
    if ids.len() > 100 {
        let to_remove: Vec<String> = ids.iter().take(50).cloned().collect();
        for id in to_remove {
            ids.remove(&id);
        }
    }
}
```

## 难点 6: 事件推送

### 问题描述
后端需要主动通知前端状态变化。

### 解决方案
```rust
use tauri::Emitter;

// 推送轮询状态
app.emit("polling-status", "started").ok();
app.emit("polling-status", "stopped").ok();

// 推送 Claude 状态
app.emit("claude-status", "executing").ok();
app.emit("claude-status", "completed").ok();

// 推送执行结果
app.emit("claude-result", &result).ok();
```

### 前端监听
```typescript
import { listen } from "@tauri-apps/api/event";

listen<string>("polling-status", (event) => {
  console.log("状态:", event.payload);
});
```

## 难点 7: HTTP 插件配置

### 问题描述
需要在 Tauri 中配置 HTTP 插件权限。

### Cargo.toml
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-http = "2"
```

### lib.rs
```rust
.plugin(tauri_plugin_http::init())
```

### capabilities
```json
{
  "permissions": [
    { "identifier": "http:default", "allow": [{ "url": "https://open.feishu.cn/**" }] }
  ]
}
```

## 难点 8: Shell 插件配置

### 问题描述
需要执行 Claude CLI 命令。

### Cargo.toml
```toml
tauri-plugin-shell = "2"
```

### capabilities
```json
{
  "permissions": [
    "shell:allow-open",
    "shell:allow-execute"
  ]
}
```

## 难点 9: 错误处理

### 问题描述
需要将 Rust 错误传递给前端。

### 解决方案
```rust
#[tauri::command]
fn some_command() -> Result<SuccessType, String> {
    // 返回 Ok 成功
    // 返回 Err 错误信息

    some_operation()
        .map_err(|e| format!("操作失败: {}", e))?;

    Ok(result)
}

// 前端处理
try {
  const result = await invoke('some_command');
} catch (error) {
  console.error("错误:", error); // 接收 Rust 的 Err 字符串
}
```

## 难点 10: 并发安全

### 问题描述
多线程访问共享状态需要保证安全。

### 解决方案
```rust
// 使用 Mutex 保护数据
pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub processed_ids: Mutex<HashSet<String>>,
}

// 使用 AtomicBool 保护标志
pub struct AppState {
    pub is_running: AtomicBool,
}

// 读取
let config = state.config.lock().map_err(|e| e.to_string())?;

// 写入
let mut config = state.config.lock().map_err(|e| e.to_string())?;
*config = new_config;
```
