/**
 * 主题状态管理 Store
 *
 * 管理应用主题（亮色/暗色/跟随系统）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 主题类型
export type ThemeMode = Theme;
export type Theme = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

// 主题状态
export interface ThemeState {
  // 用户设置的主题
  theme: Theme;
  // 实际生效的主题（根据系统偏好计算）
  effectiveTheme: EffectiveTheme;
  // 是否正在跟随系统
  isFollowingSystem: boolean;
}

// 主题操作方法
export interface ThemeActions {
  // 设置主题
  setTheme: (theme: Theme) => void;
  // 更新实际生效的主题（根据系统偏好）
  updateEffectiveTheme: (prefersDark: boolean) => void;
  // 切换主题
  toggleTheme: () => void;
  // 重置主题
  reset: () => void;
}

// 初始状态
const initialState: ThemeState = {
  theme: 'system',
  effectiveTheme: 'light',
  isFollowingSystem: true,
};

// 创建 Store
export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTheme: (theme) => {
        set({
          theme,
          isFollowingSystem: theme === 'system',
        });

        // 如果不是跟随系统，立即更新 effectiveTheme
        if (theme !== 'system') {
          set({ effectiveTheme: theme });
        }
      },

      updateEffectiveTheme: (prefersDark) => {
        const { theme } = get();

        if (theme === 'system') {
          set({
            effectiveTheme: prefersDark ? 'dark' : 'light',
            isFollowingSystem: true,
          });
        }
      },

      toggleTheme: () => {
        const { theme } = get();
        const themes: Theme[] = ['light', 'dark', 'system'];
        const currentIndex = themes.indexOf(theme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        get().setTheme(nextTheme);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'feishu-claude-theme-store',
    }
  )
);

// 选择器 hooks
export const useCurrentTheme = () => useThemeStore((state) => state.theme);
export const useEffectiveTheme = () =>
  useThemeStore((state) => state.effectiveTheme);

// 监听系统主题变化的辅助函数
export const watchSystemTheme = () => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // 初始化时更新一次
  useThemeStore.getState().updateEffectiveTheme(mediaQuery.matches);

  // 监听变化
  const handler = (e: MediaQueryListEvent) => {
    useThemeStore.getState().updateEffectiveTheme(e.matches);
  };

  mediaQuery.addEventListener('change', handler);

  // 返回取消监听函数
  return () => mediaQuery.removeEventListener('change', handler);
};

// 应用主题到 DOM
export const applyTheme = (theme: EffectiveTheme) => {
  document.documentElement.setAttribute('data-theme', theme);

  // 如果使用 Ant Design，可以在这里动态切换 ConfigProvider
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
};

// 兼容旧代码的导出（使用 Zustand Store 实现）
export const themeStore = {
  getThemeMode: () => useThemeStore.getState().theme,
  setThemeMode: (mode: Theme) => useThemeStore.getState().setTheme(mode),
  getEffectiveTheme: () => useThemeStore.getState().effectiveTheme,
  watchSystemTheme: (callback: (theme: EffectiveTheme) => void) => {
    const unsubscribe = useThemeStore.subscribe((state, prevState) => {
      if (state.effectiveTheme !== prevState.effectiveTheme) {
        callback(state.effectiveTheme);
      }
    });

    // 同时监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      useThemeStore.getState().updateEffectiveTheme(e.matches);
    };
    mediaQuery.addEventListener('change', handler);

    return () => {
      unsubscribe();
      mediaQuery.removeEventListener('change', handler);
    };
  },
};
