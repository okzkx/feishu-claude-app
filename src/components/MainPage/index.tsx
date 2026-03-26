/**
 * MainPage 组件
 *
 * 飞书 Claude 消息轮询主页面
 * 组合子组件：PollingControl, AdminCommands, TestPanel, RecentMessages, MessageList
 */

import React from 'react';
import { Card, Badge, Space, Button, Divider } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { AppConfig } from '../../types';

// 子组件
import { PollingStatusIndicator, McpStatusIndicator } from './StatusIndicator';
import PollingControl from './PollingControl';
import AdminCommands from './AdminCommands';
import TestPanel from './TestPanel';
import RecentMessages from './RecentMessages';
import MessageList from './MessageList';

// Hooks
import { usePolling } from './usePolling';

interface MainPageProps {
  config: AppConfig;
  onSettings: () => void;
}

const MainPageNew: React.FC<MainPageProps> = ({ config, onSettings }) => {
  // 使用轮询 hook
  const { isRunning, isRefreshing, pollMessages, handleLoadImage } = usePolling(config);

  return (
    <div className="main-page">
      <Card
        title={
          <Space>
            <Badge
              status={isRunning ? 'processing' : 'default'}
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
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 控制区 */}
          <PollingControl onRefresh={() => pollMessages(false)} />

          <Divider />

          {/* 管理员指令说明 */}
          <AdminCommands />

          <Divider />

          {/* 测试区 */}
          <TestPanel />

          <Divider />

          {/* 最近消息 */}
          <RecentMessages
            refreshing={isRefreshing}
            onLoadImage={handleLoadImage}
          />

          <Divider />

          {/* 消息列表 */}
          <MessageList />
        </Space>
      </Card>
    </div>
  );
};

export default MainPageNew;
