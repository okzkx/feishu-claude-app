use super::types::McpError;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use uuid::Uuid;

/// STDIO 传输层（每次调用模式，支持会话）
pub struct StdioTransport {
    _process: Option<Child>,
    working_dir: PathBuf,
    /// 会话存储：session_key -> session_id
    session_store: HashMap<String, Uuid>,
}

impl StdioTransport {
    /// 创建新的传输层
    pub fn new(working_dir: String) -> Self {
        Self {
            _process: None,
            working_dir: PathBuf::from(working_dir),
            session_store: HashMap::new(),
        }
    }

    /// 测试 claude 命令是否可用
    pub async fn test_connection(&mut self) -> Result<(), McpError> {
        println!("[MCP DEBUG] Testing connection with 'claude --version'");

        // 在 Windows 上使用 cmd.exe 来执行 claude（npm 安装的命令需要 .cmd 扩展名）
        // 清除 CLAUDECODE 环境变量以避免嵌套会话检测
        #[cfg(target_os = "windows")]
        let mut child = Command::new("cmd")
            .args(["/C", "claude", "--version"])
            .current_dir(&self.working_dir)
            .env("CLAUDECODE", "")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                println!("[MCP DEBUG] Failed to spawn claude: {}", e);
                McpError::ConnectionFailed(format!("Failed to spawn claude: {}", e))
            })?;

        #[cfg(not(target_os = "windows"))]
        let mut child = Command::new("claude")
            .arg("--version")
            .current_dir(&self.working_dir)
            .env("CLAUDECODE", "")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                println!("[MCP DEBUG] Failed to spawn claude: {}", e);
                McpError::ConnectionFailed(format!("Failed to spawn claude: {}", e))
            })?;

        println!("[MCP DEBUG] Process spawned, waiting for result...");

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // 读取输出
        let mut stdout_content = String::new();
        let mut stderr_content = String::new();

        if let Some(stdout) = stdout {
            let mut reader = BufReader::new(stdout);
            let _ = reader.read_to_string(&mut stdout_content).await;
        }

        if let Some(stderr) = stderr {
            let mut reader = BufReader::new(stderr);
            let _ = reader.read_to_string(&mut stderr_content).await;
        }

        println!("[MCP DEBUG] stdout: {}", stdout_content.trim());
        println!("[MCP DEBUG] stderr: {}", stderr_content.trim());

        let status = child
            .wait()
            .await
            .map_err(|e| {
                println!("[MCP DEBUG] Wait error: {}", e);
                McpError::ConnectionFailed(format!("Wait error: {}", e))
            })?;

        println!("[MCP DEBUG] Exit status: {}", status);

        if status.success() {
            println!("[MCP DEBUG] Connection test successful");
            Ok(())
        } else {
            println!("[MCP DEBUG] Connection test failed");
            Err(McpError::ConnectionFailed(format!(
                "claude --version failed with status: {}",
                status
            )))
        }
    }

    /// 执行单次命令
    /// session_key: 可选的会话键，用于保持会话连续性
    pub async fn execute(&mut self, command: &str, session_key: Option<&str>) -> Result<String, McpError> {
        println!("[MCP DEBUG] Executing command: {}", command);

        // 获取或创建 session_id，并判断是否为新会话
        let (session_id, is_new_session) = match session_key {
            Some(key) => {
                if let Some(existing_id) = self.session_store.get(key) {
                    // 已存在的会话，使用 --resume 恢复
                    println!("[MCP DEBUG] Resuming session key: {}, id: {}", key, existing_id);
                    (*existing_id, false)
                } else {
                    // 新会话，使用 --session-id 创建
                    let new_id = Uuid::new_v4();
                    self.session_store.insert(key.to_string(), new_id);
                    println!("[MCP DEBUG] Creating new session key: {}, id: {}", key, new_id);
                    (new_id, true)
                }
            }
            None => (Uuid::nil(), false),
        };

        // 构建命令参数
        // 新会话使用 --session-id，已存在的会话使用 --resume
        let session_id_str;
        let args: Vec<&str> = if session_key.is_some() {
            session_id_str = session_id.to_string();
            if is_new_session {
                vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", "--session-id", &session_id_str, command]
            } else {
                vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", "--resume", &session_id_str, command]
            }
        } else {
            vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", command]
        };

        // 在 Windows 上使用 cmd.exe 来执行 claude
        // 清除 CLAUDECODE 环境变量以避免嵌套会话检测
        #[cfg(target_os = "windows")]
        let mut child = Command::new("cmd")
            .args(&args)
            .current_dir(&self.working_dir)
            .env("CLAUDECODE", "")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                println!("[MCP DEBUG] Failed to spawn claude: {}", e);
                McpError::RequestFailed(format!("Failed to spawn claude: {}", e))
            })?;

        // 非Windows平台的命令构建
        #[cfg(not(target_os = "windows"))]
        let mut child = {
            let mut cmd = Command::new("claude");
            cmd.args(["-p", "--output-format", "text", "--dangerously-skip-permissions"]);
            if session_key.is_some() {
                if is_new_session {
                    cmd.arg("--session-id").arg(session_id.to_string());
                } else {
                    cmd.arg("--resume").arg(session_id.to_string());
                }
            }
            cmd.arg(command)
                .current_dir(&self.working_dir)
                .env("CLAUDECODE", "")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| {
                    println!("[MCP DEBUG] Failed to spawn claude: {}", e);
                    McpError::RequestFailed(format!("Failed to spawn claude: {}", e))
                })?
        };

        println!("[MCP DEBUG] Process spawned for command execution");

        let stdout = child.stdout.take().ok_or_else(|| {
            println!("[MCP DEBUG] Failed to get stdout");
            McpError::RequestFailed("Failed to get stdout".to_string())
        })?;
        let stderr = child.stderr.take().ok_or_else(|| {
            println!("[MCP DEBUG] Failed to get stderr");
            McpError::RequestFailed("Failed to get stderr".to_string())
        })?;

        let mut stdout_reader = BufReader::new(stdout).lines();
        let mut stderr_reader = BufReader::new(stderr);
        let mut stderr_content = String::new();

        // 读取 stderr
        let _ = stderr_reader.read_to_string(&mut stderr_content).await;
        if !stderr_content.is_empty() {
            println!("[MCP DEBUG] stderr: {}", stderr_content.trim());
        }

        // 读取 stdout
        let mut output_lines = Vec::new();
        while let Some(line) = stdout_reader.next_line().await.map_err(|e| {
            println!("[MCP DEBUG] Read error: {}", e);
            McpError::RequestFailed(format!("Read error: {}", e))
        })? {
            output_lines.push(line);
        }

        // 等待进程结束
        let status = child.wait().await.map_err(|e| {
            println!("[MCP DEBUG] Wait error: {}", e);
            McpError::RequestFailed(format!("Wait error: {}", e))
        })?;

        println!("[MCP DEBUG] Command execution exit status: {}", status);

        if !status.success() {
            let error_msg = if stderr_content.is_empty() {
                format!("Command failed with status: {}", status)
            } else {
                stderr_content.trim().to_string()
            };
            println!("[MCP DEBUG] Command failed: {}", error_msg);
            return Err(McpError::RequestFailed(error_msg));
        }

        let result = output_lines.join("\n");
        println!("[MCP DEBUG] Command result length: {} bytes", result.len());
        Ok(result)
    }

    /// 停止（无操作，因为没有持久进程）
    pub async fn stop(&mut self) {
        println!("[MCP DEBUG] Stop called (no-op for per-call mode)");
    }

    /// 清除指定会话
    pub fn clear_session(&mut self, session_key: &str) {
        if let Some(id) = self.session_store.remove(session_key) {
            println!("[MCP DEBUG] Cleared session: key={}, id={}", session_key, id);
        }
    }

    /// 清除所有会话
    pub fn clear_all_sessions(&mut self) {
        let count = self.session_store.len();
        self.session_store.clear();
        println!("[MCP DEBUG] Cleared all {} sessions", count);
    }
}
