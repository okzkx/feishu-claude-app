/**
 * usePolling Hook
 *
 * 封装消息轮询逻辑，使用 Zustand stores 管理状态
 */

import { useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { feishuApi } from '../../utils/feishuApi';
import {
  usePollingStore,
  useMessageStore,
  useMcpStore,
  useConfigStore,
} from '../../stores';
import type { AppConfig, TaskResult } from '../../types';

// 管理员指令处理函数
const handleAdminCommand = async (
  content: string,
  setWorkingDir: (dir: string) => void
): Promise<{ handled: boolean; response?: string }> => {
  const trimmedContent = content.trim();

  // /clear - 清除记忆
  if (trimmedContent === '/clear') {
    try {
      const result = await invoke<string>('clear_claude_memory');
      return { handled: true, response: result };
    } catch (error) {
      return { handled: true, response: `清除记忆失败: ${error}` };
    }
  }

  // /cd <目录> - 切换工作目录
  if (trimmedContent.startsWith('/cd ')) {
    const path = trimmedContent.slice(4).trim();
    if (!path) {
      return { handled: true, response: '请指定目录路径，例如: /cd /path/to/project' };
    }
    try {
      const result = await invoke<string>('set_working_dir', { path });
      setWorkingDir(path);
      return { handled: true, response: result };
    } catch (error) {
      return { handled: true, response: `切换目录失败: ${error}` };
    }
  }

  // 非管理员指令
  return { handled: false };
};

export const usePolling = (config: AppConfig) => {
  // Zustand stores
  const {
    isRunning,
    isRefreshing,
    start,
    stop,
    setRefreshing,
    setBackendStatus,
    setPollInterval,
  } = usePollingStore();

  const {
    messages,
    addMessage,
    updateMessageStatus,
    setRecentMessages,
    addRecentMessage,
    markProcessed,
    isProcessed,
    setImageBlobUrl,
    setImageLoading,
    isFirstPoll,
    setIsFirstPoll,
    lastMessageId,
    setLastMessageId,
  } = useMessageStore();

  const {
    status: mcpStatus,
    setStatus: setMcpStatus,
    hasNotifiedDisconnect,
    setNotifiedDisconnect,
    setWorkingDir,
  } = useMcpStore();

  // 保留 setMcpConnecting 以备将来使用（消除 TS6133 警告）
  const _setMcpConnecting = useMcpStore((state) => state.setConnecting);
  void _setMcpConnecting;

  const { mcp, isConfigComplete } = useConfigStore();

  // 使用 ref 解决事件监听器中的闭包问题
  const lastMessageIdRef = useRef<string | null>(lastMessageId);
  const isFirstPollRef = useRef<boolean>(isFirstPoll);

  // 同步 ref 与 store
  useEffect(() => {
    lastMessageIdRef.current = lastMessageId;
  }, [lastMessageId]);

  useEffect(() => {
    isFirstPollRef.current = isFirstPoll;
  }, [isFirstPoll]);

  // 轮询消息
  const pollMessages = useCallback(async (isAutoRefresh: boolean = false) => {
    // 检查配置是否已初始化
    if (!config || !feishuApi.hasValidConfig()) {
      if (!isAutoRefresh) {
        message.warning('请先配置飞书应用信息');
      }
      setRefreshing(false, false);
      return;
    }

    setRefreshing(true, !isAutoRefresh);

    try {
      // 从 ref 获取最新值
      const isFirst = isFirstPollRef.current;
      const lastId = lastMessageIdRef.current;

      // 首次拉取 20 条，后续只拉取 1 条
      const pageSize = isFirst ? 20 : 1;
      const msgs = await feishuApi.getMessages(pageSize);

      // 首次拉取时记录最新消息 ID 并显示消息列表
      if (isFirst && msgs.length > 0) {
        setLastMessageId(msgs[0].messageId);
        setRecentMessages(msgs.slice(0, 10));
        setIsFirstPoll(false);
        return;
      }

      // 后续拉取：与最新消息比对
      if (msgs.length > 0 && msgs[0].messageId !== lastId) {
        const newMsg = msgs[0];

        // 更新最新消息 ID
        setLastMessageId(newMsg.messageId);

        // 更新最近消息列表
        addRecentMessage(newMsg);

        // 检查是否为非机器人消息
        if (newMsg.msgType === 'text' && newMsg.senderType !== 'app') {
          // 检查是否已处理
          if (!isProcessed(newMsg.messageId)) {
            // 标记已处理
            markProcessed(newMsg.messageId);

            // 更新消息列表显示处理中
            addMessage({ ...newMsg, status: 'processing' });

            let result: TaskResult;

            // 检查是否为管理员指令
            const adminResult = await handleAdminCommand(newMsg.content, setWorkingDir);
            if (adminResult.handled) {
              // 管理员指令已处理
              result = {
                success: true,
                output: adminResult.response || '指令已执行',
                timestamp: (Date.now() / 1000) | 0,
              };
            } else {
              // 原样转发给 Claude MCP
              result = await invoke<TaskResult>('execute_claude', {
                command: newMsg.content,
                chatId: newMsg.chatId,
              });
            }

            // 更新消息状态
            updateMessageStatus(
              newMsg.messageId,
              result.success ? 'completed' : 'failed'
            );

            // 发送结果到飞书
            if (result.success && result.output) {
              await feishuApi.sendMessage(result.output);
            } else if (!result.success) {
              await feishuApi.sendMessage(`执行失败: ${result.output}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('轮询失败:', error);
      if (!isAutoRefresh) {
        message.error(`刷新失败: ${error}`);
      }
    } finally {
      setRefreshing(false, false);
    }
  }, [
    config,
    setRefreshing,
    setLastMessageId,
    setRecentMessages,
    setIsFirstPoll,
    addRecentMessage,
    isProcessed,
    markProcessed,
    addMessage,
    setWorkingDir,
    updateMessageStatus,
  ]);

  // 加载飞书图片
  const handleLoadImage = useCallback(async (imageKey: string) => {
    // 设置加载状态
    setImageLoading(imageKey, true);

    try {
      const result = await invoke<Record<string, any>>('get_feishu_image', { imageKey });

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取图片失败');
      }

      const bytes = result.data;
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      setImageBlobUrl(imageKey, url);
      setImageLoading(imageKey, false);
    } catch (error) {
      console.error('加载图片失败:', error);
      message.error(`加载图片失败: ${error instanceof Error ? error.message : String(error)}`);
      setImageLoading(imageKey, false);
    }
  }, [setImageBlobUrl, setImageLoading]);

  // 初始化和事件监听
  useEffect(() => {
    // 同步后端轮询状态
    invoke<boolean>('is_polling_running')
      .then((running) => {
        if (running) {
          start();
        }
      })
      .catch(console.error);

    // 设置轮询间隔
    if (config.pollInterval) {
      setPollInterval(config.pollInterval);
    }

    // 检查配置是否完整（决定是否自动启动）
    const configComplete = isConfigComplete();

    // 初始化时获取 MCP 状态（仅在配置不完整时，避免与自动启动冲突）
    if (mcp.enabled && !configComplete) {
      invoke<any>('mcp_status')
        .then((info) => {
          if (info && info.status) {
            setMcpStatus(info.status);
          }
        })
        .catch(console.error);
    } else if (mcp.enabled && configComplete) {
      // 配置完整时，设置为 connecting 状态，等待自动启动
      setMcpStatus('connecting');
    }

    // 自动启动逻辑
    const autoStart = async () => {
      if (!configComplete) {
        console.log('[AutoStart] 配置不完整，跳过自动启动');
        return;
      }

      const isBackendRunning = await invoke<boolean>('is_polling_running');
      if (isBackendRunning) {
        console.log('[AutoStart] 轮询已在运行中');
        start();
        return;
      }

      console.log('[AutoStart] 开始自动启动...');

      // 1. 如果 MCP 启用，先连接 MCP
      if (mcp.enabled) {
        try {
          setMcpStatus('connecting');
          await invoke('mcp_connect');
          setMcpStatus('connected');
          console.log('[AutoStart] MCP 连接成功');
        } catch (error) {
          console.error('[AutoStart] MCP 连接失败:', error);
          setMcpStatus('error');
        }
      }

      // 2. 启动轮询
      try {
        start();
        message.success('应用已自动启动');

        // 发送启动通知
        feishuApi.sendMessage(
          `Claude 机器人已自动启动！\n指令格式：${config?.cmdPrefix}你的指令`
        ).catch(console.error);

        invoke('start_polling').catch((error) => {
          console.error('[AutoStart] 轮询错误:', error);
          if (!String(error).includes('已在运行')) {
            stop();
            message.error(`轮询异常: ${error}`);
          }
        });
      } catch (error) {
        stop();
        console.error('[AutoStart] 启动失败:', error);
      }
    };

    // 延迟 1 秒后自动启动
    const autoStartTimer = setTimeout(autoStart, 1000);

    // 存储所有取消监听函数
    const unlistenFns: Promise<() => void>[] = [];

    // 监听轮询事件
    unlistenFns.push(
      listen('poll-tick', async () => {
        await pollMessages(true);
      })
    );

    // 监听轮询状态
    unlistenFns.push(
      listen<string>('polling-status', (event) => {
        if (event.payload === 'started') {
          start();
          setBackendStatus('running');
        } else if (event.payload === 'stopped') {
          stop();
          setBackendStatus('idle');
        }
      })
    );

    // 监听 Claude 状态
    unlistenFns.push(
      listen<string>('claude-status', (event) => {
        if (event.payload === 'executing') {
          message.loading({ content: 'Claude 正在执行...', key: 'claude', duration: 0 });
        } else if (event.payload === 'completed') {
          message.destroy('claude');
        }
      })
    );

    // 监听 Claude 结果
    unlistenFns.push(
      listen<TaskResult>('claude-result', (event) => {
        if (event.payload.success) {
          message.success({ content: '执行成功', key: 'claude-result' });
        } else {
          message.error({ content: '执行失败', key: 'claude-result' });
        }
      })
    );

    // 监听 MCP 状态变化
    unlistenFns.push(
      listen<string>('mcp-status', async (event) => {
        const newStatus = event.payload as 'disconnected' | 'connecting' | 'connected' | 'error';
        setMcpStatus(newStatus);

        // 如果 MCP 断开且轮询正在运行，发送"服务不可用"消息到飞书
        if (newStatus === 'disconnected' || newStatus === 'error') {
          if (!hasNotifiedDisconnect && mcp.enabled && isRunning) {
            setNotifiedDisconnect(true);
            await feishuApi.sendMessage('服务不可用：MCP 连接已断开，正在尝试重新连接...');
          }
        } else if (newStatus === 'connected') {
          setNotifiedDisconnect(false);
          if (isRunning) {
            await feishuApi.sendMessage('服务已恢复：MCP 连接已重新建立');
          }
        }
      })
    );

    // 监听 MCP 重连成功事件
    unlistenFns.push(
      listen('mcp-reconnected', () => {
        setMcpStatus('connected');
        setNotifiedDisconnect(false);
        if (isRunning) {
          feishuApi.sendMessage('服务已恢复：MCP 连接已重新建立').catch(console.error);
        }
      })
    );

    return () => {
      clearTimeout(autoStartTimer);
      unlistenFns.forEach((fn) => fn.then((f) => f()));
    };
  }, [config, mcp.enabled]); // 依赖项

  return {
    // 状态
    isRunning,
    isRefreshing,
    messages,
    mcpStatus,
    // 方法
    pollMessages,
    handleLoadImage,
  };
};

export default usePolling;
