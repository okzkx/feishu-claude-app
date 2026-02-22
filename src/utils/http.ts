/**
 * Tauri HTTP 适配器
 * 用于绕过浏览器的 CORS 限制
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AxiosAdapter } from "axios";

function buildFullPath(
  baseURL: string | undefined,
  requestedURL: string
): string {
  if (baseURL && !/^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(requestedURL)) {
    return baseURL.replace(/\/+$/, "") + "/" + requestedURL.replace(/^\/+/, "");
  }
  return requestedURL;
}

function buildURL(url: string, params?: Record<string, unknown>): string {
  if (!params) return url;

  const queryString = Object.entries(params)
    .filter(([, val]) => val !== undefined && val !== null)
    .map(
      ([key, val]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`
    )
    .join("&");

  if (!queryString) return url;

  const separator = url.includes("?") ? "&" : "?";
  return url + separator + queryString;
}

/**
 * 创建 Tauri 适配器，用于 axios 与 Tauri 的 fetch API 集成
 */
export const createTauriAdapter = (): AxiosAdapter => {
  return async (config) => {
    console.log("TauriAdapter: config.params", config.params);
    console.log("TauriAdapter: config.url", config.url);

    let url = config.url!;
    if (config.baseURL && !url.startsWith("http")) {
      url = buildURL(buildFullPath(config.baseURL, config.url!), config.params);
    } else {
      url = buildURL(url, config.params);
    }

    const method = config.method?.toUpperCase() || "GET";
    const headers: Record<string, string> = {};
    const data = config.data;

    // 处理 headers
    if (config.headers) {
      const headersObj = config.headers as Record<string, unknown>;
      for (const key of Object.keys(headersObj)) {
        const value = headersObj[key];
        if (typeof value === "string") {
          headers[key] = value;
        } else if (value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }
    }

    console.log("TauriAdapter: 最终 URL", url);
    console.log("TauriAdapter: 请求", method, url);

    try {
      let body: string | undefined;
      if (data) {
        if (typeof data === "string") {
          body = data;
        } else {
          body = JSON.stringify(data);
        }
      }

      const response = await tauriFetch(url, {
        method,
        headers,
        body,
      });

      console.log("TauriAdapter: response status", response.status);

      const textData = await response.text();
      console.log("TauriAdapter: raw text response", textData);

      let responseData: unknown;
      try {
        responseData = JSON.parse(textData);
        console.log("TauriAdapter: parsed JSON response", responseData);
      } catch {
        responseData = textData;
      }

      if (!response.ok) {
        const error = new Error(
          `Request failed with status code ${response.status}`
        ) as Error & {
          config: unknown;
          response: {
            data: unknown;
            status: number;
            statusText: string;
            headers: Record<string, string>;
          };
        };
        error.config = config;
        error.response = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        };
        throw error;
      }

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config,
        request: {},
      };
    } catch (error) {
      console.error("TauriAdapter: error", error);
      throw error;
    }
  };
};
