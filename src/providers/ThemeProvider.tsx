/**
 * 主题提供者
 * - 管理主题状态
 * - 监听系统主题变化
 * - 注入 CSS 变量
 * - 配置 Ant Design 主题
 */

import { useEffect, useMemo, createContext, useContext } from 'react';
import { ConfigProvider, theme } from 'antd';
import {
  useThemeStore,
  watchSystemTheme,
  applyTheme,
  type ThemeMode,
  type EffectiveTheme,
} from '../stores';

// Ant Design 中文语言包
import zhCN from 'antd/locale/zh_CN';

/**
 * 主题 Token 配置
 */
const THEME_TOKENS = {
  light: {
    colorPrimary: '#1677ff',
    colorBgContainer: '#ffffff',
    colorBgBase: '#f5f5f5',
    colorText: '#1f1f1f',
    colorTextSecondary: '#666666',
    colorBorder: '#d9d9d9',
  },
  dark: {
    colorPrimary: '#177ddc',
    colorBgContainer: '#141414',
    colorBgBase: '#0d0d0d',
    colorText: '#ffffff',
    colorTextSecondary: '#a6a6a6',
    colorBorder: '#424242',
  },
} as const;

/**
 * 主题上下文类型
 */
interface ThemeContextValue {
  /** 当前主题模式 (light/dark/system) */
  themeMode: ThemeMode;
  /** 实际生效的主题 (light/dark) */
  effectiveTheme: EffectiveTheme;
  /** 设置主题模式 */
  setThemeMode: (mode: ThemeMode) => void;
  /** 切换主题（快捷方法） */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 使用主题 Hook
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * 主题提供者组件
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 使用 Zustand Store
  const themeMode = useThemeStore((state) => state.theme);
  const effectiveTheme = useThemeStore((state) => state.effectiveTheme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  // 监听系统主题变化
  useEffect(() => {
    const unsubscribe = watchSystemTheme();
    return unsubscribe;
  }, []);

  // 应用主题到 DOM
  useEffect(() => {
    applyTheme(effectiveTheme);
    document.body.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  // Ant Design 主题配置
  const antdThemeConfig = useMemo(
    () => ({
      algorithm:
        effectiveTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: THEME_TOKENS[effectiveTheme],
    }),
    [effectiveTheme]
  );

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      effectiveTheme,
      setThemeMode: setTheme,
      toggleTheme,
    }),
    [themeMode, effectiveTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={antdThemeConfig} locale={zhCN}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
