/**
 * MessageList 组件
 *
 * 显示已处理的消息记录列表
 */

import React from 'react';
import { Card, List, Space, Tag, Typography } from 'antd';
import { useMessageStore } from '../../stores';
import type { Message } from '../../types';

const { Text } = Typography;

// 状态颜色映射
const statusColors: Record<string, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
};

// 状态文本映射
const statusTexts: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
};

const MessageList: React.FC = () => {
  const { messages } = useMessageStore();

  return (
    <Card size="small" title={`消息记录 (${messages.length})`}>
      <List
        dataSource={messages}
        renderItem={(item: Message) => (
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
        locale={{ emptyText: '暂无消息' }}
      />
    </Card>
  );
};

export default MessageList;
