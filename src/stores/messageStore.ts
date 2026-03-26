/**
 * 消息状态管理 Store
 *
 * 管理消息列表、最近消息和已处理消息 ID
 */

import { create } from 'zustand';
import type { Message } from '../types';

// 消息状态
export interface MessageState {
  // 消息记录列表（处理的指令消息）
  messages: Message[];
  // 最近收到的消息（包含所有类型）
  recentMessages: Message[];
  // 已处理的消息 ID 集合（用于去重）
  processedIds: Set<string>;
  // 图片 Blob URL 映射（imageKey -> blobUrl）
  imageBlobUrls: Record<string, string>;
  // 正在加载的图片集合
  loadingImages: Set<string>;
  // 最新消息 ID（用于增量检测）
  lastMessageId: string | null;
  // 是否首次轮询
  isFirstPoll: boolean;
}

// 消息操作方法
export interface MessageActions {
  // 添加消息到记录列表
  addMessage: (message: Message) => void;
  // 更新消息状态
  updateMessageStatus: (
    messageId: string,
    status: Message['status']
  ) => void;
  // 设置最近消息列表
  setRecentMessages: (messages: Message[]) => void;
  // 添加最近消息（增量更新）
  addRecentMessage: (message: Message) => void;
  // 标记消息为已处理
  markProcessed: (messageId: string) => void;
  // 检查消息是否已处理
  isProcessed: (messageId: string) => boolean;
  // 设置图片 Blob URL
  setImageBlobUrl: (imageKey: string, blobUrl: string) => void;
  // 设置图片加载状态
  setImageLoading: (imageKey: string, isLoading: boolean) => void;
  // 检查图片是否正在加载
  isImageLoading: (imageKey: string) => boolean;
  // 更新最新消息 ID
  setLastMessageId: (id: string | null) => void;
  // 设置是否首次轮询
  setIsFirstPoll: (isFirst: boolean) => void;
  // 清空消息记录
  clearMessages: () => void;
  // 清空最近消息
  clearRecentMessages: () => void;
  // 重置所有状态
  reset: () => void;
}

// 初始状态
const initialState: MessageState = {
  messages: [],
  recentMessages: [],
  processedIds: new Set(),
  imageBlobUrls: {},
  loadingImages: new Set(),
  lastMessageId: null,
  isFirstPoll: true,
};

// 创建 Store
export const useMessageStore = create<MessageState & MessageActions>()(
  (set, get) => ({
    ...initialState,

    addMessage: (message) =>
      set((state) => ({
        messages: [message, ...state.messages],
      })),

    updateMessageStatus: (messageId, status) =>
      set((state) => ({
        messages: state.messages.map((m) =>
          m.messageId === messageId ? { ...m, status } : m
        ),
      })),

    setRecentMessages: (messages) => set({ recentMessages: messages }),

    addRecentMessage: (message) =>
      set((state) => {
        // 去重并限制数量为 10
        const filtered = state.recentMessages.filter(
          (m) => m.messageId !== message.messageId
        );
        return {
          recentMessages: [message, ...filtered].slice(0, 10),
        };
      }),

    markProcessed: (messageId) =>
      set((state) => {
        const newSet = new Set(state.processedIds);
        newSet.add(messageId);
        return { processedIds: newSet };
      }),

    isProcessed: (messageId) => get().processedIds.has(messageId),

    setImageBlobUrl: (imageKey, blobUrl) =>
      set((state) => ({
        imageBlobUrls: {
          ...state.imageBlobUrls,
          [imageKey]: blobUrl,
        },
      })),

    setImageLoading: (imageKey, isLoading) =>
      set((state) => {
        const newSet = new Set(state.loadingImages);
        if (isLoading) {
          newSet.add(imageKey);
        } else {
          newSet.delete(imageKey);
        }
        return { loadingImages: newSet };
      }),

    isImageLoading: (imageKey) => get().loadingImages.has(imageKey),

    setLastMessageId: (id) => set({ lastMessageId: id }),

    setIsFirstPoll: (isFirst) => set({ isFirstPoll: isFirst }),

    clearMessages: () => set({ messages: [] }),

    clearRecentMessages: () => set({ recentMessages: [] }),

    reset: () =>
      set({
        ...initialState,
        processedIds: new Set(),
        loadingImages: new Set(),
      }),
  })
);

// 选择器 hooks
export const useMessages = () => useMessageStore((state) => state.messages);
export const useRecentMessages = () =>
  useMessageStore((state) => state.recentMessages);
export const useMessageCount = () =>
  useMessageStore((state) => ({
    messagesCount: state.messages.length,
    recentCount: state.recentMessages.length,
  }));
