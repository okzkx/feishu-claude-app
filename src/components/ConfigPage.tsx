import { Form, Input, Button, Card, InputNumber, message, Space, Modal, List, Spin } from "antd";
import { SettingOutlined, ArrowLeftOutlined, SearchOutlined, CopyOutlined } from "@ant-design/icons";
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

  // 加载已保存的配置到表单
  useEffect(() => {
    if (initialConfig) {
      form.setFieldsValue(initialConfig);
    }
  }, [initialConfig, form]);

  const onFinish = async (values: AppConfig) => {
    setLoading(true);
    try {
      onConfigured(values);
    } catch (error) {
      message.error("配置保存失败");
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

    // 保存当前表单数据到 localStorage
    const currentConfig: AppConfig = {
      feishuAppId: values.feishuAppId,
      feishuAppSecret: values.feishuAppSecret,
      feishuChatId: values.feishuChatId || "",
      feishuUserId: values.feishuUserId || "",
      claudeProjectDir: values.claudeProjectDir || ".",
      cmdPrefix: values.cmdPrefix || "claude:",
      pollInterval: values.pollInterval || 5,
    };
    localStorage.setItem("feishu-claude-config", JSON.stringify(currentConfig));

    // 临时初始化 API 以获取群聊列表
    feishuApi.init(currentConfig);

    setChatListLoading(true);
    setChatList([]);
    setChatModalVisible(true);

    try {
      console.log("开始获取群聊列表...");
      const chats = await feishuApi.getChatList();
      console.log("获取到的群聊列表:", chats);
      setChatList(chats);
      if (chats.length === 0) {
        message.info("未找到群聊，请确保机器人已加入群聊");
      }
    } catch (error) {
      console.error("获取群聊列表失败:", error);
      message.error(`获取群聊列表失败: ${error}`);
      // 不关闭 Modal，让用户看到错误
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
            cmdPrefix: "claude:",
            pollInterval: 5,
            claudeProjectDir: ".",
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
            name="feishuUserId"
            label="你的飞书 User ID（可选）"
            extra="填写后只处理你的消息，留空则处理所有消息"
          >
            <Input placeholder="ou_xxxxxxxxxxxx" />
          </Form.Item>

          <Form.Item
            name="claudeProjectDir"
            label="Claude 项目目录"
            rules={[{ required: true, message: "请输入 Claude 项目目录" }]}
          >
            <Input placeholder="D:\projects\my_claude_project" />
          </Form.Item>

          <Form.Item
            name="cmdPrefix"
            label="指令前缀"
            extra="消息以此前缀开头才会被处理"
          >
            <Input placeholder="claude:" />
          </Form.Item>

          <Form.Item
            name="pollInterval"
            label="轮询间隔（秒）"
          >
            <InputNumber min={1} max={60} style={{ width: "100%" }} />
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

      {/* 群聊列表弹窗 */}
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
