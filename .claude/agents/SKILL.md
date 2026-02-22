# Feishu Claude App - Agent 配置

本项目使用的 Agent 分类整合。

## 架构类 Agent (architecture-specialist)

### 适用场景
- HTTP 适配器优化
- Tauri 配置管理
- 性能优化
- 底层框架设计

### 本次使用
- 修复 HTTP 请求间歇性错误
- 添加重试机制到 TauriAdapter
- 配置 Tauri capabilities

---

## 玩法实现类 Agent (gameplay-specialist)

### 适用场景
- React 组件开发
- 状态管理
- 前端逻辑实现
- UI 交互处理

### 本次使用
- 修复增量消息拉取问题
- 解决 useCallback stale closure 问题
- useState 改 useRef 优化

---

## Agent 使用建议

| 问题类型 | 推荐 Agent |
|---------|-----------|
| HTTP/网络请求问题 | architecture-specialist |
| React 状态/闭包问题 | gameplay-specialist |
| 渲染/着色器问题 | unity-rendering-specialist |
| AI 行为设计 | game-ai-specialist |
| 游戏系统设计 | game-design-specialist |
| 技术决策/架构 | technical-director |
| 项目管理 | game-producer |
| 市场推广 | marketing-specialist |
