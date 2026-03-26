/**
 * TitleBar 组件 - 自定义标题栏
 * 提供窗口拖动、最小化、最大化/还原、关闭功能
 */

import { useCallback, useState, useEffect } from 'react';
import { Button, Tooltip, Space, Badge } from 'antd';
import {
  MinusOutlined,
  BorderOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppConfig } from '../../types';
import { usePollingStore } from './usePolling';

interface TitleBarProps {
  onSettings?: () => void;
  onPollingStatusChange?: (isRunning: boolean) => void;
}

const TitleBar: React.FC<TitleBarProps> = {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const isPolling = usePollingStore((state) => state.isRunning);

  // 初始化窗口状态
  useEffect(() => {
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (e) {
        console.error('Failed to check maximized state:', e);
      }
    };
    checkMaximized();

    // 监听窗口大小变化
    useEffect(() => {
      const unlisten = appWindow.onResized(() => {
        checkMaximized();
      });

      return () => {
        unlisten.then((fn) => fn());
      };
    }, [checkMaximized]);

  // 最小化按钮
  const handleMinimize = useCallback(async () => {
    try {
      await appWindow.minimize();
    } catch (e) {
      console.error('Failed to minimize window:', e);
    }
  }, []);

  // 最大化/还原按钮
  const handleMaximize = useCallback(async () => {
    try {
      if (isMaximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (e) {
      console.error('Failed to maximize/restore window:', e);
    }
  }, [isMaximized]);

  // 关闭按钮
  const handleClose = useCallback(async () => {
    try {
      await appWindow.hide();
    } catch (e) {
      console.error('Failed to hide window:', e);
    }
  }, []);

  return (
    <div className="titlebar-container" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region>
        {/* Logo */}
        <div className="titlebar-logo">飞书 Claude</div>

        {/* 拖动区域 */}
        <div className="titlebar-drag" data-tauri-drag-region>
          {/* 标题 */}
          <div className="titlebar-title" style={{ flex: 1 }}>
            飞书 Claude 消息轮询
          </div>

          {/* 轮询状态指示器 */}
          <div className="titlebar-status">
            {isPolling ? (
              <Badge status="processing" style={{ marginLeft: 4 }} color="var(--color-success)" />
            ) : (
              <Badge status="default" style={{ marginTop: 4 }} color="var(--color-text-secondary)" />
            )}
          </div>

          {/* 紻动区域 */}
          <div className="titlebar-spacer" style={{ flex: 1 }} />

          {/* 窗口控制按钮 */}
          <div className="window-controls">
            <Tooltip title="最小化">
              <Button
                type="text"
                size="small"
                icon={<MinusOutlined />}
                className="window-control-button minimize"
                onClick={handleMinimize}
              />
            </Tooltip>
            <Tooltip title={isMaximized ? '还原' : '最大化'}>
              <Button
                type="text"
                size="small"
                icon={isMaximized ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                className="window-control-button maximize"
                onClick={handleMaximize}
              />
            </Tooltip>
            <Tooltip title="关闭">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                className="window-control-button close"
                onClick={handleClose}
              />
            </Tooltip>
            {onSettings && (
              <Tooltip title="设置">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  className="window-control-button settings"
                  onClick={onSettings}
                  title="设置"
                />
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
