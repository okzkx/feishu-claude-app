/**
 * MainPage 组件类型定义
 *
 * 导出所有子组件的 Props 类型
 */

export interface PollingControlProps {
  onRefresh: () => void;
}

export interface RecentMessagesProps {
  refreshing?: boolean;
  onLoadImage: (imageKey: string) => void;
}

export interface MainPageProps {
  config: import('../../types').AppConfig;
  onSettings: () => void;
}
