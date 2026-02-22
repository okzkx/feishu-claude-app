import type { AppConfig } from "../types";

const CONFIG_KEY = "feishu-claude-config";

export const storage = {
  getConfig: (): AppConfig | null => {
    try {
      const data = localStorage.getItem(CONFIG_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setConfig: (config: AppConfig): void => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  clearConfig: (): void => {
    localStorage.removeItem(CONFIG_KEY);
  },
};
