import React from 'react';
import { Tag, Space, Image, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { Message } from '../types';

const { Text } = Typography;

interface MessageItemProps {
  message: Message;
  imageBlobUrls?: Record<string, string>;  // imageKey -> Blob URL 的映射
  onLoadImage?: (imageKey: string) => void;  // 加载图片的回调
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  imageBlobUrls,
  onLoadImage,
}) => {
  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Space>
          <Tag color={message.senderType === 'user' ? 'green' : 'blue'}>
            {message.senderName || '未知'}
          </Tag>
          <Tag color="orange">
            {message.msgType === 'image' ? '图片' : '文本'}
          </Tag>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined /> {formatTime(message.createTime)}
        </Text>
      </div>

      <div style={{ paddingLeft: 8 }}>
        {message.msgType === 'image' && message.imageKey ? (
          // 图片消息
          imageBlobUrls?.[message.imageKey] ? (
            <Image
              src={imageBlobUrls[message.imageKey]}
              alt="图片消息"
              width={200}
              style={{ cursor: 'pointer', borderRadius: '8px' }}
              preview={{
                mask: '点击查看大图',
              }}
            />
          ) : (
            // 图片未加载，显示加载按钮
            <button
              onClick={() => onLoadImage?.(message.imageKey!)}
              style={{
                padding: '8px 16px',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              加载图片
            </button>
          )
        ) : (
          // 文本消息
          <Text>{message.content || '(无内容)'}</Text>
        )}
      </div>
    </div>
  );
};
