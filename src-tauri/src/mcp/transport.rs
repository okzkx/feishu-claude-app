use super::types::McpError;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};

/// 清除记忆标志：下次执行时不使用 --continue，开启全新会话
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

/// 设置清除记忆标志（下次执行时不使用 --continue）
pub fn set_clear_memory_flag() {
    SHOULD_CLEAR_MEMORY.store(true, Ordering::SeqCst);
    println!("[MCP DEBUG] Clear memory flag set - next execution will start fresh session");
}

/// STDIO 传输层（每次调用模式，使用 --continue 自动恢复会话）
pub struct StdioTransport {
    _process: Option<Child>,
    working_dir: PathBuf,
}

impl StdioTransport {
    /// 创建新的传输层
    pub fn new(working_dir: String) -> Self {
        Self {
            _process: None,
            working_dir: PathBuf::from(working_dir),
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
    /// 简化方案：不使用任何 session 参数，让 Claude CLI 自动管理会话
    /// 这样可以避免 "Session ID already in use" 等错误
    /// 使用 --continue 参数让 Claude 自动继续上次会话（如果存在）
    /// 如果设置了清除记忆标志，则不使用 --continue，开启全新会话
    pub async fn execute(&mut self, command: &str, _session_key: Option<&str>) -> Result<String, McpError> {
        println!("[MCP DEBUG] Executing command: {}", command);
        println!("[MCP DEBUG] Working directory: {:?}", self.working_dir);

        // 检查是否需要清除记忆（开启新会话）
        let should_clear = SHOULD_CLEAR_MEMORY.swap(false, Ordering::SeqCst);

        let args: Vec<&str> = if should_clear {
            // 不使用 --continue，开启全新会话
            println!("[MCP DEBUG] Starting FRESH session (clear memory mode)");
            vec![
                "/C", "claude", "-p",
                "--output-format", "text",
                "--dangerously-skip-permissions",
                command
            ]
        } else {
            // 使用 --continue 参数恢复上次会话（如果存在）
            println!("[MCP DEBUG] Using --continue mode (auto-resume last session)");
            vec![
                "/C", "claude", "-p",
                "--output-format", "text",
                "--dangerously-skip-permissions",
                "--continue",
                command
            ]
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
            if should_clear {
                cmd.args(["-p", "--output-format", "text", "--dangerously-skip-permissions"])
                    .arg(command);
            } else {
                cmd.args(["-p", "--output-format", "text", "--dangerously-skip-permissions", "--continue"])
                    .arg(command);
            }
            cmd.current_dir(&self.working_dir)
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

    /// 设置清除记忆标志
    /// 下次执行时不使用 --continue，开启全新会话
    pub fn set_clear_memory() {
        set_clear_memory_flag();
    }
}
