# 技术工作阶段报告

**项目**: Feishu Claude App
**日期**: 2026-02-22
**版本**: 0.1.0

---

## 工作摘要

本次工作阶段修复了两个关键 Bug：HTTP 请求间歇性错误和增量消息拉取失效问题。

---

## 问题 1: HTTP 请求间歇性错误

### 现象
```
http.ts:130  TauriAdapter: error error sending request for url
(https://open.feishu.cn/open-apis/im/v1/messages?...)
```

### 根因分析
1. 网络不稳定导致请求偶尔失败
2. 飞书 API 可能返回 429/5xx 错误
3. 原代码无重试机制，单次失败即报错

### 解决方案
在 `src/utils/http.ts` 添加重试机制：

| 特性 | 实现 |
|-----|------|
| 最大重试次数 | 3 次 (共 4 次尝试) |
| 延迟策略 | 指数退避 + 随机抖动 |
| 基础延迟 | 1000ms |
| 最大延迟 | 10000ms |
| 可重试状态码 | 429, 500, 502, 503, 504 |
| 可重试错误 | "error sending request", "timeout", "connection refused" 等 |

### 代码变更
- 文件: `src/utils/http.ts`
- 新增行数: ~200 行
- 主要新增函数: `shouldRetry()`, `sleep()`, 重试循环逻辑

---

## 问题 2: 增量消息拉取失效

### 现象
- 只有首次拉取的消息显示
- 后续新消息不会被检测到

### 根因分析
React `useCallback` 闭包问题：

```typescript
// 问题代码
const [lastMessageId, setLastMessageId] = useState<string | null>(null);

const pollMessages = useCallback(async () => {
  // 这里 lastMessageId 是闭包捕获的旧值
  if (msgs[0].messageId !== lastMessageId) { ... }
}, [lastMessageId]); // 依赖变化时重新创建，但事件监听器仍持有旧引用
```

### 解决方案
使用 `useRef` 替代 `useState`：

```typescript
// 修复代码
const lastMessageIdRef = useRef<string | null>(null);

const pollMessages = useCallback(async () => {
  // ref.current 总是获取最新值
  if (msgs[0].messageId !== lastMessageIdRef.current) { ... }
}, []); // 无需依赖 ref
```

### 代码变更
- 文件: `src/components/MainPage.tsx`
- 变更: `useState` → `useRef` for `lastMessageId` and `isFirstPoll`

---

## 其他变更

### Tauri 权限配置
- 文件: `src-tauri/capabilities/default.json`
- 新增: `https://open.larkoffice.com/**` 域名权限

---

## 测试验证

| 测试项 | 结果 |
|-------|------|
| TypeScript 类型检查 | ✅ 通过 |
| Vite 构建 | ✅ 成功 |
| 应用启动 | ✅ 正常 |
| MCP 命令执行 | ✅ 正常 |

---

## 团队协作

本次使用了 2 个 Agent 协作完成：

| Agent | 职责 |
|-------|------|
| architecture-specialist | HTTP 重试机制、Tauri 配置 |
| gameplay-specialist | React 状态管理、闭包问题修复 |

---

## 后续建议

1. **监控重试日志**: 观察生产环境重试频率，调整重试参数
2. **添加错误上报**: 将 HTTP 错误上报到监控系统
3. **单元测试**: 为 `http.ts` 重试逻辑添加单元测试
4. **E2E 测试**: 模拟网络异常场景的端到端测试

---

## 文件变更清单

| 文件 | 变更类型 | 行数 |
|-----|---------|------|
| src/utils/http.ts | 修改 | +198/-62 |
| src/components/MainPage.tsx | 修改 | +10/-14 |
| src-tauri/capabilities/default.json | 修改 | +3/-0 |
| src-tauri/gen/schemas/capabilities.json | 自动生成 | +1/-1 |

**总计**: 4 files, +279 insertions, -81 deletions
