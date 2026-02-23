import { useState, useEffect } from "react";
import { ConfigProvider, theme, message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import ConfigPage from "./components/ConfigPage";
import MainPage from "./components/MainPage";
import { storage, feishuApi } from "./utils";
import type { AppConfig } from "./types";
import "./App.css";

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    // 加载保存的配置
    const loadConfig = async () => {
      const savedConfig = storage.getConfig();
      if (savedConfig) {
        setConfig(savedConfig);
        feishuApi.init(savedConfig);

        // 关键：同步配置到 Rust 后端，确保 MCP working_dir 正确
        try {
          await invoke('save_config', { config: savedConfig });
          console.log('[App] 配置已同步到后端');
        } catch (error) {
          console.error('[App] 同步配置到后端失败:', error);
        }
      }
      setLoading(false);
    };

    loadConfig();
  }, []);

  const handleConfigured = (newConfig: AppConfig) => {
    storage.setConfig(newConfig);
    setConfig(newConfig);
    feishuApi.init(newConfig);
    setShowConfig(false);
    message.success("配置已保存");
  };

  const handleBack = () => {
    setShowConfig(false);
  };

  const handleShowConfig = () => {
    setShowConfig(true);
  };

  if (loading) {
    return <div style={{ padding: 50, textAlign: "center" }}>加载中...</div>;
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
        },
      }}
    >
      <div className="app">
        {config && !showConfig ? (
          <MainPage config={config} onSettings={handleShowConfig} />
        ) : (
          <ConfigPage
            onConfigured={handleConfigured}
            initialConfig={config}
            onBack={config ? handleBack : undefined}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
