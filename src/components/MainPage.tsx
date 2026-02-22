import { useState, useEffect } from "react";
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
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  SendOutlined,
  ReloadOutlined,
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
  const [testCommand, setTestCommand] = useState("");

  useEffect(() => {
    // 监听轮询事件
    const unlisten = listen("poll-tick", async () => {
      await pollMessages();
    });

    // 监听 Claude 状态
    listen<string>("claude-status", (event) => {
      if (event.payload === "executing") {
        message.loading({ content: "Claude 正在执行...", key: "claude" });
      }
    });

    // 监听 Claude 结果
    listen<TaskResult>("claude-result", (event) => {
      if (event.payload.success) {
        message.success({ content: "执行成功", key: "claude" });
      } else {
        message.error({ content: "执行失败", key: "claude" });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const pollMessages = async () => {
    try {
      const msgs = await feishuApi.getMessages();
      console.log("pollMessages: 获取到消息", msgs.length, "条");

      // 显示最近10条文本消息
      setRecentMessages(msgs.filter(m => m.msgType === 'text').slice(0, 10));

      for (const msg of msgs) {
        console.log("pollMessages: 处理消息", msg.messageId, msg.msgType, msg.content?.substring(0, 50));

        // 检查是否已处理
        const processed = await invoke<boolean>("is_message_processed", {
          messageId: msg.messageId,
        });

        if (processed) {
          console.log("pollMessages: 已处理，跳过");
          continue;
        }

        // 过滤：只处理文本消息
        if (msg.msgType !== "text") {
          console.log("pollMessages: 非文本消息，跳过", msg.msgType);
          continue;
        }

        // 过滤：只处理我的消息
        if (!feishuApi.isMyMessage(msg.senderId)) {
          console.log("pollMessages: 非我的消息，跳过", msg.senderId);
          continue;
        }

        // 检查命令前缀
        const prefix = feishuApi.getCmdPrefix();
        if (!msg.content?.startsWith(prefix)) {
          console.log("pollMessages: 不匹配前缀，跳过", prefix, msg.content?.substring(0, 20));
          continue;
        }

        // 提取命令
        const command = msg.content.slice(prefix.length).trim();
        if (!command) {
          console.log("pollMessages: 命令为空，跳过");
          continue;
        }

        console.log("pollMessages: 找到有效命令", command);

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
              m.messageId === msg.messageId
                ? { ...m, status: "completed" }
                : m
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
    }
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      await invoke("start_polling");
      setIsRunning(true);
      message.success("轮询已启动");

      // 发送启动通知
      await feishuApi.sendMessage(
        `Claude 机器人已启动！\n指令格式：${config?.cmdPrefix}你的指令`
      );
    } catch (error) {
      message.error(`启动失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await invoke("stop_polling");
      setIsRunning(false);
      message.info("轮询已停止");

      await feishuApi.sendMessage("Claude 机器人已停止");
    } catch (error) {
      message.error(`停止失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCommand = async () => {
    if (!testCommand.trim()) {
      message.warning("请输入测试指令");
      return;
    }

    setLoading(true);
    try {
      const result = await invoke<TaskResult>("execute_claude", {
        command: testCommand,
      });

      if (result.success) {
        message.success("执行成功");
      } else {
        message.error("执行失败");
      }
    } catch (error) {
      message.error(`执行失败: ${error}`);
    } finally {
      setLoading(false);
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

  // 格式化时间
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

  return (
    <div className="main-page">
      <Card
        title={
          <Space>
            <Badge status={isRunning ? "processing" : "default"} />
            <span>飞书 Claude 消息轮询</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={onSettings}>
              设置
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {/* 控制区 */}
          <Space>
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
            <Button icon={<ReloadOutlined />} onClick={pollMessages}>
              手动刷新
            </Button>
          </Space>

          <Divider />

          {/* 测试区 */}
          <Card size="small" title="本地测试">
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="输入测试指令"
                value={testCommand}
                onChange={(e) => setTestCommand(e.target.value)}
                onPressEnter={handleTestCommand}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleTestCommand}
                loading={loading}
              >
                执行
              </Button>
            </Space.Compact>
          </Card>

          <Divider />

          {/* 最近消息 */}
          <Card size="small" title={`最近消息 (${recentMessages.length})`}>
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
                    {/* 头部：用户名 + 时间 */}
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
                    {/* 消息内容 */}
                    <div style={{ paddingLeft: 8 }}>
                      <Text>{item.content || '(无内容)'}</Text>
                    </div>
                  </div>
                ))
              )}
            </div>
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
