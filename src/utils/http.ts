/**
 * Tauri HTTP 适配器
 * 用于绕过浏览器的 CORS 限制
 * 包含自动重试机制和详细的错误处理
 */
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AxiosAdapter } from "axios";

/**
 * 重试配置
 */
interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟时间（毫秒），使用指数退避 */
  baseDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 需要重试的 HTTP 状态码 */
  retryStatusCodes: number[];
  /** 需要重试的错误类型（错误消息中包含的关键字） */
  retryErrorPatterns: string[];
}

/** 默认重试配置 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  // 5xx 服务器错误和 429 限流
  retryStatusCodes: [429, 500, 502, 503, 504],
  // 网络错误和超时相关
  retryErrorPatterns: [
    "error sending request",
    "network error",
    "timeout",
    "connection refused",
    "connection reset",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
  ],
};

/**
 * 计算重试延迟（指数退避 + 随机抖动）
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // 指数退避: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // 添加随机抖动 (0-25%)
  const jitter = exponentialDelay * 0.25 * Math.random();
  const delay = exponentialDelay + jitter;
  return Math.min(delay, maxDelay);
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(
  error: unknown,
  statusCode?: number,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // 检查 HTTP 状态码
  if (statusCode !== undefined && retryConfig.retryStatusCodes.indexOf(statusCode) !== -1) {
    return true;
  }

  // 检查错误消息
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    for (let i = 0; i < retryConfig.retryErrorPatterns.length; i++) {
      const pattern = retryConfig.retryErrorPatterns[i];
      if (errorMessage.indexOf(pattern.toLowerCase()) !== -1) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const entries = Object.entries(params);
  const filteredEntries: [string, string][] = [];

  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];
    if (val !== undefined && val !== null) {
      filteredEntries.push([key, String(val)]);
    }
  }

  const queryString = filteredEntries
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join("&");

  if (!queryString) return url;

  const separator = url.indexOf("?") !== -1 ? "&" : "?";
  return url + separator + queryString;
}

/**
 * 将 Headers 转换为普通对象
 */
function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * 执行单次 HTTP 请求
 */
async function executeRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined
): Promise<{ response: Response; responseData: unknown }> {
  // 构建请求选项
  const fetchOptions: RequestInit = {
    method,
    headers: headers as HeadersInit,
  };

  if (body) {
    fetchOptions.body = body;
  }

  const response = await tauriFetch(url, fetchOptions);

  const textData = await response.text();

  let responseData: unknown;
  try {
    responseData = JSON.parse(textData);
  } catch {
    responseData = textData;
  }

  return { response, responseData };
}

/**
 * 创建 Tauri 适配器，用于 axios 与 Tauri 的 fetch API 集成
 * 包含自动重试机制
 */
export const createTauriAdapter = (retryConfig?: Partial<RetryConfig>): AxiosAdapter => {
  const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  return async (axiosConfig) => {
    console.log("TauriAdapter: config.params", axiosConfig.params);
    console.log("TauriAdapter: config.url", axiosConfig.url);

    let url = axiosConfig.url || "";
    if (axiosConfig.baseURL && url.indexOf("http") !== 0) {
      url = buildURL(buildFullPath(axiosConfig.baseURL, axiosConfig.url || ""), axiosConfig.params);
    } else {
      url = buildURL(url, axiosConfig.params);
    }

    const method = (axiosConfig.method?.toUpperCase() || "GET");
    const headers: Record<string, string> = {};
    const data = axiosConfig.data;

    // 处理 headers
    if (axiosConfig.headers) {
      const headersObj = axiosConfig.headers as Record<string, unknown>;
      const keys = Object.keys(headersObj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
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

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        let body: string | undefined;
        if (data) {
          if (typeof data === "string") {
            body = data;
          } else {
            body = JSON.stringify(data);
          }
        }

        const { response, responseData } = await executeRequest(
          url,
          method,
          headers,
          body
        );

        console.log(`TauriAdapter: 尝试 ${attempt + 1}/${config.maxRetries + 1}, 状态码: ${response.status}`);

        if (!response.ok) {
          // 检查是否需要重试
          if (attempt < config.maxRetries && isRetryableError(null, response.status, config)) {
            const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay);
            console.warn(
              `TauriAdapter: 请求失败 (状态码 ${response.status}), ` +
              `${Math.round(delay)}ms 后进行第 ${attempt + 2} 次重试...`
            );
            await sleep(delay);
            continue;
          }

          // 不可重试或已达到最大重试次数，抛出详细错误
          const error = new Error(
            `HTTP ${response.status} ${response.statusText}: 请求 ${method} ${url} 失败`
          ) as Error & {
            config: unknown;
            response: {
              data: unknown;
              status: number;
              statusText: string;
              headers: Record<string, string>;
            };
            code?: string;
          };
          error.config = axiosConfig;
          error.response = {
            data: responseData,
            status: response.status,
            statusText: response.statusText,
            headers: headersToObject(response.headers),
          };
          error.code = `HTTP_${response.status}`;
          throw error;
        }

        // 请求成功
        if (attempt > 0) {
          console.log(`TauriAdapter: 重试成功 (第 ${attempt + 1} 次尝试)`);
        }

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: headersToObject(response.headers),
          config: axiosConfig,
          request: {},
        };
      } catch (error) {
        lastError = error;

        // 如果已经是我们构造的 HTTP 错误，直接抛出
        if (error instanceof Error && error.message.indexOf("HTTP ") === 0) {
          throw error;
        }

        // 检查是否需要重试
        if (attempt < config.maxRetries && isRetryableError(error, undefined, config)) {
          const delay = calculateDelay(attempt, config.baseDelay, config.maxDelay);
          console.warn(
            `TauriAdapter: 网络错误 (${error instanceof Error ? error.message : String(error)}), ` +
            `${Math.round(delay)}ms 后进行第 ${attempt + 2} 次重试...`
          );
          await sleep(delay);
          continue;
        }

        // 不可重试或已达到最大重试次数
        console.error(`TauriAdapter: 请求失败，已重试 ${attempt} 次`, error);

        // 构造详细的错误信息
        const detailedError = new Error(
          `网络请求失败: ${method} ${url} - ` +
          (error instanceof Error ? error.message : String(error)) +
          (attempt > 0 ? ` (已重试 ${attempt} 次)` : "")
        ) as Error & {
          config: unknown;
          originalError: unknown;
          attempts: number;
        };
        detailedError.config = axiosConfig;
        detailedError.originalError = error;
        (detailedError as any).attempts = attempt + 1;
        throw detailedError;
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw lastError || new Error("请求失败: 未知错误");
  };
};
