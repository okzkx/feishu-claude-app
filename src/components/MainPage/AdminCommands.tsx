/**
 * AdminCommands 组件
 *
 * 管理员指令说明面板
 */

import React from 'react';
import { Card, List, Tag, Space, Typography } from 'antd';
import {
  CodeOutlined,
  StopOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useMcpStore } from '../../stores';

const { Text } = Typography;

// 管理员指令列表
const adminCommands = [
  { cmd: '/clear', desc: '清除 Claude 记忆', icon: <StopOutlined /> },
  { cmd: '/cd <目录>', desc: '切换工作目录', icon: <FolderOutlined /> },
];

const AdminCommands: React.FC = () => {
  const { workingDir } = useMcpStore();

  return (
    <Card
      size="small"
      title={
        <Space>
          <CodeOutlined />
          <span>管理员指令</span>
        </Space>
      }
    >
      <List
        dataSource={adminCommands}
        renderItem={(item) => (
          <List.Item style={{ padding: '8px 0', border: 'none' }}>
            <Space>
              <Tag icon={item.icon} color="blue" style={{ fontFamily: 'monospace' }}>
                {item.cmd}
              </Tag>
              <Text type="secondary">{item.desc}</Text>
            </Space>
          </List.Item>
        )}
      />
      {workingDir && workingDir !== '.' && (
        <div style={{ marginTop: 8, padding: '8px', backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <Text type="secondary">当前工作目录: </Text>
          <Text code>{workingDir}</Text>
        </div>
      )}
    </Card>
  );
};

export default AdminCommands;
