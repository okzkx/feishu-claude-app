/**
 * RecentMessages 组件
 *
 * 显示最近收到的消息列表（包含文本和图片）
 */

import React from 'react';
import { Card, Spin, Typography } from 'antd';
import { MessageItem } from '../MessageItem';
import { useMessageStore } from '../../stores';

const { Text } = Typography;

interface RecentMessagesProps {
  refreshing?: boolean;
  onLoadImage: (imageKey: string) => void;
}

const RecentMessages: React.FC<RecentMessagesProps> = ({
  refreshing = false,
  onLoadImage,
}) => {
  const { recentMessages, imageBlobUrls, loadingImages } = useMessageStore();

  return (
    <Card size="small" title={`最近消息 (${recentMessages.length})`}>
      <Spin spinning={refreshing} tip="加载中...">
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {recentMessages.length === 0 ? (
            <Text type="secondary">暂无消息</Text>
          ) : (
            recentMessages.map((item) => (
              <MessageItem
                key={item.messageId}
                message={item}
                imageBlobUrls={imageBlobUrls}
                loadingImages={loadingImages}
                onLoadImage={onLoadImage}
              />
            ))
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default RecentMessages;
