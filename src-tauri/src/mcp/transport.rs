use super::types::McpError;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use uuid::Uuid;
use sha2::{Sha256, Digest};

/// 基于 chat_id 生成确定性的 UUID（SHA-256 哈希）
/// 这样即使应用重启，也能根据 chat_id 计算出相同的 session_id
fn session_id_from_chat_id(chat_id: &str) -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(chat_id.as_bytes());
    let hash = hasher.finalize();
    // 使用哈希的前 16 字节创建 UUID (v5 风格)
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}

/// 生成固定的全局会话 UUID（用于永久记忆）
/// 基于 "feishu-claude-app-global-session" 字符串的 SHA-256 哈希
fn get_global_session_id() -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(b"feishu-claude-app-global-session");
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}

/// 获取 Claude 会话文件路径
/// 会话文件存储在 ~/.claude/projects/<escaped-cwd>/<session-id>.jsonl
fn get_session_file_path(session_id: &Uuid, working_dir: &PathBuf) -> PathBuf {
    // 获取用户主目录
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    // 转义工作目录路径（Claude 使用特定格式）
    let escaped_cwd = working_dir
        .to_string_lossy()
        .replace(':', "-")
        .replace('\\', "-")
        .replace('/', "-");

    // 构建会话文件路径
    home.join(".claude")
        .join("projects")
        .join(escaped_cwd)
        .join(format!("{}.jsonl", session_id))
}

/// 检查会话文件是否存在于磁盘上
fn session_exists_on_disk(session_id: &Uuid, working_dir: &PathBuf) -> bool {
    let session_file = get_session_file_path(session_id, working_dir);
    let exists = session_file.exists();
    println!("[MCP DEBUG] Checking session file: {:?}, exists: {}", session_file, exists);
    exists
}

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
    /// 始终使用全局会话 ID，保持永久记忆
    pub async fn execute(&mut self, command: &str, _session_key: Option<&str>) -> Result<String, McpError> {
        println!("[MCP DEBUG] Executing command: {}", command);

        // 始终使用全局会话 ID（永久记忆模式）
        let session_id = get_global_session_id();

        // 检查磁盘上是否存在会话文件
        let exists_on_disk = session_exists_on_disk(&session_id, &self.working_dir);
        let is_new_session = !exists_on_disk;

        if is_new_session {
            println!("[MCP DEBUG] Creating NEW global session, id: {}", session_id);
        } else {
            println!("[MCP DEBUG] RESUMING global session, id: {}", session_id);
        }

        // 构建命令参数
        // 始终使用会话 ID，新会话用 --session-id，已存在用 --resume
        let session_id_str = session_id.to_string();
        let args: Vec<&str> = if is_new_session {
            vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", "--session-id", &session_id_str, command]
        } else {
            vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", "--resume", &session_id_str, command]
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
            if is_new_session {
                cmd.arg("--session-id").arg(session_id.to_string());
            } else {
                cmd.arg("--resume").arg(session_id.to_string());
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

    /// 清除全局会话文件（删除记忆）
    pub fn clear_global_session(&self) -> Result<(), McpError> {
        let session_id = get_global_session_id();
        let session_file = get_session_file_path(&session_id, &self.working_dir);

        if session_file.exists() {
            std::fs::remove_file(&session_file)
                .map_err(|e| McpError::RequestFailed(format!("Failed to delete session file: {}", e)))?;
            println!("[MCP DEBUG] Deleted global session file: {:?}", session_file);
            Ok(())
        } else {
            println!("[MCP DEBUG] No global session file to delete");
            Ok(())
        }
    }
}
