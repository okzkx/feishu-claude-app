/**
 * MCP (Model Context Protocol) 状态管理 Store
 *
 * 管理 MCP 连接状态、执行结果和工作目录
 */

import { create } from 'zustand';
import type { TaskResult } from '../types';

// MCP 连接状态
export type McpConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

// MCP 状态
export interface McpState {
  // 连接状态
  status: McpConnectionStatus;
  // 是否已通知用户 MCP 断开
  hasNotifiedDisconnect: boolean;
  // 最后执行结果
  lastResult: TaskResult | null;
  // 当前工作目录
  workingDir: string;
  // 是否正在连接
  isConnecting: boolean;
  // 连接错误信息
  errorMessage: string | null;
  // 最后连接时间
  lastConnectedTime: number | null;
}

// MCP 操作方法
export interface McpActions {
  // 设置连接状态
  setStatus: (status: McpConnectionStatus) => void;
  // 连接中状态
  setConnecting: (isConnecting: boolean) => void;
  // 设置断开通知状态
  setNotifiedDisconnect: (notified: boolean) => void;
  // 设置最后执行结果
  setLastResult: (result: TaskResult | null) => void;
  // 设置工作目录
  setWorkingDir: (dir: string) => void;
  // 设置错误信息
  setErrorMessage: (message: string | null) => void;
  // 记录连接成功
  markConnected: () => void;
  // 记录断开连接
  markDisconnected: () => void;
  // 记录连接错误
  markError: (error: string) => void;
  // 检查是否已连接
  isConnected: () => boolean;
  // 重置状态
  reset: () => void;
}

// 初始状态
const initialState: McpState = {
  status: 'disconnected',
  hasNotifiedDisconnect: false,
  lastResult: null,
  workingDir: '.',
  isConnecting: false,
  errorMessage: null,
  lastConnectedTime: null,
};

// 创建 Store
export const useMcpStore = create<McpState & McpActions>()((set, get) => ({
  ...initialState,

  setStatus: (status) =>
    set((state) => ({
      status,
      // 如果状态变为已连接，清除错误信息
      errorMessage: status === 'connected' ? null : state.errorMessage,
      // 如果状态变为连接中，设置 isConnecting
      isConnecting: status === 'connecting',
      // 如果状态变为断开或错误，清除连接时间
      lastConnectedTime:
        status === 'disconnected' || status === 'error'
          ? null
          : state.lastConnectedTime,
    })),

  setConnecting: (isConnecting) => set({ isConnecting }),

  setNotifiedDisconnect: (notified) => set({ hasNotifiedDisconnect: notified }),

  setLastResult: (result) => set({ lastResult: result }),

  setWorkingDir: (dir) => set({ workingDir: dir }),

  setErrorMessage: (message) => set({ errorMessage: message }),

  markConnected: () =>
    set({
      status: 'connected',
      isConnecting: false,
      errorMessage: null,
      lastConnectedTime: Date.now(),
      hasNotifiedDisconnect: false,
    }),

  markDisconnected: () =>
    set({
      status: 'disconnected',
      isConnecting: false,
      lastConnectedTime: null,
    }),

  markError: (error) =>
    set({
      status: 'error',
      isConnecting: false,
      errorMessage: error,
    }),

  isConnected: () => get().status === 'connected',

  reset: () => set(initialState),
}));

// 选择器 hooks
export const useMcpStatus = () => useMcpStore((state) => state.status);
export const useMcpConnectionInfo = () =>
  useMcpStore((state) => ({
    status: state.status,
    isConnecting: state.isConnecting,
    workingDir: state.workingDir,
    errorMessage: state.errorMessage,
    lastConnectedTime: state.lastConnectedTime,
  }));
