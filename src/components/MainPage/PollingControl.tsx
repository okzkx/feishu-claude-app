/**
 * PollingControl 组件
 *
 * 轮询控制按钮组：启动/停止轮询、手动刷新、MCP连接控制、清除记忆
 */

import React, { useState } from 'react';
import {
  Button,
  Space,
  Tooltip,
  Modal,
  message,
  Alert,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  StopOutlined,
  ApiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { feishuApi } from '../../utils/feishuApi';
import {
  usePollingStore,
  useMcpStore,
  useConfigStore,
} from '../../stores';

interface PollingControlProps {
  onRefresh: () => void;
}

const PollingControl: React.FC<PollingControlProps> = ({ onRefresh }) => {
  const { isRunning, isRefreshing, isManualRefresh, start, stop } = usePollingStore();
  const { status: mcpStatus, setStatus: setMcpStatus, isConnecting, setConnecting: setMcpConnecting } = useMcpStore();
  const { mcp, cmdPrefix, exportToAppConfig } = useConfigStore();

  const [loading, setLoading] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [clearMemoryModalOpen, setClearMemoryModalOpen] = useState(false);

  // 启动轮询
  const handleStart = async () => {
    setLoading(true);
    try {
      const isBackendRunning = await invoke<boolean>('is_polling_running');

      if (isBackendRunning) {
        start();
        message.info('轮询已在运行中');
      } else {
        start();
        message.success('轮询已启动');

        // 发送启动通知
        const config = exportToAppConfig();
        feishuApi.sendMessage(
          `Claude 机器人已启动！\n指令格式：${config?.cmdPrefix || cmdPrefix}你的指令`
        ).catch(console.error);

        // start_polling 是阻塞的，不等待它完成
        invoke('start_polling').catch((error) => {
          console.error('轮询错误:', error);
          if (!String(error).includes('已在运行')) {
            stop();
            message.error(`轮询异常: ${error}`);
          }
        });
      }
    } catch (error) {
      stop();
      message.error(`启动失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 停止轮询
  const handleStop = async () => {
    setLoading(true);
    try {
      stop();
      message.info('轮询已停止');

      await invoke('stop_polling');

      // 异步发送停止通知
      feishuApi.sendMessage('Claude 机器人已停止').catch(console.error);
    } catch (error) {
      message.error(`停止失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // MCP 连接
  const handleMcpConnect = async () => {
    if (!mcp.enabled) {
      message.warning('请先在设置中启用 MCP');
      return;
    }

    setMcpConnecting(true);
    try {
      await invoke('mcp_connect');
      setMcpStatus('connected');
      message.success('MCP 连接成功');
    } catch (error) {
      setMcpStatus('error');
      message.error(`MCP 连接失败: ${error}`);
    } finally {
      setMcpConnecting(false);
    }
  };

  // MCP 断开
  const handleMcpDisconnect = async () => {
    setMcpConnecting(true);
    try {
      await invoke('mcp_disconnect');
      setMcpStatus('disconnected');
      message.success('MCP 已断开');
    } catch (error) {
      message.error(`MCP 断开失败: ${error}`);
    } finally {
      setMcpConnecting(false);
    }
  };

  // 清除记忆
  const handleClearMemoryConfirm = async () => {
    setClearingMemory(true);
    try {
      const result = await invoke<string>('clear_claude_memory');
      message.success(result || '已设置清除记忆标志');
      setClearMemoryModalOpen(false);
    } catch (error) {
      message.error(`设置清除标志失败: ${error}`);
    } finally {
      setClearingMemory(false);
    }
  };

  return (
    <>
      <Space wrap>
        {/* 启动/停止按钮 */}
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

        {/* 手动刷新按钮 */}
        <Tooltip title={isRefreshing ? '正在刷新...' : '手动刷新消息'}>
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={onRefresh}
            loading={isRefreshing}
            disabled={isRefreshing}
          >
            手动刷新
          </Button>
        </Tooltip>

        {/* MCP 连接控制 */}
        {mcp.enabled && (
          mcpStatus === 'connected' ? (
            <Tooltip title="断开 MCP 连接">
              <Button
                icon={<DisconnectOutlined />}
                onClick={handleMcpDisconnect}
                loading={isConnecting}
              >
                断开 MCP
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title={mcpStatus === 'connecting' ? '正在连接...' : '连接 MCP 服务'}>
              <Button
                type="default"
                icon={<ApiOutlined />}
                onClick={handleMcpConnect}
                loading={isConnecting || mcpStatus === 'connecting'}
                disabled={mcpStatus === 'connecting'}
              >
                连接 MCP
              </Button>
            </Tooltip>
          )
        )}

        {/* 清除记忆按钮 */}
        <Tooltip title="清除 Claude 的所有记忆">
          <Button
            danger
            icon={<StopOutlined />}
            onClick={() => setClearMemoryModalOpen(true)}
            loading={clearingMemory}
          >
            清除记忆
          </Button>
        </Tooltip>
      </Space>

      {/* 刷新状态提示（仅在手动刷新时显示） */}
      {isManualRefresh && isRefreshing && (
        <Alert
          message="正在从飞书服务器获取消息..."
          type="info"
          showIcon
          icon={<SyncOutlined spin />}
          style={{ marginTop: 12, marginBottom: 8 }}
        />
      )}

      {/* MCP 状态提示 */}
      {mcp.enabled && (mcpStatus === 'disconnected' || mcpStatus === 'error') && (
        <Alert
          message="MCP 服务不可用"
          description={
            mcpStatus === 'error'
              ? 'MCP 连接出错，正在尝试重新连接...'
              : 'MCP 连接已断开，正在尝试重新连接...'
          }
          type="warning"
          showIcon
          icon={<DisconnectOutlined />}
          style={{ marginTop: 12, marginBottom: 8 }}
        />
      )}

      {/* 清除记忆确认对话框 */}
      <Modal
        title="确认清除记忆"
        open={clearMemoryModalOpen}
        onOk={handleClearMemoryConfirm}
        onCancel={() => setClearMemoryModalOpen(false)}
        okText="确认清除"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: clearingMemory }}
      >
        <p>下次对话将开启全新会话，Claude 将不再记得之前的对话内容。</p>
        <p>确定要继续吗？</p>
      </Modal>
    </>
  );
};

export default PollingControl;
