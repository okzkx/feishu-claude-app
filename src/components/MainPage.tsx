import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Button,
  List,
  Tag,
  Space,
  Badge,
  Input,
  message,
  Divider,
  Typography,
  Spin,
  Alert,
  Tooltip,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  SendOutlined,
  ReloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ApiOutlined,
  DisconnectOutlined,
  CloudOutlined,
} from "@ant-design/icons";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { AppConfig, Message, TaskResult } from "../types";
import { feishuApi } from "../utils/feishuApi";

const { Text, Paragraph } = Typography;

interface MainPageProps {
  config: AppConfig;
  onSettings: () => void;
}

const MainPage: React.FC<MainPageProps> = ({ config, onSettings }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testCommand, setTestCommand] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; output: string } | null>(null);
  const [mcpStatus, setMcpStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [mcpNotified, setMcpNotified] = useState(false); // 是否已通知用户 MCP 断开

  // 定义 pollMessages 在 useEffect 之前，避免变量提升问题
  const pollMessages = useCallback(async (isAutoRefresh: boolean = false) => {
    if (!isAutoRefresh) {
      setRefreshing(true);
    }

    try {
      const msgs = await feishuApi.getMessages();

      // 显示最近10条文本消息
      setRecentMessages(msgs.filter(m => m.msgType === 'text').slice(0, 10));

      for (const msg of msgs) {
        // 检查是否已处理
        const processed = await invoke<boolean>("is_message_processed", {
          messageId: msg.messageId,
        });

        if (processed) continue;

        // 过滤：只处理文本消息
        if (msg.msgType !== "text") continue;

        // 过滤：只处理我的消息
        if (!feishuApi.isMyMessage(msg.senderId)) continue;

        // 检查命令前缀
        const prefix = feishuApi.getCmdPrefix();
        if (!msg.content?.startsWith(prefix)) continue;

        // 提取命令
        const command = msg.content.slice(prefix.length).trim();
        if (!command) continue;

        // 标记已处理
        await invoke("mark_message_processed", { messageId: msg.messageId });

        // 更新消息列表
        setMessages((prev) => [
          { ...msg, status: "processing", content: command },
          ...prev,
        ]);

        // 发送确认
        await feishuApi.sendMessage(`收到指令：\n${command}\n正在执行...`);

        // 执行 Claude
        const result = await invoke<TaskResult>("execute_claude", { command });

        // 推送结果
        if (result.success) {
          await feishuApi.sendMessage(`执行完成：\n${result.output}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === msg.messageId ? { ...m, status: "completed" } : m
            )
          );
        } else {
          await feishuApi.sendMessage(`执行失败：\n${result.output}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === msg.messageId ? { ...m, status: "failed" } : m
            )
          );
        }
      }
    } catch (error) {
      console.error("轮询失败:", error);
      if (!isAutoRefresh) {
        message.error(`刷新失败: ${error}`);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // 初始化时同步后端轮询状态
    invoke<boolean>("is_polling_running").then(setIsRunning).catch(console.error);

    // 初始化时获取 MCP 状态
    if (config.mcp?.enabled) {
      invoke<any>("mcp_status")
        .then((info) => {
          if (info && info.status) {
            setMcpStatus(info.status);
          }
        })
        .catch(console.error);
    }

    // 存储所有取消监听函数
    const unlistenFns: Promise<() => void>[] = [];

    // 监听轮询事件
    unlistenFns.push(
      listen("poll-tick", async () => {
        await pollMessages(true);
      })
    );

    // 监听轮询状态
    unlistenFns.push(
      listen<string>("polling-status", (event) => {
        if (event.payload === "started") {
          setIsRunning(true);
        } else if (event.payload === "stopped") {
          setIsRunning(false);
        }
      })
    );

    // 监听 Claude 状态
    unlistenFns.push(
      listen<string>("claude-status", (event) => {
        if (event.payload === "executing") {
          message.loading({ content: "Claude 正在执行...", key: "claude", duration: 0 });
        } else if (event.payload === "completed") {
          message.destroy("claude");
        }
      })
    );

    // 监听 Claude 结果
    unlistenFns.push(
      listen<TaskResult>("claude-result", (event) => {
        if (event.payload.success) {
          message.success({ content: "执行成功", key: "claude-result" });
        } else {
          message.error({ content: "执行失败", key: "claude-result" });
        }
      })
    );

    // 监听 MCP 状态变化
    unlistenFns.push(
      listen<string>("mcp-status", async (event) => {
        const newStatus = event.payload as 'disconnected' | 'connecting' | 'connected' | 'error';
        setMcpStatus(newStatus);

        // 如果 MCP 断开且轮询正在运行，发送"服务不可用"消息到飞书
        if (newStatus === 'disconnected' || newStatus === 'error') {
          if (!mcpNotified && config.mcp?.enabled && isRunning) {
            setMcpNotified(true);
            await feishuApi.sendMessage("服务不可用：MCP 连接已断开，正在尝试重新连接...");
          }
        } else if (newStatus === 'connected') {
          setMcpNotified(false);
          // 发送重连成功通知
          if (isRunning) {
            await feishuApi.sendMessage("服务已恢复：MCP 连接已重新建立");
          }
        }
      })
    );

    // 监听 MCP 重连成功事件
    unlistenFns.push(
      listen("mcp-reconnected", () => {
        setMcpStatus('connected');
        setMcpNotified(false);
        if (isRunning) {
          feishuApi.sendMessage("服务已恢复：MCP 连接已重新建立").catch(console.error);
        }
      })
    );

    return () => {
      // 清理所有事件监听器
      unlistenFns.forEach((fn) => fn.then((f) => f()));
    };
  }, [pollMessages]);

  const handleStart = async () => {
    setLoading(true);
    try {
      // 先检查后端是否已经在轮询
      const isBackendRunning = await invoke<boolean>("is_polling_running");

      if (isBackendRunning) {
        setIsRunning(true);
        message.info("轮询已在运行中");
      } else {
        setIsRunning(true);
        message.success("轮询已启动");

        // 发送启动通知
        feishuApi.sendMessage(
          `Claude 机器人已启动！\n指令格式：${config?.cmdPrefix}你的指令`
        ).catch(console.error);

        // start_polling 是阻塞的，不等待它完成
        invoke("start_polling").catch((error) => {
          console.error("轮询错误:", error);
          if (!String(error).includes("已在运行")) {
            setIsRunning(false);
            message.error(`轮询异常: ${error}`);
          }
        });
      }
    } catch (error) {
      setIsRunning(false);
      message.error(`启动失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      setIsRunning(false);
      message.info("轮询已停止");

      await invoke("stop_polling");

      // 异步发送停止通知，不阻塞
      feishuApi.sendMessage("Claude 机器人已停止").catch(console.error);
    } catch (error) {
      message.error(`停止失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCommand = async () => {
    console.log("handleTestCommand called, testCommand:", testCommand);

    if (!testCommand.trim()) {
      message.warning("请输入测试指令");
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      console.log("Invoking execute_claude with command:", testCommand);
      const result = await invoke<TaskResult>("execute_claude", {
        command: testCommand,
      });
      console.log("execute_claude result:", result);

      setTestResult({
        success: result.success,
        output: result.output,
      });

      if (result.success) {
        message.success("执行成功");
      } else {
        message.error("执行失败");
      }
    } catch (error) {
      console.error("执行错误:", error);
      setTestResult({
        success: false,
        output: String(error),
      });
      message.error(`执行失败: ${error}`);
    } finally {
      setTestLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "default",
    processing: "processing",
    completed: "success",
    failed: "error",
  };

  const statusTexts: Record<string, string> = {
    pending: "待处理",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const PollingStatusIndicator = () => (
    <Space size="small">
      {isRunning ? (
        <>
          <Tag
            icon={<SyncOutlined spin />}
            color="processing"
            style={{ fontSize: 14, padding: '4px 12px' }}
          >
            轮询中
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            每 {config?.pollInterval || 5} 秒刷新
          </Text>
        </>
      ) : (
        <Tag
          icon={<StopOutlined />}
          color="default"
          style={{ fontSize: 14, padding: '4px 12px' }}
        >
          已停止
        </Tag>
      )}
    </Space>
  );

  const McpStatusIndicator = () => {
    if (!config.mcp?.enabled) {
      return (
        <Tooltip title="MCP 未启用">
          <Tag
            icon={<ApiOutlined />}
            color="default"
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            MCP: 未启用
          </Tag>
        </Tooltip>
      );
    }

    switch (mcpStatus) {
      case 'connected':
        return (
          <Tooltip title="MCP 已连接">
            <Tag
              icon={<CloudOutlined />}
              color="success"
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              MCP: 已连接
            </Tag>
          </Tooltip>
        );
      case 'connecting':
        return (
          <Tooltip title="MCP 连接中...">
            <Tag
              icon={<SyncOutlined spin />}
              color="processing"
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              MCP: 连接中
            </Tag>
          </Tooltip>
        );
      case 'error':
        return (
          <Tooltip title="MCP 连接错误">
            <Tag
              icon={<DisconnectOutlined />}
              color="error"
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              MCP: 错误
            </Tag>
          </Tooltip>
        );
      default:
        return (
          <Tooltip title="MCP 未连接">
            <Tag
              icon={<DisconnectOutlined />}
              color="default"
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              MCP: 未连接
            </Tag>
          </Tooltip>
        );
    }
  };

  return (
    <div className="main-page">
      <Card
        title={
          <Space>
            <Badge
              status={isRunning ? "processing" : "default"}
              text={
                <Space>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>飞书 Claude 消息轮询</span>
                  <PollingStatusIndicator />
                </Space>
              }
            />
          </Space>
        }
        extra={
          <Space>
            <McpStatusIndicator />
            <Button icon={<SettingOutlined />} onClick={onSettings}>
              设置
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {/* 控制区 */}
          <Space wrap>
            {!isRunning ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                loading={loading}
              >
                启动轮询
              </Button>
            ) : (
              <Button
                danger
                icon={<PauseCircleOutlined />}
                onClick={handleStop}
                loading={loading}
              >
                停止轮询
              </Button>
            )}
            <Tooltip title={refreshing ? "正在刷新..." : "手动刷新消息"}>
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => pollMessages(false)}
                loading={refreshing}
                disabled={refreshing}
              >
                手动刷新
              </Button>
            </Tooltip>
          </Space>

          {/* 刷新状态提示 */}
          {refreshing && (
            <Alert
              message="正在从飞书服务器获取消息..."
              type="info"
              showIcon
              icon={<SyncOutlined spin />}
              style={{ marginBottom: 8 }}
            />
          )}

          {/* MCP 状态提示 */}
          {config.mcp?.enabled && (mcpStatus === 'disconnected' || mcpStatus === 'error') && (
            <Alert
              message="MCP 服务不可用"
              description={
                mcpStatus === 'error'
                  ? "MCP 连接出错，正在尝试重新连接..."
                  : "MCP 连接已断开，正在尝试重新连接..."
              }
              type="warning"
              showIcon
              icon={<DisconnectOutlined />}
              style={{ marginBottom: 8 }}
            />
          )}

          <Divider />

          {/* 测试区 */}
          <Card size="small" title="本地测试">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: 'flex', width: '100%' }}>
                <Input
                  placeholder="输入测试指令"
                  value={testCommand}
                  onChange={(e) => setTestCommand(e.target.value)}
                  onPressEnter={handleTestCommand}
                  disabled={testLoading}
                  style={{ flex: 1, borderRadius: '6px 0 0 6px' }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleTestCommand}
                  loading={testLoading}
                  style={{ borderRadius: '0 6px 6px 0' }}
                >
                  执行
                </Button>
              </div>

              {/* 测试结果显示 */}
              {testResult && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: testResult.success ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
                  borderRadius: 6,
                }}>
                  <Space>
                    {testResult.success ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <StopOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    <Text strong>{testResult.success ? '执行成功' : '执行失败'}</Text>
                  </Space>
                  <Paragraph
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {testResult.output}
                  </Paragraph>
                </div>
              )}
            </Space>
          </Card>

          <Divider />

          {/* 最近消息 */}
          <Card size="small" title={`最近消息 (${recentMessages.length})`}>
            <Spin spinning={refreshing} tip="加载中...">
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {recentMessages.length === 0 ? (
                  <Text type="secondary">暂无消息</Text>
                ) : (
                  recentMessages.map((item) => (
                    <div
                      key={item.messageId}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space>
                          <Tag color={item.senderType === 'user' ? 'green' : 'blue'}>
                            {item.senderName || '未知'}
                          </Tag>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(item.createTime)}
                        </Text>
                      </div>
                      <div style={{ paddingLeft: 8 }}>
                        <Text>{item.content || '(无内容)'}</Text>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Spin>
          </Card>

          <Divider />

          {/* 消息列表 */}
          <Card size="small" title={`消息记录 (${messages.length})`}>
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text code>{item.content}</Text>
                        <Tag color={statusColors[item.status]}>
                          {statusTexts[item.status]}
                        </Tag>
                      </Space>
                    }
                    description={new Date(item.createTime * 1000).toLocaleString()}
                  />
                </List.Item>
              )}
              locale={{ emptyText: "暂无消息" }}
            />
          </Card>
        </Space>
      </Card>
    </div>
  );
};

export default MainPage;
