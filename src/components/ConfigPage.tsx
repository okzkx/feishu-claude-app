import { Form, Input, Button, Card, InputNumber, message, Space, Modal, List, Spin, Switch, Divider, Tag } from "antd";
import { SettingOutlined, ArrowLeftOutlined, SearchOutlined, CopyOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import type { AppConfig } from "../types";
import { feishuApi } from "../utils/feishuApi";

interface ConfigPageProps {
  onConfigured: (config: AppConfig) => void;
  initialConfig?: AppConfig | null;
  onBack?: () => void;
}

interface ChatItem {
  chat_id: string;
  name: string;
}

const ConfigPage: React.FC<ConfigPageProps> = ({ onConfigured, initialConfig, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatList, setChatList] = useState<ChatItem[]>([]);
  const [chatListLoading, setChatListLoading] = useState(false);
  const [mcpTesting, setMcpTesting] = useState(false);
  const [mcpConnectionStatus, setMcpConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  useEffect(() => {
    if (initialConfig) {
      form.setFieldsValue(initialConfig);
    }
  }, [initialConfig, form]);

  const onFinish = async (values: AppConfig) => {
    setLoading(true);
    try {
      // 构建完整配置，确保 mcp 字段完整
      const fullConfig: AppConfig = {
        feishuAppId: values.feishuAppId,
        feishuAppSecret: values.feishuAppSecret,
        feishuChatId: values.feishuChatId,
        feishuUserId: values.feishuUserId,
        cmdPrefix: values.cmdPrefix || "claude:",
        pollInterval: values.pollInterval || 5,
        mcp: {
          enabled: values.mcp?.enabled ?? false,
          workingDir: values.mcp?.workingDir || ".",
        },
      };

      // 同步配置到 Rust 后端（关键：确保 MCP working_dir 正确）
      await invoke('save_config', { config: fullConfig });

      // 更新前端状态和 localStorage
      onConfigured(fullConfig);
    } catch (error) {
      message.error(`配置保存失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetChatList = async () => {
    const values = form.getFieldsValue();
    if (!values.feishuAppId || !values.feishuAppSecret) {
      message.warning("请先填写飞书 App ID 和 App Secret");
      return;
    }

    const currentConfig: AppConfig = {
      feishuAppId: values.feishuAppId,
      feishuAppSecret: values.feishuAppSecret,
      feishuChatId: values.feishuChatId || "",
      feishuUserId: values.feishuUserId || "",
      cmdPrefix: values.cmdPrefix || "claude:",
      pollInterval: values.pollInterval || 5,
      mcp: values.mcp || { enabled: false, workingDir: "." },
    };
    localStorage.setItem("feishu-claude-config", JSON.stringify(currentConfig));

    feishuApi.init(currentConfig);

    setChatListLoading(true);
    setChatList([]);
    setChatModalVisible(true);

    try {
      const chats = await feishuApi.getChatList();
      setChatList(chats);
      if (chats.length === 0) {
        message.info("未找到群聊，请确保机器人已加入群聊");
      }
    } catch (error) {
      message.error(`获取群聊列表失败: ${error}`);
    } finally {
      setChatListLoading(false);
    }
  };

  const handleSelectChat = (chatId: string) => {
    form.setFieldsValue({ feishuChatId: chatId });
    setChatModalVisible(false);
    message.success("已填充 Chat ID");
  };

  const handleCopyChatId = (chatId: string) => {
    navigator.clipboard.writeText(chatId);
    message.success("已复制到剪贴板");
  };

  const handleTestMcpConnection = async () => {
    const values = form.getFieldsValue();
    const mcpEnabled = values.mcp?.enabled ?? false;

    if (!mcpEnabled) {
      message.warning("请先启用 MCP");
      return;
    }

    const workingDir = values.mcp?.workingDir;
    if (!workingDir) {
      message.warning("请先填写 Claude 项目目录");
      return;
    }

    setMcpTesting(true);
    setMcpConnectionStatus('connecting');

    try {
      // 先保存配置到后端，确保工作目录正确
      const currentConfig: AppConfig = {
        feishuAppId: values.feishuAppId || "",
        feishuAppSecret: values.feishuAppSecret || "",
        feishuChatId: values.feishuChatId || "",
        feishuUserId: values.feishuUserId || "",
        cmdPrefix: values.cmdPrefix || "claude:",
        pollInterval: values.pollInterval || 5,
        mcp: {
          enabled: true,
          workingDir: workingDir,
        },
      };
      await invoke('save_config', { config: currentConfig });

      // 然后测试连接
      await invoke('mcp_connect');
      message.success("MCP 连接测试成功");
      setMcpConnectionStatus('connected');
    } catch (error) {
      message.error(`MCP 连接测试失败: ${error}`);
      setMcpConnectionStatus('error');
    } finally {
      setMcpTesting(false);
    }
  };

  const renderMcpConnectionStatus = () => {
    switch (mcpConnectionStatus) {
      case 'connected':
        return <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>;
      case 'connecting':
        return <Tag icon={<LoadingOutlined />} color="processing">连接中...</Tag>;
      case 'error':
        return <Tag icon={<CloseCircleOutlined />} color="error">连接失败</Tag>;
      default:
        return <Tag color="default">未连接</Tag>;
    }
  };

  return (
    <div className="config-page">
      <Card
        title={
          <span>
            <SettingOutlined /> 飞书 Claude 消息轮询配置
          </span>
        }
        style={{ maxWidth: 600, margin: "50px auto" }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            pollInterval: 2,
            mcp: { enabled: false, workingDir: "." },
          }}
        >
          <Form.Item
            name="feishuAppId"
            label="飞书 App ID"
            rules={[{ required: true, message: "请输入飞书 App ID" }]}
          >
            <Input placeholder="cli_xxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="feishuAppSecret"
            label="飞书 App Secret"
            rules={[{ required: true, message: "请输入飞书 App Secret" }]}
          >
            <Input.Password placeholder="App Secret" />
          </Form.Item>

          <Form.Item
            name="feishuChatId"
            label="群聊 Chat ID"
            rules={[{ required: true, message: "请输入群聊 Chat ID" }]}
            extra={
              <Button
                type="link"
                size="small"
                icon={<SearchOutlined />}
                onClick={handleGetChatList}
                style={{ padding: 0, marginTop: 4 }}
              >
                获取群聊列表
              </Button>
            }
          >
            <Input placeholder="oc_xxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="pollInterval"
            label="轮询间隔（秒）"
          >
            <InputNumber min={1} max={60} style={{ width: "100%" }} />
          </Form.Item>

          <Divider orientation="left">
            <ApiOutlined /> MCP 设置 (STDIO 模式)
          </Divider>

          <Form.Item
            name={['mcp', 'enabled']}
            label="启用 MCP"
            valuePropName="checked"
            extra="启用后将通过 STDIO 与 Claude CLI 通信"
          >
            <Switch />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.mcp?.enabled !== curr.mcp?.enabled}>
            {({ getFieldValue }) => {
              const mcpEnabled = getFieldValue(['mcp', 'enabled']);
              return mcpEnabled ? (
                <>
                  <Form.Item
                    name={['mcp', 'workingDir']}
                    label="Claude 项目目录"
                    rules={[{ required: true, message: "请输入 Claude 项目目录" }]}
                    extra="Claude 子进程的工作目录"
                  >
                    <Input placeholder="D:\projects\my_claude_project" />
                  </Form.Item>
                  <Form.Item label="连接状态">
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        loading={mcpTesting}
                        onClick={handleTestMcpConnection}
                      >
                        测试连接
                      </Button>
                      {renderMcpConnectionStatus()}
                    </Space>
                  </Form.Item>
                </>
              ) : null;
            }}
          </Form.Item>

          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              {onBack && (
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                  返回
                </Button>
              )}
              <Button type="primary" htmlType="submit" loading={loading} style={{ flex: 1 }}>
                保存配置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="选择群聊"
        open={chatModalVisible}
        onCancel={() => setChatModalVisible(false)}
        footer={null}
        width={500}
      >
        {chatListLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <List
            dataSource={chatList}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="copy"
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyChatId(item.chat_id)}
                  >
                    复制
                  </Button>,
                  <Button
                    key="select"
                    type="link"
                    size="small"
                    onClick={() => handleSelectChat(item.chat_id)}
                  >
                    选择
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.name || "未命名群聊"}
                  description={
                    <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                      {item.chat_id}
                    </span>
                  }
                />
              </List.Item>
            )}
            locale={{ emptyText: "暂无群聊，请确保机器人已加入群聊" }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ConfigPage;
