/**
 * StatusIndicator 组件
 *
 * 显示轮询状态和 MCP 连接状态
 */

import React from 'react';
import { Tag, Tooltip, Space } from 'antd';
import {
  SyncOutlined,
  StopOutlined,
  ApiOutlined,
  CloudOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { usePollingStore, useMcpStore, useConfigStore } from '../../stores';

/**
 * 轮询状态指示器
 */
export const PollingStatusIndicator: React.FC = () => {
  const { isRunning, pollInterval } = usePollingStore();

  return (
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
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            每 {pollInterval} 秒刷新
          </span>
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
};

/**
 * MCP 状态指示器
 */
export const McpStatusIndicator: React.FC = () => {
  const { mcp } = useConfigStore();
  const { status } = useMcpStore();

  if (!mcp.enabled) {
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

  switch (status) {
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

/**
 * 组合状态指示器（用于卡片标题）
 */
export const StatusIndicator: React.FC = () => {
  return (
    <Space>
      <PollingStatusIndicator />
      <McpStatusIndicator />
    </Space>
  );
};

export default StatusIndicator;
