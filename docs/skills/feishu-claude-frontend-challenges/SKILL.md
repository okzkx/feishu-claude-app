# 飞书 Claude 应用 - 前端技术难点

本文档记录飞书消息轮询应用前端开发中的技术难点和解决方案。

## 难点 1: CORS 跨域问题

### 问题描述
浏览器直接调用飞书 API 会被 CORS 策略阻止：
```
Access to XMLHttpRequest at 'https://open.feishu.cn/...' from origin 'http://localhost:1421'
has been blocked by CORS policy
```

### 解决方案
使用 Tauri HTTP 插件绕过 CORS：

```typescript
// src/utils/http.ts
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const createTauriAdapter = (): AxiosAdapter => {
  return async (config) => {
    const response = await tauriFetch(url, { method, headers, body });
    const textData = await response.text();
    return { data: JSON.parse(textData), ... };
  };
};

// 在 Axios 中使用
this.axiosInstance = axios.create({
  adapter: createTauriAdapter(),
});
```

### 配置要求
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    { "identifier": "http:default", "allow": [{ "url": "https://open.feishu.cn/**" }] }
  ]
}
```

## 难点 2: 飞书 API 参数

### 问题描述
飞书 API 参数命名和结构与预期不同，导致请求失败。

### 错误示例
```
"field_violations": [
  {"field": "container_id_type", "description": "container_id_type is required"},
  {"field": "container_id", "description": "container_id is required"}
]
```

### 解决方案
正确使用 API 参数：

```typescript
// 获取消息列表
GET /im/v1/messages?container_id_type=chat&container_id={chat_id}&order=Desc

// 获取群聊列表
GET /im/v1/chats?page_size=20

// 认证
POST /auth/v3/tenant_access_token/internal
Body: { "app_id": "xxx", "app_secret": "xxx" }
```

## 难点 3: 响应数据结构

### 问题描述
不同 API 的响应结构不同，直接访问会报错。

### 获取 Token 响应
```json
{
  "code": 0,
  "tenant_access_token": "t-xxx",  // 注意：不在 data 中
  "expire": 7200
}
```

### 获取消息列表响应
```json
{
  "code": 0,
  "data": {
    "items": [...]  // 在 data.items 中
  }
}
```

### 解决方案
分别处理不同的响应结构：

```typescript
// Token - 直接访问
const token = response.data.tenant_access_token;

// 消息列表 - 通过 data 访问
const items = response.data.data?.items || [];
```

## 难点 4: 消息内容解析

### 问题描述
消息内容是 JSON 字符串，需要解析才能获取文本。

### 原始数据
```json
{
  "body": {
    "content": "{\"text\":\"实际消息内容\"}"
  }
}
```

### 解决方案
```typescript
const parseContent = (content: string): string => {
  try {
    const parsed = JSON.parse(content);
    return parsed.text || content;
  } catch {
    return content;
  }
};

// 使用
const text = parseContent(item.body?.content || "");
```

## 难点 5: 时间戳处理

### 问题描述
飞书返回毫秒级时间戳，需要转换。

### 解决方案
```typescript
// 转换为秒级
createTime: parseInt(item.create_time) / 1000

// 显示
new Date(createTime * 1000).toLocaleString()

// 友好时间
const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`;
  return new Date(timestamp * 1000).toLocaleDateString();
};
```

## 难点 6: 消息排序

### 问题描述
默认返回的是旧消息在前，需要最新消息在前。

### 解决方案
```typescript
// 1. API 参数
params: { order: "Desc" }

// 2. 客户端排序
messages.sort((a, b) => parseInt(b.create_time) - parseInt(a.create_time));
```

## 难点 7: 消息类型过滤

### 问题描述
群聊包含多种消息类型（text, image, system），需要只显示文本消息。

### 解决方案
```typescript
// 过滤
const textMessages = messages.filter(m => m.msgType === 'text');

// 类型标签
<Tag color={item.msgType === 'text' ? 'blue' : 'default'}>
  {item.msgType}
</Tag>
```

## 难点 8: 配置持久化

### 问题描述
刷新页面后配置丢失。

### 解决方案
```typescript
// 保存
const saveConfig = (config: AppConfig) => {
  localStorage.setItem('feishu-claude-config', JSON.stringify(config));
};

// 加载
const loadConfig = (): AppConfig | null => {
  const data = localStorage.getItem('feishu-claude-config');
  return data ? JSON.parse(data) : null;
};

// 应用启动时加载
useEffect(() => {
  const saved = loadConfig();
  if (saved) {
    setConfig(saved);
    feishuApi.init(saved);
  }
}, []);
```

## 难点 9: Tauri 事件通信

### 问题描述
Rust 后端需要通知前端轮询事件。

### 后端发送
```rust
app.emit("poll-tick", ()).ok();
```

### 前端监听
```typescript
import { listen } from "@tauri-apps/api/event";

useEffect(() => {
  const unlisten = listen("poll-tick", async () => {
    await pollMessages();
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

## 难点 10: React 状态刷新机制

### 问题描述
使用 useRef 存储数据时，数据变化不会自动触发组件重渲染。导致：
1. 事件更新了 ref 中的数据，但界面没有刷新
2. 筛选/过滤后的数据（filteredFiles）没有正确反映最新状态
3. 文件从一个分类（页签）移动到另一个分类时，界面没有更新

### 错误示例
```typescript
// ❌ 错误：直接修改 ref 不会触发重渲染
const filesRef = useRef<DownloadFile[]>([]);

const handleFileStatusChanged = (data: any) => {
  const fileIndex = filesRef.current.findIndex(f => f.id === data.file_id);
  if (fileIndex !== -1) {
    filesRef.current[fileIndex] = { ...filesRef.current[fileIndex], status: data.status };
    // 没有触发重渲染，界面不会更新！
  }
};
```

### 解决方案：Ref + Version 模式

```typescript
// 使用 ref 存储数据，用 version 状态触发重渲染
const filesRef = useRef<DownloadFile[]>([]);
const [version, setVersion] = useState(0);

// 增加版本号，触发重渲染
const incrementVersion = useCallback(() => {
  setVersion(prev => prev + 1);
}, []);

// useMemo 依赖 version，当 version 变化时重新计算
const filteredFiles = useMemo(() => {
  let files = filesRef.current;
  switch (filterStatus) {
    case 'completed':
      return files.filter(f => f.status === FileStatus.COMPLETED);
    case 'downloading':
      return files.filter(f => f.status === FileStatus.DOWNLOADING);
    // ...
  }
  return files;
}, [version, filterStatus]); // 关键：version 作为依赖

// 事件处理时调用 incrementVersion
const handleFileStatusChanged = useCallback((data: any) => {
  const fileIndex = filesRef.current.findIndex(f => f.id === data.file_id);
  if (fileIndex !== -1) {
    filesRef.current[fileIndex] = {
      ...filesRef.current[fileIndex],
      status: data.status
    };
    // ✅ 触发重渲染，filteredFiles 会重新计算
    incrementVersion();
  }
}, [incrementVersion]);
```

### 关键点
1. **useRef 优势**：存储大量数据不会触发频繁渲染
2. **version 状态**：作为 useMemo 的依赖，控制何时重新计算
3. **始终刷新**：状态变化可能影响多个筛选结果（如文件从一个页签移动到另一个），应始终刷新

### 适用场景
- 大列表数据的懒加载和虚拟滚动
- 实时事件驱动的状态更新
- 多条件筛选的数据展示
